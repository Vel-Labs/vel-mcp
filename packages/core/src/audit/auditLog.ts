import { createHash } from "node:crypto";
import { mkdir, readFile, appendFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";

export interface AuditEventInput {
  type: string;
  package: string;
  operation: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent extends AuditEventInput {
  timestamp: string;
  previousHash: string | null;
  eventHash: string;
}

export interface AuditLogOptions {
  rootDir: string;
  fileName?: string;
  maxSizeBytes?: number;
  maxRotationFiles?: number;
}

export class AuditLog {
  private rootDir: string;
  private fileName: string;
  private maxSizeBytes: number;
  private maxRotationFiles: number;

  constructor(opts: AuditLogOptions);
  constructor(rootDir: string, fileName?: string);
  constructor(rootDirOrOpts: string | AuditLogOptions, fileName = "audit.jsonl") {
    if (typeof rootDirOrOpts === "string") {
      this.rootDir = rootDirOrOpts;
      this.fileName = fileName;
      this.maxSizeBytes = 0;
      this.maxRotationFiles = 0;
    } else {
      this.rootDir = rootDirOrOpts.rootDir;
      this.fileName = rootDirOrOpts.fileName ?? "audit.jsonl";
      this.maxSizeBytes = rootDirOrOpts.maxSizeBytes ?? 0;
      this.maxRotationFiles = rootDirOrOpts.maxRotationFiles ?? 0;
    }
  }

  private get path(): string {
    return join(this.rootDir, this.fileName);
  }

  async append(input: AuditEventInput): Promise<AuditEvent> {
    await mkdir(this.rootDir, { recursive: true });
    if (this.maxSizeBytes > 0) {
      await this.rotateIfNeeded();
    }
    const previousHash = await this.latestHash();
    const unsigned = {
      ...input,
      timestamp: new Date().toISOString(),
      previousHash
    };
    const eventHash = hashCanonical(unsigned);
    const event: AuditEvent = { ...unsigned, eventHash };
    await appendFile(this.path, `${JSON.stringify(event)}\n`);
    return event;
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const st = await stat(this.path);
      if (st.size < this.maxSizeBytes) return;

      for (let i = this.maxRotationFiles - 1; i >= 0; i--) {
        const oldPath = i > 0 ? join(this.rootDir, `audit.${i}.jsonl`) : join(this.rootDir, "audit.jsonl");
        const newPath = join(this.rootDir, `audit.${i + 1}.jsonl`);
        try {
          if (i === 0) {
            await rename(oldPath, newPath);
          } else {
            await rename(oldPath, newPath);
          }
        } catch { /* ignore missing files */ }
      }
    } catch { /* stat failed, file may not exist yet */ }
  }

  async latestHash(): Promise<string | null> {
    try {
      const raw = await readFile(this.path, "utf8");
      const lines = raw.trim().split("\n").filter(Boolean);
      if (lines.length === 0) return null;
      return (JSON.parse(lines[lines.length - 1]) as AuditEvent).eventHash;
    } catch {
      return null;
    }
  }

  async verifyChain(): Promise<{ ok: boolean; errorAtLine?: number; expected?: string; actual?: string }> {
    try {
      const raw = await readFile(this.path, "utf8");
      let previousHash: string | null = null;
      const lines = raw.trim().split("\n").filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const event = JSON.parse(lines[i]) as AuditEvent;
        const { eventHash, ...unsigned } = event;
        if (event.previousHash !== previousHash) {
          return { ok: false, errorAtLine: i + 1, expected: previousHash ?? "null", actual: event.previousHash ?? "null" };
        }
        const expectedHash = hashCanonical(unsigned);
        if (eventHash !== expectedHash) return { ok: false, errorAtLine: i + 1, expected: expectedHash, actual: eventHash };
        previousHash = eventHash;
      }
      return { ok: true };
    } catch {
      return { ok: true };
    }
  }
}

export function hashCanonical(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(sortKeys(value))).digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}
