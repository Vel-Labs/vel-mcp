import { describe, it, expect } from "vitest";
import { AuditLog } from "../src/audit/auditLog.js";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("AuditLog", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "vel-core-audit-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("appends events and verifies chain", async () => {
    const log = new AuditLog(dir);
    await log.append({ type: "test", package: "core", operation: "unit-test" });
    const result = await log.verifyChain();
    expect(result.ok).toBe(true);
  });

  it("hash chain links events", async () => {
    const log = new AuditLog(dir);
    const e1 = await log.append({ type: "a", package: "p", operation: "op1" });
    const e2 = await log.append({ type: "a", package: "p", operation: "op2" });
    expect(e2.previousHash).toBe(e1.eventHash);
    expect(e1.previousHash).toBeNull();
  });

  it("detects chaining failure", async () => {
    const log = new AuditLog(dir);
    await log.append({ type: "a", package: "p", operation: "op1" });
    await log.append({ type: "a", package: "p", operation: "op2" });

    const result = await log.verifyChain();
    expect(result.ok).toBe(true);

    const fs = await import("node:fs/promises");
    await fs.appendFile(join(dir, "audit.jsonl"), `${JSON.stringify({ timestamp: "bad", previousHash: "deadbeef", eventHash: "faked" })}\n`);
    const bad = await log.verifyChain();
    expect(bad.ok).toBe(false);
  });
});
