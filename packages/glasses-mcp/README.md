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
- `locate-anything` — NVIDIA Eagle / LocateAnything provider through Python JSONL worker. Disabled until dependencies are installed and license is accepted.

## Dev

```bash
pnpm --filter @vel/glasses-mcp dev
```

The server uses stdio by default. Do not log to stdout.

See `ROADMAP.md` for the implementation sequence.
