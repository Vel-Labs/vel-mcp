import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { ImageComparator } from "../src/services/imageComparator.js";

const comparator = new ImageComparator();

async function makeImage(w: number, h: number, color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();
}

describe("ImageComparator", () => {
  describe("metadataDiff", () => {
    it("detects identical images", async () => {
      const diff = await comparator.metadataDiff(
        { sha256: "abc", bytes: 100, mimeType: "image/png", width: 100, height: 100 },
        { sha256: "abc", bytes: 100, mimeType: "image/png", width: 100, height: 100 }
      );
      expect(diff.sameHash).toBe(true);
      expect(diff.sameDimensions).toBe(true);
      expect(diff.sameFormat).toBe(true);
      expect(diff.sameSize).toBe(true);
    });

    it("detects dimension change", async () => {
      const diff = await comparator.metadataDiff(
        { sha256: "abc", bytes: 100, mimeType: "image/png", width: 100, height: 100 },
        { sha256: "def", bytes: 100, mimeType: "image/png", width: 200, height: 100 }
      );
      expect(diff.sameHash).toBe(false);
      expect(diff.sameDimensions).toBe(false);
      expect(diff.sameFormat).toBe(true);
    });

    it("detects format change", async () => {
      const diff = await comparator.metadataDiff(
        { sha256: "abc", bytes: 100, mimeType: "image/png", width: 100, height: 100 },
        { sha256: "def", bytes: 100, mimeType: "image/jpeg", width: 100, height: 100 }
      );
      expect(diff.sameFormat).toBe(false);
    });
  });

  describe("pixelDiff", () => {
    it("returns no change for identical images", async () => {
      const img = await makeImage(50, 50, { r: 255, g: 0, b: 0 });
      const result = await comparator.pixelDiff(img, img);
      expect(result.changed).toBe(false);
      expect(result.diffPixels).toBe(0);
    });

    it("detects pixel changes", async () => {
      const before = await makeImage(50, 50, { r: 255, g: 0, b: 0 });
      const after = await sharp({ create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } } })
        .composite([{ input: { create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 255, b: 0 } } }, left: 5, top: 5 }])
        .png()
        .toBuffer();
      const result = await comparator.pixelDiff(before, after, { threshold: 0.05 });
      expect(result.changed).toBe(true);
      expect(result.diffPixels).toBeGreaterThan(0);
      expect(result.changedRegions.length).toBeGreaterThan(0);
    });

    it("reports dimension mismatch", async () => {
      const before = await makeImage(50, 50, { r: 255, g: 0, b: 0 });
      const after = await makeImage(60, 50, { r: 255, g: 0, b: 0 });
      const result = await comparator.pixelDiff(before, after);
      expect(result.changed).toBe(true);
      expect(result.changedRegions[0].label).toBe("dimension mismatch");
    });

    it("respects threshold", async () => {
      const before = await makeImage(50, 50, { r: 255, g: 0, b: 0 });
      const after = await makeImage(50, 50, { r: 254, g: 0, b: 0 });
      const lowThreshold = await comparator.pixelDiff(before, after, { threshold: 0.001 });
      const highThreshold = await comparator.pixelDiff(before, after, { threshold: 0.1 });
      expect(lowThreshold.changed).toBe(true);
      expect(highThreshold.changed).toBe(false);
    });
  });

  describe("ocrDiff", () => {
    it("detects added and removed text", async () => {
      const before = [{ text: "hello", bboxNorm1000: [0, 0, 100, 100] as [number, number, number, number] }];
      const after = [{ text: "world", bboxNorm1000: [0, 0, 100, 100] as [number, number, number, number] }];
      const result = await comparator.ocrDiff(before, after);
      expect(result.added).toHaveLength(1);
      expect(result.added[0].text).toBe("world");
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].text).toBe("hello");
    });

    it("returns empty for identical text", async () => {
      const spans = [{ text: "same" }];
      const result = await comparator.ocrDiff(spans, spans);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });
  });

  describe("layoutDiff", () => {
    it("detects moved elements", async () => {
      const before = [{ label: "button", bboxNorm1000: [0, 0, 100, 100] as [number, number, number, number], confidence: 1 }];
      const after = [{ label: "button", bboxNorm1000: [500, 500, 600, 600] as [number, number, number, number], confidence: 1 }];
      const result = await comparator.layoutDiff(before, after);
      expect(result.sameLayout).toBe(false);
      expect(result.moved).toHaveLength(1);
      expect(result.moved[0].label).toBe("button");
    });

    it("detects added and removed elements", async () => {
      const before = [{ label: "A", bboxNorm1000: [0, 0, 100, 100] as [number, number, number, number], confidence: 1 }];
      const after = [{ label: "B", bboxNorm1000: [0, 0, 100, 100] as [number, number, number, number], confidence: 1 }];
      const result = await comparator.layoutDiff(before, after);
      expect(result.sameLayout).toBe(false);
      expect(result.added).toHaveLength(1);
      expect(result.removed).toHaveLength(1);
    });

    it("returns sameLayout for identical layouts", async () => {
      const regions = [{ label: "A", bboxNorm1000: [0, 0, 100, 100] as [number, number, number, number], confidence: 1 }];
      const result = await comparator.layoutDiff(regions, regions);
      expect(result.sameLayout).toBe(true);
    });
  });
});
