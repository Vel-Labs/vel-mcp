import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../src/providers/providerRegistry.js";
import type { NamedProvider, ProviderHealth } from "../src/providers/providerRegistry.js";

interface TestProvider extends NamedProvider {
  value: string;
}

describe("ProviderRegistry", () => {
  it("registers and retrieves providers", () => {
    const registry = new ProviderRegistry<TestProvider>();
    const p = { id: "test", value: "hello" };
    registry.register(p);
    expect(registry.get("test")).toBe(p);
  });

  it("throws on duplicate registration", () => {
    const registry = new ProviderRegistry<TestProvider>();
    registry.register({ id: "dup", value: "a" });
    expect(() => registry.register({ id: "dup", value: "b" })).toThrow("Provider already registered");
  });

  it("throws on unknown provider", () => {
    const registry = new ProviderRegistry<TestProvider>();
    expect(() => registry.get("nope")).toThrow("Unknown provider");
  });

  it("lists all providers", () => {
    const registry = new ProviderRegistry<TestProvider>();
    registry.register({ id: "a", value: "1" });
    registry.register({ id: "b", value: "2" });
    expect(registry.list()).toHaveLength(2);
  });

  it("supports health checks", async () => {
    const registry = new ProviderRegistry<NamedProvider>();
    const ok: ProviderHealth = { ok: true };
    registry.register({ id: "healthy", healthCheck: async () => ok });
    const p = registry.get("healthy");
    const result = await p.healthCheck!();
    expect(result.ok).toBe(true);
  });
});
