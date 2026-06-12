import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { ArtifactStore } from "@vel/core";
import { videoScanTool } from "../src/tools/videoScan.js";

describe("videoScanTool", () => {
  let tempDir: string;
  let videoPath: string;
  let artifactStore: ArtifactStore;

  beforeAll(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "vel-video-scan-tool-"));
    videoPath = join(tempDir, "test.mp4");
    artifactStore = new ArtifactStore(resolve(tempDir, "artifacts"));

    const result = spawnSync("ffmpeg", [
      "-f", "lavfi",
      "-i", "testsrc=duration=1:size=64x64:rate=1",
      "-pix_fmt", "yuv420p",
      "-y",
      videoPath,
    ], { encoding: "utf-8" });
    if (result.status !== 0) throw new Error(`ffmpeg test video creation failed: ${result.stderr}`);
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("includes frame artifact and region provenance on query events", async () => {
    const provider = {
      async locate() {
        return {
          provider: { name: "test-provider" },
          timingMs: 1,
          warnings: [],
          data: {
            matches: [{
              label: "target",
              bboxNorm1000: [100, 200, 300, 400] as [number, number, number, number],
              centerNorm1000: [200, 300] as [number, number],
              confidence: 0.8,
              uncertainty: "synthetic",
            }],
          },
        };
      },
    };
    const bytes = statSync(videoPath).size;
    const tool = videoScanTool(
      { getForTool: () => provider } as any,
      {
        load: async () => ({
          warnings: [],
          meta: { source: { kind: "file_path", value: videoPath }, bytes },
        }),
      } as any,
      artifactStore
    );

    const mcpResult = await tool.handler({
      video: { kind: "file_path", value: videoPath },
      sampling: { everySeconds: 1, maxFrames: 1, maxDurationSec: 2, maxBytes: bytes + 1 },
      query: "target",
    } as any) as { content: Array<{ text: string }> };
    const envelope = JSON.parse(mcpResult.content[0].text);

    expect(envelope.ok).toBe(true);
    expect(envelope.result.events[0]).toMatchObject({
      frameIndex: 0,
      label: "target",
      bboxNorm1000: [100, 200, 300, 400],
      centerNorm1000: [200, 300],
      confidence: 0.8,
      uncertainty: "synthetic",
    });
    expect(envelope.result.events[0].frameArtifactId).toMatch(/^sha256-/);
    expect(envelope.result.events[0].evidence.frameArtifactId).toBe(envelope.result.events[0].frameArtifactId);
    expect(envelope.result.policy.maxBytes).toBe(bytes + 1);
  });

  it("rejects videos above maxBytes policy", async () => {
    const bytes = statSync(videoPath).size;
    const tool = videoScanTool(
      { getForTool: () => ({}) } as any,
      {
        load: async () => ({
          warnings: [],
          meta: { source: { kind: "file_path", value: videoPath }, bytes },
        }),
      } as any,
      artifactStore
    );

    await expect(tool.handler({
      video: { kind: "file_path", value: videoPath },
      sampling: { everySeconds: 1, maxFrames: 1, maxDurationSec: 2, maxBytes: bytes - 1 },
    } as any)).rejects.toThrow("maxBytes policy");
  });
});
