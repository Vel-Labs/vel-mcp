import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(__dirname, "../dist/cli.js");

describe("G12 — CLI", () => {
  it("vel-glasses --help exits 0", () => {
    const out = execSync(`node ${CLI} --help`, { encoding: "utf-8" });
    expect(out).toContain("inspect");
    expect(out).toContain("describe");
    expect(out).toContain("ask");
    expect(out).toContain("locate");
    expect(out).toContain("ocr");
    expect(out).toContain("providers");
  });

  it("vel-glasses providers returns JSON with mock provider", () => {
    const out = execSync(`node ${CLI} providers`, { encoding: "utf-8" });
    const parsed = JSON.parse(out);
    expect(parsed.providers).toBeDefined();
    expect(parsed.providers.some((p: any) => p.id === "mock")).toBe(true);
  });

  it("vel-glasses health checks mock provider", () => {
    const out = execSync(`node ${CLI} health mock`, { encoding: "utf-8" });
    const parsed = JSON.parse(out);
    expect(parsed.provider).toBe("mock");
    expect(parsed.health.ok).toBe(true);
  });
});
