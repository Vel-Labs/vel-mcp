import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WorkerSupervisor, type WorkerLifecycleEvent, type ProgressEvent } from "../src/workers/workerSupervisor.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FAKE_WORKER = join(__dirname, "fake-worker.mjs");

function spec(overrides: Record<string, unknown> = {}) {
  return {
    id: `test-worker-${Math.random().toString(36).slice(2, 8)}`,
    command: "node",
    args: [FAKE_WORKER],
    idleTtlMs: 0,
    maxRestarts: 3,
    restartWindowSec: 60,
    startupTimeoutMs: 10_000,
    env: { FAKE_WORKER_MODE: "echo", ...overrides.env },
    ...overrides
  };
}

describe("WorkerSupervisor lifecycle", () => {
  let supervisor: WorkerSupervisor;

  beforeEach(() => {
    supervisor = new WorkerSupervisor();
  });

  afterEach(async () => {
    await supervisor.stopAll();
  });

  it("starts worker lazily on first request", async () => {
    const lifecycle: string[] = [];
    supervisor.on("lifecycle", (e: WorkerLifecycleEvent) => lifecycle.push(e.event));

    const worker = supervisor.getOrCreate(spec());
    const res = await worker.request({ op: "test" });

    expect(res.ok).toBe(true);
    expect(lifecycle).toContain("starting");
    expect(lifecycle).toContain("started");
  });

  it("emits progress events", async () => {
    const progressEvents: ProgressEvent[] = [];
    supervisor.on("progress", (e: ProgressEvent) => progressEvents.push(e));

    const worker = supervisor.getOrCreate(spec());
    await worker.request({ op: "test" });

    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    expect(progressEvents[0].current).toBe(1);
    expect(progressEvents[0].total).toBe(2);
  });

  it("handles crash on startup", async () => {
    const lifecycle: string[] = [];
    supervisor.on("lifecycle", (e: WorkerLifecycleEvent) => lifecycle.push(e.event));

    const worker = supervisor.getOrCreate(spec({ env: { FAKE_WORKER_MODE: "crash" } }));
    await expect(worker.request({ op: "test" })).rejects.toThrow();

    expect(lifecycle).toContain("starting");
    expect(lifecycle).toContain("crash");
  });

  it("restarts after crash", async () => {
    const lifecycle: string[] = [];
    supervisor.on("lifecycle", (e: WorkerLifecycleEvent) => lifecycle.push(e.event));

    const s = spec({ id: "restart-test", env: { FAKE_WORKER_MODE: "crash" } });
    const worker = supervisor.getOrCreate(s);
    await expect(worker.request({ op: "test" })).rejects.toThrow();
    expect(lifecycle).toContain("crash");

    // Same ID — second request triggers restart, but crash-mode worker crashes again
    await expect(worker.request({ op: "test" })).rejects.toThrow();

    expect(lifecycle).toContain("restart");
    expect(lifecycle).toContain("starting");
    // crashes after restart too, so we get another crash
    const crashes = lifecycle.filter((e) => e === "crash");
    expect(crashes.length).toBeGreaterThanOrEqual(2);
  });

  it("emits startup_timeout for slow worker", async () => {
    const lifecycle: string[] = [];
    supervisor.on("lifecycle", (e: WorkerLifecycleEvent) => lifecycle.push(e.event));

    const worker = supervisor.getOrCreate(spec({
      startupTimeoutMs: 500,
      env: { FAKE_WORKER_MODE: "slow-start", FAKE_WORKER_START_DELAY_MS: "40000" }
    }));
    await expect(worker.request({ op: "test" })).rejects.toThrow();

    expect(lifecycle).toContain("startup_timeout");
  }, 15_000);
});

describe("JsonlWorkerClient restart policy", () => {
  let supervisor: WorkerSupervisor;

  beforeEach(() => {
    supervisor = new WorkerSupervisor();
  });

  afterEach(async () => {
    await supervisor.stopAll();
  });

  it("exceeds max restarts", async () => {
    const lifecycle: string[] = [];
    supervisor.on("lifecycle", (e: WorkerLifecycleEvent) => lifecycle.push(e.event));

    const worker = supervisor.getOrCreate(spec({
      maxRestarts: 1,
      restartWindowSec: 300,
      env: { FAKE_WORKER_MODE: "crash" }
    }));

    // First crash
    await expect(worker.request({ op: "test" })).rejects.toThrow();
    expect(lifecycle).toContain("crash");

    // Second attempt should exceed maxRestarts=1
    await expect(worker.request({ op: "test" })).rejects.toThrow("max restarts");

    expect(lifecycle).toContain("max_restarts_exceeded");
  });
});
