import { describe, it, expect } from "vitest";
import { safeJsonParse, redactForLog } from "../src/utils/json.js";

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    const result = safeJsonParse('{"a":1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it("returns error on invalid JSON", () => {
    const result = safeJsonParse("{bad}");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(Error);
  });
});

describe("redactForLog", () => {
  it("truncates long strings", () => {
    const long = "a".repeat(200);
    const result = redactForLog(long) as string;
    expect(result).toContain("redacted:200");
  });

  it("redacts sensitive keys", () => {
    const result = redactForLog({ apiKey: "secret123", name: "test" }) as Record<string, unknown>;
    expect(result.apiKey).toBe("<redacted>");
    expect(result.name).toBe("test");
  });

  it("redacts nested sensitive keys", () => {
    const obj = { nested: { password: "pw", data: "ok" } };
    const result = redactForLog(obj) as Record<string, unknown>;
    const nested = result.nested as Record<string, unknown>;
    expect(nested.password).toBe("<redacted>");
    expect(nested.data).toBe("ok");
  });
});
