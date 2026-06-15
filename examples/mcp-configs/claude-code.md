# Claude Code config example

Use a local stdio MCP server for Glasses during development.

```bash
pnpm --dir /absolute/path/to/vel-mcp --filter @vel/glasses-mcp dev
```

For the mock provider, set:

```bash
export VEL_GLASSES_PROVIDER=mock
```

For the real local MLX LocateAnything provider, set:

```bash
export VEL_GLASSES_PROVIDER=glasses-grounding
export VEL_VISION_PYTHON=/absolute/path/to/vel-mcp/.vel/venvs/glasses-mlx/bin/python
export VEL_VISION_MODEL=/absolute/path/to/LocateAnything-3B-bf16
```

On Steven's local machine, the current known-good values are:

```bash
export VEL_GLASSES_PROVIDER=glasses-grounding
export VEL_VISION_PYTHON=/Users/steven/Workspace/40_Code/projects/vel-mcp/.vel/venvs/glasses-mlx/bin/python
export VEL_VISION_MODEL=/Users/steven/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16
```
