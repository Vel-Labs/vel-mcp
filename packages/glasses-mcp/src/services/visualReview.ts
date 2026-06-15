import type { ArtifactStore } from "@vel/core";
import type { ImageRef, ReviewVisualInput } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "./imageLoader.js";
import { RegionCropper } from "./regionCropper.js";
import type { LocalizationResult, OcrSpan } from "../providers/types.js";

export interface VisualReviewResult {
  summary: string;
  mode: ReviewVisualInput["mode"];
  image: {
    sha256: string;
    width?: number;
    height?: number;
    mimeType?: string;
    source: { kind: string; value: string };
  };
  wholeImage: string[];
  focusArea?: {
    query: string;
    matches: LocalizationResult[];
    selected?: {
      bboxNorm1000?: [number, number, number, number];
      centerNorm1000?: [number, number];
      notes: string[];
      cropArtifactId?: string;
    };
  };
  text?: {
    text: string;
    spans: OcrSpan[];
  };
  uncertainty: string[];
  nextActions: string[];
}

export interface VisualReviewEnvelope {
  data: VisualReviewResult;
  provider: { name: string; version?: string; mode?: string };
  timingMs: number;
  warnings: string[];
}

export class VisualReviewService {
  private readonly cropper: RegionCropper;

  constructor(
    private readonly router: ProviderRouter,
    private readonly imageLoader: ImageLoader,
    private readonly artifactStore: ArtifactStore
  ) {
    this.cropper = new RegionCropper(artifactStore);
  }

  async review(input: ReviewVisualInput): Promise<VisualReviewEnvelope> {
    const started = Date.now();
    const image = imageRefFromInput(input);
    const loaded = await this.imageLoader.load(image);
    const warnings = [...loaded.warnings];
    const uncertainty: string[] = [];

    const vlm = this.router.getForTool("inspect_image");
    const inspect = await vlm.inspectImage({
      image,
      detail: input.detail,
      includeObjects: true,
      includeText: true,
      includeLayout: true,
    });
    warnings.push(...inspect.warnings);
    const wholeImage = inspect.data.observations ?? [];

    let focusArea: VisualReviewResult["focusArea"];
    if (input.focus) {
      const grounding = this.router.getForTool("locate");
      const located = await grounding.locate({
        image,
        query: input.focus,
        targetType: input.mode === "target_check" ? "gui" : "any",
        outputType: "both",
        maxResults: 5,
        includeRawModelOutput: false,
      });
      warnings.push(...located.warnings);
      const matches = located.data.matches ?? [];
      const selected = matches.find((match) => match.bboxNorm1000) ?? matches[0];
      focusArea = { query: input.focus, matches };

      if (selected?.bboxNorm1000 && loaded.meta.width && loaded.meta.height) {
        const crop = await this.cropper.cropRegion(
          loaded.imageBytes,
          loaded.meta.mimeType ?? "image/png",
          loaded.meta.width,
          loaded.meta.height,
          selected.bboxNorm1000
        );
        warnings.push(...crop.warnings);
        const regionInspect = await vlm.inspectImage({
          image: { kind: "file_path", value: this.artifactStore.dataPath(crop.cropArtifactId), mimeType: crop.cropArtifactRef.mimeType },
          detail: input.detail === "low" ? "medium" : input.detail,
          includeObjects: true,
          includeText: true,
          includeLayout: true,
        });
        warnings.push(...regionInspect.warnings);
        focusArea.selected = {
          bboxNorm1000: selected.bboxNorm1000,
          centerNorm1000: selected.centerNorm1000,
          notes: regionInspect.data.observations ?? [],
          cropArtifactId: crop.cropArtifactId,
        };
      } else if (matches.length === 0) {
        uncertainty.push(`No focus match found for "${input.focus}".`);
      } else {
        uncertainty.push(`Focus match for "${input.focus}" did not include a box for region inspection.`);
      }
    }

    const shouldOcr = input.includeOcr ?? ["ui_review", "target_check", "design_revision"].includes(input.mode);
    let text: VisualReviewResult["text"];
    if (shouldOcr) {
      const ocrProvider = this.router.getForTool("ocr");
      const ocr = await ocrProvider.ocr({ image, mode: "layout", mergeLines: true });
      warnings.push(...ocr.warnings);
      text = { text: ocr.data.text, spans: ocr.data.spans };
    }

    if (wholeImage.length === 0) uncertainty.push("Whole-image inspection returned no observations.");
    const nextActions = buildNextActions(input, focusArea, text);
    const summary = buildSummary(input, wholeImage, focusArea, text);

    return {
      data: {
        summary,
        mode: input.mode,
        image: {
          sha256: loaded.meta.sha256,
          width: loaded.meta.width,
          height: loaded.meta.height,
          mimeType: loaded.meta.mimeType,
          source: loaded.meta.source,
        },
        wholeImage,
        focusArea,
        text,
        uncertainty,
        nextActions,
      },
      provider: { name: "glasses-review", version: "0.1.0" },
      timingMs: Date.now() - started,
      warnings,
    };
  }
}

function imageRefFromInput(input: ReviewVisualInput): ImageRef {
  if (Boolean(input.image) === Boolean(input.screenshotArtifactId)) {
    throw new Error("Provide exactly one of image or screenshotArtifactId.");
  }
  if (input.image) return input.image;
  return { kind: "artifact_id", value: input.screenshotArtifactId!, mimeType: "image/png" };
}

function buildSummary(
  input: ReviewVisualInput,
  wholeImage: string[],
  focusArea: VisualReviewResult["focusArea"],
  text: VisualReviewResult["text"]
): string {
  if (input.focus && focusArea?.selected) return `Reviewed the full image and inspected the focused area "${input.focus}".`;
  if (input.focus && focusArea?.matches.length) return `Reviewed the full image and found candidate matches for "${input.focus}".`;
  if (input.focus) return `Reviewed the full image but did not find a region for "${input.focus}".`;
  if (text?.text) return "Reviewed the full image and extracted visible text.";
  if (wholeImage.length) return "Reviewed the full image.";
  return "Visual review completed with limited observations.";
}

function buildNextActions(
  input: ReviewVisualInput,
  focusArea: VisualReviewResult["focusArea"],
  text: VisualReviewResult["text"]
): string[] {
  const actions: string[] = [];
  if (input.focus && !focusArea?.selected) actions.push("Try a more specific focus phrase or provide a region.");
  if (input.mode === "target_check" && focusArea?.selected?.centerNorm1000) actions.push("Use centerNorm1000 as the candidate target point; do not click automatically.");
  if (["ui_review", "design_revision"].includes(input.mode) && text && text.spans.length === 0) actions.push("Run a text-focused OCR pass if copy accuracy is important.");
  if (actions.length === 0) actions.push("Use the structured notes and coordinates as visual evidence for the next design or QA step.");
  return actions;
}
