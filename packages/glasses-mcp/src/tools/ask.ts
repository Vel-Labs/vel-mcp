import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { AskInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";

export function askTool(router: ProviderRouter, imageLoader: ImageLoader): VelToolSpec<typeof AskInputSchema.shape> {
  return {
    name: "glasses.ask",
    title: "Ask about image",
    description: "Ask a free-form visual question about an image and receive a natural language answer.",
    inputSchema: AskInputSchema.shape,
    handler: async (input) => {
      const loaded = await imageLoader.load(input.image);
      const provider = router.getForTool("ask", input.provider);
      if (!provider.ask) {
        throw new Error(`Provider ${provider.id} does not support ask.`);
      }
      const result = await provider.ask(input);
      return toMcpJsonResult(envelope({
        answer: result.data.answer,
        confidence: result.data.confidence,
      }, {
        provider: result.provider,
        timingMs: result.timingMs,
        warnings: [...loaded.warnings, ...result.warnings],
      }));
    },
  };
}
