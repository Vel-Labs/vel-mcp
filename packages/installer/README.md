# @vel/mcp

`@vel/mcp` is the small installer and setup wizard for VEL-MCP. It does not run the glasses MCP server itself; it prints or writes the MCP client configuration needed to launch `@vel/glasses-mcp`.

## Quick start

Dry-run the generic MCP manifest for the current project:

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
- Readiness checks for the kit checkout, project directory, Python worker, and local vision model path.
- `VEL_ALLOWED_IMAGE_ROOTS` so the target project, VEL kit examples, and `~/vel/glasses/inputs` are readable by the glasses path policy.
- Local LocateAnything model discovery with Hugging Face links.
- First image and video prompts that use the demo assets in `examples/glasses-demo`.

The wizard is dry-run-first. It only clones/builds the kit with `--bootstrap`, and it only writes `.mcp.json` or `opencode.json` with `--write`.

OpenCode must be closed and reopened after changing MCP config; starting a new chat in the same process is not enough.
