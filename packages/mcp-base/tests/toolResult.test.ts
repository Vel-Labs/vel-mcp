import { describe, it, expect } from "vitest";
import { envelope, errorEnvelope, toMcpJsonResult, toMcpErrorResult } from "../src/toolResult.js";

describe("envelope", () => {
  it("wraps result with schema version", () => {
    const e = envelope({ matches: [] });
    expect(e.schemaVersion).toBe("2026-06-06");
    expect(e.ok).toBe(true);
    expect(e.result).toEqual({ matches: [] });
  });

  it("includes provider metadata", () => {
    const e = envelope({}, { provider: { name: "mock", version: "0.1.0" }, timingMs: 42 });
    expect(e.provider).toEqual({ name: "mock", version: "0.1.0" });
    expect(e.timingMs).toBe(42);
  });
});

describe("errorEnvelope", () => {
  it("returns error shape", () => {
    const e = errorEnvelope({ code: "TEST", message: "fail" });
    expect(e.ok).toBe(false);
    expect(e.error?.code).toBe("TEST");
  });
});

describe("toMcpJsonResult", () => {
  it("returns MCP text content", () => {
    const result = toMcpJsonResult({ hello: "world" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ hello: "world" });
  });
});

describe("toMcpErrorResult", () => {
  it("wraps Error objects", () => {
    const result = toMcpErrorResult(new Error("boom"));
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.message).toBe("boom");
  });
});
