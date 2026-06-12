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

## Remaining Gaps

| Gap | Impact | Suggested next action |
| --- | --- | --- |
| No automated `setup locate-anything` CLI equivalent | Operators still need manual venv/model setup. `glasses.setup` gives guidance, but does not install or validate end to end. | Add `vel-glasses setup locate-anything` with dry-run by default, explicit install flags, and no stdout noise. |
| Worker README is stale | It still references `VEL_LOCATEANYTHING_*` and the old Eagle/PyTorch layout while current implementation is MLX-first with `VEL_VISION_*`. | Update `packages/glasses-mcp/workers/vel-worker/README.md` and stale model-discovery guidance. |
| `inspect_region` only accepts normalized coordinates | Transcript implied both normalized and pixel-region ergonomics. Current schema requires `regionNorm1000`. | Add `regionPx` input with conversion to normalized coordinates when image dimensions are known. |
| `inspect_region` does not remap crop-local detections to parent coordinates | Cropper has mapping helpers, but the tool currently returns observations plus the selected region only. | If query/object inspection is requested, run locate/OCR on the crop and remap child boxes/points back to the parent image. |
| No semantic compare mode | Current compare modes are metadata, pixel, OCR, layout, and auto. The deleted path included a provider-backed semantic compare idea. | Add `mode: "semantic"` only if the output contract stays structured and deterministic. |
| Video sampling controls are basic | Current schema supports `everySeconds` and `maxFrames`; no `fps` or scene-change threshold. | Extend `VideoScanInputSchema.sampling` with controlled `fps` and optional scene-change policy after tests. |
| Video file-size enforcement is not hard | Duration truncation exists in `VideoSampler`; file-size is currently image-loader warning-level, not a video policy gate. | Add `maxDurationSec` and `maxBytes` to video policy, returning structured failure or truncation metadata. |
| Video events omit region provenance | Events include timestamp, frame index, label, confidence; frame artifacts are separate. Bboxes/centers are not carried into events. | Include bbox/center, uncertainty, and frame artifact ID on each event. |
| Non-benchmark real-provider CLI commands can leave workers alive | Benchmark exits explicitly; other CLI commands may keep the process open after starting a worker supervisor. | Add explicit supervisor shutdown or CLI process finalization for one-shot commands. |
| Model discovery does not fully respect custom cache layout | `VEL_VISION_MODEL` works for execution, but discovery guidance still points at default Hugging Face/Eagle paths. | Teach discovery about `VEL_VISION_MODEL`, `HF_HOME`, and the local MLX cache path pattern. |
| Real eval breadth is still small | Current real receipts cover one blue-button locate smoke and one quality case. | Add a small fixture matrix: GUI point, multiple boxes, text-ish target, negative/no-match, and latency budget report. |
| Eagle/PyTorch backend is not ported | Current repo intentionally moved MLX-first. The deleted setup path included PyTorch/Eagle dependency handling and a `decord` shim. | Treat as a separate optional backend decision, not a recovery blocker, unless NVIDIA/Eagle parity is required. |

## Priority Order

1. Fix stale setup/docs and one-shot CLI shutdown.
2. Add pixel-region input and parent-coordinate remapping for `inspect_region`.
3. Harden video policy: `maxDurationSec`, `maxBytes`, richer event provenance.
4. Expand real eval fixtures and reports.
5. Decide whether semantic compare and Eagle/PyTorch are product requirements or optional provider lanes.

## Verification Receipts To Keep Current

- `pnpm verify`
- `pnpm smoke:glasses`
- Real MLX doctor:
  `VEL_VISION_PYTHON=.vel/venvs/glasses-mlx/bin/python VEL_VISION_MODEL=/Users/steven/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16 node packages/glasses-mcp/dist/cli.js --provider glasses-grounding doctor locate-anything`
- Real MLX evals:
  `pnpm eval:locate-anything-smoke`
  `pnpm eval:locate-anything-quality`

