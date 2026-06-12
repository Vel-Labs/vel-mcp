import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { DescribeInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";

export function describeTool(router: ProviderRouter, imageLoader: ImageLoader): VelToolSpec<typeof DescribeInputSchema.shape> {
  return {
    name: "glasses.describe",
    title: "Describe image",
    description: "Generate a natural language description of an image. Supports concise, detailed, bullet, and alt-text styles.",
    inputSchema: DescribeInputSchema.shape,
    handler: async (input) => {
      const loaded = await imageLoader.load(input.image);
      const provider = router.getForTool("describe", input.provider);
      if (!provider.describe) {
        throw new Error(`Provider ${provider.id} does not support describe.`);
      }
      const result = await provider.describe(input);
      return toMcpJsonResult(envelope({
        description: result.data.description,
        style: result.data.style,
      }, {
        provider: result.provider,
        timingMs: result.timingMs,
        warnings: [...loaded.warnings, ...result.warnings],
      }));
    },
  };
}
