import { describe, it, expect } from "vitest";
import { createGlassesServer } from "../src/server.js";
import { listProvidersTool } from "../src/tools/listProviders.js";

describe("glasses.list_providers", () => {
  it("returns registered providers with capabilities", async () => {
    const { router } = createGlassesServer();
    const tool = listProvidersTool(router);
    const result = await tool.handler({});
    const content = result.content[0] as { type: string; text: string };
    expect(content.type).toBe("text");
    const parsed = JSON.parse(content.text);
    expect(parsed.result.providers).toBeDefined();
    expect(parsed.result.providers.length).toBeGreaterThanOrEqual(1);
    expect(parsed.result.providers[0].id).toBeDefined();
    expect(parsed.result.providers[0].capabilities).toBeDefined();
  });
});
