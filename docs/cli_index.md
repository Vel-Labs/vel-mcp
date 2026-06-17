# vel-glasses CLI — Command Index

Every command, its purpose, and a copy-pasteable example. Designed for coding agents to scan and route to the right command without reading source or scattered docs.

All commands use `node packages/glasses-mcp/dist/cli.js` (or `vel-glasses` if globally linked). Output defaults to JSON. Shadow `--output text` is supported but not shown below.

---

## Image inspection

### `inspect` — structured visual inspection

Run comprehensive visual analysis: objects, text, layout, and scene description in one call.

```
vel-glasses inspect screenshot.png
vel-glasses inspect screenshot.png --detail high
```

### `describe` — natural language description

Generate a concise, detailed, bullet, or alt-text description of an image.

```
vel-glasses describe photo.jpg --style concise
vel-glasses describe photo.jpg --style alt-text
```

### `ask` — free-form visual question

Ask a specific question about an image.

```
vel-glasses ask screenshot.png "What color is the submit button?"
vel-glasses ask chart.png "What's the trend from Q1 to Q4?"
```

---

## Grounding & localization

### `locate` — find objects, text, or GUI elements

Returns exact coordinates (box, point, or both) for a natural-language query.

```
vel-glasses locate ui.png "the login button"
vel-glasses locate ui.png "all checkboxes" --output-type box --labels "checkbox"
vel-glasses locate dashboard.png "approve deployment button" --target-type gui --include-raw-model-output
```

### `ocr` — extract text

Extract text from an image. Three modes: `text_only` (plain), `localized` (spans with positions), `layout` (reading order and structure).

```
vel-glasses ocr receipt.png
vel-glasses ocr receipt.png --mode layout
vel-glasses ocr whiteboard.jpg --mode text_only
```

### `crop` — crop a region and inspect

Crop a bounding box `[x1,y1,x2,y2]` from an image and run focused inspection on just that region. Coordinates are normalized [0, 1000].

```
vel-glasses crop screenshot.png 200,100,500,400
```

---

## Document reading

### `read` — extract from documents

Read a document (image or PDF) and extract structured content: OCR, summarization, tables, or full.

```
vel-glasses read invoice.pdf
vel-glasses read scan.png --mode extract_tables
vel-glasses read report.pdf --mode summarize
```

---

## Comparison & diff

### `diff` — compare two images

Detect changed regions between a before and after image. Modes: `metadata`, `pixel`, `ocr`, `layout`, `auto`.

```
vel-glasses diff before.png after.png --mode auto
vel-glasses diff v1.png v2.png --mode pixel
```

### `anomalies` — detect visual anomalies

Check if an actual image deviates from the expected baseline.

```
vel-glasses anomalies expected.png actual.png
vel-glasses anomalies baseline.png current.png --sensitivity high
```

---

## Review orchestration

### `review` — whole-image review with optional focus and OCR

The preferred high-level command. Combines image understanding, optional focused region inspection, and OCR in one call. Modes: `general`, `ui_review`, `target_check`, `design_revision`.

```
vel-glasses review dashboard.png --mode ui_review
vel-glasses review form.png --mode target_check --focus "submit button" --detail high --include-ocr
vel-glasses review before.png --mode design_revision
```

---

## Video

### `video-scan` — sample frames and analyze

Sample video frames at a given interval or FPS, with an optional per-frame query. Always bounded by `--max-duration-sec` (default 600s) and `--max-bytes` (default 250MB).

```
vel-glasses video-scan clip.mp4 --query "is the blue button visible?"
vel-glasses video-scan screen-recording.mov --fps 1 --max-frames 30
vel-glasses video-scan meeting.mp4 --every-seconds 5 --max-duration-sec 120
```

---

## Web capture

### `capture-url` — screenshot a URL

Capture a webpage or localhost URL as a VEL artifact. Supports viewport sizing, full-page captures, selector targeting, and wait timing.

```
vel-glasses capture-url https://example.com
vel-glasses capture-url http://localhost:3000 --full-page --max-height-px 5000
vel-glasses capture-url http://localhost:3000/pricing --selector ".pricing-table"
vel-glasses capture-url https://news.ycombinator.com --width 1440 --height 900 --wait-ms 2000
```

---

## Operations

### `providers` — list all registered providers

Show every provider with health status and capability matrix.

```
vel-glasses providers
```

### `health` — check a single provider

Run the health check for a specific provider by ID.

```
vel-glasses health glasses-grounding
```

### `doctor` — run provider diagnostics

Run end-to-end provider diagnostics with structured output and an exit code reflecting health.

```
vel-glasses doctor locate-anything
```

### `setup` — print provider setup steps

Generate a dry-run setup plan for a provider. Use `--print-env` for shell exports, `--check` to verify after setup.

```
vel-glasses setup locate-anything
vel-glasses setup locate-anything --model mlx-community/LocateAnything-3B-bf16 --print-env
vel-glasses setup locate-anything --model mlx-community/Qwen3-VL-4B-Instruct-5bit --check
```

### `benchmark` — run a provider benchmark probe

Run a real locate benchmark against an image and query. Use `--allow-empty-match` to succeed when no match is expected.

```
vel-glasses benchmark locate-anything --image dashboard.png --query "approve button"
vel-glasses benchmark locate-anything --image dashboard.png --query "non-existent" --allow-empty-match
```

---

## MCP server setup

### `install` — generate MCP config for Codex or generic clients

Print machine-readable MCP setup JSON. Use `--write` to persist as `.mcp.json`.

```
vel-glasses install codex --project-dir .
vel-glasses install mcp --project-dir . --write
vel-glasses install mcp --project-dir /path/to/project --server-name vel-glasses-local --format json
```

> **Note**: The `vel-mcp` installer (run via `npx vel-mcp install`) is the preferred bootstrap flow for first-time setup. This `vel-glasses install` command is the in-repo equivalent for developers working from a cloned kit.

---

## Common patterns

| Want to... | Command |
|------------|---------|
| Know what's in an image | `review` (or `inspect` for raw JSON) |
| Find where something is | `locate` |
| Read text | `ocr` |
| Answer a question about an image | `ask` |
| Check a webpage | `capture-url` → `review` |
| Compare two screenshots | `diff` |
| Scan a video for an event | `video-scan` |
| Verify provider health | `providers` → `health` → `doctor` |
| Bootstrap a new project | `npx vel-mcp install` (see Quick Start) |

## Options available on all commands

| Option | Purpose |
|--------|---------|
| `--provider <id>` | Force a specific provider (e.g., `glasses-grounding`) |
| `--output <format>` | Output format: `json` (default) or `text` |
| `--config <path>` | Override config file path |
| `--verbose` | Show warnings and timing in output |
