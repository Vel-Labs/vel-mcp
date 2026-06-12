# Glasses evals

Evaluation harness for vision provider quality.

## Metrics

- `bbox_iou`: intersection-over-union for predicted vs golden boxes.
- `center_distance_norm1000`: Euclidean distance in normalized coordinate space.
- `gui_click_success`: center distance under configured radius.
- `match_count`: predicted match count meets `expected.matchCount`.
- `multi_bbox_iou`: mean IoU across one-to-one matched expected boxes.
- `no_match`: provider returned no matches for an expected-negative task.
- `ocr_exact`: exact text match.
- `ocr_cer`: character error rate.
- `latency_ms`: provider latency.
- `latency_budget_ms`: provider latency is under `expected.latencyBudgetMs`.

## First eval target

Run against mock provider first, then use the real grounding provider once `VEL_VISION_PYTHON` and `VEL_VISION_MODEL` point at a working local MLX-VLM setup.

```bash
pnpm eval:glasses
VEL_VISION_PYTHON=/absolute/path/to/.vel/venvs/glasses-mlx/bin/python \
VEL_VISION_MODEL=/absolute/path/to/LocateAnything-3B-bf16 \
  pnpm eval:locate-anything-smoke
VEL_VISION_PYTHON=/absolute/path/to/.vel/venvs/glasses-mlx/bin/python \
VEL_VISION_MODEL=/absolute/path/to/LocateAnything-3B-bf16 \
  pnpm eval:locate-anything-quality
```

Reports are written under `evals/glasses/runner/reports/`.
