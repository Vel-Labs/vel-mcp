# Package roadmap: `@vel/glasses-mcp`

## Purpose

The Glasses MCP is the vision/perception layer for VEL. It serves **all** visual understanding needs — not just GUI automation. It is provider-agnostic, optimized for structured visual facts, and designed to be maximally useful for both coding agents and non-coding users.

## Use case lanes

These lanes define the surface area. Every lane has dedicated tools, and tools may serve multiple lanes.

### Lane 1 — Image understanding (general perception)

"Describe this photo." "What objects are visible?" "What's the layout?"

- Consumers: coding agents, general users, accessibility tools
- Tools: `glasses.inspect_image`, `glasses.locate`, `glasses.inspect_region`
- Providers: VLM (GPT-4V, Claude Vision, Gemini), LocateAnything for grounding

### Lane 2 — OCR and document reading

"Read this PDF." "Extract text with positions." "What does this receipt say?"

- Consumers: coding agents, document processing pipelines, non-coding users
- Tools: `glasses.ocr`, `glasses.read_document`, `glasses.inspect_region`
- Providers: LocateAnything, Tesseract, cloud OCR APIs
- Formats: images (PNG/JPEG), PDF (rasterized), screenshots

### Lane 3 — GUI and application automation

"Find the Submit button." "Where is the search field?" "What changed on screen?"

- Consumers: coding agents (CUA workflows), QA/testing tools
- Tools: `glasses.locate`, `glasses.compare`, `glasses.inspect_region`
- Providers: LocateAnything, fine-tuned GUI grounding models

### Lane 4 — Design and visual QA feedback

"Compare mockup to implementation." "Check spacing against design system." "Is this pixel-perfect?"

- Consumers: design tools, CI pipelines, code review assistants
- Tools: `glasses.compare`, `glasses.inspect_region`, `glasses.detect_anomalies`
- Providers: pixel diff, VLM comparison, custom heuristics

### Lane 5 — Video and temporal analysis

"What happens in this video?" "Find the moment when X appears." "Scan security footage."

- Consumers: coding agents, media tools, surveillance/observability
- Tools: `glasses.video_scan`, `glasses.video_locate`, `glasses.video_summarize`
- Providers: frame sampling + image tools, video VLMs

### Lane 6 — PDF and document processing

"Read this 30-page PDF." "Extract all tables." "Summarize this contract."

- Consumers: non-coding users, legal/finance tools, coding agents
- Tools: `glasses.read_document`, `glasses.ocr`, `glasses.inspect_image`
- Providers: PDF rasterization + VLM, structured extraction models
- Covers: multi-page navigation, table extraction, form field detection

## Tool surface (expanded)

| Tool | Lane | Purpose | First provider |
|---|---|---|---|
| `glasses.inspect_image` | 1, 6 | Structured observations, objects, text, layout | mock, later VLM |
| `glasses.locate` | 1, 2, 3 | Locate object/text/GUI/point by query | LocateAnything |
| `glasses.ocr` | 2, 6 | OCR spans with regions and reading order | LocateAnything / OCR |
| `glasses.inspect_region` | 1, 3, 4 | Crop/zoom region and re-run analysis | any provider |
| `glasses.compare` | 3, 4 | Compare two images/screenshots | mock, pixel diff |
| `glasses.video_scan` | 5 | Sample video frames, return timestamped events | mock, later video VLM |
| `glasses.video_locate` | 5 | Locate object/event across video timeline | later |
| `glasses.video_summarize` | 5 | Summarize video content as structured timeline | later |
| `glasses.read_document` | 2, 6 | Full document OCR with pages, tables, structure | PDF rasterizer + VLM |
| `glasses.detect_anomalies` | 4 | Find visual anomalies between expected and actual | pixel diff, VLM |
| `glasses.describe` | 1 | Natural language description of an image | VLM |
| `glasses.ask` | 1, 2, 3, 4, 5, 6 | Free-form visual question answering | VLM |

## Input contracts

Every tool that reads an image accepts:

```ts
type ImageRef =
  | { kind: "file_path"; value: string; mimeType?: string }
  | { kind: "artifact_id"; value: string; mimeType?: string }
  | { kind: "data_url"; value: string; mimeType?: string }
  | { kind: "url"; value: string; mimeType?: string } // disabled by default
```

Document tools additionally accept:

```ts
type DocumentRef = ImageRef & {
  pages?: number[];            // specific pages to process
  startPage?: number;          // inclusive
  endPage?: number;            // inclusive
  password?: string;           // for encrypted PDFs
}
```

Every localization result emits:

```ts
{
  label: string;
  bboxNorm1000?: [number, number, number, number];
  centerNorm1000?: [number, number];
  bboxPx?: [number, number, number, number];
  centerPx?: [number, number];
  confidence?: number;
  evidence?: { text?: string; rawModelOutput?: string; cropArtifactId?: string };
}
```

## Image loading pipeline

Shared across all tools. Implemented as `src/services/imageLoader.ts`.

```
ImageRef → resolve kind
  ├── file_path → PathPolicy.assertAllowed() → readFile → hash → artifact
  ├── artifact_id → ArtifactStore.getMetadata() → openReadStream → check
  ├── data_url → base64 decode → hash → artifact
  └── url → blocked unless modules.glasses.allowHttpImageLoading: true
       └── if allowed → fetch → hash → artifact
↓
Check dimensions (warn if > modules.glasses.maxImageDimension)
Check file size (warn if > vel.warnFileSizeMb)
↓
Return { imageBytes, mimeType, width, height, sha256, artifactId, warnings }
```

Audit event is emitted with hash, size, dimensions, and origin — **never raw bytes**.

## Vision provider contract

```ts
interface VisionProvider extends NamedProvider {
  // Core
  inspectImage(input: InspectImageInput): Promise<VisionProviderResult<{ observations: string[]; image?: ImageRef }>>;
  locate(input: LocateInput): Promise<VisionProviderResult<{ matches: LocalizationResult[] }>>;
  ocr(input: OcrInput): Promise<VisionProviderResult<{ text: string; spans: OcrSpan[] }>>;
  inspectRegion(input: InspectRegionInput): Promise<VisionProviderResult<{ observations: string[]; region: LocalizationResult }>>;
  compare(input: CompareInput): Promise<VisionProviderResult<{ summary: string; changedRegions: LocalizationResult[] }>>;
  videoScan(input: VideoScanInput): Promise<VisionProviderResult<{ frames: unknown[]; events: unknown[] }>>;

  // Extended (Phase 2+)
  describe?(input: DescribeInput): Promise<VisionProviderResult<{ description: string; style?: string }>>;
  ask?(input: AskInput): Promise<VisionProviderResult<{ answer: string; confidence?: number }>>;
  readDocument?(input: ReadDocumentInput): Promise<VisionProviderResult<{ pages: DocumentPage[] }>>;
  detectAnomalies?(input: DetectAnomaliesInput): Promise<VisionProviderResult<{ anomalies: AnomalyRegion[] }>>;

  healthCheck?: () => Promise<ProviderHealth>;
}
```

## Milestones

### G0 — Mock provider contract ✅ COMPLETE

- [x] Define `VisionProvider` interface with 6 core methods.
- [x] Define request/response types for inspect, locate, OCR, region, compare, video.
- [x] Implement deterministic mock provider returning structured JSON for all 6 tools.
- [x] Validate tool outputs match schemas (smoke test).
- [x] Provider metadata (name, version, timingMs) on every result.

### G1 — Image loading ✅ COMPLETE

- [x] Implement `ImageLoader` class at `src/services/imageLoader.ts`.
- [x] Resolve `file_path` through `PathPolicy.assertAllowed()`.
- [x] Resolve `artifact_id` through `ArtifactStore` lookup.
- [x] Decode `data_url` (base64 → buffer, extract MIME from header).
- [x] Block `url` kind unless `modules.glasses.allowHttpImageLoading` is `true`.
- [x] Extract dimensions (width, height) for PNG/JPEG/GIF/WebP/BMP.
- [x] Compute SHA-256 hash and create artifact via `ArtifactStore`.
- [x] Emit audit event with hash, size, dimensions, origin (no raw bytes).
- [x] Warn on oversized files (> `vel.warnFileSizeMb`) and oversized dimensions (> `modules.glasses.maxImageDimension`).
- [x] Wire loader into all 6 tool handlers between schema validation and provider dispatch.
- [x] Add tests: file_path (allowed + rejected), artifact_id, data_url, url-blocked, oversized, dimensions warning, file size warning, audit event (9 tests).

Acceptance:
- [x] `glasses.inspect_image({ image: { kind: "file_path", value: "./test.png" } })` returns metadata.
- [x] Oversized image returns result with warnings, not errors.
- [x] Blocked URL returns structured error `{ code: "HTTP_URL_DISABLED", message: "..." }`.

### G2 — LocateAnything parser ✅ COMPLETE

- [x] Parse `<ref>label</ref><box><x1><y1><x2><y2></box>`.
- [x] Parse point output `<box><x><y></box>`.
- [x] Parse no-result `<box>none</box>`.
- [x] Clamp coordinates to `[0, 1000]` with warnings.
- [x] Convert normalized coords to pixel coords if dimensions known.
- [x] Preserve raw model output under `evidence.rawModelOutput` when configured.
- [x] Wire parser into `LocateAnythingProvider` for locate and OCR ops.
- [x] Edge case tests: whitespace, empty, no-label, HTML in labels, mixed outputs, case-insensitive none, center compute, raw output preservation (18 tests total, up from 8).

### G3 — Python LocateAnything worker ✅ COMPLETE

Status: **Code complete, integration tested via real Python subprocess.** `FAKE_WORKER_MODE=1` env var added to `main.py` — when set, the worker returns deterministic `<ref>/<box>` output without importing Eagle or PIL. Integration test (`tests/pythonWorker.test.ts`) spawns `python3 -m vel_locate_anything_worker.main` via `WorkerSupervisor`, validates health/locate/OCR/point/error over real JSONL. **The real LocateAnything-3B model has NOT been loaded yet** — fake mode bypasses `load_worker()` entirely. Swapping to the real model is a config change (`FAKE_WORKER_MODE` → `VEL_LOCATEANYTHING_REPO`), not yet tested.

- [x] JSONL worker at `workers/locate-anything/vel_locate_anything_worker/main.py`.
- [x] `FAKE_WORKER_MODE` env var — returns deterministic output, no Eagle/PIL needed (mirrors Node `fake-worker.mjs` pattern).
- [x] Lazy imports — worker doesn't load dependencies until first inference; PIL import moved inside `open_image()`.
- [x] Returns setup error if `locateanything_worker` can't be imported (real mode only).
- [x] All 7 ops: `health`, `load_model`, `detect`, `ground_multi`, `detect_text`, `ground_gui`, `point`.
- [x] Returns raw answer + timing.
- [x] Python logs go to stderr.
- [x] `pyproject.toml` with optional eagle dependencies.
- [x] Dockerfile for containerized use.
- [x] Integration test (`tests/pythonWorker.test.ts`, 6 tests) — spawns real `python3` subprocess via `WorkerSupervisor`, validates JSONL responses for health/locate/point/OCR/error.
- [ ] **Real model load test**: remove `FAKE_WORKER_MODE`, point `VEL_LOCATEANYTHING_REPO` at Eagle checkout + `VEL_LOCATEANYTHING_MODEL` at downloaded weights, validate actual `<ref>/<box>` output from LocateAnything-3B.
- [ ] **MLX candidate test**: try `andai-labs/LocateAnything-3B-MLX` or `mlx-community/LocateAnything-3B-bf16` as Apple Silicon alternatives.

### G4 — LocateAnything Node provider ✅ IMPLEMENTED

Status: **Code complete with tests.** Uses `WorkerSupervisor.getOrCreate()` and a Node fake worker (`core/tests/fake-worker.mjs` in `vision-echo` mode) for testing. Maps tool calls → worker ops correctly, parses responses through the TypeScript parser. Hard-disabled by default (enabled only when `VEL_LOCATEANYTHING_REPO` env var is set).

- [x] `LocateAnythingProvider` wraps `WorkerSupervisor.getOrCreate()`.
- [x] Maps `targetType=gui` → `ground_gui`, `outputType=point` → `point`, OCR → `detect_text`.
- [x] Parses worker raw answer through `parseLocateAnythingAnswer()`.
- [x] Health check verifies repo path.
- [x] License warning on all outputs.
- [x] Config-driven via `LocateAnythingConfig` (repo, python, model, attn impl).
- [x] 8 integration tests with fake worker (locate ground_multi/ground_gui/point, OCR, inspectImage, license warning, raw output preservation, cancellation).

### G5 — OCR behavior expansion ✅ COMPLETE

Status: **Mode differentiation, region filtering, line merging, layout reading-order, and span-level eval metrics all implemented.** Shared OCR utilities (`src/services/ocrUtils.ts`) used by both providers. Mock provider applies `regionNorm1000` filtering, `mergeLines` with y-center tolerance, and true y-band reading-order for `layout` mode. LocateAnything provider sends `mode`/`mergeLines` in worker payload and applies same post-processing. Eval runner has `spanIoU` (greedy closest-center) and `readingOrderCorrelation` (Spearman rank) metrics. **No language hints yet; confidence scores remain undefined from real model output.**

- [x] `mode: "text_only"` — returns plain text string, `spans: []`.
- [x] `mode: "localized"` — returns spans with bboxes and reading order.
- [x] `mode: "layout"` — returns y-band + within-band x-sort reading order.
- [x] `mergeLines` option to combine adjacent line-level spans (y-center tolerance 50 norm1000 units).
- [x] `regionNorm1000` option to restrict OCR to a sub-region (intersection-based filtering).
- [ ] Language hint parameter for multi-lingual OCR.
- [x] Confidence scores per span (plumbed through, but real LocateAnything model doesn't emit them).
- [x] Eval metrics: character error rate (CER), word error rate (WER), span IoU (`span_iou`), reading order correlation (`reading_order_correlation`).
- [x] Shared OCR utilities at `src/services/ocrUtils.ts`: `bboxesIntersect`, `filterByRegion`, `mergeLinesByYBands`, `layoutSort` (14 unit tests).

### G6 — Region inspection with coordinate mapping ✅ COMPLETE

Status: **Implemented with Sharp-based cropping, artifact storage, and coordinate remapping.** `inspectRegionTool` loads the image, optionally crops to a normalized `[0,1000]` region using `RegionCropper`, stores the crop as an artifact, and re-runs `inspect_image` on the cropped region. Results include parent → child coordinate mapping.

- [x] Crop image from normalized `[0,1000]` bbox.
- [x] Crop image from pixel bbox.
- [x] Store crop as artifact via `ArtifactStore`.
- [x] Re-run provider on cropped region (any tool: inspect, locate, OCR).
- [x] Return parent → child coordinate mapping so results can be translated back.
- [x] Handle edge cases: crop extends beyond image bounds, zero-area region, full-image region.
- [x] Tests for coordinate remapping: bbox in crop → bbox in original.

**Implementation:** `src/services/regionCropper.ts` (Sharp pipeline), `src/tools/inspectRegion.ts` (tool handler), `tests/regionCropper.test.ts` (8 tests).

### G7 — Image comparison ✅ COMPLETE

Status: **Implemented with metadata, pixel, OCR, and layout diff modes.** `compareTool` uses `ImageComparator` service to perform multi-mode comparison. Pixel diff uses Sharp raw pixel comparison with configurable threshold and flood-fill region detection. OCR diff compares text spans. Layout diff compares spatial arrangement of detected elements.

- [x] Metadata diff: dimensions, format, file size, hash.
- [x] Pixel diff: pixel-by-pixel comparison with threshold, return changed bounding boxes.
- [x] OCR diff: run OCR on both images, return text changes with positions.
- [x] Layout diff: compare spatial arrangement of detected elements.
- [x] Changed regions output as `LocalizationResult[]` with diff metadata.
- [x] Comparison mode selection: auto (try all), metadata-only, pixel-only, ocr-only, layout-only.

**Implementation:** `src/services/imageComparator.ts` (metadata/pixel/OCR/layout diff), `src/tools/compare.ts` (tool handler), `tests/imageComparator.test.ts` (12 tests).

### G8 — Video analysis ✅ COMPLETE

Status: **Implemented with ffmpeg-based frame sampling and provider frame analysis.** `videoScanTool` uses `VideoSampler` service to probe video metadata and extract frames at configurable intervals using ffmpeg's `fps` filter. Frames are stored as artifacts. If a query is provided, `locate` is run on each sampled frame to detect events across the timeline.

- [x] Accept video as file path or artifact.
- [x] Extract frame manifest: `[{ frameIndex, timestampSec, artifactId }]`.
- [x] Sampling policies: every N seconds, fixed FPS, keyframe-only, scene-change detection (later).
- [x] Run `inspect_image` or `locate` over sampled frames.
- [x] Return events: `[{ timestampSec, frameIndex, label, bbox, confidence }]`.
- [x] Return timeline summary: key events sorted by timestamp.
- [x] Hard limits: max duration (configurable, default 10 min), max file size, max frames (500).

**Implementation:** `src/services/videoSampler.ts` (ffmpeg probe + fps filter extraction), `src/tools/videoScan.ts` (tool handler), `tests/videoSampler.test.ts` (4 tests).

### G9 — Evals ✅ COMPLETE

- [x] Dataset schema at `evals/glasses/dataset.schema.json`.
- [x] Sample task list at `evals/glasses/sample-tasks.jsonl` (2 tasks).
- [x] Metrics implemented in runner src: `bboxIoU()`, `centerDistance()`, `ocrCer()`, `ocrExact()`, `guiClickSuccess()`, edit distance.
- [x] Metrics documented in `metrics.md`.
- [x] Eval runner (`evalRunner.ts`): loads tasks, executes against mock provider, computes metrics, asserts thresholds.
- [x] IoU metric with configurable threshold (default 0.5).
- [x] Center distance metric in normalized [0,1000] space (default success ≤ 30).
- [x] GUI click success metric (center_distance_norm1000 ≤ threshold).
- [x] OCR character error rate (CER) and word error rate (WER).
- [x] Eval runner tests: 4 tests covering full task run, metric pass/fail, report structure (in `evals/glasses/runner/tests/`).
- [x] Runs in CI via `pnpm test` (part of pnpm -r test sweep).

### G10 — Non-coding use case tools ✅ COMPLETE

Status: **All four standalone MCP tools implemented with schemas, handlers, and mock provider support.** `glasses.describe` and `glasses.ask` route to the VLM provider (or mock). `glasses.read_document` runs OCR on document images with page extraction. `glasses.detect_anomalies` uses pixel diff (ImageComparator) for baseline anomaly detection, with VLM-based detection as future work.

- [x] Python worker `describe` op — natural language image description.
- [x] Python worker `ask` op — free-form visual Q&A.
- [x] `inspect_image` routes to VLM provider and returns structured observations.
- [x] `glasses.describe` — standalone MCP tool with style selection (concise, detailed, bullet, alt-text).
- [x] `glasses.ask` — standalone MCP tool with free-form visual Q&A.
- [x] `glasses.read_document` — document OCR with pages, text, spans, and metadata.
- [x] `glasses.detect_anomalies` — pixel-diff baseline anomaly detection with sensitivity levels.

**Implementation:** `src/tools/describe.ts`, `src/tools/ask.ts`, `src/tools/readDocument.ts`, `src/tools/detectAnomalies.ts`, `tests/nonCodingTools.test.ts` (4 tests).

### G11 — Provider ecosystem ✅ COMPLETE

Status: **`glasses.list_providers` MCP tool implemented.** Returns all registered providers with capabilities, health status, priority, role, and model ID. Provider auto-detection is config-driven via `ModelRegistry` and `ProviderRouter` — the server registers providers based on env vars and config, and `list_providers` surfaces what's available.

- [x] Mock provider expanded with query-dependent responses for `locate`, mode-aware OCR, varied fixture data.
- [x] VLM provider contract (VelVisionProvider with MLX/Python worker).
- [x] Provider auto-detection: config-driven via `ModelRegistry` + env vars.
- [x] Provider capability discovery: `glasses.list_providers` returns available tools per provider with health status.

**Implementation:** `src/tools/listProviders.ts`, `tests/listProviders.test.ts` (1 test).

### G12 — CLI ✅ COMPLETE

Status: **`vel-glasses` CLI implemented with Commander.js.** All core commands are functional. The CLI creates the same server instance as the MCP server, calls provider methods directly, and outputs structured JSON. Commands: `inspect`, `describe`, `ask`, `locate`, `ocr`, `read`, `crop`, `diff`, `anomalies`, `video-scan`, `providers`, `health`.

```bash
# Image understanding
pnpm vel-glasses inspect <image>              # Run glasses.inspect_image
pnpm vel-glasses describe <image>             # Natural language description
pnpm vel-glasses ask <image> "question"       # Visual Q&A

# Location and OCR
pnpm vel-glasses locate <image> "query"       # Find something in an image
pnpm vel-glasses ocr <image>                  # Extract text
pnpm vel-glasses read <document>              # Full document processing

# Region and comparison
pnpm vel-glasses crop <image> <bbox>          # Crop and inspect a region
pnpm vel-glasses diff <before> <after>        # Compare two images
pnpm vel-glasses anomalies <expected> <actual> # Detect visual anomalies

# Video
pnpm vel-glasses video-scan <video>           # Sample and analyze video

# Development and debugging
pnpm vel-glasses providers                    # List available providers
pnpm vel-glasses health [provider]            # Check provider health

# Options (all commands)
#   --provider <id>     Force specific provider
#   --output <format>   Output format: json or text
#   --config <path>     Config file path
#   --verbose           Show warnings and timing
```

Acceptance:
- [x] `pnpm vel-glasses --help` shows all commands.
- [x] `pnpm vel-glasses providers` lists registered providers with health status.
- [x] `pnpm vel-glasses health mock` checks mock provider health.

**Implementation:** `src/cli.ts` (Commander.js), `tests/cli.test.ts` (3 tests).

## Maturity gates

| Gate | Criterion | Dependencies | Status |
|---|---|---|---|
| **G0-G1** | Image loading works, mock tools return valid JSON on stdio | Phase 1 complete | ✅ COMPLETE |
| **G2-G4** | LocateAnything provider works end-to-end (health → inference → parsed result) | G1, Python worker | ✅ COMPLETE (fake mode; real model not yet loaded) |
| **G5** | OCR mode differentiation, region filtering, mergeLines, span eval metrics | G1, parser | ✅ COMPLETE |
| **G6-G7** | Region inspection with crop/remap, image comparison with pixel/OCR/layout diff | G1, image processing | ✅ COMPLETE |
| **G8** | Video scanning with frame sampling | G1, ffmpeg/decord | ✅ COMPLETE |
| **G9** | Evals run in CI, report pass/fail | G0-G4 | ✅ COMPLETE |
| **G10** | Non-coding tools: describe, ask, read_document, detect_anomalies MCP tools | VLM provider | ✅ COMPLETE |
| **G11** | Provider ecosystem: list_providers, capability discovery, health checks | G1-G4 | ✅ COMPLETE |
| **G12** | CLI: glasses-specific command-line interface with all tools | G0-G11 | ✅ COMPLETE |

## Phase mapping (actual status)

| Phase | Milestones | Theme | Status |
|---|---|---|---|
| **Phase 2** | G0 + G1 + G2 + G9 | Image loading, parser wiring, baseline evals | ✅ **COMPLETE** |
| **Phase 3** | G3 + G4 + G5 | LocateAnything worker + provider, OCR expansion | ✅ **COMPLETE** (fake-mode tested; real model load + Eagle2.5 not yet attempted) |
| **Phase 3.5** | Model registry + dual VLM provider + role-based routing | VLM provider separation, config-driven routing | ✅ **COMPLETE** |
| **Phase 4** | G6 + G7 + G8 | Region, comparison, video | ✅ **COMPLETE** |
| **Phase 5** | G10 + G11 + G12 | Non-coding tools, multi-provider, CLI | ✅ **COMPLETE** |

---

## Phase 3.5 completion summary (2026-06-09)

**Model registry** (`src/services/modelRegistry.ts`):
- Reads `models[]`, `roles{}` (preferred + fallback chains), and `toolToRole{}` from config
- `resolveModelForTool(toolName)` → role → preferred model → fallback chain
- `resolveModelForRole(roleName)` → first available model in fallback chain
- `getModelConfig()`, `getModelsForRole()`, `isModelAvailable()`, `hasRole()` helpers

**Provider router** (`src/providers/providerRouter.ts`):
- `getForTool(toolName, explicitProviderId?)`: synchronous tool → provider resolution via model registry + providerModelMap
- `resolveForTool(toolName, explicitProviderId?)`: async resolution with health-check fallback chain traversal
- `providerModelMap`: maps modelId → providerId for routing
- `selectionLog`: audit trail of routing decisions

**Server wiring** (`src/server.ts`):
- Creates `ModelRegistry` from `opts.config`
- Resolves `grounding` role → registers `VelVisionProvider` as `glasses-grounding`
- Resolves `general_vlm` role → registers `VelVisionProvider` as `glasses-vlm`
- Passes `modelRegistry` to `ProviderRouter`

**VelVisionProvider** (`src/providers/velVisionProvider.ts`):
- Configurable `providerId` and `role` in constructor
- `inspectImage()` sends `op: "describe"` with natural language prompt (VLM path)
- `locate()`/`ocr()` send grounding ops (`ground_multi`, `ground_gui`, `point`, `detect_text`)
- `healthCheck()` reports the actual configured model

**Python worker** (`workers/vel-worker/vel_glasses_worker/main.py`):
- `describe(image, prompt, max_tokens)` — natural language image description
- `ask(image, question, max_tokens)` — visual Q&A
- `build_inspect_prompt()` helper for structured inspect requests
- Fake mode returns deterministic responses for describe/ask ops

**Tests**: 126 tests (core 31, mcp-base 10, glasses-mcp 73, evals 12 + 3 opt-in real-model skipped). Build, lint, typecheck, smoke all green.

---

## Phase 3 model discovery & setup tool (2026-06-08)

### `glasses.setup` tool

New tool (`src/tools/setup.ts`) added alongside the 6 existing tools. Reports model inventory and setup guidance:
- Input: optional `provider` field (defaults to default provider)
- Output: `{ models: ModelDiscovery[] }` with per-model status, paths, dependencies, and actionable install instructions
- Mock provider returns empty inventory with a warning that model discovery isn't supported

### Model discovery service (`src/services/modelDiscovery.ts`)

Auto-scans known filesystem paths for 5 model candidates:

| Model | Path | Status detection |
|-------|------|-----------------|
| `nvidia/LocateAnything-3B` | `~/30_AI-Lab/_cache/models/nvidia/LocateAnything-3B` | `config.json` exists check |
| `mlx-community/LocateAnything-3B-bf16` | `~/.cache/huggingface/hub/models--mlx-community--...` | snapshots dir check |
| `sahilchachra/locateanything-3b-mxfp4-mlx` | `~/.cache/huggingface/hub/models--sahilchachra--...` | snapshots dir check |
| `andai-labs/LocateAnything-3B-MLX` | `~/.cache/huggingface/hub/models--andai-labs--...` | snapshots dir check |
| `nvidia/Eagle2.5-8B` | Not downloaded | Always "not-installed" |

Each model reports: status (available/partial/not-installed), runtime readiness, license warnings, and specific setup instructions (pip commands, env vars, download URLs).

### Enhanced health check

`LocateAnythingProvider.healthCheck()` now:
- Reports Eagle repo presence and LocateAnything-3B weight status
- Checks MLX BF16 availability as a secondary path
- Returns `ok: false` with structured error when misconfigured (was: `ok: true` with scaffold caveat)
- Directs users to `glasses.setup` for install guidance when models are missing

### Config-driven model registry (2026-06-08)

The model discovery system is now **config-driven**, not hardcoded to any specific machine or user.

**`modelDiscovery.ts`** (`src/services/modelDiscovery.ts`):
- Accepts `ModelConfig[]` from config in priority; falls back to sensible defaults when no config exists
- Auto-detects model presence by checking filesystem paths (`config.json` for Transformers, snapshot dirs for MLX)
- Builds structured `ModelDiscovery` entries with status (available/not-installed), runtime readiness, task affinity, and setup instructions
- **5 default models** shipped: `nvidia/LocateAnything-3B`, 3 MLX variants, `nvidia/Eagle2.5-8B`
- **No hardcoded paths** — every model reads its path from config or derives it from `~/.cache/huggingface/hub/models--<org>--<name>` convention

**`vel.config.example.yaml`** expanded with:
- `modules.glasses.models[]` — declare any vision model with its kind, role, path, task affinity, and setup instructions
- `modules.glasses.taskToModel` — maps tool/task categories (locate, ocr, inspect_image, describe, etc.) to preferred model IDs
- Users add or remove models by editing YAML — no code changes needed

**`glasses.setup` tool** (continued):
- Output reflects the config-driven model inventory
- Mock provider returns empty inventory with clear guidance to check config
- LocateAnything provider reports per-model status with specific setup instructions

**Config bridging** (continued):
- `index.ts` calls `loadVelConfig()` → passes `modules.glasses` to `createGlassesServer()`
- When config is present, model discovery uses config-provided models
- When config is absent or invalid, server starts with defaults (non-fatal)
- Provider registration still uses env vars for backward compatibility

**Tests**: 126 total (core 31, mcp-base 10, glasses-mcp 73, evals 12). 4 new setup tests. Build, lint, typecheck, smoke all green.

---

## Phase 2 completion summary (2026-06-08)

### G1 — Image loading (`src/services/imageLoader.ts`)

Implemented `ImageLoader` as a shared service handling all 4 `ImageRef` kinds:

- **file_path**: routes through `PathPolicy.assertAllowed()`, reads file, extracts dimensions from binary headers (PNG/JPEG/GIF/WebP/BMP), computes SHA-256, emits audit event
- **artifact_id**: looks up metadata in `ArtifactStore`, reads data file, extracts dimensions
- **data_url**: decodes base64 payload, extracts MIME type, stores in artifact store
- **url**: blocked unless `modules.glasses.allowHttpImageLoading: true`; throws `{ code: "HTTP_URL_DISABLED" }` structured error

Dimension extraction from binary headers — no image library needed. Supports PNG (IHDR), JPEG (SOFn marker scan), GIF (header), WebP (VP8/VP8L/VP8X), BMP (DIB header).

Size/dimension guards: `checkFileSize()` and `checkImageDimensions()` from `@vel/core` produce warnings, not errors.

Wired into all 6 tool handlers. Each handler calls `imageLoader.load()` before dispatching to the provider, merging loader warnings into the result envelope.

**Tests**: 9 tests (`tests/imageLoader.test.ts`) — valid PNG file_path, valid JPEG file_path, blocked path outside roots, audit event emission, URL kind blocked, data URL decode with dimension extraction, oversized dimension warning, artifact_id load, oversized file warning.

### G2 — Parser edge cases (`tests/parser.test.ts`)

Expanded from 8 to 18 tests covering: whitespace-only input, empty string, box without ref label (defaults to "object"), point without ref label (defaults to "point"), HTML tag stripping from labels, mixed box+point output, raw model output preservation, case-insensitive none detection, automatic center coordinate computation. All tests pass.

### G9 — Eval runner (`evals/glasses/runner/`)

Added to `src/index.ts`: `guiClickSuccess()`, `ocrCer()` (character error rate with edit distance), `ocrExact()`, `ocrCer()` with configurable thresholds, `EvalTask`/`EvalTaskResult`/`EvalReport` types.

New `src/evalRunner.ts`: `loadTasks()` reads JSONL, `runEvals()` dispatches to provider, evaluates metrics, produces structured report with per-task pass/fail, metric values, and timestamps.

**Tests**: 4 tests (`tests/evalRunner.test.ts`) — full run of 2 sample tasks against mock provider, locate passes bbox_iou, OCR passes ocr_exact, report has timestamps and duration.

### Infrastructure changes

- `GlassesServerOptions` extended with `artifactStore`, `allowedImageRoots`, `allowHttpImageLoading`, `maxImageDimension`, `warnFileSizeMb` — all with sane defaults
- `server.ts` creates `ImageLoader` with `ArtifactStore` and `PathPolicy` and passes it to all 6 tool constructors
- `smoke-glasses.sh` generates a real 16×16 PNG for the locate call (ImageLoader needs a real file now)
- Build, lint, test (61 tests), typecheck all green
- Smoke test passes with real MCP handshake over stdio
