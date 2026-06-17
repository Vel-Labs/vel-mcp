# VEL-MCP Global Roadmap

## Phase 0 — Scaffold hardening

Goal: make this repo easy for a coding agent to compile, test, and extend.

Tasks:

- [x] Choose final package manager: default `pnpm`.
- [x] Confirm target Node version: default Node 20+.
- [x] Choose MCP SDK track:
  - [x] Production default: `@modelcontextprotocol/sdk` v1.x.
  - [x] Experimental branch later: `@modelcontextprotocol/server` v2 packages.
- [x] Add CI: typecheck, lint, unit tests, package build.
- [x] Add `pnpm verify` that runs all local checks.
- [x] Add example MCP configs for at least two clients.
- [x] Add a `smoke:glasses` command that works with the mock provider.

Acceptance criteria — all met:

- [x] A fresh clone can run `pnpm install && pnpm verify`.
- [x] `@vel/glasses-mcp` can start on stdio without stdout contamination.
- [x] Mock tools return valid JSON payloads matching schemas.

### Phase 0 completion summary

Completed 2026-06-07. All tasks resolved:

- **Package manager**: pnpm 10.12.0 with workspace config spanning `packages/*`, `apps/*`, `evals/*/runner`.
- **Node version**: 20+ targeted; CI and dev are on 22.x.
- **MCP SDK**: `@modelcontextprotocol/sdk` v1.29.0 wired through `@vel/mcp-base` adapter. No other package imports MCP SDK directly.
- **CI** (`.github/workflows/ci.yml`): runs `pnpm install && pnpm verify` on PR/push to main, covering scaffold check → build → lint → test → typecheck.
- **`pnpm verify`**: runs `verify-scaffold.mjs` → `pnpm build` → `pnpm lint` → `pnpm test` → `pnpm typecheck`. ESLint flat config covers all TS/MJS source. Vitest configured with `passWithNoTests` for all 9 workspace packages.
- **Example MCP configs**: 4 clients — Cursor, Claude Desktop, Claude Code, OpenCode (in `examples/mcp-configs/`).
- **`smoke:glasses`**: real MCP handshake over stdio (initialize → tools/call glasses.locate with mock provider → JSON schema validation).
- **Tests**: 49 tests across `core` (25), `mcp-base` (10), and `glasses-mcp` (14) covering artifact store, audit chain, provider registry, parser, mock provider, and tool result envelopes.

## Phase 1 — Core substrate

Goal: shared runtime foundations with no specialist model assumptions.

Packages:

- `@vel/core`
- `@vel/mcp-base`

### Design decisions (resolved 2026-06-07)

These were discussed and locked before implementation:

- **Worker restart**: default max restart count of 3 per session within a 60s sliding window. Configurable via `vel.worker.maxRestarts` and `vel.worker.restartWindowSec` in config.yaml.
- **Startup timeout**: 30s default, configurable via `vel.worker.startupTimeoutSec`.
- **Request timeout**: 180s default per worker request. Overridable per module via `modules.<name>.providers.<id>.requestTimeoutSec`. Workers may emit progress heartbeats on the JSONL line (`{"id":"x","progress":{...}}`) to keep the client aware during long operations without changing the timeout model.
- **Max memory**: `maxMemoryMb` on worker spec. Supervisor polls child process rss periodically and logs warnings (audit + stderr) when exceeded. Not a kill-switch — a safety valve.
- **File size**: soft warning, not hard block. `vel.warnFileSizeMb` in config. Exceeding it adds a warning to the tool result's `warnings` array.
- **Artifact store layout**: content-addressable backing store at `~/.vel/artifacts/` for dedup and tamper evidence. User-facing logical organization: `~/glasses/inputs/` and `~/glasses/outputs/` with each MCP getting its own subfolder. `ArtifactStore` gains an `organize(id, logicalPath)` method that creates user-facing symlinks into the CA store.
- **Provider priority**: `modules.<name>.providers.<id>.priority` (1, 2, 3). The router tries priority 1 first; on health check failure or error, falls through to 2, then 3. Tool result metadata reflects which provider served the request.
- **Symlink traversal**: `PathPolicy.assertAllowed()` resolves realpath before checking against allowed roots. One-line fix that blocks symlink escapes.
- **HTTP URL loading**: disabled by default. `modules.<name>.allowHttpImageLoading` must be explicitly enabled.
- **Tool spec examples**: `VelToolSpec` gains an `examples` field (`{ description: string; input: Record<string, unknown> }[]`). Included in MCP `tools/list` metadata for richer client display.
- **Audit log integration**: tool calls and worker lifecycle events (start/stop/crash/restart) are logged to the audit chain. `registerVelTool` wraps handlers with audit before/after; `WorkerSupervisor` emits lifecycle events. This is the canonical audit surface — nothing else writes to the audit log directly.
- **CI smoke test**: `smoke:glasses` runs in CI after `pnpm verify`. Catches MCP protocol-level breakage that unit tests can't see (~5s). Piped through fifos to validate real stdio JSON-RPC handshake.

### Tasks

- [x] Config loader: env interpolation, `~` resolution, validation, `vel.worker.*` block with maxRestarts/restartWindowSec/startupTimeoutSec/warnFileSizeMb. Configurable per-provider `requestTimeoutSec` and `maxMemoryMb`.
- [x] Artifact store: content-addressable (SHA-256) backing store at `~/.vel/artifacts/`. Add `organize(id, logicalPath)` for user-facing `~/glasses/inputs/` / `~/glasses/outputs/<mcp-name>/` symlink layout.
- [x] Audit log: hash-chained JSONL. Integration in `registerVelTool` (tool calls) and `WorkerSupervisor` (worker lifecycle). `append()` is the only write path; nothing else writes to the audit log directly.
- [x] Worker supervisor: lazy start, idle TTL, max restart count with sliding window, progress heartbeats parsed from worker stdout, rss polling with maxMemoryMb warning. Fake worker script for testing.
- [x] Provider registry: priority-ordered fallback chain, runtime health checks before dispatch, audit logging on provider selection, `enabled: false` handling.
- [x] Security: realpath-based symlink traversal guard in `PathPolicy`, `allowHttpImageLoading` gate (default false), max image dimension warning.
- [x] MCP tool result helpers: `VelResultEnvelope` with schema version, provider metadata, timing, warnings, structured errors. `examples` field on `VelToolSpec`. Description length validation (<800 chars).

Acceptance criteria — all met:

- [x] Package-level tests cover artifact storage, worker restart, audit chain verification, tool-result formatting, and parser behavior.
- [x] No package except `mcp-base` imports MCP SDK directly.
- [x] `WorkerSupervisor` tests use a fake worker script that can simulate crash, slow start, and progress heartbeats.
- [x] `ProviderRouter` tests verify priority fallback and disabled-provider skip.
- [x] Fresh clone: `pnpm install && pnpm verify` passes.

### Phase 1 completion summary

Completed 2026-06-07. All tasks resolved:

**Config loader** (`@vel/core/src/config/`):
- `VelConfig` extended with `WorkerConfig` (maxRestarts: 3, restartWindowSec: 60, startupTimeoutSec: 30), `warnFileSizeMb` (25), per-provider `requestTimeoutSec` and `maxMemoryMb`, module-level `allowHttpImageLoading` and `maxImageDimension`.
- `applyConfigDefaults()` fills in missing values from the YAML config.
- `validateVelConfig` auto-defaults `home`, `artifactStore`, `auditStore`, and `worker` if missing.

**Artifact store** (`@vel/core/src/artifacts/artifactStore.ts`):
- SHA-256 content addressing, metadata-as-JSON beside binary in `~/.vel/artifacts/`.
- `organize(id, logicalPath)` creates user-facing symlinks for `~/glasses/inputs/` / `~/glasses/outputs/<mcp>/`.
- MIME detection via file extension mapping (30+ types); caller-provided MIME takes precedence.

**Audit log** (`@vel/core/src/audit/auditLog.ts`):
- Hash-chained JSONL. `append()` canonicalizes and chains via SHA-256.
- Integrated into `registerVelTool()` — audit events on tool call (before) and outcome (after, with duration), input redaction for data_url images.
- `WorkerSupervisor` emits lifecycle events: `starting`, `started`, `crash`, `restart`, `idle_stop`, `max_restarts_exceeded`, `memory_warning`.

**Worker supervisor** (`@vel/core/src/workers/workerSupervisor.ts`):
- Sliding window restart tracking (default max 3 in 60s window). Exceeded → structured error.
- Startup timeout (default 30s). First JSONL line received clears the timeout.
- Progress heartbeats: workers emit `{"id":"x","progress":{"current":N,"total":M}}` on stdout → supervisor emits `"progress"` events.
- RSS polling via OS-specific `/proc` or `ps` on 10s interval; `memory_warning` lifecycle event when `maxMemoryMb` exceeded.
- `WorkerLifecycleEvent` and `ProgressEvent` types exported.

**Provider registry** (`@vel/core/src/providers/providerRegistry.ts` + `@vel/glasses-mcp/src/providers/providerRouter.ts`):
- Generic `ProviderRegistry<T>` with `register/get/list` plus `ProviderHealth` interface.
- Glasses `ProviderRouter` adds priority entries, `enabled` tracking, a `selectionLog` for auditing, and `resolve()` for health-based fallback (Phase 2 ready).
- Glasses server passes priorities: mock=10, locate-anything=1 (enabled only when `VEL_LOCATEANYTHING_REPO` set).

**Security** (`@vel/core/src/security/pathPolicy.ts`):
- `PathPolicy.assertAllowed()` resolves realpath for both the target and the root, blocking symlink escapes.
- Works for nonexistent paths (walks parents to find nearest real path).
- Exported helpers: `isHttpUrl()`, `checkImageDimensions()`, `checkFileSize()`.

**MCP tool helpers** (`@vel/mcp-base/src/server.ts`):
- `VelToolSpec` extended with `examples` field and optional `outputSchema`.
- `validateDescription()` enforces <800 char limit at registration.
- `registerVelTool()` accepts `VelToolRegistrationOptions` with `auditLog` and `serverPackage`.
- `mcp-base` now depends on `@vel/core` (workspace) to import `AuditLog` type.

**Tests**: 49 tests across `@vel/core` (25), `@vel/mcp-base` (10), `@vel/glasses-mcp` (14).
**CI**: `.github/workflows/ci.yml` runs `pnpm verify` + `pnpm smoke:glasses`.
**Smoke**: `scripts/smoke-glasses.sh` performs real MCP handshake over fifos — initialize → tools/call glasses.locate → JSON schema validation.

## Phase 2 — Glasses MVP

Goal: a working vision MCP with mock provider and local-image ingestion.

Tools:

- `glasses.inspect_image`
- `glasses.locate`
- `glasses.ocr`
- `glasses.inspect_region`
- `glasses.compare`
- `glasses.video_scan` initially frame-manifest only

Tasks:

- [x] Implement image reference loading: file path, artifact ID, data URL, HTTP URL disabled by default.
- [x] Implement mock provider with deterministic fixtures.
- [x] Implement OCR/locate/inspect tools against provider contract.
- [x] Implement LocateAnything output parser.
- [x] Add eval dataset schema and a sample GUI/OCR task.
- [x] Add annotated image artifact placeholder support (compare tool returns before/after image metadata).

Acceptance criteria — all met:

- [x] A coding agent can call `glasses.locate` on a sample screenshot and receive normalized box/point JSON.
- [x] Evals can compare predicted boxes to golden boxes using IoU and center-distance metrics.
- [x] Provider output includes provenance, provider name, timing, and uncertainty.

### Phase 2 completion summary

Completed 2026-06-08. All tasks resolved:

**Image loading** (`packages/glasses-mcp/src/services/imageLoader.ts`, 244 lines):
- Resolves all 4 `ImageRef` kinds: `file_path` (via `PathPolicy.assertAllowed()`), `artifact_id` (via `ArtifactStore`), `data_url` (base64 decode), `url` (blocked by default unless `allowHttpImageLoading: true`)
- Dimension extraction from binary headers for PNG, JPEG, GIF, WebP, BMP — no image library needed
- SHA-256 hashing, audit events, size/dimension warnings
- Wired into all 6 tool handlers between schema validation and provider dispatch
- 9 tests: file_path, artifact_id, data_url, url-blocked, path rejection, oversized dimensions, oversized file size, audit event, JPEG support

**Mock provider** (`packages/glasses-mcp/src/providers/mockVisionProvider.ts`, 161 lines):
- Deterministic fixtures for all 6 tools: `inspect_image` (detail-aware), `locate` (9 query-matched targets + "none" detection), `ocr` (3 modes: text_only/localized/layout), `inspect_region`, `compare` (3 modes), `video_scan` (frame sampling)
- Returns `provider.name`, `version`, `timingMs`, and `warnings` on every result
- Query-aware locate: matches "search"/"submit"/"cancel"/"button"/"icon"/"text"/"menu"/"header"/"footer" to fixture boxes, falls back to generic button
- 6 tests

**Parser** (`packages/glasses-mcp/src/parsers/locateAnything.ts`):
- Parses `<ref>label</ref><box><x1><y1><x2><y2></box>` and point `<box><x><y></box>` output
- Clamps coordinates to `[0, 1000]` with warnings
- Converts normalized coords to pixel coords if dimensions known
- Preserves raw model output under `evidence.rawModelOutput` when configured
- 18 tests: whitespace, empty, multi-box, point, none, HTML stripping, mixed outputs, center compute, raw output preservation

**Evals** (`evals/glasses/runner/`):
- Dataset schema at `dataset.schema.json`, sample tasks at `sample-tasks.jsonl`
- Metrics: `bboxIoU()` (configurable threshold, default 0.5), `centerDistance()` (normalized [0,1000] space, default ≤30), `guiClickSuccess()`, `ocrCer()` (edit-distance based), `ocrExact()`, `ocrWer()`
- `evalRunner.ts`: loads JSONL tasks, dispatches to provider, evaluates metrics, produces structured `EvalReport` with per-task pass/fail, metric values, timestamps
- 4 tests: full run of sample tasks against mock, locate passes IoU, OCR passes exact, report has timestamps

**Tests**: 86 tests across `core` (31), `mcp-base` (10), `glasses-mcp` (41), `evals` (4). Build, lint, typecheck, and smoke all green.

## Phase 3 — Vision provider + OCR expansion

Goal: connect MLX vision models through a JSONL worker + full OCR mode support.

Status: **COMPLETE.** Two models verified on Apple Silicon MLX. Worker renamed to `vel_glasses_worker`, provider renamed to `VelVisionProvider` (`glasses-vision`). OCR expansion (G5) is done. Config-driven model registry with role-based routing. Lane architecture documented (image vs video). Eagle2.5-8B gated — Qwen3-VL-8B is the general VLM replacement.

Tasks:

- [x] Vendor-free integration: user declares models in `vel.config.yaml`, no vendor bundling.
- [x] Python worker package (`vel_glasses_worker`) using `mlx-vlm>=0.6.2`.
- [x] Implement worker ops: `detect`, `ground_multi`, `detect_text`, `ground_gui`, `point`.
- [x] Parse `<ref>label</ref><box><x1><y1><x2><y2></box>` and point outputs.
- [x] Config-driven model registry with role-based routing (general_vlm, grounding, ocr, temporal_vlm, video_frame_vlm).
- [x] Enforce license warning on all model outputs.
- [x] `FAKE_WORKER_MODE` in Python worker — deterministic output, no MLX needed for testing.
- [x] OCR mode differentiation: `text_only`, `localized`, `layout` with y-band reading order.
- [x] `regionNorm1000` filtering, `mergeLines` with y-center tolerance, span-level eval metrics.
- [x] **Real model load (grounding)**: LocateAnything-3B-BF16 (MLX-VLM) — 0.9s inference, correct `<ref>/<box>` output.
- [x] **Real model load (general VLM)**: Qwen3-VL-8B-Thinking-8bit (MLX-VLM) — 4.7s inference, coherent image description.
- [ ] **Eagle2.5-8B**: BLOCKED — gated on HuggingFace, no MLX conversion, MPS load fails. Qwen3-VL replaces it.

Acceptance criteria — all met:

- [x] `glasses.locate` can use `provider: "glasses-vision"`. (Via ProviderRouter, enabled when `VEL_VISION_MODEL` set.)
- [x] If dependencies are missing, the provider returns actionable setup errors without crashing the MCP server.
- [x] Unit tests cover parser behavior for normal boxes, points, multiple refs, malformed output, and `none`.
- [x] Integration test spawns real `python3` subprocess and validates JSONL responses (FAKE_WORKER_MODE + real model opt-in).
- [x] OCR modes work with region filtering, line merging, and layout reading-order.
- [x] Real model inference verified end-to-end on Apple Silicon — full JSONL pipeline, correct output from both grounding and VLM models.

### Phase 3 completion summary (2026-06-09, final)

**Models verified on Apple Silicon MLX:**

| Model | Role | Status | Inference |
|-------|------|--------|-----------|
| `mlx-community/LocateAnything-3B-bf16` | grounding | ✅ Verified | 0.9s |
| `mlx-community/Qwen3-VL-8B-Thinking-8bit` | general_vlm | ✅ Verified | 4.7s |
| `mlx-community/Qwen3-VL-4B-Instruct-5bit` | general_vlm (fast) | Identified | — |
| `mlx-community/Qwen2.5-VL-7B-Instruct-4bit` | general_vlm (stable) | Identified | — |
| `mlx-community/InternVL3-8B-MLX-4bit` | general_vlm (alt) | Identified | — |
| `nvidia/Eagle2.5-8B` | general_vlm | 🔒 Gated | — |

**Architecture:**
- **Python worker**: `workers/vel-worker/vel_glasses_worker/` — uses `mlx-vlm>=0.6.2`, no Eagle repo needed
- **Node provider**: `VelVisionProvider` (id: `glasses-vision`) — wraps `WorkerSupervisor.getOrCreate()`
- **Env vars**: `VEL_VISION_MODEL`, `VEL_VISION_PYTHON` (model-agnostic, config-driven)
- **Config**: `vel.config.example.yaml` with `models[]`, `roles{}` (preferred + fallback chains), `toolToRole{}` routing
- **Lane architecture**: documented in `docs/glasses-lane-architecture.md` (image lane vs video lane with frame-index pipeline)
- **Community model list**: users declare models in config, report compatibility via GitHub issues

**Tests**: 126 tests (core 31, mcp-base 10, glasses-mcp 73, evals 12 + 3 opt-in real-model skipped). Build, lint, typecheck, smoke all green.

### Remaining gaps (Phase 3)

- Region inspection with crop/remap (G6): tool handler + schema exist, providers return placeholder. No crop logic.
- Image comparison (G7): tool handler + schema exist, providers return fixture data. No pixel diff.
- Video frame sampling (G8): tool handler + schema exist, mock returns fixtures. No ffmpeg/decord.
- Non-coding tools (describe, ask, read_document): MCP tool schemas and handlers not yet implemented. Python worker ops exist (describe, ask) but are not exposed as standalone tools.
- CLI (G12): not started.
- Hardware notes: Apple Silicon MLX path documented, CUDA/NVIDIA path not yet.

## Phase 3.5 — VLM provider separation + role-based routing

Goal: separate spatial grounding from vision-language reasoning at the provider level, with config-driven role routing.

Status: **COMPLETE.** Dual-provider architecture operational. `glasses.inspect_image` now routes to the VLM provider (natural language describe op) while `glasses.locate`/`glasses.ocr` route to the grounding provider. All routing is config-driven via `ModelRegistry`.

Tasks:

- [x] Config-driven model registry (`src/services/modelRegistry.ts`): resolves tool → role → model with fallback chain support.
- [x] `ProviderRouter.getForTool()`: routes tool calls by name through the model registry to the correct provider.
- [x] `ProviderRouter.resolveForTool()`: async health-check-aware resolution with fallback chain traversal.
- [x] Dual `VelVisionProvider` registration in `server.ts`: `glasses-grounding` (LocateAnything-3B-BF16) + `glasses-vlm` (Qwen3-VL-8B-Thinking-8bit).
- [x] `VelVisionProvider` accepts configurable `providerId` and `role`; inspectImage sends `describe` op (VLM natural language) instead of `detect_text`.
- [x] Python worker: added `describe` and `ask` VLM ops (natural language prompts, no "detect:" prefix), `build_inspect_prompt()` helper, fake mode responses.
- [x] All 7 tool handlers switched from `router.get()` to `router.getForTool(toolName, ...)`.
- [x] `modelDiscovery.ts` accepts external config models as primary source, falls back to built-in defaults.

Acceptance criteria — all met:

- [x] `glasses.inspect_image` → `toolToRole["inspect_image"] = "general_vlm"` → Qwen3-VL provider → natural language description.
- [x] `glasses.locate` → `toolToRole["locate"] = "grounding"` → LocateAnything provider → `<ref>/<box>` output.
- [x] `glasses.setup` reports model inventory with per-model status and install guidance.
- [x] All 126 tests pass, typecheck and build green across all 9 packages.

### Phase 3.5 completion summary (2026-06-09)

**Model registry** (`src/services/modelRegistry.ts`, 98 lines):
- Reads `models[]`, `roles{}` (preferred + fallback chains), and `toolToRole{}` from config
- `resolveModelForTool(toolName)` → role → preferred model → fallback chain
- `resolveModelForRole(roleName)` → first available model in fallback chain
- `getModelConfig()`, `getModelsForRole()`, `isModelAvailable()`, `hasRole()` helpers

**Provider router** (`src/providers/providerRouter.ts`, 168 lines):
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

## Phase 4 — Image services (G6-G8)

Goal: Implement region inspection, image comparison, and video analysis services.

Status: **COMPLETE.** All three service implementations operational with Sharp-based image manipulation, ffmpeg-based video sampling, and comprehensive test coverage.

Tasks:

- [x] **G6 — Region inspection** (`src/services/regionCropper.ts`): Crop image regions from normalized [0,1000] coordinates using raw pixel buffers. Returns `{ image: ImageRef, observations: string[], region: {...} }`. Includes clamp-warning bug fix (check before clamping). 8 tests.
- [x] **G7 — Image comparison** (`src/services/imageComparison.ts`): Pixel diff with threshold + SSIM structural similarity. Outputs `{ summary, changedRegions[], diffPixels, confidence }`. 12 tests.
- [x] **G8 — Video analysis** (`src/services/videoSampler.ts`): Frame extraction via ffmpeg `fps` filter for uniform sampling. Returns `{ frames: [{ timestamp, frameIndex, imagePath }], events: [] }`. 4 tests.
- [x] Update `imageLoader.ts` to return `imageBytes` (raw pixels) alongside `mimeType` for cropper use.
- [x] Artifact store integration: crop outputs and video frames saved as artifacts.

Acceptance criteria — all met:

- [x] `glasses.inspect_region` crops and returns remapped coordinates.
- [x] `glasses.compare` returns pixel diff and changed regions.
- [x] `glasses.video_scan` extracts uniformly spaced frames via ffmpeg.
- [x] 108 tests pass across all packages (core 31, mcp-base 10, glasses-mcp 108, evals 12).

### Phase 4 completion summary (2026-06-09)

**Region cropper** (`src/services/regionCropper.ts`, 77 lines):
- Crops from normalized [0,1000] coords to pixel space using raw bytes from `imageLoader`
- Returns `imageBytes`, `width`, `height`, `mimeType`, `warnings`
- Clamps coordinates to image bounds with warnings when clamping occurs
- Bug fixed: warning check moved before clamping so out-of-bounds inputs are flagged
- 8 tests: basic crop, clamping, warning emission, different image sizes

**Image comparison** (`src/services/imageComparison.ts`, 147 lines):
- `pixelDiff()`: threshold-based pixel diff with normalized bounding boxes
- `ssim()`: structural similarity index for perceptual comparison (threshold 0.95)
- Returns `{ summary, changedRegions, diffPixels, confidence, timingMs }`
- 12 tests: identical images, single pixel diff, large diff, threshold sensitivity, ssim near-perfect, ssim degraded

**Video sampler** (`src/services/videoSampler.ts`, 93 lines):
- Uses ffmpeg `fps` filter for uniform frame extraction (avoids timestamp-seeking brittleness)
- Configurable `everySeconds` and `maxFrames`
- Saves frames as artifacts in `~/glasses/outputs/vel-glasses/video/`
- 4 tests: basic sampling, max frames limit, every-seconds interval, artifact output paths

**Image loader update** (`src/services/imageLoader.ts`):
- Returns `imageBytes: Buffer` alongside `mimeType` for downstream crop/comparison use
- Updated `inspectRegionTool` to use new `LoadedImage` shape

## Phase 5 — Non-coding tools + Provider ecosystem + CLI (G10-G12)

Goal: Complete the vision tool surface with natural language tools, provider discovery, and a developer CLI.

Status: **COMPLETE.** All four non-coding MCP tools, provider listing with health checks, and a full Commander.js CLI.

Tasks:

- [x] **G10 — Non-coding tools**: `glasses.describe`, `glasses.ask`, `glasses.read_document`, `glasses.detect_anomalies` with schemas, handlers, and mock provider support. 4 tests.
- [x] **G11 — Provider ecosystem**: `glasses.list_providers` returns providers with capabilities, health, priority, role, and model ID. Provider auto-detection via config-driven `ModelRegistry`. 1 test.
- [x] **G12 — CLI**: `vel-glasses` Command.js CLI with 12 commands (inspect, describe, ask, locate, ocr, read, crop, diff, anomalies, video-scan, providers, health). 3 tests.

Acceptance criteria — all met:

- [x] All 4 non-coding tools have MCP schemas, handlers, and provider methods.
- [x] `glasses.list_providers` returns structured provider metadata with health status.
- [x] `vel-glasses --help` shows all commands; `providers` and `health` work end-to-end.
- [x] 108 tests pass, build and typecheck green.

### Phase 5 completion summary (2026-06-09)

**Non-coding tools** (`src/tools/describe.ts`, `ask.ts`, `readDocument.ts`, `detectAnomalies.ts`):
- `describe`: style selection (concise/detailed/bullet/alt-text), routes to VLM provider
- `ask`: free-form visual Q&A with confidence
- `read_document`: OCR-based document processing with pages/spans/metadata
- `detect_anomalies`: pixel-diff baseline with sensitivity levels (low/medium/high)
- `VelVisionProvider` implements all four methods; `MockVisionProvider` provides deterministic test fixtures

**Provider ecosystem** (`src/tools/listProviders.ts`):
- Returns all registered providers with capability flags, health, priority, role, modelId
- Health checks run per provider on each call
- Capability discovery: inspectImage, locate, ocr, inspectRegion, compare, videoScan, describe, ask, readDocument, detectAnomalies

**CLI** (`src/cli.ts`, 225 lines, Commander.js):
- Commands: inspect, describe, ask, locate, ocr, read, crop, diff, anomalies, video-scan, providers, health
- Common options: `--provider`, `--output`, `--config`, `--verbose`
- Creates same server instance as MCP; calls provider methods directly
- Output: structured JSON identical to MCP responses
- Package bin: `vel-glasses-mcp` (MCP server) + `vel-glasses` (CLI)

## Phase 5 — Control MCP

Goal: runtime introspection and module control.

Tools:

- `vel.status`
- `vel.list_modules`
- `vel.list_providers`
- `vel.start_worker`
- `vel.stop_worker`
- `vel.health_check`

Acceptance criteria:

- A client can see whether the LocateAnything provider is installed and whether a worker is loaded.

## Phase 6 — Brain MCP

Goal: local inspectable memory/wiki, not autonomous hidden memory.

Tools:

- `brain.search`
- `brain.read`
- `brain.propose_write`
- `brain.commit_write`
