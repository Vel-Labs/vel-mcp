# VEL Glasses Eval Report

## Summary

- Total: 7
- Passed: 5
- Failed: 2

## Cases

| ID | Type | Status | Metrics | Errors |
|---|---|---|---|---|
| mock-gui-search | locate | pass | bbox_iou: 1<br>center_distance_norm1000: 0<br>gui_click_success: 1 |  |
| mock-ocr-buttons | ocr | pass | ocr_exact: 1<br>ocr_cer: 0 |  |
| mock-locate-no-result | locate | fail | bbox_iou: 0 |  |
| mock-ocr-text-only | ocr | pass | ocr_exact: 1 |  |
| mock-ocr-spans | ocr | pass | span_iou: 1<br>reading_order_correlation: 1 |  |
| mock-ocr-layout | ocr | fail | ocr_exact: 1<br>reading_order_correlation: 0.5 |  |
| mock-ocr-region | ocr | pass | ocr_exact: 1<br>span_iou: 1 |  |
