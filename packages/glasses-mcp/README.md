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
- `glasses-vlm` — local MLX-VLM general image reasoning provider. Enabled when `VEL_VISION_VLM_MODEL` points to a compatible general VLM such as Qwen3-VL, Qwen2.5-VL, or InternVL.

## Model Roles

`VEL_VISION_MODEL` configures the grounding lane. LocateAnything is the current verified model for this lane. It should be used for `glasses.locate`, GUI click-target lookup, object boxes, points, OCR-style localized spans, and bounded video event localization. Its limitation is architectural: LocateAnything emits localization tokens (`<ref>`, `<box>`, points) and is optimized for spatial grounding, not free-form visual narration.

`VEL_VISION_VLM_MODEL` configures the general VLM lane. This is required for useful `glasses.inspect_image`, `glasses.describe`, and `glasses.ask` output. Qwen3-VL-4B-Instruct-5bit is the recommended MLX default; Qwen3-VL-4B-Instruct-8bit is the local quality option when memory budget allows. Qwen2.5-VL and InternVL remain alternatives. General VLMs are better at descriptions and screenshot/document reasoning, but they are not the first choice for deterministic GUI coordinates.

If only `VEL_VISION_MODEL` is set, `glasses.locate` can be fully operational while `glasses.inspect_image` correctly reports that a general VLM is missing.

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
