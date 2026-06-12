import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { ReadDocumentInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";

export function readDocumentTool(router: ProviderRouter, imageLoader: ImageLoader): VelToolSpec<typeof ReadDocumentInputSchema.shape> {
  return {
    name: "glasses.read_document",
    title: "Read document",
    description: "Process a document (image or PDF) and extract text, structure, and tables. Supports OCR, summarize, extract_tables, and full modes.",
    inputSchema: ReadDocumentInputSchema.shape,
    handler: async (input) => {
      const loaded = await imageLoader.load(input.document);
      const provider = router.getForTool("read_document", input.provider);
      if (!provider.readDocument) {
        throw new Error(`Provider ${provider.id} does not support read_document.`);
      }
      const result = await provider.readDocument(input);
      return toMcpJsonResult(envelope({
        pages: result.data.pages,
        metadata: result.data.metadata,
      }, {
        provider: result.provider,
        timingMs: result.timingMs,
        warnings: [...loaded.warnings, ...result.warnings],
      }));
    },
  };
}
