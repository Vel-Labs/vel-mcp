# vel-glasses CLI — Agent Routing Skill

When the user asks to run a vision task directly from the terminal (not via MCP tools), route to the `vel-glasses` CLI. The CLI is at `node packages/glasses-mcp/dist/cli.js` (from the kit) or `npx vel-glasses` (if installed globally).

All commands output JSON by default. Use `--output text` for human-readable output.

## Routing table

| User asks... | Command |
|-------------|---------|
| "what's in this image", "inspect this", "analyze this" | `review <image> --mode ui_review` |
| "describe this image" | `describe <image>` (or `inspect <image>` for structured output) |
| "where is X", "find X", "locate X", "coordinates of Y" | `locate <image> "<query>"` |
| "read the text", "extract text", "OCR this", "what does this say" | `ocr <image>` |
| "ask about", "question about", "does this contain X" | `ask <image> "<question>"` |
| "crop and check", "zoom into region", "inspect this area" | `crop <image> <x1>,<y1>,<x2>,<y2>` |
| "read this document", "summarize PDF", "extract tables" | `read <document>` |
| "compare these", "what changed", "diff these images" | `diff <before> <after>` |
| "detect anomalies", "does this look wrong" | `anomalies <expected> <actual>` |
| "screenshot this URL", "capture localhost", "look at this page" | `capture-url <url>` then `review` on the artifact |
| "scan this video", "when does X appear", "analyze frames" | `video-scan <video> --query "<what to look for>"` |
| "check health", "is the provider working", "diagnose" | `providers`, then `health <id>`, then `doctor locate-anything` |
| "set up a model", "install locate-anything" | `setup locate-anything` |
| "benchmark", "test performance", "run a probe" | `benchmark locate-anything --image <img> --query "<q>"` |
| "install MCP config", "write .mcp.json" | `install mcp --project-dir <path> --write` |

## Key defaults

- Coordinates are normalized [0, 1000] unless `--output-type` says otherwise.
- Video is always bounded: `--max-duration-sec 600`, `--max-bytes 250MB`.
- `review` is preferred over `inspect` for open-ended visual questions; `locate` is for coordinates.
- `capture-url` screenshots only; follow with `review` for inspection.

## Common option patterns

| Option | Purpose |
|--------|---------|
| `--detail low\|medium\|high` | Control output verbosity (inspect, review) |
| `--mode <mode>` | Route behavior: `ui_review`, `target_check`, `design_revision`, `text_only`, `localized`, `layout` |
| `--focus "<target>"` | Narrow review to a specific region or element |
| `--include-ocr` | Force OCR pass alongside visual review |
| `--include-raw-model-output` | Include raw provider output as evidence |
| `--provider <id>` | Override provider (e.g., `glasses-grounding`) |
| `--verbose` | Show warnings and timing |
| `--output json\|text` | Output format (default: json) |

## Context note

For full command descriptions and examples, see `docs/cli_index.md`.
