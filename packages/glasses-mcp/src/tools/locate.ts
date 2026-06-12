import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { LocateInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";

export function locateTool(router: ProviderRouter, imageLoader: ImageLoader): VelToolSpec<typeof LocateInputSchema.shape> {
  return {
    name: "glasses.locate",
    title: "Locate visual target",
    description: "Locate an object, text span, GUI element, point, or region in an image. Returns normalized [0,1000] coordinates and optional pixel coordinates.",
    inputSchema: LocateInputSchema.shape,
    handler: async (input) => {
      const loaded = await imageLoader.load(input.image);
      const result = await router.getForTool("locate", input.provider).locate(input);
      return toMcpJsonResult(envelope(result.data, {
        provider: result.provider,
        timingMs: result.timingMs,
        warnings: [...loaded.warnings, ...result.warnings]
      }));
    }
  };
}
