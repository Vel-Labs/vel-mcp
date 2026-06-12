import { WorkerSupervisor, type JsonlWorkerClient, type JsonlRequest } from "@vel/core";
import type { AskInput, CompareInput, DescribeInput, DetectAnomaliesInput, ImageRef, InspectImageInput, InspectRegionInput, LocateInput, OcrInput, ReadDocumentInput, VideoScanInput } from "../schemas.js";
import { parseLocateAnythingAnswer } from "../parsers/locateAnything.js";
import type { VisionProvider, VisionProviderResult, OcrSpan } from "./types.js";
import { filterByRegion, mergeLinesByYBands, layoutSort } from "../services/ocrUtils.js";
import { discoverModels } from "../services/modelDiscovery.js";

export interface VelVisionConfig {
  python?: string;
  model?: string;
  providerId?: string;
  role?: string;
  workerCwd?: string;
  workerArgs?: string[];
}

export class VelVisionProvider implements VisionProvider {
  id: string;
  displayName: string;
  private worker: JsonlWorkerClient | null = null;
  private supervisor: WorkerSupervisor;
  private config: VelVisionConfig;
  private discovery = discoverModels();

  constructor(supervisor: WorkerSupervisor, config?: Partial<VelVisionConfig>) {
    this.supervisor = supervisor;
    this.config = {
      python: config?.python ?? process.env.VEL_VISION_PYTHON ?? "python3",
      model: config?.model ?? process.env.VEL_VISION_MODEL ?? "mlx-community/LocateAnything-3B-bf16",
      providerId: config?.providerId,
      role: config?.role,
      workerCwd: config?.workerCwd ?? undefined,
      workerArgs: config?.workerArgs,
    };
    this.id = this.config.providerId ?? "glasses-vision";
    this.displayName = `VEL Glasses vision provider — ${this.config.role ?? "vision"} (MLX)`;
  }

  async healthCheck() {
    const warnings: string[] = [licenseWarning()];
    const modelId = this.activeModel();

    const mlxBf16 = this.discovery.models.find((m) => m.id === modelId);
    if (mlxBf16) {
      return { ok: mlxBf16.status === "available", error: !mlxBf16.runtimeReady ? `Model ${modelId} is not runtime-ready. Run glasses.setup for install guidance.` : undefined, warnings };
    }

    if (process.env.FAKE_WORKER_MODE) {
      warnings.push("FAKE_WORKER_MODE is active — model weights are not loaded.");
      return { ok: true, warnings };
    }

    return { ok: true, warnings, details: { model: modelId } };
  }

  async setup(): Promise<VisionProviderResult<{ models: any[] }>> {
    return {
      provider: providerMeta(this.id),
      timingMs: 0,
      warnings: [licenseWarning()],
      data: { models: this.discovery.models },
    };
  }

  async inspectImage(input: InspectImageInput): Promise<VisionProviderResult<{ observations: string[] }>> {
    const started = Date.now();
    const response = await this.request({
      op: "describe",
      image: input.image,
      detail: input.detail,
      includeObjects: input.includeObjects,
      includeText: input.includeText,
      includeLayout: input.includeLayout,
    });
    if (!response.ok) return failure(started, response.error?.message ?? "VLM describe failed");
    const observations = [String((response.result as any)?.answer ?? "")];
    return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning()], data: { observations } };
  }

  async locate(input: LocateInput): Promise<VisionProviderResult<{ matches: ReturnType<typeof parseLocateAnythingAnswer>["matches"] }>> {
    const started = Date.now();
    const labels = input.labels?.length ? input.labels : undefined;
    const op = labels && input.targetType === "object" ? "detect" : input.targetType === "gui" ? "ground_gui" : input.outputType === "point" ? "point" : "ground_multi";
    const response = await this.request({ op, image: input.image, query: input.query, labels, outputType: input.outputType, maxResults: input.maxResults });
    if (!response.ok) return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning()], data: { matches: [] } };
    const rawAnswer = String((response.result as any)?.answer ?? "");
    const parsed = parseLocateAnythingAnswer(rawAnswer, { includeRawModelOutput: input.includeRawModelOutput });
    return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning(), ...parsed.warnings], data: { matches: parsed.matches } };
  }

  async ocr(input: OcrInput): Promise<VisionProviderResult<{ text: string; spans: OcrSpan[] }>> {
    const started = Date.now();
    const mode = input.mode ?? "localized";
    const response = await this.request({
      op: "detect_text",
      image: input.image,
      mode,
      mergeLines: input.mergeLines,
      regionNorm1000: input.regionNorm1000
    });
    if (!response.ok) return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning(), response.error?.message ?? "OCR failed"], data: { text: "", spans: [] } };
    const rawAnswer = String((response.result as any)?.answer ?? "");
    const parsed = parseLocateAnythingAnswer(rawAnswer, { includeRawModelOutput: false });
    let spans: OcrSpan[] = parsed.matches.map((m) => ({ text: m.label, bboxNorm1000: m.bboxNorm1000, confidence: m.confidence }));

    if (input.regionNorm1000) {
      spans = filterByRegion(spans, input.regionNorm1000 as [number, number, number, number]);
    }

    if (mode === "text_only") {
      return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning(), ...parsed.warnings], data: { text: spans.map((s) => s.text).join("\n"), spans: [] } };
    }

    if (input.mergeLines ?? true) {
      spans = mergeLinesByYBands(spans);
    }

    if (mode === "layout") {
      spans = layoutSort(spans);
    } else {
      spans = spans.map((s, i) => ({ ...s, readingOrder: i + 1 }));
    }

    return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning(), ...parsed.warnings], data: { text: spans.map((s) => s.text).join("\n"), spans } };
  }

  async inspectRegion(input: InspectRegionInput): Promise<VisionProviderResult<{ observations: string[]; region: { label: string; bboxNorm1000: [number, number, number, number]; confidence: number } }>> {
    return { provider: providerMeta(this.id), timingMs: 0, warnings: [licenseWarning(), "Region crop/remap is not implemented yet."], data: { observations: [], region: { label: "selected region", bboxNorm1000: input.regionNorm1000, confidence: 1 } } };
  }

  async compare(_input: CompareInput): Promise<VisionProviderResult<{ summary: string; changedRegions: [] }>> {
    return { provider: providerMeta(this.id), timingMs: 0, warnings: [licenseWarning(), "Compare mode is not implemented yet."], data: { summary: "not implemented", changedRegions: [] } };
  }

  async videoScan(_input: VideoScanInput): Promise<VisionProviderResult<{ frames: unknown[]; events: unknown[] }>> {
    return { provider: providerMeta(this.id), timingMs: 0, warnings: [licenseWarning(), "Video scan requires frame sampling implementation."], data: { frames: [], events: [] } };
  }

  async describe(input: DescribeInput): Promise<VisionProviderResult<{ description: string; style?: string }>> {
    const started = Date.now();
    const prompt = buildDescribePrompt(input.style);
    const response = await this.request({ op: "describe", image: input.image, prompt });
    if (!response.ok) return failure(started, response.error?.message ?? "VLM describe failed");
    return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning()], data: { description: String((response.result as any)?.answer ?? ""), style: input.style } };
  }

  async ask(input: AskInput): Promise<VisionProviderResult<{ answer: string; confidence?: number }>> {
    const started = Date.now();
    const response = await this.request({ op: "ask", image: input.image, question: input.question });
    if (!response.ok) return failure(started, response.error?.message ?? "VLM ask failed");
    return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning()], data: { answer: String((response.result as any)?.answer ?? "") } };
  }

  async readDocument(input: ReadDocumentInput): Promise<VisionProviderResult<{ pages: Array<{ pageNumber: number; text: string; spans?: OcrSpan[] }>; metadata: { totalPages: number; mode: string } }>> {
    const started = Date.now();
    // For now, treat document as an image and run OCR; multi-page PDF support is future work
    const ocrResult = await this.ocr({ image: input.document, mode: input.mode === "ocr" ? "text_only" : "localized", mergeLines: true });
    const pages = [{ pageNumber: 1, text: ocrResult.data.text, spans: ocrResult.data.spans }];
    return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning(), ...ocrResult.warnings], data: { pages, metadata: { totalPages: 1, mode: input.mode } } };
  }

  async detectAnomalies(input: DetectAnomaliesInput): Promise<VisionProviderResult<{ anomalies: Array<{ label: string; bboxNorm1000?: [number, number, number, number]; severity: string; description: string }> }>> {
    const started = Date.now();
    // For now, use pixel diff via ImageComparator; VLM-based anomaly detection is future work
    const { ImageComparator } = await import("../services/imageComparator.js");
    const comparator = new ImageComparator();
    const [before, after] = await Promise.all([
      this.loadBytes(input.expected),
      this.loadBytes(input.actual),
    ]);
    const pixelDiff = await comparator.pixelDiff(before, after, { threshold: input.sensitivity === "high" ? 0.05 : input.sensitivity === "low" ? 0.2 : 0.1 });
    const anomalies = pixelDiff.changedRegions.map((r, i) => ({
      label: r.label ?? `anomaly-${i + 1}`,
      bboxNorm1000: r.bboxNorm1000,
      severity: pixelDiff.diffPixels > 1000 ? "high" : "medium",
      description: r.evidence?.text ?? "Visual difference detected",
    }));
    return { provider: providerMeta(this.id), timingMs: Date.now() - started, warnings: [licenseWarning()], data: { anomalies } };
  }

  private async loadBytes(ref: ImageRef): Promise<Buffer> {
    if (ref.kind === "data_url") {
      const base64 = ref.value.split(",")[1];
      return Buffer.from(base64, "base64");
    }
    if (ref.kind === "file_path") {
      const { readFile } = await import("node:fs/promises");
      return readFile(ref.value);
    }
    throw new Error(`loadBytes not implemented for kind: ${ref.kind}`);
  }

  private getWorker(): JsonlWorkerClient {
    if (this.worker) return this.worker;
    const c = this.config;
    const model = this.activeModel();
    this.worker = this.supervisor.getOrCreate({
      id: this.id,
      command: c.python ?? "python3",
      args: c.workerArgs ?? ["-m", "vel_glasses_worker.main"],
      cwd: c.workerCwd ?? undefined,
      env: {
        VEL_VISION_MODEL: model,
      },
      idleTtlMs: Number(process.env.VEL_GLASSES_WORKER_IDLE_TTL_SECONDS ?? 600) * 1000
    });
    this.worker.on("stderr", (line) => process.stderr.write(`[${this.id}] ${line}`));
    return this.worker;
  }

  private async request(payload: JsonlRequest) {
    return await this.getWorker().request(payload, 180_000);
  }

  private activeModel(): string {
    return process.env.VEL_VISION_MODEL ?? this.config.model ?? "mlx-community/LocateAnything-3B-bf16";
  }
}

function buildDescribePrompt(style: string): string {
  switch (style) {
    case "concise":
      return "Describe this image in one sentence.";
    case "bullet":
      return "Describe this image as a bullet list of key elements.";
    case "alt-text":
      return "Write alt text for this image — concise, objective, under 150 characters.";
    case "detailed":
    default:
      return "Describe this image in detail, including objects, text, layout, and overall scene.";
  }
}

function providerMeta(providerId: string) {
  return { name: providerId, version: "0.1.0", mode: "mlx" };
}

function licenseWarning() {
  return "Vision models may have non-commercial license terms. Verify before use in production.";
}

function failure<T>(started: number, message: string): VisionProviderResult<T> {
  return { provider: providerMeta("glasses-vision"), timingMs: Date.now() - started, warnings: [licenseWarning(), message], data: {} as T };
}
