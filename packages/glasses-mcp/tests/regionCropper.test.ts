import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";
import { ArtifactStore } from "@vel/core";
import { RegionCropper } from "../src/services/regionCropper.js";

describe("RegionCropper", () => {
  let tempDir: string;
  let artifactStore: ArtifactStore;
  let cropper: RegionCropper;
  let testImage: Buffer;
  const width = 200;
  const height = 100;

  beforeAll(async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), "vel-test-cropper-"));
    artifactStore = new ArtifactStore(resolve(tempDir, "artifacts"));
    cropper = new RegionCropper(artifactStore);

    // Create a 200x100 test image: left half red, right half blue
    testImage = await sharp({
      create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .composite([
        { input: { create: { width: 100, height, channels: 3, background: { r: 0, g: 0, b: 255 } } }, left: 100, top: 0 },
      ])
      .png()
      .toBuffer();
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("crops a region and stores it as an artifact", async () => {
    const result = await cropper.cropRegion(
      testImage,
      "image/png",
      width,
      height,
      [0, 0, 500, 1000] // left half
    );

    expect(result.cropArtifactId).toMatch(/^sha256-/);
    expect(result.parentRegionNorm1000).toEqual([0, 0, 500, 1000]);
    expect(result.parentRegionPx).toEqual([0, 0, 100, 100]);
    expect(result.cropWidthPx).toBe(100);
    expect(result.cropHeightPx).toBe(100);
    expect(result.warnings).toHaveLength(0);

    // Verify the crop was stored
    const meta = await artifactStore.getMetadata(result.cropArtifactId);
    expect(meta.mimeType).toBe("image/png");
    expect(meta.bytes).toBeGreaterThan(0);
  });

  it("clamps out-of-bounds coordinates", async () => {
    const result = await cropper.cropRegion(
      testImage,
      "image/png",
      width,
      height,
      [-100, -100, 1100, 1200]
    );

    expect(result.parentRegionNorm1000).toEqual([0, 0, 1000, 1000]);
    expect(result.parentRegionPx).toEqual([0, 0, 200, 100]);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.includes("clamped"))).toBe(true);
  });

  it("fixes inverted coordinates", async () => {
    const result = await cropper.cropRegion(
      testImage,
      "image/png",
      width,
      height,
      [500, 500, 0, 0]
    );

    expect(result.parentRegionNorm1000).toEqual([0, 0, 500, 500]);
    expect(result.warnings.some((w) => w.includes("inverted"))).toBe(true);
  });

  it("throws on zero-area region", async () => {
    await expect(
      cropper.cropRegion(testImage, "image/png", width, height, [500, 500, 500, 500])
    ).rejects.toThrow("Invalid crop region");
  });

  it("warns on full-image crop", async () => {
    const result = await cropper.cropRegion(
      testImage,
      "image/png",
      width,
      height,
      [0, 0, 1000, 1000]
    );

    expect(result.warnings.some((w) => w.includes("full image"))).toBe(true);
  });

  it("maps child bbox back to parent space", async () => {
    const crop = await cropper.cropRegion(
      testImage,
      "image/png",
      width,
      height,
      [250, 250, 750, 750] // middle 50%
    );

    // Child bbox at [0,0,1000,1000] (full crop) → should map back to parent region
    const parentBbox = cropper.mapChildToParent([0, 0, 1000, 1000], crop);
    expect(parentBbox[0]).toBeCloseTo(250, 0);
    expect(parentBbox[1]).toBeCloseTo(250, 0);
    expect(parentBbox[2]).toBeCloseTo(750, 0);
    expect(parentBbox[3]).toBeCloseTo(750, 0);

    // Child bbox at [500,500,1000,1000] (bottom-right quadrant of crop)
    const parentQuadrant = cropper.mapChildToParent([500, 500, 1000, 1000], crop);
    expect(parentQuadrant[0]).toBeCloseTo(500, 0);
    expect(parentQuadrant[1]).toBeCloseTo(500, 0);
    expect(parentQuadrant[2]).toBeCloseTo(750, 0);
    expect(parentQuadrant[3]).toBeCloseTo(750, 0);
  });

  it("maps child point back to parent space", async () => {
    const crop = await cropper.cropRegion(
      testImage,
      "image/png",
      width,
      height,
      [0, 0, 500, 500] // top-left quadrant
    );

    // Center of crop → should be at [250, 250] in parent (center of top-left quadrant)
    const parentPoint = cropper.mapChildPointToParent([500, 500], crop);
    expect(parentPoint[0]).toBeCloseTo(250, 0);
    expect(parentPoint[1]).toBeCloseTo(250, 0);
  });

  it("produces a valid cropped image", async () => {
    const result = await cropper.cropRegion(
      testImage,
      "image/png",
      width,
      height,
      [0, 0, 500, 1000]
    );

    const dataPath = artifactStore.dataPath(result.cropArtifactId);
    const cropInfo = await sharp(dataPath).metadata();
    expect(cropInfo.width).toBe(100);
    expect(cropInfo.height).toBe(100);
  });
});
