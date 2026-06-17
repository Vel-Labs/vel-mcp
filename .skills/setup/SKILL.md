# Vel Glasses — Setup

Run once per project. Use this skill only when the agent needs to install or verify the `vel-glasses` MCP server.

## Install

```bash
npx vel-mcp install commandcode --project-dir . --bootstrap --write
```

Replace `commandcode` with `opencode`, `codex`, or `mcp`.

## Verify

After install, restart the agent. The `vel-glasses` MCP server should appear in the available tool list. List tools to confirm.

## Manual fallback

If `npx` fails, clone and build:

```bash
git clone https://github.com/Vel-Labs/vel-mcp.git ~/.vel/kits/vel-mcp
cd ~/.vel/kits/vel-mcp && pnpm install && pnpm build
pnpm --filter @vel/mcp build
node packages/installer/dist/cli.js install commandcode --project-dir /path/to/project --write
```
