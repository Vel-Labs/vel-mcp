import sharp from "sharp";
import type { LocalizationResult } from "../providers/types.js";

export interface MetadataDiff {
  sameDimensions: boolean;
  sameFormat: boolean;
  sameSize: boolean;
  sameHash: boolean;
  beforeWidth?: number;
  beforeHeight?: number;
  afterWidth?: number;
  afterHeight?: number;
  beforeBytes: number;
  afterBytes: number;
  beforeMime?: string;
  afterMime?: string;
}

export interface PixelDiffResult {
  changed: boolean;
  changedRegions: LocalizationResult[];
  threshold: number;
  diffPixels: number;
  totalPixels: number;
}

export interface OcrDiffResult {
  beforeText: string;
  afterText: string;
  added: Array<{ text: string; bboxNorm1000?: [number, number, number, number] }>;
  removed: Array<{ text: string; bboxNorm1000?: [number, number, number, number] }>;
}

export interface LayoutDiffResult {
  sameLayout: boolean;
  moved: Array<{ label: string; beforeBbox: [number, number, number, number]; afterBbox: [number, number, number, number] }>;
  added: LocalizationResult[];
  removed: LocalizationResult[];
}

export class ImageComparator {
  async metadataDiff(
    beforeMeta: { sha256: string; bytes: number; mimeType?: string; width?: number; height?: number },
    afterMeta: { sha256: string; bytes: number; mimeType?: string; width?: number; height?: number }
  ): Promise<MetadataDiff> {
    return {
      sameDimensions: beforeMeta.width === afterMeta.width && beforeMeta.height === afterMeta.height,
      sameFormat: beforeMeta.mimeType === afterMeta.mimeType,
      sameSize: beforeMeta.bytes === afterMeta.bytes,
      sameHash: beforeMeta.sha256 === afterMeta.sha256,
      beforeWidth: beforeMeta.width,
      beforeHeight: beforeMeta.height,
      afterWidth: afterMeta.width,
      afterHeight: afterMeta.height,
      beforeBytes: beforeMeta.bytes,
      afterBytes: afterMeta.bytes,
      beforeMime: beforeMeta.mimeType,
      afterMime: afterMeta.mimeType,
    };
  }

  async pixelDiff(
    beforeBytes: Buffer,
    afterBytes: Buffer,
    opts: { threshold?: number; minChangedPixels?: number } = {}
  ): Promise<PixelDiffResult> {
    const threshold = opts.threshold ?? 0.1;
    const minChangedPixels = opts.minChangedPixels ?? 10;

    // Load both images as raw rgba pixels
    const beforeRaw = await sharp(beforeBytes, { failOnError: false }).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const afterRaw = await sharp(afterBytes, { failOnError: false }).raw().ensureAlpha().toBuffer({ resolveWithObject: true });

    const bw = beforeRaw.info.width;
    const bh = beforeRaw.info.height;
    const aw = afterRaw.info.width;
    const ah = afterRaw.info.height;

    if (bw !== aw || bh !== ah) {
      return {
        changed: true,
        changedRegions: [{
          label: "dimension mismatch",
          bboxNorm1000: [0, 0, 1000, 1000],
          confidence: 1,
          evidence: { text: `Dimensions differ: ${bw}x${bh} vs ${aw}x${ah}` }
        }],
        threshold,
        diffPixels: -1,
        totalPixels: Math.max(bw * bh, aw * ah),
      };
    }

    const totalPixels = bw * bh;
    const beforeData = beforeRaw.data;
    const afterData = afterRaw.data;

    // Compute per-pixel difference
    const diffMask = new Uint8Array(totalPixels);
    let diffCount = 0;
    for (let i = 0; i < totalPixels; i++) {
      const rDiff = Math.abs(beforeData[i * 4] - afterData[i * 4]);
      const gDiff = Math.abs(beforeData[i * 4 + 1] - afterData[i * 4 + 1]);
      const bDiff = Math.abs(beforeData[i * 4 + 2] - afterData[i * 4 + 2]);
      const aDiff = Math.abs(beforeData[i * 4 + 3] - afterData[i * 4 + 3]);
      const maxDiff = Math.max(rDiff, gDiff, bDiff, aDiff) / 255;
      if (maxDiff > threshold) {
        diffMask[i] = 1;
        diffCount++;
      }
    }

    if (diffCount < minChangedPixels) {
      return { changed: false, changedRegions: [], threshold, diffPixels: diffCount, totalPixels };
    }

    // Find connected changed regions using simple bounding box grouping
    const regions = findChangedRegions(diffMask, bw, bh);

    return {
      changed: true,
      changedRegions: regions.map((r) => ({
        label: "pixel change",
        bboxNorm1000: pxToNorm1000(r, bw, bh),
        confidence: Math.min(1, r.pixelCount / 100),
        evidence: { text: `${r.pixelCount} pixels changed` }
      })),
      threshold,
      diffPixels: diffCount,
      totalPixels,
    };
  }

  async ocrDiff(
    beforeSpans: Array<{ text: string; bboxNorm1000?: [number, number, number, number] }>,
    afterSpans: Array<{ text: string; bboxNorm1000?: [number, number, number, number] }>
  ): Promise<OcrDiffResult> {
    const beforeSet = new Set(beforeSpans.map((s) => s.text));
    const afterSet = new Set(afterSpans.map((s) => s.text));

    const added = afterSpans.filter((s) => !beforeSet.has(s.text));
    const removed = beforeSpans.filter((s) => !afterSet.has(s.text));

    return {
      beforeText: beforeSpans.map((s) => s.text).join("\n"),
      afterText: afterSpans.map((s) => s.text).join("\n"),
      added: added.map((s) => ({ text: s.text, bboxNorm1000: s.bboxNorm1000 })),
      removed: removed.map((s) => ({ text: s.text, bboxNorm1000: s.bboxNorm1000 })),
    };
  }

  async layoutDiff(
    beforeRegions: LocalizationResult[],
    afterRegions: LocalizationResult[]
  ): Promise<LayoutDiffResult> {
    // Simple layout diff: match by label, compare bbox
    const moved: Array<{ label: string; beforeBbox: [number, number, number, number]; afterBbox: [number, number, number, number] }> = [];
    const added: LocalizationResult[] = [];
    const removed: LocalizationResult[] = [];

    const beforeMap = new Map(beforeRegions.map((r) => [r.label, r]));
    const afterMap = new Map(afterRegions.map((r) => [r.label, r]));

    for (const [label, before] of beforeMap) {
      const after = afterMap.get(label);
      if (!after) {
        removed.push(before);
      } else if (bboxDistance(before.bboxNorm1000!, after.bboxNorm1000!) > 50) {
        moved.push({ label, beforeBbox: before.bboxNorm1000!, afterBbox: after.bboxNorm1000! });
      }
    }

    for (const [label, after] of afterMap) {
      if (!beforeMap.has(label)) {
        added.push(after);
      }
    }

    return { sameLayout: moved.length === 0 && added.length === 0 && removed.length === 0, moved, added, removed };
  }
}

function findChangedRegions(diffMask: Uint8Array, width: number, height: number): Array<{ x: number; y: number; w: number; h: number; pixelCount: number }> {
  const visited = new Uint8Array(diffMask.length);
  const regions: Array<{ x: number; y: number; w: number; h: number; pixelCount: number }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (diffMask[idx] && !visited[idx]) {
        const region = floodFill(diffMask, visited, width, height, x, y);
        if (region.pixelCount >= 5) { // min region size
          regions.push(region);
        }
      }
    }
  }

  return regions;
}

function floodFill(diffMask: Uint8Array, visited: Uint8Array, width: number, height: number, startX: number, startY: number): { x: number; y: number; w: number; h: number; pixelCount: number } {
  let minX = startX, minY = startY, maxX = startX, maxY = startY;
  let count = 0;
  const stack = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;
    count++;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    const neighbors = [[x-1,y], [x+1,y], [x,y-1], [x,y+1]];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nidx = ny * width + nx;
        if (diffMask[nidx] && !visited[nidx]) {
          stack.push([nx, ny]);
        }
      }
    }
  }

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, pixelCount: count };
}

function pxToNorm1000(region: { x: number; y: number; w: number; h: number }, imgW: number, imgH: number): [number, number, number, number] {
  return [
    Math.round((region.x / imgW) * 1000),
    Math.round((region.y / imgH) * 1000),
    Math.round(((region.x + region.w) / imgW) * 1000),
    Math.round(((region.y + region.h) / imgH) * 1000),
  ];
}

function bboxDistance(a: [number, number, number, number], b: [number, number, number, number]): number {
  const acx = (a[0] + a[2]) / 2;
  const acy = (a[1] + a[3]) / 2;
  const bcx = (b[0] + b[2]) / 2;
  const bcy = (b[1] + b[3]) / 2;
  return Math.sqrt((acx - bcx) ** 2 + (acy - bcy) ** 2);
}
