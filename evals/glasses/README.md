# Glasses evals

Evaluation harness for vision provider quality.

## Metrics

- `bbox_iou`: intersection-over-union for predicted vs golden boxes.
- `center_distance_norm1000`: Euclidean distance in normalized coordinate space.
- `gui_click_success`: center distance under configured radius.
- `ocr_exact`: exact text match.
- `ocr_cer`: character error rate.
- `latency_ms`: provider latency.

## First eval target

Run against mock provider first. Then add LocateAnything provider once installed.
