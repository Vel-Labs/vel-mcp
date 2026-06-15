import { z } from "zod";

export const ImageRefSchema = z.object({
  kind: z.enum(["file_path", "artifact_id", "data_url", "url"]),
  value: z.string().min(1),
  mimeType: z.string().optional()
}).strict();

export const BBoxNorm1000Schema = z.tuple([
  z.number().min(0).max(1000),
  z.number().min(0).max(1000),
  z.number().min(0).max(1000),
  z.number().min(0).max(1000)
]);

export const BBoxPxSchema = z.tuple([
  z.number().int().min(0),
  z.number().int().min(0),
  z.number().int().min(0),
  z.number().int().min(0)
]);

export const PointNorm1000Schema = z.tuple([
  z.number().min(0).max(1000),
  z.number().min(0).max(1000)
]);

export const ProviderSchema = z.object({ provider: z.string().optional() });

export const LocateInputSchema = ProviderSchema.extend({
  image: ImageRefSchema,
  query: z.string().min(1),
  labels: z.array(z.string().min(1)).optional(),
  targetType: z.enum(["any", "object", "text", "gui", "point", "region"]).default("any"),
  outputType: z.enum(["box", "point", "both"]).default("box"),
  maxResults: z.number().int().min(1).max(100).default(10),
  minConfidence: z.number().min(0).max(1).optional(),
  includeRawModelOutput: z.boolean().default(false)
}).strict();

export const InspectImageInputSchema = ProviderSchema.extend({
  image: ImageRefSchema,
  detail: z.enum(["low", "medium", "high"]).default("medium"),
  includeObjects: z.boolean().default(true),
  includeText: z.boolean().default(true),
  includeLayout: z.boolean().default(true)
}).strict();

export const OcrInputSchema = ProviderSchema.extend({
  image: ImageRefSchema,
  mode: z.enum(["text_only", "localized", "layout"]).default("localized"),
  regionNorm1000: BBoxNorm1000Schema.optional(),
  mergeLines: z.boolean().default(true)
}).strict();

export const InspectRegionInputSchema = ProviderSchema.extend({
  image: ImageRefSchema,
  regionNorm1000: BBoxNorm1000Schema.optional(),
  regionPx: BBoxPxSchema.optional(),
  query: z.string().optional(),
  detail: z.enum(["low", "medium", "high"]).default("high")
}).strict();

export const CompareInputSchema = ProviderSchema.extend({
  before: ImageRefSchema,
  after: ImageRefSchema,
  mode: z.enum(["metadata", "pixel", "ocr", "layout", "auto"]).default("metadata")
}).strict();

export const VideoScanInputSchema = ProviderSchema.extend({
  video: ImageRefSchema,
  sampling: z.object({
    everySeconds: z.number().positive().optional(),
    fps: z.number().positive().max(30).optional(),
    sceneChangeThreshold: z.number().min(0).max(1).optional(),
    maxFrames: z.number().int().min(1).max(500).default(60),
    maxDurationSec: z.number().positive().max(3600).default(600),
    maxBytes: z.number().int().positive().default(250 * 1024 * 1024)
  }).default({ everySeconds: 2, maxFrames: 60 }),
  query: z.string().optional()
}).strict();

export const DescribeInputSchema = ProviderSchema.extend({
  image: ImageRefSchema,
  style: z.enum(["concise", "detailed", "bullet", "alt-text"]).default("detailed"),
}).strict();

export const AskInputSchema = ProviderSchema.extend({
  image: ImageRefSchema,
  question: z.string().min(1),
}).strict();

export const ReadDocumentInputSchema = ProviderSchema.extend({
  document: ImageRefSchema,
  pages: z.array(z.number().int().min(1)).optional(),
  startPage: z.number().int().min(1).optional(),
  endPage: z.number().int().min(1).optional(),
  mode: z.enum(["ocr", "summarize", "extract_tables", "full"]).default("full"),
}).strict();

export const DetectAnomaliesInputSchema = ProviderSchema.extend({
  expected: ImageRefSchema,
  actual: ImageRefSchema,
  sensitivity: z.enum(["low", "medium", "high"]).default("medium"),
}).strict();

export const CaptureUrlInputSchema = z.object({
  url: z.string().url(),
  viewport: z.object({
    width: z.number().int().min(320).max(3840).default(1280),
    height: z.number().int().min(240).max(2160).default(800),
  }).default({ width: 1280, height: 800 }),
  fullPage: z.boolean().default(false),
  waitMs: z.number().int().min(0).max(30_000).default(500),
  timeoutMs: z.number().int().min(1_000).max(60_000).default(15_000),
  selector: z.string().min(1).optional(),
  maxHeightPx: z.number().int().min(240).max(50_000).default(10_000),
}).strict();

export const ReviewVisualInputSchema = z.object({
  image: ImageRefSchema.optional(),
  screenshotArtifactId: z.string().min(1).optional(),
  focus: z.string().min(1).optional(),
  mode: z.enum(["general", "ui_review", "target_check", "design_revision"]).default("general"),
  detail: z.enum(["low", "medium", "high"]).default("medium"),
  includeOcr: z.boolean().optional(),
}).strict();

export const ListProvidersInputSchema = ProviderSchema.extend({}).strict();

export const SetupInputSchema = ProviderSchema.extend({}).strict();

export type ImageRef = z.infer<typeof ImageRefSchema>;
export type LocateInput = z.infer<typeof LocateInputSchema>;
export type InspectImageInput = z.infer<typeof InspectImageInputSchema>;
export type OcrInput = z.infer<typeof OcrInputSchema>;
export type InspectRegionInput = z.infer<typeof InspectRegionInputSchema>;
export type CompareInput = z.infer<typeof CompareInputSchema>;
export type VideoScanInput = z.infer<typeof VideoScanInputSchema>;
export type DescribeInput = z.infer<typeof DescribeInputSchema>;
export type AskInput = z.infer<typeof AskInputSchema>;
export type ReadDocumentInput = z.infer<typeof ReadDocumentInputSchema>;
export type DetectAnomaliesInput = z.infer<typeof DetectAnomaliesInputSchema>;
export type CaptureUrlInput = z.infer<typeof CaptureUrlInputSchema>;
export type ReviewVisualInput = z.infer<typeof ReviewVisualInputSchema>;
export type ListProvidersInput = z.infer<typeof ListProvidersInputSchema>;
export type SetupInput = z.infer<typeof SetupInputSchema>;
