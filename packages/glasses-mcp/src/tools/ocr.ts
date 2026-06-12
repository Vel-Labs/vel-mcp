import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { OcrInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";

export function ocrTool(router: ProviderRouter, imageLoader: ImageLoader): VelToolSpec<typeof OcrInputSchema.shape> {
  return {
    name: "glasses.ocr",
    title: "OCR image",
    description: "Extract text from an image. Can return text only, localized spans, or layout-oriented spans depending on mode.",
    inputSchema: OcrInputSchema.shape,
    handler: async (input) => {
      const loaded = await imageLoader.load(input.image);
      const result = await router.getForTool("ocr", input.provider).ocr(input);
      return toMcpJsonResult(envelope(result.data, {
        provider: result.provider,
        timingMs: result.timingMs,
        warnings: [...loaded.warnings, ...result.warnings]
      }));
    }
  };
}
