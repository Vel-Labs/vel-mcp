import { spawn, execSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";

export interface WorkerSpec {
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  idleTtlMs?: number;
  startupTimeoutMs?: number;
  maxMemoryMb?: number;
  maxRestarts?: number;
  restartWindowSec?: number;
}

export interface JsonlRequest {
  id?: string;
  op: string;
  [key: string]: unknown;
}

export interface JsonlResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string; details?: unknown };
  progress?: { current: number; total: number; message?: string };
}

export interface ProgressEvent {
  workerId: string;
  requestId: string;
  current: number;
  total: number;
  message?: string;
}

export interface WorkerLifecycleEvent {
  workerId: string;
  event: "starting" | "startup_timeout" | "started" | "crash" | "idle_stop" | "restart" | "max_restarts_exceeded" | "memory_warning";
  details?: Record<string, unknown>;
}

function getRssMb(pid: number): number | null {
  try {
    if (process.platform === "linux") {
      const statm = readFileSync(`/proc/${pid}/statm`, "utf8").trim().split(/\s+/);
      const residentPages = parseInt(statm[1], 10);
      if (!isNaN(residentPages)) return (residentPages * 4096) / (1024 * 1024);
    }
    if (process.platform === "darwin") {
      const out = execSync(`ps -o rss= -p ${pid}`, { encoding: "utf8", timeout: 2000 }).trim();
      const kb = parseInt(out, 10);
      if (!isNaN(kb)) return kb / 1024;
    }
  } catch {
    // process may have exited
  }
  return null;
}

export class JsonlWorkerClient extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, { resolve: (v: JsonlResponse) => void; reject: (e: Error) => void; timeout: NodeJS.Timeout }>();
  private idleTimer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private restartTimestamps: number[] = [];
  private started = false;
  private memCheckTimer: NodeJS.Timeout | null = null;

  constructor(private readonly spec: WorkerSpec) {
    super();
  }

  async request(payload: JsonlRequest, timeoutMs = 120_000): Promise<JsonlResponse> {
    await this.ensureStarted();
    const id = payload.id ?? randomUUID();
    const line = JSON.stringify({ ...payload, id });
    const proc = this.proc;
    if (!proc) throw new Error(`Worker ${this.spec.id} failed to start`);
    this.bumpIdleTimer();
    return await new Promise<JsonlResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(Object.assign(new Error(`Worker ${this.spec.id} request ${id} timed out after ${timeoutMs}ms`), { code: "WORKER_TIMEOUT" }));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      proc.stdin.write(`${line}\n`);
    });
  }

  cancel(requestId: string): void {
    const p = this.pending.get(requestId);
    if (!p) return;
    clearTimeout(p.timeout);
    this.pending.delete(requestId);
    p.reject(Object.assign(new Error(`Worker ${this.spec.id} request ${requestId} cancelled`), { code: "WORKER_CANCELLED" }));
  }

  cancelAll(): void {
    for (const id of [...this.pending.keys()]) {
      this.cancel(id);
    }
  }

  async ensureStarted(): Promise<void> {
    if (this.proc && !this.proc.killed) return;

    const now = Date.now();
    const windowMs = (this.spec.restartWindowSec ?? 60) * 1000;
    this.restartTimestamps = this.restartTimestamps.filter((t) => now - t < windowMs);
    const maxRestarts = this.spec.maxRestarts ?? 3;

    if (this.started && this.restartTimestamps.length >= maxRestarts) {
      this.emit("lifecycle", {
        workerId: this.spec.id,
        event: "max_restarts_exceeded",
        details: { restartCount: this.restartTimestamps.length, windowSec: this.spec.restartWindowSec }
      } satisfies WorkerLifecycleEvent);
      throw new Error(`Worker ${this.spec.id} exceeded max restarts (${maxRestarts} in ${this.spec.restartWindowSec}s)`);
    }

    const isRestart = this.started;
    this.restartTimestamps.push(now);
    this.started = true;

    if (isRestart) {
      this.emit("lifecycle", { workerId: this.spec.id, event: "restart" } satisfies WorkerLifecycleEvent);
    }
    this.emit("lifecycle", { workerId: this.spec.id, event: "starting" } satisfies WorkerLifecycleEvent);

    const proc = spawn(this.spec.command, this.spec.args ?? [], {
      cwd: this.spec.cwd,
      env: { ...process.env, ...(this.spec.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.proc = proc;

    const startupTimeoutMs = this.spec.startupTimeoutMs ?? 30_000;
    this.startupTimer = setTimeout(() => {
      this.emit("lifecycle", {
        workerId: this.spec.id,
        event: "startup_timeout",
        details: { timeoutMs: startupTimeoutMs }
      } satisfies WorkerLifecycleEvent);
      void this.stop();
    }, startupTimeoutMs);

    const rl = createInterface({ input: proc.stdout });
    rl.on("line", (line) => {
      if (this.startupTimer) {
        clearTimeout(this.startupTimer);
        this.startupTimer = null;
        this.emit("lifecycle", { workerId: this.spec.id, event: "started" } satisfies WorkerLifecycleEvent);
      }
      this.handleLine(line);
    });

    proc.stderr.on("data", (chunk) => this.emit("stderr", chunk.toString("utf8")));
    proc.on("exit", (code, signal) => {
      this.clearTimers();
      this.emit("lifecycle", {
        workerId: this.spec.id,
        event: "crash",
        details: { exitCode: code ?? undefined, signal: signal ?? undefined }
      } satisfies WorkerLifecycleEvent);
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`Worker ${this.spec.id} exited before response for ${id}`));
      }
      this.pending.clear();
      this.proc = null;
    });

    if (this.spec.maxMemoryMb) {
      this.startMemoryMonitor(this.spec.maxMemoryMb);
    }

    this.bumpIdleTimer();
  }

  async stop(): Promise<void> {
    this.clearTimers();
    if (this.proc && !this.proc.killed) {
      this.proc.kill("SIGTERM");
    }
    this.proc = null;
  }

  private clearTimers(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    if (this.memCheckTimer) clearInterval(this.memCheckTimer);
    this.memCheckTimer = null;
  }

  private handleLine(line: string): void {
    let parsed: JsonlResponse;
    try {
      parsed = JSON.parse(line) as JsonlResponse;
    } catch {
      this.emit("stderr", `Invalid JSONL worker stdout: ${line}\n`);
      return;
    }

    if (parsed.progress) {
      this.emit("progress", {
        workerId: this.spec.id,
        requestId: parsed.id ?? "unknown",
        current: parsed.progress.current,
        total: parsed.progress.total,
        message: parsed.progress.message
      } satisfies ProgressEvent);
      return;
    }

    if (!parsed.id) return;
    const pending = this.pending.get(parsed.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(parsed.id);
    pending.resolve(parsed);
    this.bumpIdleTimer();
  }

  private bumpIdleTimer(): void {
    if (!this.spec.idleTtlMs) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.emit("lifecycle", { workerId: this.spec.id, event: "idle_stop" } satisfies WorkerLifecycleEvent);
      void this.stop();
    }, this.spec.idleTtlMs);
  }

  private startMemoryMonitor(maxMemoryMb: number): void {
    if (this.memCheckTimer) return;
    this.memCheckTimer = setInterval(() => {
      const proc = this.proc;
      if (!proc || !proc.pid) return;
      const rssMb = getRssMb(proc.pid);
      if (rssMb !== null && rssMb > maxMemoryMb) {
        this.emit("stderr", `[${this.spec.id}] Memory warning: RSS ${rssMb.toFixed(0)}MB exceeds limit ${maxMemoryMb}MB\n`);
        this.emit("lifecycle", {
          workerId: this.spec.id,
          event: "memory_warning",
          details: { rssMb: Math.round(rssMb), maxMemoryMb }
        } satisfies WorkerLifecycleEvent);
      }
    }, 10_000);
  }
}

export class WorkerSupervisor extends EventEmitter {
  private workers = new Map<string, JsonlWorkerClient>();

  getOrCreate(spec: WorkerSpec): JsonlWorkerClient {
    const existing = this.workers.get(spec.id);
    if (existing) return existing;
    const worker = new JsonlWorkerClient(spec);
    worker.on("lifecycle", (event: WorkerLifecycleEvent) => this.emit("lifecycle", event));
    worker.on("progress", (event: ProgressEvent) => this.emit("progress", event));
    this.workers.set(spec.id, worker);
    return worker;
  }

  async stop(id: string): Promise<void> {
    const worker = this.workers.get(id);
    if (!worker) return;
    await worker.stop();
    this.workers.delete(id);
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.workers.keys()].map((id) => this.stop(id)));
  }
}
