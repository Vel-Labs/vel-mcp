import { describe, it, expect } from "vitest";
import { bboxesIntersect, filterByRegion, mergeLinesByYBands, layoutSort } from "../src/services/ocrUtils.js";
import type { Bbox, SpanLike } from "../src/services/ocrUtils.js";

function span(
  text: string,
  bboxNorm1000?: Bbox,
  confidence?: number,
  readingOrder?: number,
): SpanLike {
  return { text, bboxNorm1000, ...(confidence !== undefined ? { confidence } : {}), ...(readingOrder !== undefined ? { readingOrder } : {}) };
}

describe("bboxesIntersect", () => {
  it("returns true for overlapping bboxes", () => {
    expect(bboxesIntersect([0, 0, 100, 100], [50, 50, 150, 150])).toBe(true);
  });

  it("returns true when one contains the other", () => {
    expect(bboxesIntersect([0, 0, 200, 200], [50, 50, 100, 100])).toBe(true);
  });

  it("returns false for non-overlapping bboxes", () => {
    expect(bboxesIntersect([0, 0, 50, 50], [100, 100, 150, 150])).toBe(false);
  });

  it("returns false for edge-touching (non-overlapping)", () => {
    expect(bboxesIntersect([0, 0, 50, 50], [50, 0, 100, 50])).toBe(false);
  });
});

describe("filterByRegion", () => {
  const spans: SpanLike[] = [
    span("top-left", [0, 0, 100, 100]),
    span("top-right", [900, 0, 1000, 100]),
    span("bottom", [400, 800, 600, 1000]),
  ];

  it("filters spans intersecting the region", () => {
    const result = filterByRegion(spans, [0, 0, 200, 200]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("top-left");
  });

  it("returns empty when no spans match", () => {
    const result = filterByRegion(spans, [200, 200, 300, 300]);
    expect(result).toHaveLength(0);
  });

  it("filters out spans without bboxes", () => {
    const withMissing = [...spans, span("no-bbox")];
    const result = filterByRegion(withMissing, [0, 0, 1000, 1000]);
    expect(result).toHaveLength(3);
    expect(result.find((s) => s.text === "no-bbox")).toBeUndefined();
  });
});

describe("mergeLinesByYBands", () => {
  it("merges two spans on the same y-band into one line", () => {
    const spans: SpanLike[] = [
      span("Hello", [0, 90, 200, 110]),
      span("World", [250, 90, 450, 110]),
    ];
    const merged = mergeLinesByYBands(spans);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("Hello World");
    expect(merged[0].bboxNorm1000).toEqual([0, 90, 450, 110]);
    expect(merged[0].readingOrder).toBe(1);
  });

  it("keeps spans on different y-bands separate", () => {
    const spans: SpanLike[] = [
      span("Top", [0, 0, 100, 20]),
      span("Bottom", [0, 500, 100, 520]),
    ];
    const merged = mergeLinesByYBands(spans);
    expect(merged).toHaveLength(2);
    expect(merged[0].text).toBe("Top");
    expect(merged[1].text).toBe("Bottom");
  });

  it("returns spans as-is when none have bboxes", () => {
    const spans: SpanLike[] = [span("a"), span("b")];
    const merged = mergeLinesByYBands(spans);
    expect(merged).toHaveLength(2);
  });

  it("merges within tolerance and split beyond", () => {
    const spans: SpanLike[] = [
      span("A", [0, 100, 50, 110]),
      span("B", [60, 140, 110, 150]),
      span("C", [0, 500, 50, 510]),
    ];
    const merged = mergeLinesByYBands(spans, 50);
    expect(merged).toHaveLength(2);
    expect(merged[0].text).toBe("A B");
    expect(merged[1].text).toBe("C");
  });
});

describe("layoutSort", () => {
  it("assigns reading order top-to-bottom, left-to-right within band", () => {
    const spans: SpanLike[] = [
      span("right-top", [700, 80, 940, 150]),
      span("left-top", [100, 80, 300, 150]),
      span("bottom", [500, 820, 680, 900]),
    ];
    const sorted = layoutSort(spans);
    expect(sorted).toHaveLength(3);
    expect(sorted[0].text).toBe("left-top");
    expect(sorted[0].readingOrder).toBe(1);
    expect(sorted[1].text).toBe("right-top");
    expect(sorted[1].readingOrder).toBe(2);
    expect(sorted[2].text).toBe("bottom");
    expect(sorted[2].readingOrder).toBe(3);
  });

  it("handles single span", () => {
    const sorted = layoutSort([span("only", [0, 0, 100, 100])]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].readingOrder).toBe(1);
  });

  it("appends spans without bbox at the end", () => {
    const spans: SpanLike[] = [
      span("has-bbox", [0, 0, 100, 100]),
      span("no-bbox"),
    ];
    const sorted = layoutSort(spans);
    expect(sorted).toHaveLength(2);
    expect(sorted[0].text).toBe("has-bbox");
    expect(sorted[0].readingOrder).toBe(1);
    expect(sorted[1].text).toBe("no-bbox");
    expect(sorted[1].readingOrder).toBe(2);
  });
});
