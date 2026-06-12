import { describe, it, expect } from "vitest";
import { setupTool } from "../src/tools/setup.js";
import { ProviderRouter } from "../src/providers/providerRouter.js";
import { MockVisionProvider } from "../src/providers/mockVisionProvider.js";

function makeRouter() {
  const router = new ProviderRouter({ defaultProviderId: "mock" });
  router.register(new MockVisionProvider(), { priority: 10, enabled: true });
  return router;
}

describe("setupTool", () => {
  it("has correct name and schema", () => {
    const router = makeRouter();
    const tool = setupTool(router);
    expect(tool.name).toBe("glasses.setup");
    expect(tool.inputSchema).toBeDefined();
    expect(tool.description.length).toBeLessThan(800);
  });

  it("mock provider returns empty models with warning", async () => {
    const router = makeRouter();
    const tool = setupTool(router);
    const raw = await tool.handler({});

    const text = JSON.parse(raw.content[0].text);

    expect(text.ok).toBe(true);
    expect(text.result.models).toEqual([]);
    expect(text.warnings).toContain(
      'Provider "mock" does not support model discovery.'
    );
    expect(text.provider.name).toBe("mock");
  });

  it("accepts explicit provider parameter", async () => {
    const router = makeRouter();
    const tool = setupTool(router);
    const raw = await tool.handler({ provider: "mock" });

    const text = JSON.parse(raw.content[0].text);

    expect(text.ok).toBe(true);
    expect(text.result.models).toBeDefined();
    expect(text.provider.name).toBe("mock");
  });

  it("includes examples in tool spec", () => {
    const router = makeRouter();
    const tool = setupTool(router);
    expect(tool.examples).toBeDefined();
    expect(tool.examples!.length).toBeGreaterThan(0);
  });
});
