import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { InspectImageInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";

export function inspectImageTool(router: ProviderRouter, imageLoader: ImageLoader): VelToolSpec<typeof InspectImageInputSchema.shape> {
  return {
    name: "glasses.inspect_image",
    title: "Inspect image",
    description: "Return structured observations about an image: visible text, objects, layout, and uncertainty. Use for perception, not broad creative interpretation.",
    inputSchema: InspectImageInputSchema.shape,
    handler: async (input) => {
      const loaded = await imageLoader.load(input.image);
      const result = await router.getForTool("inspect_image", input.provider).inspectImage(input);
      return toMcpJsonResult(envelope(result.data, {
        provider: result.provider,
        timingMs: result.timingMs,
        warnings: [...loaded.warnings, ...result.warnings]
      }));
    }
  };
}
