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

## OCR CER

Character error rate:

```text
CER = edit_distance(predicted, expected) / max(1, len(expected))
```
