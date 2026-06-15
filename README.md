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

## First working target

The first shippable target is a **mockable vision MCP**:

```text
pnpm install
pnpm --filter @vel/glasses-mcp build
pnpm --filter @vel/glasses-mcp dev
```

Then connect the generated server command from `examples/mcp-configs/` to Cursor/OpenCode/Claude Desktop/Claude Code.

The first real provider should be NVIDIA Eagle / LocateAnything through a Python worker process. The initial tool surface should remain stable even if the model backend changes.

## One-command MCP setup

From a cloned repo, use the setup wrapper. It installs dependencies, builds the installer, generates client config, and prints readiness checks.

OpenCode:

```bash
git clone https://github.com/Vel-Labs/vel-mcp.git
cd vel-mcp
pnpm setup:opencode -- --project-dir /path/to/project
```

Codex:

```bash
pnpm setup:codex -- --project-dir /path/to/project
```

Generic MCP `.mcp.json`:

```bash
pnpm setup:mcp -- --project-dir /path/to/project --write
```

For OpenCode, fully close and reopen the OpenCode process after setup. Starting a new chat is not enough.

The published package path is intended to become:

```bash
npx @vel/mcp install mcp --project-dir . --bootstrap --write
```

Use `install codex` to print Codex STDIO form fields, `install opencode` to generate an OpenCode-native `opencode.json`, or `install mcp --format json` to emit a machine-readable setup payload for agent harnesses.

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
