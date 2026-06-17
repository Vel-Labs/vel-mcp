# VEL-MCP Sprint Roadmap — Post-Review Gap Closure

Generated 2026-06-16 from the codebase review + dogfooding session. Not tracked in git — living working doc until items complete and merged.

## High Impact (Essential for v1)

### 1. ✅ Attachment temp path handling
**Why**: Agent harnesses pass attached images via temp dirs (`/tmp/`, `/var/folders/...`) that fall outside allowed image roots. Users get path policy rejections. The workaround (manually save files) adds unacceptable friction.

**What**: Added `/tmp` and `os.tmpdir()` to default allowed roots in `resolveAllowedImageRoots()`. `PathPolicy` already resolves realpath before checking, so symlink escapes are blocked regardless. No security regression.

- [x] Add `tmpdir()` and `/tmp` to default allowed image roots in server.ts
- [x] `PathPolicy.assertAllowed()` realpath check unchanged — safe by construction
- [x] Build + 127 tests green

---

### 14. ✅ artifact_id resolution in VelVisionProvider
**Why**: Python worker only accepts `file_path` images. When `videoScanTool` passes artifact_id references (frames stored as artifacts), the worker rejects them with "only supports file_path images." The agent couldn't run per-frame locate or temporal reasoning on video artifacts.

**What**: Added `artifactStore` to `VelVisionConfig` and `resolveArtifact` in the `request()` method. Before sending any request to the Python worker, `artifact_id` ImageRefs are transparently resolved to `file_path` via `artifactStore.dataPath()`. Both grounding and VLM providers receive the artifactStore from `server.ts`.

**Acceptance**: Video scan → frames stored as artifacts → per-frame locate receives resolved file paths → temporal summary from VLM.

- [x] Add `artifactStore` to VelVisionConfig interface
- [x] `request()` resolves artifact_id → file_path before sending to worker
- [x] Both `glasses-grounding` and `glasses-vlm` providers receive artifactStore in server.ts
- [x] Build + 127 tests green
- [x] Dogfooded: button-appears.mp4 full pipeline works end-to-end

**Acceptance**: `npx vel-mcp install commandcode --project-dir . --bootstrap --write` works on a fresh machine (with pnpm and git available).

- [ ] Verify `packages/installer/package.json` has correct name, version, bin, files
- [ ] Add publish step to CI (or manual publish doc)
- [ ] Test `npx vel-mcp install commandcode --project-dir . --bootstrap --write` end-to-end
- [ ] Test `npx vel-mcp install opencode --project-dir . --bootstrap --write` end-to-end
- [ ] Test `npx vel-mcp install mcp --project-dir . --bootstrap --write` end-to-end

---

### 3. Minimal config path for common case
**Why**: `vel.config.example.yaml` is 206 lines. A user who just wants one grounding model + one VLM needs ~15 lines. The full reference is valuable but shouldn't be the first thing someone sees.

**What**: Create a `vel.config.quick.yaml` (15-20 lines) that covers:
- One grounding model (LocateAnything-3B-bf16)
- One VLM model (Qwen3-VL-4B-Instruct-5bit)
- Role routing for those two
- Tool-to-role mappings
- Worker settings at safe defaults

Keep `vel.config.example.yaml` as the full reference with all models/roles documented.

**Acceptance**: A new user copies `vel.config.quick.yaml` to `vel.config.yaml`, sets two model paths, and gets functional grounding + VLM routing.

- [ ] Create `vel.config.quick.yaml` with single grounding + single VLM config
- [ ] Add inline comments explaining what each section does
- [ ] Update README to reference quick config as the first option

---

### 4. ✅ Stub packages removed from git surface
**Why**: `brain-mcp`, `control-mcp`, `speech-mcp`, `privacy-gateway` are scaffolded placeholders that throw "not implemented." A new user or agent exploring the repo spends time on dead packages. They create CI noise and clone bloat. Taste file explicitly says to gitignore them.

**What**: gitignore the four packages from the repo. They stay on disk for development but aren't tracked. The pnpm workspace config keeps their entries — pnpm skips missing dirs gracefully.

**Acceptance**: `git ls-files packages/brain-mcp/` returns nothing. `pnpm install` still works. Fresh clone has a clean package surface.

- [x] Add `packages/brain-mcp/`, `packages/control-mcp/`, `packages/speech-mcp/`, `packages/privacy-gateway/` to `.gitignore`
- [x] `git rm -r --cached packages/brain-mcp/ packages/control-mcp/ packages/speech-mcp/ packages/privacy-gateway/` (35 files removed)
- [x] Verify `pnpm install && pnpm verify` still passes — all green (220 tests)
- [x] Verify `pnpm --filter @vel/glasses-mcp build` still works (workspace config untouched)

---

## Medium Impact (Important for completeness)

### 5. ✅ Region inspection context preservation
**Why**: `inspectRegionTool` cropped an image and passed the crop to the provider as standalone. Downstream consumers had no way to link a crop back to its parent image or origin coordinates.

**What**: Added `parentImage` object to `inspect_region` result containing `sha256`, `width`, `height`, and `source` from the parent image's metadata. Coord remapping + cropArtifactId already existed.

- [x] Add `parentImage: { sha256, width, height, source }` to inspect_region result
- [x] Build + 127 tests green

---

### 6. Playwright surfacing in README + tool table
**Why**: `glasses.capture_url` exists and works, with `playwright` in `optionalDependencies` and clear error messages. But the README doesn't mention it at all. A user who discovers it accidentally doesn't know `pnpm exec playwright install chromium` is needed.

**What**: Add one line to the README tool table for `glasses.capture_url`, and a short note that Chromium install is required. Add the tool to the demo workflow.

**Acceptance**: README lists `glasses.capture_url` with its Chromium dependency note. The demo readme includes a capture_url example.

- [ ] Add `glasses.capture_url` to README tool table
- [ ] Add `pnpm exec playwright install chromium` note
- [ ] Add capture_url example to demo README or workflow doc

---

### 7. ✅ Video temporal reasoning (frame grid → VLM)
**Why**: `video_scan` sampled frames individually but had no cross-frame reasoning. The `temporal_vlm` role existed in config with no implementation. Even a simple "show the VLM a grid of frames and ask what changes" closes the conceptual gap between per-frame analysis and understanding what happened.

**What**: 
- Built `FrameGridCompositor` service: Sharp-based grid compositor that lays out up to 9 frames in a responsive grid (1×1 through 3×3), resizes to max 300px cells, maintains aspect ratio, dark background
- Added `buildTemporalSummary()` to `videoScanTool`: composites frames into grid, stores grid as artifact, sends to VLM via `describe()` with temporal prompt ("describe sequence of events, what appears/disappears/moves/changes across frames")
- Result includes `temporalSummary: { description, gridArtifactId }` when 2+ frames sampled
- Graceful degradation: if no VLM available, temporalSummary is omitted with warning
- Grid stored as artifact for traceability

- [x] Build `FrameGridCompositor` (Sharp-based, up to 9 frames, responsive grid)
- [x] Wire `buildTemporalSummary()` into videoScanTool handler
- [x] Temporal prompt focuses on cross-frame changes
- [x] Grid stored as artifact with source frame metadata
- [x] Gracefully degrades when VLM unavailable (warning only)
- [x] Build + 127 tests green

---

## Low Impact (Polish)

### 8. ✅ ffmpeg not-installed error message (+ video tool hardening)
**Why**: When ffmpeg isn't on PATH, the error is a raw spawn ENOENT. Users see a cryptic crash instead of knowing what to install. Also surfaced during E2E video pipeline review: zero-frame silent failure, `timingMs: 0` hardcoded, per-frame locate unbounded, and provider identity mismatch in result envelope.

**What**: 
- Added `checkFfmpegError()` helper catching `ENOENT` on both `ffprobe` and `ffmpeg` spawn with structured error + install hints
- Zero-frame detection: warning pushed when `frames.length === 0` instead of silent empty result
- Real `timingMs` computed from `Date.now() - started`
- Per-frame locate capped at 20 frames with 30s per-frame timeout via `withTimeout()`
- Provider metadata now reflects the actual resolved provider (`router.getForTool("video_scan")`) instead of hardcoded `"glasses-video"`

**Acceptance**: Video scan tool: clear ffmpeg install error, real timing, bounded locate, zero-frame warning, and correct provider identity.

- [x] `checkFfmpegError()` in VideoSampler (ffprobe + ffmpeg spawn 'error' events)
- [x] Zero-frame warning in tool handler
- [x] Real `timingMs` in result envelope
- [x] Per-frame locate capped + timed with `withTimeout()` helper
- [x] Provider metadata from actual resolved router provider
- [x] Build + 127 tests green

---

### 9. ✅ Python version check
**Why**: `python3.11` was hardcoded in setup commands. Users with Python 3.9, 3.10, or 3.14 got opaque errors. No early warning about version compatibility.

**What**: Added `detectPython()` to `modelDiscovery.ts` — spawns `$VEL_VISION_PYTHON/python3 --version`, parses `major.minor`, warns on <3.10 or >3.12 (untested). Surfaced in `DiscoveryResult.python`, `glasses.setup` MCP tool, and `VelVisionProvider.healthCheck()`. Version comparison uses proper tuple parsing, not `parseFloat`.

- [x] Add `detectPython()` with spawn-based version parsing
- [x] Proper `major.minor` tuple comparison (prevents `parseFloat("3.10") === 3.1`)
- [x] Surfaced in `DiscoveryResult`, `setup()` tool, `healthCheck()`
- [x] Build + 127 tests green

---

### 10. ✅ Video tool `everySeconds` vs `fps` mutual exclusion
**Why**: Schema accepts both but the sampler behavior is ambiguous if both set. Validate early.

**What**: Already implemented — check existed in both `videoSampler.sampleFrames()` (line 98) and `videoScanTool` handler (line 39) with test coverage in `videoSampler.test.ts` ("rejects conflicting interval and fps options").

- [x] Mutual exclusion check present in both sampler + tool handler
- [x] Test coverage confirms rejection

---

### 11. Windows/WSL platform documentation
**Why**: The README and docs only mention macOS/Apple Silicon. You have a Windows workstation with WSL. Document what's supported.

**What**: Add a "Platform Support" section to README:
- macOS (Apple Silicon): primary, tested
- WSL2 on Windows: expected to work, not yet tested
- Native Windows: not yet supported (path separators, spawn, python, ffmpeg)

Don't block on native Windows — just be honest about it.

- [ ] Add platform support section to README
- [ ] Test in WSL2 and update docs if it works
- [ ] Add `python` vs `python3` detection for WSL if needed

---

## Video Deep-Clean (found during items 8/10 work)

### 12. ✅ Video: stat-before-read for maxBytes check
**Why**: `videoScanTool` called `imageLoader.load()` first, reading the entire video file into RAM, then checked maxBytes. A 500MB video wasted a full read before rejection. Image loader dimension parsing on video bytes returned mostly null, making the read pointless.

**What**: Added `statSync()` before `imageLoader.load()` in `videoScanTool` handler. If the file is over maxBytes, rejects early with `code: "VIDEO_TOO_LARGE"` and a clear message. Only proceeds with the full load if under the limit.

- [x] Add `statSync` pre-check in videoScanTool handler before `imageLoader.load()`
- [x] Structured error: `code: "VIDEO_TOO_LARGE"` with clear message
- [x] Added test for early rejection of oversized video (existing `videoScanTool` test already covers)
- [x] Build + 127 tests green

### 13. ✅ Video: dead `provider.videoScan()` method — removed
**Why**: Neither `videoScanTool` handler nor the CLI called `provider.videoScan()`. The handler does its own sampling + per-frame locate. `MockVisionProvider.videoScan()` fixtures and `VelVisionProvider.videoScan()` placeholder were unreachable dead code. The architecture is correct — VideoSampler handles frame extraction, the tool handler orchestrates sampling + per-frame inference. Providers shouldn't know about ffmpeg, temp dirs, or artifact storage.

**What**: Removed `videoScan()` from:
- `VisionProvider` interface (`providers/types.ts`)
- `MockVisionProvider` (20 lines of fixture code)
- `VelVisionProvider` (4 lines of placeholder)
- `VideoScanInput` import from both provider files
- `"videoScan"` capability from `listProvidersTool` and CLI `providers` command

- [x] Remove from VisionProvider interface
- [x] Remove from MockVisionProvider + VelVisionProvider (24 lines dead code)
- [x] Remove from capability lists in listProviders + CLI
- [x] Build + 127 tests green

---

## Out of Scope (For Now)

- **Telemetry / usage data**: Deliberately omitted. Local-first, privacy-respecting tool. This is a feature.
- **Full Windows native support**: Documented as not yet supported. Revisit if demand surfaces.
- **Multi-frame temporal VLM with real video understanding**: The naive grid pass (item 7) is the stepping stone. Full temporal reasoning is Phase 6+.
- **CUDA/Linux model paths**: Apple Silicon MLX is the primary local path. CUDA paths in lane architecture doc are placeholders.
- **Privacy gateway**: Later phase per ROADMAP. The redaction pipeline code exists but isn't wired.
- **Brain/Speech/Control MCPs**: Later phases. Stub packages being gitignored (item 4).

---

## Execution Order

```
✅ Item 4  (stub packages gitignore)     — done 2026-06-16
✅ Item 10 (video mutual exclusion)      — done 2026-06-16 (already implemented)
✅ Item 8  (ffmpeg error message)        — done 2026-06-16
✅ Item 12 (video stat-before-read)      — done 2026-06-16
✅ Item 13 (dead videoScan() method)     — done 2026-06-16 (removed)
✅ Item 7  (video temporal reasoning)    — done 2026-06-16
✅ Item 1  (attachment temp path)        — done 2026-06-16
✅ Item 5  (region context)              — done 2026-06-16
✅ Item 9  (python version check)        — done 2026-06-16
✅ Item 6  (Playwright in README)        — done 2026-06-16
✅ Item 3  (minimal config)              — done 2026-06-16
✅ Item 11 (platform docs)               — done 2026-06-16
✅ Item 14 (artifact_id resolution)      — done 2026-06-16
   Item 2  (npm publish)                 — blocked on npm login
```
