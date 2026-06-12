# Claude Code config example

Use a local stdio MCP server for Glasses during development.

```bash
pnpm --dir /absolute/path/to/vel-mcp --filter @vel/glasses-mcp dev
```

Set environment:

```bash
export VEL_GLASSES_PROVIDER=mock
```

For LocateAnything, also set:

```bash
export VEL_GLASSES_PROVIDER=locate-anything
export VEL_LOCATEANYTHING_REPO=/absolute/path/to/eagle/Embodied
export VEL_LOCATEANYTHING_WORKER_CWD=/absolute/path/to/vel-mcp/packages/glasses-mcp/workers/locate-anything
export VEL_LOCATEANYTHING_WORKER_PYTHONPATH=/absolute/path/to/vel-mcp/packages/glasses-mcp/workers/locate-anything
```
