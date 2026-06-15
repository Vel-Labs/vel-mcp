import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";
import { ArtifactStore } from "@vel/core";
import { VisualReviewService } from "../src/services/visualReview.js";

describe("VisualReviewService", () => {
  let tempDir: string;
  let artifactStore: ArtifactStore;
  let imageBytes: Buffer;

  beforeEach(async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), "vel-visual-review-test-"));
    artifactStore = new ArtifactStore(resolve(tempDir, "artifacts"));
    imageBytes = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 245, g: 247, b: 250 } },
    }).png().toBuffer();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function imageLoader() {
    return {
      load: async (image: any) => ({
        imageBytes,
        warnings: [],
        meta: {
          sha256: "test-sha",
          bytes: imageBytes.length,
          mimeType: image.mimeType ?? "image/png",
          width: 200,
          height: 100,
          source: image,
        },
      }),
    };
  }

  it("reviews a whole image without focus using the VLM lane only", async () => {
    const calls: string[] = [];
    const router = {
      getForTool(tool: string) {
        calls.push(tool);
        return {
          inspectImage: async () => ({
            provider: { name: "vlm" },
            timingMs: 2,
            warnings: [],
            data: { observations: ["whole image observation"] },
          }),
        };
      },
    };
    const service = new VisualReviewService(router as any, imageLoader() as any, artifactStore);
    const result = await service.review({
      image: { kind: "file_path", value: "/tmp/screen.png", mimeType: "image/png" },
      mode: "general",
      detail: "medium",
    });

    expect(result.data.summary).toBe("Reviewed the full image.");
    expect(result.data.wholeImage).toEqual(["whole image observation"]);
    expect(result.data.focusArea).toBeUndefined();
    expect(result.data.text).toBeUndefined();
    expect(calls).toEqual(["inspect_image"]);
  });

  it("reviews a focused UI area with locate, region inspection, and OCR", async () => {
    const calls: string[] = [];
    let inspectCount = 0;
    const router = {
      getForTool(tool: string) {
        calls.push(tool);
        if (tool === "inspect_image") {
          return {
            inspectImage: async () => {
              inspectCount += 1;
              return {
                provider: { name: "vlm" },
                timingMs: 3,
                warnings: [],
                data: { observations: [inspectCount === 2 ? "focused region observation" : "whole image observation"] },
              };
            },
          };
        }
        if (tool === "locate") {
          return {
            locate: async () => ({
              provider: { name: "grounding" },
              timingMs: 4,
              warnings: [],
              data: {
                matches: [{
                  label: "Approve",
                  bboxNorm1000: [250, 250, 750, 750] as [number, number, number, number],
                  centerNorm1000: [500, 500] as [number, number],
                  confidence: 0.9,
                }],
              },
            }),
          };
        }
        return {
          ocr: async () => ({
            provider: { name: "ocr" },
            timingMs: 5,
            warnings: [],
            data: { text: "Approve deployment", spans: [{ text: "Approve", readingOrder: 1 }] },
          }),
        };
      },
    };
    const service = new VisualReviewService(router as any, imageLoader() as any, artifactStore);
    const result = await service.review({
      image: { kind: "file_path", value: "/tmp/screen.png", mimeType: "image/png" },
      focus: "Approve button",
      mode: "ui_review",
      detail: "high",
    });

    expect(result.data.summary).toContain("Approve button");
    expect(result.data.wholeImage).toEqual(["whole image observation"]);
    expect(result.data.focusArea?.matches[0].label).toBe("Approve");
    expect(result.data.focusArea?.selected?.bboxNorm1000).toEqual([250, 250, 750, 750]);
    expect(result.data.focusArea?.selected?.notes).toEqual(["focused region observation"]);
    expect(result.data.focusArea?.selected?.cropArtifactId).toMatch(/^sha256-/);
    expect(result.data.text?.text).toBe("Approve deployment");
    expect(calls).toEqual(["inspect_image", "locate", "ocr"]);
  });
});
