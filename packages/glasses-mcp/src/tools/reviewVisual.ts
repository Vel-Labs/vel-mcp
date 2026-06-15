import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { ReviewVisualInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";
import { VisualReviewService } from "../services/visualReview.js";
import type { ArtifactStore } from "@vel/core";

export function reviewVisualTool(
  router: ProviderRouter,
  imageLoader: ImageLoader,
  artifactStore: ArtifactStore
): VelToolSpec<typeof ReviewVisualInputSchema.shape> {
  const reviewer = new VisualReviewService(router, imageLoader, artifactStore);

  return {
    name: "glasses.review_visual",
    title: "Review visual artifact",
    description: "Orchestrate whole-image inspection, optional focused localization, region inspection, and OCR for screenshots, UI, and design review.",
    inputSchema: ReviewVisualInputSchema.shape,
    handler: async (input) => {
      const result = await reviewer.review(input);
      return toMcpJsonResult(envelope(result.data, {
        provider: result.provider,
        timingMs: result.timingMs,
        warnings: result.warnings,
      }));
    },
  };
}
