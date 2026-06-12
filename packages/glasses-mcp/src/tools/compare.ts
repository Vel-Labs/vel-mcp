import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { CompareInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";
import { ImageComparator } from "../services/imageComparator.js";

export function compareTool(router: ProviderRouter, imageLoader: ImageLoader): VelToolSpec<typeof CompareInputSchema.shape> {
  const comparator = new ImageComparator();

  return {
    name: "glasses.compare",
    title: "Compare images",
    description: "Compare two images or screenshots and return structured changed regions. Supports metadata, pixel, OCR, and layout comparison modes.",
    inputSchema: CompareInputSchema.shape,
    handler: async (input) => {
      const before = await imageLoader.load(input.before);
      const after = await imageLoader.load(input.after);
      const mode = input.mode ?? "metadata";
      const provider = router.getForTool("compare", input.provider);

      let summary = "";
      const changedRegions: Array<{ label: string; bboxNorm1000?: [number, number, number, number]; confidence?: number; evidence?: { text?: string } }> = [];
      const warnings = [...before.warnings, ...after.warnings];
      let timingMs = 0;

      // Always compute metadata diff
      const metaDiff = await comparator.metadataDiff(before.meta, after.meta);

      if (mode === "metadata" || mode === "auto") {
        summary = metaDiff.sameHash
          ? "Images are identical (same hash)."
          : `Metadata diff: dimensions=${metaDiff.sameDimensions ? "same" : "different"}, format=${metaDiff.sameFormat ? "same" : "different"}, size=${metaDiff.sameSize ? "same" : "different"}`;
        if (!metaDiff.sameDimensions) {
          changedRegions.push({
            label: "dimension change",
            confidence: 1,
            evidence: { text: `${metaDiff.beforeWidth}x${metaDiff.beforeHeight} → ${metaDiff.afterWidth}x${metaDiff.afterHeight}` }
          });
        }
      }

      if (mode === "pixel" || mode === "auto") {
        const started = Date.now();
        const pixelDiff = await comparator.pixelDiff(before.imageBytes, after.imageBytes);
        timingMs += Date.now() - started;
        if (pixelDiff.changed) {
          summary = summary ? `${summary}; pixel diff: ${pixelDiff.diffPixels}/${pixelDiff.totalPixels} pixels changed` : `Pixel diff: ${pixelDiff.diffPixels}/${pixelDiff.totalPixels} pixels changed`;
          changedRegions.push(...pixelDiff.changedRegions);
        } else {
          summary = summary ? `${summary}; pixel diff: no significant changes` : "Pixel diff: no significant changes";
        }
      }

      if (mode === "ocr" || mode === "auto") {
        const started = Date.now();
        const beforeOcr = await provider.ocr({ image: input.before, mode: "text_only", mergeLines: true });
        const afterOcr = await provider.ocr({ image: input.after, mode: "text_only", mergeLines: true });
        timingMs += Date.now() - started;
        const ocrDiff = await comparator.ocrDiff(
          beforeOcr.data.spans.length ? beforeOcr.data.spans : [{ text: beforeOcr.data.text }],
          afterOcr.data.spans.length ? afterOcr.data.spans : [{ text: afterOcr.data.text }]
        );
        const addedCount = ocrDiff.added.length;
        const removedCount = ocrDiff.removed.length;
        if (addedCount || removedCount) {
          summary = summary ? `${summary}; OCR diff: ${addedCount} added, ${removedCount} removed` : `OCR diff: ${addedCount} added, ${removedCount} removed`;
          changedRegions.push(...ocrDiff.added.map((s, i) => ({
            label: `added text ${i + 1}`,
            bboxNorm1000: s.bboxNorm1000,
            confidence: 0.9,
            evidence: { text: s.text }
          })));
          changedRegions.push(...ocrDiff.removed.map((s, i) => ({
            label: `removed text ${i + 1}`,
            bboxNorm1000: s.bboxNorm1000,
            confidence: 0.9,
            evidence: { text: s.text }
          })));
        } else {
          summary = summary ? `${summary}; OCR diff: no text changes` : "OCR diff: no text changes";
        }
      }

      if (mode === "layout" || mode === "auto") {
        const started = Date.now();
        const beforeLocate = await provider.locate({ image: input.before, query: "all elements", outputType: "box", targetType: "any", maxResults: 10, includeRawModelOutput: false });
        const afterLocate = await provider.locate({ image: input.after, query: "all elements", outputType: "box", targetType: "any", maxResults: 10, includeRawModelOutput: false });
        timingMs += Date.now() - started;
        const layoutDiff = await comparator.layoutDiff(beforeLocate.data.matches, afterLocate.data.matches);
        if (!layoutDiff.sameLayout) {
          summary = summary ? `${summary}; layout diff: ${layoutDiff.moved.length} moved, ${layoutDiff.added.length} added, ${layoutDiff.removed.length} removed` : `Layout diff: ${layoutDiff.moved.length} moved, ${layoutDiff.added.length} added, ${layoutDiff.removed.length} removed`;
          changedRegions.push(...layoutDiff.moved.map((m) => ({
            label: `moved: ${m.label}`,
            bboxNorm1000: m.afterBbox,
            confidence: 0.8,
            evidence: { text: `Moved from [${m.beforeBbox.join(",")}] to [${m.afterBbox.join(",")}]` }
          })));
          changedRegions.push(...layoutDiff.added.map((r) => ({ ...r, label: `added: ${r.label}` })));
          changedRegions.push(...layoutDiff.removed.map((r) => ({ ...r, label: `removed: ${r.label}` })));
        } else {
          summary = summary ? `${summary}; layout diff: no changes` : "Layout diff: no changes";
        }
      }

      return toMcpJsonResult(envelope({
        summary,
        changedRegions,
        images: {
          before: { sha256: before.meta.sha256, width: before.meta.width, height: before.meta.height, mimeType: before.meta.mimeType },
          after: { sha256: after.meta.sha256, width: after.meta.width, height: after.meta.height, mimeType: after.meta.mimeType }
        }
      }, {
        provider: { name: "glasses-compare", version: "0.1.0" },
        timingMs,
        warnings
      }));
    }
  };
}
