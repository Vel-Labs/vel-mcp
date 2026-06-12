# `@vel/glasses-mcp`

Vision/OCR/grounding MCP package for VEL.

## Tools

- `glasses.inspect_image`
- `glasses.locate`
- `glasses.ocr`
- `glasses.inspect_region`
- `glasses.compare`
- `glasses.video_scan`

## Providers

- `mock` — deterministic provider for tests and smoke checks.
- `glasses-grounding` — local MLX-VLM LocateAnything provider through the Python JSONL worker. Enabled when a grounding model is configured and runtime dependencies are installed.

## Real Model Checks

```bash
node packages/glasses-mcp/dist/cli.js setup locate-anything

python3.11 -m venv .vel/venvs/glasses-mlx
.vel/venvs/glasses-mlx/bin/python -m pip install -e packages/glasses-mcp/workers/vel-worker
.vel/venvs/glasses-mlx/bin/python -m pip install mlx-vlm huggingface_hub

VEL_VISION_PYTHON=$PWD/.vel/venvs/glasses-mlx/bin/python \
VEL_VISION_MODEL=/absolute/path/to/LocateAnything-3B-bf16 \
  node packages/glasses-mcp/dist/cli.js --provider glasses-grounding doctor locate-anything

VEL_VISION_PYTHON=$PWD/.vel/venvs/glasses-mlx/bin/python \
VEL_VISION_MODEL=/absolute/path/to/LocateAnything-3B-bf16 \
  node packages/glasses-mcp/dist/cli.js --provider glasses-grounding benchmark locate-anything \
    --image evals/glasses/fixtures/blue-button.png \
    --query "blue button" \
    --target-type object \
    --labels "blue button"
```

`pnpm eval:locate-anything-smoke` and `pnpm eval:locate-anything-quality` run the corresponding eval reports after the same environment variables are set.

## Dev

```bash
pnpm --filter @vel/glasses-mcp dev
```

The server uses stdio by default. Do not log to stdout.

See `ROADMAP.md` for the implementation sequence.
