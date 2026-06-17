# Vel Glasses — give your coding agent vision

Vel Glasses is a local MCP server that lets your coding agent see images, screenshots, UI, and video — then tell you what's there, where things are, and what changed. No cloud API, no telemetry, no data leaving your machine.

## What you can ask your agent

| Ask this | Your agent does this |
|----------|---------------------|
| *"What do you see in this screenshot?"* | Full visual review with structured observations |
| *"Where is the submit button?"* | Returns exact coordinates of the button |
| *"Read the text on this receipt"* | Extracts text spans with positions and reading order |
| *"What changed between these two screenshots?"* | Pixel diff, layout diff, anomaly detection |
| *"Watch this video — when does the button appear?"* | Frame sampling, per-frame analysis, temporal summary |
| *"Look at localhost:3000 and review the pricing"* | Screenshots the page then inspects it |

## Quick Start

### 1. Tell your agent to set itself up

Copy-paste this into your coding agent:

```
Set up Vel Glasses in this project by running this command, then verify the MCP appears:

npx vel-mcp install commandcode --project-dir . --bootstrap --write

After it completes, list available MCP tools to confirm vel-glasses is connected.
If connected, reply "Vel Glasses is ready. Send me an image and I'll tell you what I see."
```

Replace `commandcode` with your agent: `opencode`, `codex`, or `mcp`.

### 2. Set your model paths

After setup, add these to your MCP config env vars:

```
VEL_VISION_MODEL=/path/to/LocateAnything-3B-bf16
VEL_VISION_VLM_MODEL=/path/to/Qwen3-VL-4B-Instruct-5bit
VEL_VISION_PYTHON=/path/to/.vel/venvs/glasses-mlx/bin/python
```

### 3. Test with demo content

```
Look at packages/glasses-mcp/examples/glasses-demo/dashboard.png and tell me what should I click to approve the deployment. Give me the coordinates but don't click anything.
```

## How it works — capabilities and models

| Capability | What it does | Model | Disk |
|-----------|-------------|-------|------|
| **Locate / ground** | Find objects, buttons, text, GUI elements — returns exact coordinates | LocateAnything-3B-bf16 (MLX) | 7.2 GB |
| **OCR** | Extract text, reading order, spans with positions | LocateAnything-3B-bf16 (MLX) | 7.2 GB |
| **Image reasoning** | Describe scenes, answer visual questions, review UI/design | Qwen3-VL-4B-Instruct-5bit (MLX) | 5.0 GB |
| **Video reasoning** | Frame sampling, per-frame analysis, temporal summary | Qwen3-VL-4B-Instruct-5bit (MLX) | 5.0 GB |
| **Compare / diff** | Pixel diff, layout diff, visual anomaly detection | Sharp (local image processing) | 0 GB |

Both models together: ~12 GB disk, 14-20 GB RAM recommended. Works on any Apple Silicon Mac.

Additional models available — see `vel.config.example.yaml` for the full list.

## Test with your own content

Once set up, attach any image or point to a file and ask naturally:

```
What do you see in this screenshot? What should I click?
```

```
Read this receipt and extract the date, total, and vendor name.
```

```
Compare these two screenshots and tell me what changed.
```

```
Look at this video and tell me when the loading spinner disappears.
```

For saved images, put them in your project or `~/vel/glasses/inputs`. Attachment paths from `/tmp` are supported.

## Platform support

| Platform | Status |
|----------|--------|
| macOS (Apple Silicon) | Primary, fully tested |
| Linux (WSL2) | Expected to work |
| Linux (native) | Expected with CUDA providers |
| Windows (native) | Not yet supported |

Requirements: Node.js 20+, pnpm 10+, Python 3.10–3.12, ffmpeg.

## Install manually (developers)

```bash
git clone https://github.com/Vel-Labs/vel-mcp.git
cd vel-mcp
pnpm install
pnpm build
node packages/glasses-mcp/dist/cli.js setup locate-anything
pnpm verify
pnpm smoke:glasses
```

## Repository

```
packages/core/          Config, artifacts, audit, worker lifecycle
packages/mcp-base/      MCP SDK adapter
packages/glasses-mcp/   Vision tools (14 MCP tools)
packages/installer/     One-command npx bootstrap
evals/glasses/          Vision eval harness
examples/               Demo assets, MCP configs, workflows
docs/                   Architecture, UX workflows, decisions
```

Future: Brain (local wiki), Speech (TTS), Control, Privacy Gateway.

## Core design rule

```
If the model should decide when to call it → MCP tool.
If it must happen before the model sees data → gateway/hook.
If it fails → structured error code + human-readable message + next step.
No silent failures. No telemetry. No data leaves your machine.
```

## Read next

- `AGENTS.md` — coding-agent contract and non-negotiable constraints
- `.skills/SKILL.md` — domain-indexed skill files for agents (setup, vision, video)
- `ROADMAP.md` — upcoming phases (Brain, Speech, Privacy)
- `ROADMAP-ARCHIVE.md` — completed phases (0–5)
