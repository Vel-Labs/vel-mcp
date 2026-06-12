# LocateAnything Python Worker

This worker is a JSONL bridge between `@vel/glasses-mcp` and NVIDIA Eagle / LocateAnything.

## Why a separate Python worker?

- Keeps the MCP server lightweight.
- Allows lazy model loading.
- Isolates Python/torch dependencies from TypeScript packages.
- Allows worker shutdown to free RAM/VRAM.

## Setup

Install Eagle separately:

```bash
git clone https://github.com/NVlabs/Eagle.git eagle
cd eagle/Embodied
pip install -e .
```

Install this worker in editable mode:

```bash
cd packages/glasses-mcp/workers/locate-anything
pip install -e .
```

Set environment variables:

```bash
export VEL_LOCATEANYTHING_REPO=/absolute/path/to/eagle/Embodied
export VEL_LOCATEANYTHING_MODEL=nvidia/LocateAnything-3B
export VEL_LOCATEANYTHING_WORKER_CWD=$PWD
export VEL_LOCATEANYTHING_WORKER_PYTHONPATH=$PWD
```

## JSONL protocol

Request:

```json
{"id":"1","op":"ground_gui","image":{"kind":"file_path","value":"/tmp/screenshot.png"},"query":"search button","outputType":"point"}
```

Response:

```json
{"id":"1","ok":true,"result":{"answer":"<ref>search button</ref><box><742><88><910><146></box>","timingMs":1200}}
```

Errors are structured and do not crash the MCP server.

## License warning

LocateAnything-3B is documented as non-commercial. Do not bundle model weights or auto-download them without explicit user action.
