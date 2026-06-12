# VEL Glasses Eval Report

## Summary

- Total: 5
- Passed: 5
- Failed: 0

## Cases

| ID | Type | Status | Metrics | Errors |
|---|---|---|---|---|
| locate-anything-blue-button | locate | pass | bbox_iou: 0.985<br>center_distance_norm1000: 1<br>latency_budget_ms: 2008 |  |
| locate-anything-blue-button-gui-click | locate | pass | gui_click_success: 1<br>center_distance_norm1000: 1<br>latency_budget_ms: 1961 |  |
| locate-anything-multiple-blue-buttons | locate | pass | match_count: 2<br>multi_bbox_iou: 0.99<br>latency_budget_ms: 2320 |  |
| locate-anything-text-target | locate | pass | bbox_iou: 0.835<br>center_distance_norm1000: 11.7<br>latency_budget_ms: 2031 |  |
| locate-anything-no-blue-button | locate | pass | no_match: 0<br>match_count: 0<br>latency_budget_ms: 1802 |  |
