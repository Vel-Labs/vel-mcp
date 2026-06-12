import { describe, it, expect } from "vitest";
import { validateVelConfig } from "../src/config/loadConfig.js";

describe("validateVelConfig", () => {
  it("throws on missing vel section", () => {
    expect(() => validateVelConfig({} as any)).toThrow("missing 'vel' section");
  });

  it("accepts valid config", () => {
    const cfg = {
      vel: { home: "~", artifactStore: "/tmp/a", auditStore: "/tmp/b", workerIdleTtlSeconds: 300, logLevel: "info" },
      modules: {}
    };
    expect(() => validateVelConfig(cfg)).not.toThrow();
  });

  it("defaults missing artifactStore and auditStore", () => {
    const cfg = { vel: { home: "~", workerIdleTtlSeconds: 300, logLevel: "info" }, modules: {} } as any;
    expect(() => validateVelConfig(cfg)).not.toThrow();
    expect(cfg.vel.artifactStore).toBe("~/.vel/artifacts");
    expect(cfg.vel.auditStore).toBe("~/.vel/audit");
    expect(cfg.vel.worker).toBeDefined();
    expect(cfg.vel.worker.maxRestarts).toBe(3);
  });
});
