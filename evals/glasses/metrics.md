# Glasses metrics

## IoU

For boxes `A` and `B` in normalized `[0,1000]` space:

```text
IoU = area(intersection(A,B)) / area(union(A,B))
```

## Center distance

```text
d = sqrt((x_pred - x_gold)^2 + (y_pred - y_gold)^2)
```

## GUI click success

Default success when `center_distance_norm1000 <= 30` unless task overrides.

## Match count

Passes when the number of predicted matches is greater than or equal to `expected.matchCount`.

## Multi-box IoU

Greedily matches each expected box to one predicted box and reports the mean IoU across expected boxes. Passes when `mean_iou >= 0.5`.

## No match

Passes when `expected.noMatch` is true and the provider returns zero matches.

## Latency budget

`latency_budget_ms` passes when provider-reported `timingMs <= expected.latencyBudgetMs`. If the task does not set a budget, the default is `30000` ms.

## OCR CER

Character error rate:

```text
CER = edit_distance(predicted, expected) / max(1, len(expected))
```
