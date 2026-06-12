# Glasses eval runner

Runs VEL Glasses JSONL eval tasks and emits JSON/Markdown reports.

```bash
pnpm --filter @vel/glasses-evals build
pnpm --filter @vel/glasses-evals eval:mock
pnpm --filter @vel/glasses-evals eval:locate-anything-smoke
pnpm --filter @vel/glasses-evals eval:locate-anything-quality
```

The mock report includes known-negative sample cases and uses `--allow-failures`. The LocateAnything smoke and quality commands call `glasses-grounding` through the built `vel-glasses` CLI and fail non-zero if setup or metrics fail.
