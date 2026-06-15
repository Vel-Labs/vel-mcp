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

  it("registers glasses-grounding from environment without a config file", async () => {
    const previousProvider = process.env.VEL_GLASSES_PROVIDER;
    const previousModel = process.env.VEL_VISION_MODEL;
    const previousPython = process.env.VEL_VISION_PYTHON;

    process.env.VEL_GLASSES_PROVIDER = "glasses-grounding";
    process.env.VEL_VISION_MODEL = "mlx-community/LocateAnything-3B-bf16";
    process.env.VEL_VISION_PYTHON = "python3";

    try {
      const { router, supervisor } = createGlassesServer({ config: undefined });
      expect(router.get("glasses-grounding").id).toBe("glasses-grounding");
      expect(router.getForTool("locate").id).toBe("glasses-grounding");
      await supervisor.stopAll();
    } finally {
      if (previousProvider === undefined) delete process.env.VEL_GLASSES_PROVIDER;
      else process.env.VEL_GLASSES_PROVIDER = previousProvider;
      if (previousModel === undefined) delete process.env.VEL_VISION_MODEL;
      else process.env.VEL_VISION_MODEL = previousModel;
      if (previousPython === undefined) delete process.env.VEL_VISION_PYTHON;
      else process.env.VEL_VISION_PYTHON = previousPython;
    }
  });
});
