import sharp from "sharp";
import type { ArtifactStore, ArtifactMetadata } from "@vel/core";

export interface CropResult {
  cropArtifactId: string;
  cropArtifactRef: { kind: "artifact_id"; value: string; mimeType?: string };
  parentRegionNorm1000: [number, number, number, number];
  parentRegionPx: [number, number, number, number];
  cropWidthPx: number;
  cropHeightPx: number;
  parentWidthPx: number;
  parentHeightPx: number;
  warnings: string[];
}

export class RegionCropper {
  constructor(private artifactStore: ArtifactStore) {}

  async cropRegion(
    imageBytes: Buffer,
    mimeType: string,
    parentWidth: number,
    parentHeight: number,
    regionNorm1000: [number, number, number, number]
  ): Promise<CropResult> {
    const warnings: string[] = [];

    // Clamp and validate coordinates
    let [x1n, y1n, x2n, y2n] = regionNorm1000;
    const origX1 = x1n, origY1 = y1n, origX2 = x2n, origY2 = y2n;
    x1n = clamp(x1n, 0, 1000);
    y1n = clamp(y1n, 0, 1000);
    x2n = clamp(x2n, 0, 1000);
    y2n = clamp(y2n, 0, 1000);

    if (x1n !== origX1 || y1n !== origY1 || x2n !== origX2 || y2n !== origY2) {
      warnings.push("Crop region was clamped to image bounds.");
    }

    if (x1n > x2n) {
      [x1n, x2n] = [x2n, x1n];
      warnings.push("Region x-coordinates were inverted; corrected.");
    }
    if (y1n > y2n) {
      [y1n, y2n] = [y2n, y1n];
      warnings.push("Region y-coordinates were inverted; corrected.");
    }

    const x1 = Math.round((x1n / 1000) * parentWidth);
    const y1 = Math.round((y1n / 1000) * parentHeight);
    const x2 = Math.round((x2n / 1000) * parentWidth);
    const y2 = Math.round((y2n / 1000) * parentHeight);

    const cropW = x2 - x1;
    const cropH = y2 - y1;

    if (cropW <= 0 || cropH <= 0) {
      throw new Error(
        `Invalid crop region: zero or negative area (${cropW}x${cropH}px). ` +
        `Normalized region: [${x1n},${y1n},${x2n},${y2n}] at ${parentWidth}x${parentHeight}px.`
      );
    }

    if (cropW === parentWidth && cropH === parentHeight) {
      warnings.push("Crop region covers the full image; no actual cropping performed.");
    }

    // Use sharp to extract the region
    const outputFormat = mimeType === "image/png" ? "png" : "jpeg";
    const cropBuffer = await sharp(imageBytes, { failOnError: false })
      .extract({ left: x1, top: y1, width: cropW, height: cropH })
      .toFormat(outputFormat as keyof sharp.FormatEnum)
      .toBuffer();

    const outputMime = outputFormat === "png" ? "image/png" : "image/jpeg";
    const meta = await this.artifactStore.putBytes(cropBuffer, {
      mimeType: outputMime,
      originalName: `crop-${x1n}-${y1n}-${x2n}-${y2n}.${outputFormat}`,
      origin: "generated",
      extra: {
        parentWidth,
        parentHeight,
        parentRegionNorm1000: [x1n, y1n, x2n, y2n],
        parentRegionPx: [x1, y1, x2, y2],
      },
    });

    return {
      cropArtifactId: meta.id,
      cropArtifactRef: { kind: "artifact_id", value: meta.id, mimeType: outputMime },
      parentRegionNorm1000: [x1n, y1n, x2n, y2n] as [number, number, number, number],
      parentRegionPx: [x1, y1, x2, y2] as [number, number, number, number],
      cropWidthPx: cropW,
      cropHeightPx: cropH,
      parentWidthPx: parentWidth,
      parentHeightPx: parentHeight,
      warnings,
    };
  }

  /**
   * Map child coordinates (in norm1000 space relative to crop) back to parent norm1000 space.
   */
  mapChildToParent(
    childNorm1000: [number, number, number, number],
    cropResult: Pick<CropResult, "parentRegionNorm1000" | "cropWidthPx" | "cropHeightPx" | "parentWidthPx" | "parentHeightPx">
  ): [number, number, number, number] {
    const [cx1, cy1, cx2, cy2] = childNorm1000;
    const [rx1, ry1] = cropResult.parentRegionNorm1000;

    // Convert child norm1000 → child pixels → parent pixels → parent norm1000
    const toParent = (cn: number, cropPx: number, parentPx: number, regionStartNorm: number) => {
      const childPx = (cn / 1000) * cropPx;
      const parentStartPx = (regionStartNorm / 1000) * parentPx;
      const parentPxCoord = parentStartPx + childPx;
      return (parentPxCoord / parentPx) * 1000;
    };

    return [
      clamp(toParent(cx1, cropResult.cropWidthPx, cropResult.parentWidthPx, rx1), 0, 1000),
      clamp(toParent(cy1, cropResult.cropHeightPx, cropResult.parentHeightPx, ry1), 0, 1000),
      clamp(toParent(cx2, cropResult.cropWidthPx, cropResult.parentWidthPx, rx1), 0, 1000),
      clamp(toParent(cy2, cropResult.cropHeightPx, cropResult.parentHeightPx, ry1), 0, 1000),
    ];
  }

  /**
   * Map child point (in norm1000 space relative to crop) back to parent norm1000 space.
   */
  mapChildPointToParent(
    childPointNorm1000: [number, number],
    cropResult: Pick<CropResult, "parentRegionNorm1000" | "cropWidthPx" | "cropHeightPx" | "parentWidthPx" | "parentHeightPx">
  ): [number, number] {
    const [cx, cy] = childPointNorm1000;
    const [rx1, ry1] = cropResult.parentRegionNorm1000;

    const toParent = (cn: number, cropPx: number, parentPx: number, regionStartNorm: number) => {
      const childPx = (cn / 1000) * cropPx;
      const parentStartPx = (regionStartNorm / 1000) * parentPx;
      return ((parentStartPx + childPx) / parentPx) * 1000;
    };

    return [
      clamp(toParent(cx, cropResult.cropWidthPx, cropResult.parentWidthPx, rx1), 0, 1000),
      clamp(toParent(cy, cropResult.cropHeightPx, cropResult.parentHeightPx, ry1), 0, 1000),
    ];
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
