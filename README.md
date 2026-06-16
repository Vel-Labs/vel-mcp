# VEL-MCP — Vel Engineered Layers

VEL-MCP is a modular tooling scaffold for giving LLMs purpose-built local or cloud-backed “senses” without forcing the primary model to be multimodal or stateful.

The intended product shape is:

```text
VEL = one install, one config, one artifact/audit substrate
MCP packages = separate capability surfaces with separate trust boundaries
Workers = lazy-loaded local or remote specialist models
Privacy = gateway/hook first, MCP second
```

## Quick Start

```bash
npx @vel/mcp install commandcode --project-dir /path/to/your/project --bootstrap --write
```

Replace `commandcode` with your agent:

| Agent | Command |
|-------|---------|
| CommandCode | `npx @vel/mcp install commandcode --project-dir /path/to/project --bootstrap --write` |
| OpenCode | `npx @vel/mcp install opencode --project-dir /path/to/project --bootstrap --write` |
| Codex | `npx @vel/mcp install codex --project-dir /path/to/project` |
| Generic MCP | `npx @vel/mcp install mcp --project-dir /path/to/project --bootstrap --write` |

Then ask your agent naturally: *"Look at this screenshot and describe what stands out."* The agent guidance handles tool routing — you never need to type MCP tool names.

**After setup**: set your model env vars in the agent's MCP config. At minimum:

```bash
VEL_VISION_MODEL=/path/to/LocateAnything-3B-bf16
VEL_VISION_VLM_MODEL=/path/to/Qwen3-VL-4B-Instruct-5bit
VEL_VISION_PYTHON=/path/to/.vel/venvs/glasses-mlx/bin/python
```

See the [Installer](#installer) section below for details, and copy `vel.config.quick.yaml` → `vel.config.yaml` for the minimal config.

## Implementation priority

1. `@vel/core` — config, artifacts, audit logs, provider registry, lazy worker supervisor.
2. `@vel/mcp-base` — minimal MCP registration adapter so SDK churn is isolated.
3. `@vel/glasses-mcp` — vision/OCR/grounding/video tools. **Build this first.**
4. `@vel/control-mcp` — status, config, module control.
5. `@vel/brain-mcp` — local wiki/memory with explicit write approval.
6. `@vel/speech-mcp` — TTS artifact generation, later STT.
7. `@vel/privacy-gateway` — pre-model redaction, synthetic mapping, response rehydration, human review.

## Why multiple MCP packages instead of one giant MCP?

Each package has a different permission surface. Glasses needs screenshots and image files. Speech needs audio output and maybe microphone input later. Brain persists memory. Privacy sees raw sensitive data and must not expose its mapping table to the LLM. Keeping each as its own MCP server avoids permission bleed, reduces tool bloat, and lets each specialist worker start only when needed.

## High-level repository map

```text
packages/core/              Shared config, artifact store, audit log, worker lifecycle
packages/mcp-base/          Thin MCP SDK compatibility adapter
packages/glasses-mcp/       Vision layer: inspect, OCR, locate, compare, video scan
packages/installer/         npx/pnpm dlx setup wizard for MCP client configuration
packages/control-mcp/       Status/config/control tools
packages/brain-mcp/         Local wiki + memory tools
packages/speech-mcp/        TTS/STT tooling contracts
packages/privacy-gateway/   Redaction gateway + synthetic substitution design
apps/local-helper/          Optional local screenshot/crop/upload helper
evals/glasses/              Vision eval harness spec and sample tasks
examples/mcp-configs/       Example configs for coding agent clients
```

## Requirements

For the current local Glasses layer:

- macOS on Apple Silicon is the primary tested local path.
- Node.js 20+.
- `pnpm` 10+.
- Python 3.11 for the local MLX worker.
- `git`.
- Optional but recommended: 32 GB+ unified memory for the two-model local profile.

The optimal local vision profile uses two models:

- `VEL_VISION_MODEL`: LocateAnything, the grounding model for boxes, GUI targets, OCR-style localized text, and object/region coordinates.
- `VEL_VISION_VLM_MODEL`: Qwen3-VL, the general VLM for descriptions, screenshot reasoning, critique, and focused region interpretation.

The current quality local profile is:

```text
mlx-community/LocateAnything-3B-bf16
mlx-community/Qwen3-VL-4B-Instruct-8bit
```

Plan for about 11.5 GB of model files on disk and roughly 14-20 GB of free unified memory when both lanes are active. A 16 GB machine should be treated as constrained mode.

For a minimal two-model setup, copy `vel.config.quick.yaml` to `vel.config.yaml` and set the three env vars listed at the bottom. The full reference with all supported models is at `vel.config.example.yaml`.

## Platform Support

| Platform | Status |
|----------|--------|
| macOS (Apple Silicon) | Primary, fully tested |
| Linux (WSL2 on Windows) | Expected to work, not yet fully tested |
| Linux (native) | Expected to work with CUDA providers, not yet tested |
| Windows (native) | Not yet supported (path separators, spawn, python detection, ffmpeg path resolution) |

Requirements across all platforms: Node.js 20+, pnpm 10+, Python 3.10–3.12, ffmpeg.

## Install From This Repo

Clone and build the kit:

```bash
git clone https://github.com/Vel-Labs/vel-mcp.git
cd vel-mcp
pnpm install
pnpm build
```

Set up the local Python worker and LocateAnything lane:

```bash
node packages/glasses-mcp/dist/cli.js setup locate-anything
```

If you are setting it up manually, the equivalent worker commands are:

```bash
python3.11 -m venv .vel/venvs/glasses-mlx
.vel/venvs/glasses-mlx/bin/python -m pip install -e packages/glasses-mcp/workers/vel-worker
.vel/venvs/glasses-mlx/bin/python -m pip install mlx-vlm huggingface_hub
```

Download the recommended local models:

```bash
huggingface-cli download mlx-community/LocateAnything-3B-bf16 \
  --local-dir ~/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16

huggingface-cli download mlx-community/Qwen3-VL-4B-Instruct-8bit \
  --local-dir ~/30_AI-Lab/_cache/models/mlx-community/Qwen3-VL-4B-Instruct-8bit
```

Export the model environment for direct CLI tests:

```bash
export VEL_GLASSES_PROVIDER=glasses-grounding
export VEL_VISION_PYTHON="$PWD/.vel/venvs/glasses-mlx/bin/python"
export VEL_VISION_MODEL="$HOME/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16"
export VEL_VISION_VLM_MODEL="$HOME/30_AI-Lab/_cache/models/mlx-community/Qwen3-VL-4B-Instruct-8bit"
```

Run a direct local smoke:

```bash
node packages/glasses-mcp/dist/cli.js review examples/glasses-demo/dashboard.png \
  --focus "Approve button" \
  --mode ui_review
```

## Configure An Agent Project

Run the setup command from the cloned `vel-mcp` repo:

| Agent | Command |
|-------|---------|
| CommandCode | `pnpm setup:commandcode -- --project-dir /path/to/project` |
| OpenCode | `pnpm setup:opencode -- --project-dir /path/to/project` |
| Codex | `pnpm setup:codex -- --project-dir /path/to/project` |
| Generic MCP | `pnpm setup:mcp -- --project-dir /path/to/project --write` |

After setup with OpenCode, fully close and reopen the process. Starting a new chat is not enough. For CommandCode, `cd` into the project and run `cmd mcp list` — `vel-glasses` should appear.

What gets written:

- CommandCode: `/path/to/project/.mcp.json`.
- OpenCode: `/path/to/project/opencode.json`.
- Generic MCP: `/path/to/project/.mcp.json`.
- Agent guidance: `/path/to/project/AGENTS.md`.
- Detailed visual-routing skill: `/path/to/project/.vel/skills/vel-glasses/SKILL.md`.

## First Prompts

After the MCP server appears in the agent client, users should ask naturally:

```text
Look at images/screenshot.png and describe what stands out in 3 bullets.
```

```text
Look at images/screenshot.png and focus on the checkout button. Where is it?
```

```text
Look at http://localhost:3000 and review the pricing section.
```

The agent guidance should route these to `glasses.review_visual`, `glasses.locate`, `glasses.ocr`, `glasses.capture_url` as needed. Users should not need to type MCP method names.

### Agent self-setup block

Copy-paste this into your coding agent to have it configure `@vel/mcp` in the current project:

```
Run this one-command install and then cd into the project and verify the MCP appears:

npx @vel/mcp install commandcode --project-dir . --bootstrap --write

After it completes, verify the MCP server is connected by listing available tools.
If the MCP server is present, reply "Vel Glasses is ready. Attach an image or point me to a screenshot and I'll tell you what I see."
```

Replace `commandcode` with `opencode`, `codex`, or `mcp` for other agents.

## Video Analysis

`glasses.video_scan` processes video files through the same visual analysis pipeline as image tools:

1. **Metadata probe** — duration, resolution, frame rate, format via ffprobe
2. **Frame sampling** — PNG frames extracted at configurable intervals via ffmpeg's `fps` filter
3. **Per-frame analysis** — each frame can be analyzed with `glasses.locate` (bounding boxes, confidence, coordinates) when a query is provided
4. **Temporal reasoning** — when 2+ frames are sampled, frames are composited into a grid and sent to the VLM provider for cross-frame event analysis ("what changed between frames")

**Current limitations**:

- Bounded only: max 60 frames, 600s duration, 250MB file size. Unsuitable for long-form video.
- The temporal reasoning pass requires a VLM provider (`VEL_VISION_VLM_MODEL`). Without one, you get frame manifests and per-frame analysis only.
- Scene-change detection is not yet implemented. Sampling is interval-based.
- Video attachments may not resolve from agent temp directories — save files to your project or `~/vel/glasses/inputs`.
- Shorter videos produce better results. Under 30 seconds with a single focal subject works best.

**Required tools**: `ffmpeg` and `ffprobe` must be on PATH (`brew install ffmpeg` on macOS, `apt-get install ffmpeg` on Linux).

## URL Screenshot Capture

`glasses.capture_url` captures screenshots of web pages via Playwright. This lets coding agents inspect localhost apps, staging environments, and public pages without manual screenshots.

```bash
# Interactive CLI
vel-glasses capture-url http://localhost:3000

# Via MCP tool — capture then inspect
glasses.capture_url → glasses.review_visual
```

**Prerequisites**: Install Chromium after installing the workspace:

```bash
pnpm --filter @vel/glasses-mcp exec playwright install chromium
```

If Chromium isn't installed, `capture_url` returns `code: "PLAYWRIGHT_BROWSER_UNAVAILABLE"` with install instructions.

## Verify

From the `vel-mcp` repo:

```bash
pnpm verify
pnpm smoke:glasses
```

For real LocateAnything evals after the model env is configured:

```bash
pnpm eval:locate-anything-smoke
pnpm eval:locate-anything-quality
```

## Installer

The `@vel/mcp` package provides a one-command bootstrap that clones, builds, and configures `vel-mcp` for any supported coding agent:

```bash
npx @vel/mcp install commandcode --project-dir . --bootstrap --write
```

Supported targets:

- `commandcode` — writes `.mcp.json` (CommandCode project config)
- `opencode` — writes `opencode.json` (OpenCode config)
- `codex` — prints Codex STDIO form fields
- `mcp` — writes generic `.mcp.json` MCP config

With `--bootstrap`, the installer clones the repo, runs `pnpm install` and `pnpm build`. Without it, pass `--kit-dir` pointing to an existing clone. Use `--write` to actually create config files; without it, the command is dry-run by default.

## Core design rule

```text
If the model should decide when to call it → MCP tool.
If it must happen before the model sees data → gateway/proxy/hook.
If it needs OS/UI/device access → local helper plus optional MCP.
If it stores sensitive state → separate process and separate permission boundary.
If it fails → structured error code + human-readable message + actionable next step.
No silent failures. Warnings are acceptable; swallowed errors, empty arrays, and undefined summaries are not.
```

## Read next

- `AGENTS.md` — coding-agent instructions.
- `ROADMAP.md` — global staged roadmap.
- `docs/package-roadmaps/glasses-mcp.md` — primary first implementation plan.
- `docs/references/eagle-locateanything.md` — integration notes for NVIDIA Eagle / LocateAnything.
