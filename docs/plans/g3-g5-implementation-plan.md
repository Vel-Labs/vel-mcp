# Plan: G3 Python Worker Integration Test + G5 OCR Expansion

## Summary

Two tracks in sequence:
1. **G3**: Add `FAKE_WORKER_MODE` to the Python worker so it can be spawned as a real `python` subprocess but returns deterministic fake data — closing the integration test gap.
2. **G5**: Complete OCR mode differentiation, `regionNorm1000` filtering, `mergeLines`, reading-order heuristic, eval span-level metrics.

---

## Part A — G3: Python Worker Fake Mode

### Problem
The Python worker (`workers/locate-anything/vel_locate_anything_worker/main.py`) has never been spawned as a real `python` subprocess in tests. All LocateAnythingProvider tests use the Node `fake-worker.mjs` in `vision-echo` mode.

### Solution
Add `FAKE_WORKER_MODE` env var to `main.py`, mirroring the Node fake-worker pattern. When set, return deterministic `<ref>/<box>` strings without importing Eagle.

### Changes

#### `workers/locate-anything/vel_locate_anything_worker/main.py`
- Read `os.environ.get("FAKE_WORKER_MODE")` at module level
- `handle()`: if truthy, call `handle_fake()` — bypass `load_worker()` and `open_image()` entirely
- `handle_fake()`:
  - `health` → `{"status": "ok", "model": "fake-vision-model"}`
  - `detect_text` → 3 spans (Search/Submit/Cancel) matching UI_FIXTURE
  - `ground_gui` / `ground_multi` → `<ref>{query}</ref><box><700><80><940><150></box>`
  - `point` → `<ref>{query}</ref><box><500><500></box>`
  - `detect` → `<ref>detected</ref><box><100><100><400><400></box>`
  - Reads `mode`, `mergeLines`, `regionNorm1000` from request — unused but doesn't crash
  - Response: `{"id": request_id, "ok": true, "result": {"answer": "...", "timingMs": 1}}`

#### `packages/glasses-mcp/tests/pythonWorker.test.ts` (NEW)
- Spawns `python -m vel_locate_anything_worker.main` via `WorkerSupervisor`
- Config: `command: "python"`, `args: ["-m", "vel_locate_anything_worker.main"]`, `env: {FAKE_WORKER_MODE: "1", VEL_LOCATEANYTHING_REPO: "/fake"}` and `PYTHONPATH` pointing to the worker dir
- Creates a minimal 1×1 PNG in a temp dir for `file_path` ImageRefs
- Tests: health, ground_multi, ground_gui, point, detect_text, invalid op → error
- Verifies no Eagle import needed

---

## Part B — G5: OCR Expansion

### Problem
OCR modes are schema-defined but neither provider differentiates. `regionNorm1000` and `mergeLines` are ignored. No span-level eval metrics.

### Solution
Shared OCR utility functions + mock/LocateAnything provider changes + eval span metrics.

### New file: `src/services/ocrUtils.ts`
Pure functions, no provider deps:
- `bboxesIntersect(a, b)`: axis-aligned intersection check
- `mergeLinesByYBands(spans, tolerance=50)`: group by y-center within tolerance, join text, union bbox
- `layoutSort(spans, bandTolerance=50)`: y-band grouping, bands top-to-bottom, within-band x-sort, assign readingOrder
- `filterByRegion(spans, regionBbox)`: intersection-based filtering

### New file: `tests/ocrUtils.test.ts`
Unit tests for: bboxIntersect (overlapping, non-overlapping, edge, contained), mergeLinesByYBands, layoutSort, filterByRegion.

### `src/providers/mockVisionProvider.ts` — `ocr()` changes
1. If `regionNorm1000` provided: `filterByRegion(fixtureSpans, region)` → if empty, return `{ text: "", spans: [] }`
2. If `mergeLines` true: `mergeLinesByYBands(filtered)` → joined spans. If false: as-is.
3. Mode:
   - `text_only`: joined text, `spans: []`
   - `localized`: spans with `readingOrder = i+1`
   - `layout`: `layoutSort(spans)`, reassign readingOrder

### `src/providers/locateAnythingProvider.ts` — `ocr()` changes
1. Send `mode` and `mergeLines` in worker payload: `{ op: "detect_text", image, mode: input.mode, mergeLines: input.mergeLines, regionNorm1000: input.regionNorm1000 }`
2. Post-parse: `filterByRegion()`, then `mergeLinesByYBands()` if mergeLines, then mode-specific:
   - `text_only`: text only, `spans: []`
   - `localized`: spans with `readingOrder = i+1`
   - `layout`: `layoutSort()`, reassign readingOrder

### `tests/mockProvider.test.ts` — new tests
- regionNorm1000 filtering (partial overlap, no match → empty)
- mergeLines=true (merges same-row spans)
- mergeLines=false (spans as-is)
- layout mode reading order (Search=1, Cancel=2, Submit=3 — left-to-right within y-band)
- text_only mode

### `tests/locateAnythingProvider.test.ts` — new tests
- mergeLines, mode, regionNorm1000 present in worker payload
- text_only strips spans
- layout reorders readingOrder

### `evals/glasses/runner/src/index.ts` — new metrics
- `spanIoU(predSpans, goldSpans)`: greedy closest-center matching, per-pair IoU, mean across all gold spans. Pass if mean ≥ 0.5.
- `readingOrderCorrelation(predSpans, goldSpans)`: Spearman rank correlation. Pass if ≥ 0.8.
- Extend `EvalTask.expected` to optionally include `spans` array.
- `evaluateOcr()` handles `span_iou` and `reading_order_correlation` metric names.

### `evals/glasses/sample-tasks.jsonl` — new tasks
- `mock-ocr-spans`: metrics=["span_iou", "reading_order_correlation"]
- `mock-ocr-layout`: mode=layout, metrics=["reading_order_correlation"]
- `mock-ocr-region`: regionNorm1000 filter, metrics=["ocr_exact"]

### `evals/glasses/runner/tests/evalRunner.test.ts` — new tests
- span_iou perfect match
- reading_order_correlation perfect and reversed

---

## Implementation Order

1. `src/services/ocrUtils.ts` — shared pure functions
2. `tests/ocrUtils.test.ts` — utility unit tests
3. `src/providers/mockVisionProvider.ts` — regionNorm1000, mergeLines, mode differentiation
4. `tests/mockProvider.test.ts` — new G5 test cases
5. `src/providers/locateAnythingProvider.ts` — payload + post-processing
6. `tests/locateAnythingProvider.test.ts` — new G5 test cases
7. `workers/locate-anything/vel_locate_anything_worker/main.py` — FAKE_WORKER_MODE
8. `tests/pythonWorker.test.ts` (NEW) — Python subprocess integration
9. `evals/glasses/runner/src/index.ts` — span metrics
10. `evals/glasses/sample-tasks.jsonl` — new sample tasks
11. `evals/glasses/runner/tests/evalRunner.test.ts` — span metric tests

---

## Verification

```bash
pnpm --filter @vel/glasses-mcp vitest run tests/ocrUtils.test.ts
pnpm --filter @vel/glasses-mcp vitest run tests/mockProvider.test.ts
pnpm --filter @vel/glasses-mcp vitest run tests/locateAnythingProvider.test.ts
pnpm --filter @vel/glasses-mcp vitest run tests/parser.test.ts
pnpm --filter @vel/glasses-mcp vitest run tests/pythonWorker.test.ts
pnpm --filter @vel/glasses-evals vitest run
pnpm test && pnpm typecheck
```

All existing tests must pass with zero regressions. Python worker test must pass without Eagle installed.
