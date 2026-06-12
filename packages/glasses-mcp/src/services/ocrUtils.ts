export interface SpanLike {
  text: string;
  bboxNorm1000?: [number, number, number, number];
  confidence?: number;
  readingOrder?: number;
}

export type Bbox = [number, number, number, number];

export function bboxesIntersect(a: Bbox, b: Bbox): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

export function filterByRegion<T extends SpanLike>(spans: T[], regionBbox: Bbox): T[] {
  return spans.filter((s) => {
    if (!s.bboxNorm1000) return false;
    return bboxesIntersect(s.bboxNorm1000, regionBbox);
  });
}

function yCenter(bbox: Bbox): number {
  return (bbox[1] + bbox[3]) / 2;
}

function unionBbox(a: Bbox, b: Bbox): Bbox {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

export function mergeLinesByYBands<T extends SpanLike>(
  spans: T[],
  tolerance = 50,
): T[] {
  if (spans.length === 0) return [];

  const withBbox = spans.filter((s): s is T & { bboxNorm1000: Bbox } => !!s.bboxNorm1000);
  if (withBbox.length === 0) return [...spans];

  const sorted = [...withBbox].sort((a, b) => yCenter(a.bboxNorm1000) - yCenter(b.bboxNorm1000));

  const bands: (T & { bboxNorm1000: Bbox })[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const lastBand = bands[bands.length - 1];
    const lastSpan = lastBand[lastBand.length - 1];
    if (Math.abs(yCenter(sorted[i].bboxNorm1000) - yCenter(lastSpan.bboxNorm1000)) <= tolerance) {
      lastBand.push(sorted[i]);
    } else {
      bands.push([sorted[i]]);
    }
  }

  const result: T[] = [];
  let order = 1;
  for (const band of bands) {
    band.sort((a, b) => a.bboxNorm1000[0] - b.bboxNorm1000[0]);
    const mergedText = band.map((s) => s.text).join(" ");
    const mergedBbox = band.reduce((acc, s) => unionBbox(acc, s.bboxNorm1000), band[0].bboxNorm1000);
    result.push({
      ...band[0],
      text: mergedText,
      bboxNorm1000: mergedBbox,
      readingOrder: order++,
    });
  }

  return result;
}

export function layoutSort<T extends SpanLike>(
  spans: T[],
  bandTolerance = 50,
): T[] {
  if (spans.length <= 1) return spans.map((s, i) => ({ ...s, readingOrder: i + 1 }));

  const withBbox = spans.filter((s): s is T & { bboxNorm1000: Bbox } => !!s.bboxNorm1000);
  const withoutBbox = spans.filter((s) => !s.bboxNorm1000);

  const sorted = [...withBbox].sort((a, b) => yCenter(a.bboxNorm1000) - yCenter(b.bboxNorm1000));

  const bands: (T & { bboxNorm1000: Bbox })[][] = [];
  for (const span of sorted) {
    let placed = false;
    for (const band of bands) {
      const bandY = yCenter(band[0].bboxNorm1000);
      if (Math.abs(yCenter(span.bboxNorm1000) - bandY) <= bandTolerance) {
        band.push(span);
        placed = true;
        break;
      }
    }
    if (!placed) bands.push([span]);
  }

  const result: T[] = [];
  let order = 1;
  for (const band of bands) {
    band.sort((a, b) => a.bboxNorm1000[0] - b.bboxNorm1000[0]);
    for (const span of band) {
      result.push({ ...span, readingOrder: order++ });
    }
  }

  for (const span of withoutBbox) {
    result.push({ ...span, readingOrder: order++ });
  }

  return result;
}
