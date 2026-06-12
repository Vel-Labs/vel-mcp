import type { ProviderHealth, NamedProvider } from "@vel/core";
import type { CompareInput, ImageRef, InspectImageInput, InspectRegionInput, LocateInput, OcrInput, VideoScanInput, DescribeInput, AskInput, ReadDocumentInput, DetectAnomaliesInput } from "../schemas.js";
import type { ModelDiscovery } from "../services/modelDiscovery.js";

export { ModelDiscovery };

export interface ImageSize {
  width: number;
  height: number;
}

export interface VisionEvidence {
  text?: string;
  rawModelOutput?: string;
  cropArtifactId?: string;
}

export interface LocalizationResult {
  label: string;
  bboxNorm1000?: [number, number, number, number];
  centerNorm1000?: [number, number];
  bboxPx?: [number, number, number, number];
  centerPx?: [number, number];
  confidence?: number;
  evidence?: VisionEvidence;
}

export interface OcrSpan {
  text: string;
  bboxNorm1000?: [number, number, number, number];
  confidence?: number;
  readingOrder?: number;
}

export interface VisionProviderResult<T> {
  provider: { name: string; version?: string; mode?: string };
  timingMs: number;
  warnings: string[];
  data: T;
}

export interface VisionProvider extends NamedProvider {
  inspectImage(input: InspectImageInput): Promise<VisionProviderResult<{ observations: string[]; image?: ImageRef }>>;
  locate(input: LocateInput): Promise<VisionProviderResult<{ matches: LocalizationResult[] }>>;
  ocr(input: OcrInput): Promise<VisionProviderResult<{ text: string; spans: OcrSpan[] }>>;
  inspectRegion(input: InspectRegionInput): Promise<VisionProviderResult<{ observations: string[]; region: LocalizationResult }>>;
  compare(input: CompareInput): Promise<VisionProviderResult<{ summary: string; changedRegions: LocalizationResult[] }>>;
  videoScan(input: VideoScanInput): Promise<VisionProviderResult<{ frames: unknown[]; events: unknown[] }>>;
  describe?(input: DescribeInput): Promise<VisionProviderResult<{ description: string; style?: string }>>;
  ask?(input: AskInput): Promise<VisionProviderResult<{ answer: string; confidence?: number }>>;
  readDocument?(input: ReadDocumentInput): Promise<VisionProviderResult<{ pages: Array<{ pageNumber: number; text: string; spans?: OcrSpan[] }>; metadata: { totalPages: number; mode: string } }>>;
  detectAnomalies?(input: DetectAnomaliesInput): Promise<VisionProviderResult<{ anomalies: Array<{ label: string; bboxNorm1000?: [number, number, number, number]; severity: string; description: string }> }>>;
  healthCheck?: () => Promise<ProviderHealth>;
  setup?(): Promise<VisionProviderResult<{ models: ModelDiscovery[] }>>;
}
