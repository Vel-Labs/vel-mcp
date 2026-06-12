import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { ArtifactStore } from "@vel/core";
import { VideoSampler } from "../src/services/videoSampler.js";

describe("VideoSampler", () => {
  let tempDir: string;
  let videoPath: string;
  let artifactStore: ArtifactStore;
  let sampler: VideoSampler;

  beforeAll(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "vel-video-test-"));
    videoPath = join(tempDir, "test.mp4");
    artifactStore = new ArtifactStore(resolve(tempDir, "artifacts"));
    sampler = new VideoSampler(artifactStore);

    // Create a 2-second 100x100 test video with ffmpeg
    const result = spawnSync("ffmpeg", [
      "-f", "lavfi",
      "-i", "testsrc=duration=2:size=100x100:rate=1",
      "-pix_fmt", "yuv420p",
      "-y",
      videoPath,
    ], { encoding: "utf-8" });

    if (result.status !== 0) {
      throw new Error(`ffmpeg test video creation failed: ${result.stderr}`);
    }
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("probes video metadata", async () => {
    const info = await sampler.probe(videoPath);
    expect(info.durationSec).toBeCloseTo(2, 0);
    expect(info.width).toBe(100);
    expect(info.height).toBe(100);
    expect(info.fps).toBeGreaterThan(0);
  });

  it("samples frames at intervals", async () => {
    const result = await sampler.sampleFrames(videoPath, { everySeconds: 1, maxFrames: 10 });
    expect(result.frames.length).toBeGreaterThanOrEqual(2);
    expect(result.frames.length).toBeLessThanOrEqual(3); // 0s, 1s, 2s
    expect(result.frames[0].timestampSec).toBe(0);
    expect(result.frames[0].artifactId).toMatch(/^sha256-/);
    expect(result.frames[0].width).toBe(100);
    expect(result.frames[0].height).toBe(100);
  });

  it("respects maxFrames limit", async () => {
    const result = await sampler.sampleFrames(videoPath, { everySeconds: 0.1, maxFrames: 2 });
    expect(result.frames.length).toBe(2);
    expect(result.warnings.some((w) => w.includes("limited"))).toBe(true);
  });

  it("stores frames as artifacts", async () => {
    const result = await sampler.sampleFrames(videoPath, { everySeconds: 1, maxFrames: 10 });
    for (const frame of result.frames) {
      const meta = await artifactStore.getMetadata(frame.artifactId);
      expect(meta.mimeType).toBe("image/png");
      expect(meta.bytes).toBeGreaterThan(0);
    }
  });
});
