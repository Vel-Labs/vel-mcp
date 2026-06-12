# Phase 3.5 & 4 Implementation Plan

## Architecture: Role-Based Multi-Provider

```
Tool handlers
  → router.getForTool("inspect_image") → provider.inspectImage()
                                       ↓
ProviderRouter (enhanced)
  ├── ModelRegistry: config.models[] + roles{} + toolToRole{} → resolve(modelId)
  ├── MockVisionProvider    (id: "mock", priority: 10)
  ├── VelVisionProvider     (id: "glasses-grounding", model: LocateAnything-3B)
  └── VelVisionProvider     (id: "glasses-vlm", model: Qwen3-VL-8B)
                                       ↓
WorkerSupervisor
  ├── worker: glasses-grounding → Python, VEL_VISION_MODEL=LocateAnything-3B
  └── worker: glasses-vlm       → Python, VEL_VISION_MODEL=Qwen3-VL-8B-8bit
```

**Key decisions:**
- Two provider instances from the **same** `VelVisionProvider` class, differentiated by config (`providerId` + `model`)
- Two Python worker processes, each loading one model (no runtime model switching)
- Config-driven routing via new `ModelRegistry` service
- Crop (G6) and pixel diff (G7) in Python (PIL); ffmpeg (G8) in TypeScript
- VLM missing → clear error with setup guide; G8 → extract frames only (agent-driven)

## Phase 3.5: Wire General VLM Lane

### Step 1: Create `ModelRegistry` service
**New file:** `packages/glasses-mcp/src/services/modelRegistry.ts`

Parses `config.models[]`, `config.roles{}`, `config.toolToRole{}` and provides:
- `resolveModelForTool(toolName)` → `{ modelId, role, providerConfig }`
- `getModelConfig(modelId)` → model config with `kind`, `taskAffinity`, `enabled` etc.
- `isModelAvailable(modelId)` → checks if model path/config is usable
- Fallback chain support via `roles.<role>.preferred` + `roles.<role>.fallback`

### Step 2: Enhance `ProviderRouter` with role routing
**Modify:** `packages/glasses-mcp/src/providers/providerRouter.ts`

Add:
- `modelRegistry: ModelRegistry` field in constructor
- `providerModelMap: Map<string, string>` — modelId → providerId
- `register()` extended opts: `{ modelId?, role? }`
- `getForTool(toolName, explicitProviderId?)` — resolves via ModelRegistry, falls back to default
- `resolveForTool(toolName)` — async with health checks and fallback chain

### Step 3: Add VLM ops to Python worker
**Modify:** `workers/vel-worker/vel_glasses_worker/main.py`

New ops in `handle()`:
- `describe` — natural language image description (no "detect:" prefix)
- `ask` — free-form visual QA
- `inspect` — structured inspection with detail level, object/text/layout flags

New methods on `MLXVisionWorker`:
- `describe(image, prompt, max_tokens=512)` — VLM inference
- `ask(image, question, max_tokens=512)` — VLM inference
- `build_inspect_prompt(detail, includeObjects, includeText, includeLayout)` — prompt builder

Key difference: VLM ops use natural language prompts (no `"detect: "` prefix).

### Step 4: Enhance `VelVisionProvider` for dual-role
**Modify:** `packages/glasses-mcp/src/providers/velVisionProvider.ts`

- Constructor accepts `{ providerId?, model, role? }` — `providerId` becomes the instance ID and worker ID
- `inspectImage()` sends `describe` op (not `detect_text`) — routes through VLM worker
- `healthCheck()` reports correct model/role

### Step 5: Wire in `server.ts`
**Modify:** `packages/glasses-mcp/src/server.ts`

- Parse config → create `ModelRegistry`
- Create `ProviderRouter` with registry
- Register mock (always, priority 10)
- Register `glasses-grounding` provider if grounding model available
- Register `glasses-vlm` provider if VLM model available
- If VLM not available: throw clear error with setup guide (model paths, install commands)

### Step 6: Update tool handlers
**Modify:** all 6 tool files under `src/tools/`

Change `router.get(input.provider).method(input)` → `router.getForTool(toolName, input.provider).method(input)`:
- `inspectImage.ts` → `"inspect_image"`
- `locate.ts` → `"locate"`
- `ocr.ts` → `"ocr"`
- `inspectRegion.ts` → `"inspect_region"`
- `compare.ts` → `"compare"`
- `videoScan.ts` → `"video_scan"`

### Step 7: Refactor `modelDiscovery.ts`
**Modify:** `packages/glasses-mcp/src/services/modelDiscovery.ts`

- Accept config models as primary source (via `ModelRegistry`)
- Fall back to `DEFAULT_MODELS` only when config has no models
- Remove hardcoded `VEL_VISION_MODEL` coupling
- Update `setup()` tool to use `ModelRegistry` for model discovery reporting

## Phase 4: G6 → G7 → G8

### G6: Region Inspection (`inspectRegion`)

**Modify:** Python worker `main.py` — add `crop_and_inspect` op:
- Convert `regionNorm1000` → pixel coordinates using image dimensions
- Crop via PIL (`image.crop(px_region)`)
- Save cropped region to temp file (artifact)
- Run `describe` on cropped region
- Return observations + crop artifact reference

**Modify:** `VelVisionProvider.inspectRegion()` — send `crop_and_inspect` op instead of returning stub.

**New dependency:** none (PIL already loaded in worker).

### G7: Image Comparison (`compare`)

**Modify:** Python worker `main.py` — add `diff` op:
- Load both images via PIL
- Convert to numpy arrays, compute per-pixel absolute diff
- Apply threshold (default 30), find connected components → bounding boxes
- Return changed regions as `bboxNorm1000` (converted from pixel coords)

**Modify:** `VelVisionProvider.compare()`:
- `mode: "pixel"` → send `diff` op to worker
- `mode: "metadata"` → implement in TypeScript: sha256, dimensions, file size comparison (data already available from ImageLoader)
- `mode: "ocr"` and `"layout"` → deferred to follow-up

**New dependency:** `numpy` in Python worker (add to `pyproject.toml`).

### G8: Video Frame Scanning (`videoScan`)

**New file:** `packages/glasses-mcp/src/services/videoFrameExtractor.ts`

- `VideoFrameExtractor` class using `child_process.execFile`
- `extractFrames(videoPath, { everySeconds, maxFrames })`:
  1. Run `ffprobe` to get duration, fps, resolution
  2. Calculate frame timestamps
  3. Run `ffmpeg -i <video> -vf "fps=1/{everySeconds}" -frames:v {maxFrames} frame_%04d.png`
  4. Store extracted frames in artifact store
  5. Return `FrameExtract[]`: `{ index, timestampSeconds, artifactId, path }`

**Modify:** `VelVisionProvider.videoScan()`:
- Call `VideoFrameExtractor.extractFrames()`
- Return frame manifest with metadata + artifact references
- **Do NOT** run VLM on frames automatically (agent-driven: agent calls `inspectImage` on frames of interest)
- Enforce hard limits: max duration (configurable, default 10 min), max file size, max frames (500)

**New dependency:** `ffmpeg` and `ffprobe` expected on system PATH (documented requirement, not bundled).

## File Change Summary

### New Files (3)
| File | Purpose |
|------|---------|
| `packages/glasses-mcp/src/services/modelRegistry.ts` | Config-driven model registry with role resolution + fallback chains |
| `packages/glasses-mcp/src/services/videoFrameExtractor.ts` | ffmpeg frame extraction service |

### Modified — TypeScript (12)
| File | Changes |
|------|---------|
| `src/providers/providerRouter.ts` | Add `ModelRegistry`, `getForTool()`, extend `register()` |
| `src/providers/velVisionProvider.ts` | Configurable id/workerId, real `inspectImage/inspectRegion/compare/videoScan` |
| `src/providers/mockVisionProvider.ts` | No changes needed (mock is for tests, always works) |
| `src/server.ts` | Parse config → ModelRegistry, register two providers, error on missing VLM |
| `src/services/modelDiscovery.ts` | Read from config, remove hardcoded coupling |
| `src/tools/inspectImage.ts` | `router.get()` → `router.getForTool("inspect_image")` |
| `src/tools/locate.ts` | `router.get()` → `router.getForTool("locate")` |
| `src/tools/ocr.ts` | `router.get()` → `router.getForTool("ocr")` |
| `src/tools/inspectRegion.ts` | `router.get()` → `router.getForTool("inspect_region")` |
| `src/tools/compare.ts` | `router.get()` → `router.getForTool("compare")` |
| `src/tools/videoScan.ts` | `router.get()` → `router.getForTool("video_scan")` |
| `src/tools/setup.ts` | Use ModelRegistry for model discovery reporting |

### Modified — Python (1)
| File | Changes |
|------|---------|
| `workers/vel-worker/vel_glasses_worker/main.py` | `describe`, `ask`, `inspect`, `crop_and_inspect`, `diff` ops |

### Modified — Config (1)
| File | Changes |
|------|---------|
| `workers/vel-worker/pyproject.toml` | Add `numpy` dependency |

## Implementation Order

1. **ModelRegistry** — foundation for everything
2. **ProviderRouter enhancement** — role-aware routing
3. **Python worker VLM ops** (`describe`, `ask`, `inspect`) — real VLM inference
4. **VelVisionProvider enhancement** — configurable id, real `inspectImage`
5. **server.ts wiring** — register both providers, wire config, VLM-missing error
6. **Tool handler updates** — switch to `getForTool`
7. **modelDiscovery.ts refactor** — read from config

   *↑ Phase 3.5 complete at this point — `inspectImage` uses real Qwen3-VL*

8. **G6: crop_and_inspect** — Python op + provider method
9. **G7: diff** — Python op + provider method + TS metadata fallback
10. **G8: VideoFrameExtractor** + videoScan orchestrator

## Verification

### Phase 3.5 verification
- `glasses.inspect_image` with VLM model configured → returns real Qwen3-VL description (not mock, not detect_text)
- `glasses.locate` and `glasses.ocr` still use LocateAnything (grounding lane unchanged)
- VLM not installed → `glasses.inspect_image` returns clear error with install commands
- `glasses.setup` reports both grounding and VLM model status
- All 126 existing tests still pass (mock provider unaffected)
- New tests: ModelRegistry resolution, ProviderRouter.getForTool dispatch

### G6 verification
- `glasses.inspect_region` with a valid regionNorm1000 → crops region, runs VLM, returns observations
- Crop coordinates are correct (verify via known test image + known region)
- Cropped artifact is stored and referenceable

### G7 verification
- `glasses.compare` with two different PNGs → returns changed bounding boxes
- `mode: "metadata"` → returns sha256/dimension/size diff
- `mode: "pixel"` → returns pixel diff regions

### G8 verification
- `glasses.video_scan` with a short video → returns frame manifest with timestamps and artifact refs
- Agent can call `glasses.inspect_image` on individual frames
- Hard limits enforced (duration, file size, frame count)
