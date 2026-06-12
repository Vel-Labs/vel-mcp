import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";
import { ArtifactStore } from "@vel/core";
import { inspectRegionTool } from "../src/tools/inspectRegion.js";

describe("inspectRegionTool", () => {
  let tempDir: string;
  let artifactStore: ArtifactStore;
  let imageBytes: Buffer;

  beforeAll(async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), "vel-inspect-region-tool-"));
    artifactStore = new ArtifactStore(resolve(tempDir, "artifacts"));
    imageBytes = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 20, g: 40, b: 80 } },
    }).png().toBuffer();
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("accepts pixel regions and remaps crop-local locate results to parent coordinates", async () => {
    const provider = {
      async inspectImage() {
        return {
          provider: { name: "test-provider" },
          timingMs: 2,
          warnings: [],
          data: { observations: ["crop inspected"] },
        };
      },
      async locate() {
        return {
          provider: { name: "test-provider" },
          timingMs: 3,
          warnings: [],
          data: {
            matches: [{
              label: "target",
              bboxNorm1000: [500, 500, 1000, 1000] as [number, number, number, number],
              centerNorm1000: [750, 750] as [number, number],
              confidence: 0.9,
            }],
          },
        };
      },
    };

    const tool = inspectRegionTool(
      { getForTool: () => provider } as any,
      {
        load: async () => ({
          imageBytes,
          warnings: [],
          meta: {
            mimeType: "image/png",
            width: 200,
            height: 100,
            sha256: "test",
            bytes: imageBytes.length,
            source: { kind: "file_path", value: "/tmp/test.png" },
          },
        }),
      } as any,
      artifactStore
    );

    const mcpResult = await tool.handler({
      image: { kind: "file_path", value: "/tmp/test.png" },
      regionPx: [50, 25, 150, 75],
      query: "target",
      detail: "high",
    } as any) as { content: Array<{ text: string }> };
    const envelope = JSON.parse(mcpResult.content[0].text);

    expect(envelope.ok).toBe(true);
    expect(envelope.result.region.bboxNorm1000).toEqual([250, 250, 750, 750]);
    expect(envelope.result.region.bboxPx).toEqual([50, 25, 150, 75]);
    expect(envelope.result.matches[0].bboxNorm1000).toEqual([500, 500, 750, 750]);
    expect(envelope.result.matches[0].centerNorm1000).toEqual([625, 625]);
    expect(envelope.result.matches[0].evidence.cropArtifactId).toMatch(/^sha256-/);
  });
});
