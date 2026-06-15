# @vel/mcp

`@vel/mcp` is the small installer and setup wizard for VEL-MCP. It does not run the glasses MCP server itself; it prints or writes the MCP client configuration needed to launch `@vel/glasses-mcp`.

## Quick start

From a cloned `vel-mcp` repo, prefer the root setup wrapper:

```bash
pnpm setup:opencode -- --project-dir /path/to/project
pnpm setup:codex -- --project-dir /path/to/project
pnpm setup:mcp -- --project-dir /path/to/project --write
```

The wrapper runs `pnpm install`, builds this installer package, then runs the right `vel-mcp install ...` command with the cloned repo as the kit.

After `@vel/mcp` is published, dry-run the generic MCP manifest for the current project:

```bash
npx @vel/mcp install mcp --project-dir .
```

Bootstrap the VEL-MCP kit into `~/.vel/kits/vel-mcp` and write a project-local `.mcp.json`:

```bash
npx @vel/mcp install mcp --project-dir . --bootstrap --write
```

Print Codex STDIO form fields:

```bash
pnpm dlx @vel/mcp install codex --project-dir .
```

Write an OpenCode project config:

```bash
pnpm dlx @vel/mcp install opencode --project-dir . --write
```

## What the wizard emits

- STDIO MCP launch fields for clients such as Codex.
- An OpenCode-native `opencode.json` with `mcp.vel-glasses`, `cwd`, timeout, and environment.
- A generic `mcpServers` JSON manifest for clients that discover project-local `.mcp.json`.
- A project-local `.vel/skills/vel-glasses/SKILL.md` guidance file and managed `AGENTS.md` pointer so coding agents can translate natural user requests into the right Glasses tool calls.
- Readiness checks for the kit checkout, project directory, Python worker, and local vision model path.
- `VEL_ALLOWED_IMAGE_ROOTS` so the target project, VEL kit examples, and `~/vel/glasses/inputs` are readable by the glasses path policy.
- Model-role guidance that explains which local model class is needed for grounding, open-ended image inspection, and video reasoning.
- Local LocateAnything and general VLM discovery with Hugging Face links.
- First image and video prompts that use the demo assets in `examples/glasses-demo`.

The wizard is dry-run-first. It only clones/builds the kit with `--bootstrap`, and it only writes `.mcp.json` or `opencode.json` with `--write`.

When `--write` is used, the wizard also writes the local skill guidance file and inserts or updates a marker-bounded VEL section in `AGENTS.md`. That guidance is deliberately human-readable and machine-oriented: it teaches an agent to use `glasses.review_visual` for normal screenshot review, `glasses.locate` for targets and click coordinates, `glasses.ocr` for text-heavy images, and `glasses.capture_url` before reviewing a URL or localhost page. Users should be able to ask natural questions like "look at this screenshot and focus on the dialogue box" instead of naming MCP methods.

OpenCode must be closed and reopened after changing MCP config; starting a new chat in the same process is not enough.

## Model roles

`VEL_VISION_MODEL` is the grounding model. The current first-class choice is LocateAnything. It is strong at deterministic coordinates: GUI elements, object boxes, points, and localized text. It is limited because its worker protocol returns grounding tokens such as `<ref>` and `<box>`; it is not meant to narrate a full scene or answer arbitrary visual questions.

`VEL_VISION_VLM_MODEL` is the general VLM. This is the model class used by `glasses.inspect_image`, `glasses.describe`, and `glasses.ask`. The recommended MLX default is `mlx-community/Qwen3-VL-4B-Instruct-5bit`; the local quality option is `mlx-community/Qwen3-VL-4B-Instruct-8bit`. Qwen2.5-VL and InternVL remain fallback candidates. These are better for descriptions and screenshot reasoning, but they are slower and should not replace LocateAnything for precise click target coordinates.

If the wizard reports `MISSING visionVlmModel`, `glasses.locate` can still work, but open-ended inspection should report that a general VLM is not configured.
