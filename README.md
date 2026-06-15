# VEL-MCP — Vel Engineered Layers

VEL-MCP is a modular tooling scaffold for giving LLMs purpose-built local or cloud-backed “senses” without forcing the primary model to be multimodal or stateful.

The intended product shape is:

```text
VEL = one install, one config, one artifact/audit substrate
MCP packages = separate capability surfaces with separate trust boundaries
Workers = lazy-loaded local or remote specialist models
Privacy = gateway/hook first, MCP second
```

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

Run the setup command from the cloned `vel-mcp` repo. The installer writes MCP config for the target project, model env vars, `AGENTS.md`, and `.vel/skills/vel-glasses/SKILL.md` guidance so users can ask normal visual questions.

CommandCode:

```bash
pnpm setup:commandcode -- --project-dir /path/to/project
cd /path/to/project
cmd mcp list
```

OpenCode:

```bash
pnpm setup:opencode -- --project-dir /path/to/project
```

After OpenCode setup, fully close and reopen the OpenCode process. Starting a new chat is not enough.

Codex:

```bash
pnpm setup:codex -- --project-dir /path/to/project
```

Generic project `.mcp.json`:

```bash
pnpm setup:mcp -- --project-dir /path/to/project --write
```

What gets written:

- CommandCode: `/path/to/project/.mcp.json`.
- OpenCode: `/path/to/project/opencode.json`.
- Generic MCP: `/path/to/project/.mcp.json`.
- Agent guidance: `/path/to/project/AGENTS.md`.
- Detailed visual-routing skill: `/path/to/project/.vel/skills/vel-glasses/SKILL.md`.

For saved images, put files under the target project or `~/vel/glasses/inputs`. Those roots are allowed by default. Attachment handling varies by agent harness; if an attached image is not accessible, save it into the project and ask about that path.

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

The agent guidance should route these to `glasses.review_visual`, `glasses.locate`, `glasses.ocr`, or `glasses.capture_url` as needed. Users should not need to type MCP method names.

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

## Future Published Installer

Once `@vel/mcp` is published, the intended no-clone bootstrap path is:

```bash
npx @vel/mcp install commandcode --project-dir . --bootstrap --write
```

Use `install commandcode` for CommandCode, `install opencode` for OpenCode, `install codex` to print Codex STDIO form fields, or `install mcp --format json` to emit a machine-readable setup payload for agent harnesses.

## Core design rule

```text
If the model should decide when to call it → MCP tool.
If it must happen before the model sees data → gateway/proxy/hook.
If it needs OS/UI/device access → local helper plus optional MCP.
If it stores sensitive state → separate process and separate permission boundary.
```

## Read next

- `AGENTS.md` — coding-agent instructions.
- `ROADMAP.md` — global staged roadmap.
- `docs/package-roadmaps/glasses-mcp.md` — primary first implementation plan.
- `docs/references/eagle-locateanything.md` — integration notes for NVIDIA Eagle / LocateAnything.
