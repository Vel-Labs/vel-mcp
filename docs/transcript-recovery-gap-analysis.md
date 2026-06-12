# Transcript Recovery Gap Analysis

Date: 2026-06-12

This compares the deleted `/Users/steven/Downloads/vel-mcp` transcript summary against the current git checkout at `/Users/steven/Workspace/40_Code/projects/vel-mcp`.

## Current Status

The current repo is ahead of the small re-port impression. Much of the original readiness work is already present in the correct checkout under current module names:

- `ImageLoader` handles `file_path`, `artifact_id`, and `data_url` ingestion through `PathPolicy`, `ArtifactStore`, hashing, dimension extraction, warnings, and audit events.
- `RegionCropper` and `glasses.inspect_region` crop normalized regions, store crop artifacts, and return parent coordinate provenance.
- `ImageComparator` and `glasses.compare` support metadata, pixel, OCR, layout, and auto comparison.
- `VideoSampler` and `glasses.video_scan` sample bounded videos through ffmpeg/ffprobe and can run locate on sampled frames.
- LocateAnything parsing, label-aware detect routing, real MLX worker stdout redirection, CLI doctor/benchmark, and real eval receipts are now present.
- `pnpm verify`, `pnpm smoke:glasses`, and the real MLX locate smoke/quality evals passed during recovery.

The project is still not complete as a functional, benchmarked Vel-Glasses layer. The remaining gaps are narrower than the deleted-folder loss first suggested, but they are real.

## Recovered Or Already Present

| Transcript item | Current repo state | Evidence |
| --- | --- | --- |
| Typecheck and workspace package resolution | Present and verified | `pnpm verify` passed after recovery. |
| Structured provider failures instead of empty success | Present in provider/error envelope behavior and tests | `packages/glasses-mcp/src/providers/*`, provider tests. |
| Real MCP stdio smoke for all six tools and `glasses.locate` | Present | `scripts/smoke-glasses.sh` passes with explicit mock provider. |
| Image ingestion beyond schema | Present | `packages/glasses-mcp/src/services/imageLoader.ts`. |
| Path policy for local files | Present | `packages/core/src/security/pathPolicy.ts`; wired in `packages/glasses-mcp/src/server.ts`. |
| Artifact IDs | Present | `ImageLoader` and `ArtifactStore` path. |
| Data URL support with redaction | Present | `ImageLoader` plus MCP base redaction. |
| SHA-256, dimensions, file warnings, audit events | Present | `ImageLoader` tests and roadmap receipts. |
| Region crop with crop artifact provenance | Present | `packages/glasses-mcp/src/services/regionCropper.ts`; `packages/glasses-mcp/src/tools/inspectRegion.ts`. |
| Pixel compare | Present | `packages/glasses-mcp/src/services/imageComparator.ts`; `packages/glasses-mcp/src/tools/compare.ts`. |
| Video sampling scaffold | Present | `packages/glasses-mcp/src/services/videoSampler.ts`; `packages/glasses-mcp/src/tools/videoScan.ts`. |
| LocateAnything parser uncertainty | Present | `packages/glasses-mcp/src/parsers/locateAnything.ts`. |
| Label-aware dense detection route | Present | `packages/glasses-mcp/src/providers/velVisionProvider.ts`. |
| Worker stdout discipline | Present | `packages/glasses-mcp/workers/vel-worker/vel_glasses_worker/main.py`. |
| Real model smoke and quality reports | Present | `evals/glasses/runner/reports/locate-anything-*-report.*`. |

## Implementation Pass 2026-06-12

Closed or advanced in this pass:

- Added dry-run-first `vel-glasses setup locate-anything` with `--print-env` and `--check`.
- Updated live worker docs to the MLX-first `VEL_VISION_*` path.
- Updated model discovery guidance to respect `VEL_VISION_MODEL`, `HF_HOME`, and common local MLX cache paths.
- Added CLI one-shot `WorkerSupervisor.stopAll()` finalization across command handlers.
- Added `regionPx` to `glasses.inspect_region`, with conversion to normalized coordinates.
- Added crop-local locate result remapping back into parent-image coordinates.
- Added video `fps`, `maxDurationSec`, and `maxBytes` policy fields.
- Added hard video file-size rejection, duration truncation metadata, and frame artifact/region provenance on video events.
- Expanded the real LocateAnything quality dataset with a GUI click case.

Still open after this pass:

- Scene-change video sampling is schema-compatible but not implemented; the tool emits a warning when requested.
- Semantic compare remains undecided.
- Eagle/PyTorch remains an optional backend decision rather than an MLX recovery blocker.
- Real eval fixture breadth is still modest until more images/videos are added.

## Remaining Gaps Snapshot

| Gap | Impact | Suggested next action |
| --- | --- | --- |
| Setup automation is dry-run only | Operators still run dependency install/download commands explicitly. This is intentional for now because model downloads and dependency writes should be operator-owned. | Add opt-in install flags only after deciding the desired local install policy. |
| Historical docs still mention Eagle/PyTorch | Some older plan/reference docs preserve prior backend notes. | Update or archive historical docs when backend policy is settled. |
| No semantic compare mode | Current compare modes are metadata, pixel, OCR, layout, and auto. The deleted path included a provider-backed semantic compare idea. | Add `mode: "semantic"` only if the output contract stays structured and deterministic. |
| Scene-change video sampling is not implemented | `sceneChangeThreshold` is accepted but interval/fps sampling is used with a warning. | Add actual scene-change extraction if video use cases need it. |
| Real eval breadth is still small | Current real receipts cover blue-button object and GUI-click cases. | Add a fixture matrix: multiple boxes, text-ish target, negative/no-match, and latency budget report. |
| Eagle/PyTorch backend is not ported | Current repo intentionally moved MLX-first. The deleted setup path included PyTorch/Eagle dependency handling and a `decord` shim. | Treat as a separate optional backend decision, not a recovery blocker, unless NVIDIA/Eagle parity is required. |

## Priority Order

1. Add more real eval fixtures and refresh real MLX reports.
2. Decide whether semantic compare and Eagle/PyTorch are product requirements or optional provider lanes.
3. Implement actual scene-change sampling if video timeline use cases require it.

## Verification Receipts To Keep Current

- `pnpm verify`
- `pnpm smoke:glasses`
- Real MLX doctor:
  `VEL_VISION_PYTHON=.vel/venvs/glasses-mlx/bin/python VEL_VISION_MODEL=/Users/steven/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16 node packages/glasses-mcp/dist/cli.js --provider glasses-grounding doctor locate-anything`
- Real MLX evals:
  `pnpm eval:locate-anything-smoke`
  `pnpm eval:locate-anything-quality`
