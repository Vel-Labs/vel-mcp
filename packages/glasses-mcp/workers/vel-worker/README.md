# VEL Glasses Python Worker

This worker is a JSONL bridge between `@vel/glasses-mcp` and local vision models. The current first-class backend is Apple Silicon MLX through `mlx-vlm` with LocateAnything-compatible model output.

## Runtime Contract

- MCP servers write only JSON-RPC to stdout.
- This worker writes only JSONL responses to stdout.
- Model logs and third-party library stdout are redirected to stderr.
- Models are loaded lazily on first request, not at MCP server startup.

## Setup

From the repo root:

```bash
python3.11 -m venv .vel/venvs/glasses-mlx
.vel/venvs/glasses-mlx/bin/python -m pip install -e packages/glasses-mcp/workers/vel-worker
.vel/venvs/glasses-mlx/bin/python -m pip install mlx-vlm huggingface_hub
```

Download a compatible grounding model, or point at an existing local cache:

```bash
huggingface-cli download mlx-community/LocateAnything-3B-bf16 \
  --local-dir ~/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16
```

Set environment variables for real-provider runs:

```bash
export VEL_VISION_PYTHON="$PWD/.vel/venvs/glasses-mlx/bin/python"
export VEL_VISION_MODEL="$HOME/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16"
export VEL_GLASSES_PROVIDER=glasses-grounding
```

For open-ended inspection and visual question answering, also download and configure a general VLM:

```bash
huggingface-cli download mlx-community/Qwen3-VL-4B-Instruct-5bit \
  --local-dir ~/30_AI-Lab/_cache/models/mlx-community/Qwen3-VL-4B-Instruct-5bit

export VEL_VISION_VLM_MODEL="$HOME/30_AI-Lab/_cache/models/mlx-community/Qwen3-VL-4B-Instruct-5bit"
```

For a higher-quality local profile, use the 8-bit Qwen3-VL model instead:

```bash
huggingface-cli download mlx-community/Qwen3-VL-4B-Instruct-8bit \
  --local-dir ~/30_AI-Lab/_cache/models/mlx-community/Qwen3-VL-4B-Instruct-8bit

export VEL_VISION_VLM_MODEL="$HOME/30_AI-Lab/_cache/models/mlx-community/Qwen3-VL-4B-Instruct-8bit"
```

LocateAnything is the grounding lane. It returns boxes, points, GUI targets, and localized text. Qwen/InternVL-style general VLMs are the description lane for `inspect_image`, `describe`, and `ask`.

The CLI can print the same setup plan:

```bash
node packages/glasses-mcp/dist/cli.js setup locate-anything
node packages/glasses-mcp/dist/cli.js setup locate-anything --print-env
node packages/glasses-mcp/dist/cli.js --provider glasses-grounding doctor locate-anything
```

## JSONL Protocol

Request:

```json
{"id":"1","op":"ground_gui","image":{"kind":"file_path","value":"/tmp/screenshot.png"},"query":"search button","outputType":"point"}
```

Response:

```json
{"id":"1","ok":true,"result":{"answer":"<ref>search button</ref><box><742><88><910><146></box>","timingMs":1200}}
```

Errors are structured and do not crash the MCP server.

## License Warning

LocateAnything-derived weights are non-commercial unless upstream licensing changes. Do not bundle model weights or auto-download them without explicit operator action.
