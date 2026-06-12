# Package roadmap: `@vel/glasses-mcp`

## Current validation note

The implementation has advanced beyond parts of this original checklist. Treat `packages/glasses-mcp/ROADMAP.md` as the active package status. Current receipts:

- `glasses-grounding` honors explicit `VEL_VISION_MODEL` and `VEL_VISION_PYTHON` overrides.
- `vel_glasses_worker.main` keeps JSONL responses on stdout and redirects model/library stdout to stderr during inference.
- `pnpm eval:locate-anything-smoke` writes `evals/glasses/runner/reports/locate-anything-smoke-report.json`.
- `pnpm eval:locate-anything-quality` writes `evals/glasses/runner/reports/locate-anything-quality-report.json`; the latest local MLX run passed `bbox_iou` 0.985 and center distance 1 on `evals/glasses/fixtures/blue-button.png`.

## Purpose

The Glasses MCP exposes a stable vision/perception interface to any MCP-capable harness. It is provider-agnostic and optimized for structured visual facts, not prose captions.

## Tool surface

| Tool | Purpose | First provider |
|---|---|---|
| `glasses.inspect_image` | structured observations, objects, visible text summary | mock, later VLM |
| `glasses.locate` | locate object/text/GUI element/point by natural language query | LocateAnything |
| `glasses.ocr` | OCR spans with regions and reading order | LocateAnything / OCR provider |
| `glasses.inspect_region` | crop/zoom a selected region and re-run analysis | any provider |
| `glasses.compare` | compare two images/screenshots | mock, later CV diff |
| `glasses.video_scan` | sample video frames and return timestamped events | later |

## Input contracts

Every tool that reads an image accepts:

```ts
type ImageRef =
  | { kind: "file_path"; value: string; mimeType?: string }
  | { kind: "artifact_id"; value: string; mimeType?: string }
  | { kind: "data_url"; value: string; mimeType?: string }
  | { kind: "url"; value: string; mimeType?: string } // disabled by default
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
  uncertainty?: string;
  evidence?: { text?: string; rawModelOutput?: string; cropArtifactId?: string };
}
```

## Milestone G0 — Mockable provider contract

Tasks:

- [ ] Define `VisionProvider` interface.
- [ ] Define request/response types for inspect, locate, OCR, region, compare, video.
- [ ] Implement deterministic mock provider.
- [ ] Add fixtures for GUI button, OCR text, object boxes, and no-result.
- [ ] Add unit tests for provider router.

Acceptance:

- All six tools work with provider `mock`.
- Outputs match schema and include provider/timing metadata.

## Milestone G1 — Image ingestion

Tasks:

- [ ] Implement file path ingestion through `PathPolicy`.
- [ ] Implement artifact ID ingestion through `ArtifactStore`.
- [ ] Implement data URL ingestion with max size guard.
- [ ] Keep URL ingestion disabled unless config explicitly enables it.
- [ ] Extract width/height where possible.
- [ ] Compute image hash.
- [ ] Add audit event without storing raw bytes.

Acceptance:

- Tool can read a local PNG/JPEG and return image metadata.
- Oversized image returns structured error.

## Milestone G2 — LocateAnything parser

Tasks:

- [ ] Parse `<ref>label</ref><box><x1><y1><x2><y2></box>`.
- [ ] Parse point output `<box><x><y></box>`.
- [ ] Parse no-result `<box>none</box>`.
- [ ] Clamp coordinates to `[0, 1000]` with warnings.
- [ ] Convert normalized coords to pixel coords if dimensions are known.
- [ ] Preserve raw model output under `evidence.rawModelOutput` only when configured.
- [ ] Add tests for multiple boxes, labels, malformed output, and mixed point/box outputs.

Acceptance:

- Parser test coverage includes at least 12 cases.

## Milestone G3 — Python LocateAnything worker

Tasks:

- [ ] Implement JSONL worker process in `workers/locate-anything`.
- [ ] Worker starts without importing heavy dependencies until `load_model` or first inference.
- [ ] Worker returns setup error if `locateanything_worker` cannot be imported.
- [ ] Add ops:
  - [ ] `health`
  - [ ] `load_model`
  - [ ] `detect`
  - [ ] `ground_multi`
  - [ ] `detect_text`
  - [ ] `ground_gui`
  - [ ] `point`
- [ ] Return raw answer string and timing.
- [ ] Ensure Python logs go to stderr.
- [ ] Add minimal Dockerfile but do not build/download model by default.

Acceptance:

- Node provider can send a JSONL health request and receive response.
- Missing Eagle dependency produces actionable error text.

## Milestone G4 — LocateAnything provider

Tasks:

- [ ] Implement `LocateAnythingProvider` around `WorkerSupervisor`.
- [ ] Map `targetType=gui` to `ground_gui`.
- [ ] Map `outputType=point` to point mode.
- [ ] Map OCR to `detect_text`.
- [ ] Map dense detection to `detect` when labels are provided.
- [ ] Parse worker raw answer into VEL localization result.
- [ ] Add provider health check that verifies repo path and Python command.
- [ ] Add license warning to provider setup output.

Acceptance:

- `glasses.locate({ provider: "locate-anything" })` works when dependencies are installed.
- Tool output is identical shape to mock provider output.

## Milestone G5 — OCR behavior

Tasks:

- [ ] Define OCR output spans with text, bbox, confidence, reading order.
- [ ] Support `mode: "text_only" | "localized" | "layout"`.
- [ ] Add option to merge line-level spans.
- [ ] Add option to return only text when model context must be small.
- [ ] Add eval metric: character error rate and span IoU.

Acceptance:

- OCR can return both text and localized spans.

## Milestone G6 — Region inspection

Tasks:

- [ ] Crop from normalized bbox or pixel bbox.
- [ ] Store crop as artifact.
- [ ] Re-run selected provider on crop.
- [ ] Return parent/child coordinate mapping.
- [ ] Add tests for crop coordinate remapping.

Acceptance:

- A box in crop coordinates can be mapped back to original image coordinates.

## Milestone G7 — Compare images

Tasks:

- [ ] Implement metadata diff.
- [ ] Implement pixel-diff provider later.
- [ ] Implement OCR diff mode.
- [ ] Implement layout-diff mode.
- [ ] Return changed regions.

Acceptance:

- Can compare two screenshots and return changed text/regions.

## Milestone G8 — Video scan

Tasks:

- [ ] Accept video artifact or path.
- [ ] Extract frame manifest: frame ID, timestamp, path/artifact.
- [ ] Support sampling policies: fps, every N seconds, scene-change later.
- [ ] Run inspect/locate over sampled frames.
- [ ] Return events with timestamps and frame provenance.
- [ ] Add hard duration/file-size limits.

Acceptance:

- A short video can be sampled and each frame can be passed to existing image tools.

## Milestone G9 — Evals

Tasks:

- [ ] Define `evals/glasses/dataset.schema.json`.
- [ ] Implement IoU metric.
- [ ] Implement center-distance metric.
- [ ] Implement OCR exact/character error metric.
- [ ] Implement GUI click success metric.
- [ ] Produce JSON and Markdown reports.

Acceptance:

- `pnpm --filter @vel/glasses-evals test` runs against mock provider.

## Eagle / LocateAnything implementation notes

The Eagle `Embodied/README.md` documents LocateAnything as a VLM for fast visual grounding with object localization, dense detection, GUI grounding, and text localization. It installs from `NVlabs/Eagle` with `cd Embodied && pip install -e .`. The quick start uses `LocateAnythingWorker("nvidia/LocateAnything-3B")` and calls `detect`, `ground_multi`, `detect_text`, `ground_gui`, and `point`. Outputs use special `<box>` tokens with `[0,1000]` coordinates. The model card says LocateAnything-3B is non-commercial, so VEL must not auto-enable it for commercial workflows.
