# Claude Code config example

Use a local stdio MCP server for Glasses during development.

For Codex's custom MCP form, generate the exact fields with:

```bash
pnpm build
node packages/glasses-mcp/dist/cli.js install codex --project-dir /path/to/project
```

For machine-readable JSON:

```bash
node packages/glasses-mcp/dist/cli.js install codex --project-dir /path/to/project --format json
```

Use `--glasses-provider mock` for a dependency-free mock setup, or leave the default `glasses-grounding` for the local MLX vision worker.

For generic MCP clients and local harness discovery, generate or write a project-local `.mcp.json`:

```bash
node packages/glasses-mcp/dist/cli.js install mcp --project-dir /path/to/project
node packages/glasses-mcp/dist/cli.js install mcp --project-dir /path/to/project --write
```

The `--write` form creates `/path/to/project/.mcp.json` and refuses to overwrite an existing file. The wizard also reports local vision-model readiness and Hugging Face links for suggested models.

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
