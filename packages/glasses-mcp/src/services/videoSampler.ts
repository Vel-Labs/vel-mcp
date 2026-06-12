import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArtifactStore } from "@vel/core";

export interface FrameManifest {
  frameIndex: number;
  timestampSec: number;
  artifactId: string;
  width: number;
  height: number;
}

export interface VideoSamplingOptions {
  everySeconds?: number;
  fps?: number;
  maxFrames?: number;
  maxDurationSec?: number;
}

export interface VideoInfo {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  format: string;
  bitrate?: number;
}

export class VideoSampler {
  constructor(private artifactStore: ArtifactStore) {}

  async probe(videoPath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn("ffprobe", [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,bit_rate:format=duration",
        "-of", "json",
        videoPath,
      ]);

      let stdout = "";
      let stderr = "";

      ffprobe.stdout.on("data", (data) => { stdout += data; });
      ffprobe.stderr.on("data", (data) => { stderr += data; });

      ffprobe.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed: ${stderr}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          const stream = parsed.streams?.[0] ?? {};
          const format = parsed.format ?? {};

          const fps = parseFps(stream.r_frame_rate);

          resolve({
            durationSec: parseFloat(format.duration ?? "0"),
            width: stream.width ?? 0,
            height: stream.height ?? 0,
            fps,
            format: stream.codec_name ?? "unknown",
            bitrate: stream.bit_rate ? parseInt(stream.bit_rate, 10) : undefined,
          });
        } catch (e) {
          reject(new Error(`Failed to parse ffprobe output: ${e}`));
        }
      });
    });
  }

  async sampleFrames(
    videoPath: string,
    opts: VideoSamplingOptions = {}
  ): Promise<{ frames: FrameManifest[]; warnings: string[]; videoInfo: VideoInfo }> {
    const warnings: string[] = [];
    const videoInfo = await this.probe(videoPath);

    if (videoInfo.durationSec <= 0) {
      throw new Error("Video has no duration or is not a valid video file.");
    }

    const maxFrames = opts.maxFrames ?? 60;
    if (opts.everySeconds && opts.fps) {
      throw new Error("Video sampling accepts either everySeconds or fps, not both.");
    }
    const everySeconds = opts.fps ? 1 / opts.fps : opts.everySeconds ?? 2;
    const maxDurationSec = opts.maxDurationSec ?? 600;

    if (videoInfo.durationSec > maxDurationSec) {
      warnings.push(`Video duration (${videoInfo.durationSec.toFixed(1)}s) exceeds max ${maxDurationSec}s. Sampling truncated.`);
    }

    const effectiveDuration = Math.min(videoInfo.durationSec, maxDurationSec);
    const totalFrames = Math.floor(effectiveDuration / everySeconds) + 1;
    const requestedCount = Math.min(totalFrames, maxFrames);

    if (totalFrames > maxFrames) {
      warnings.push(`Requested ${totalFrames} frames, limited to ${maxFrames}.`);
    }

    const tempDir = mkdtempSync(join(tmpdir(), "vel-video-frames-"));

    try {
      // Use ffmpeg fps filter for reliable interval extraction
      // fps=1/INTERVAL extracts one frame every INTERVAL seconds
      const fpsValue = requestedCount <= 1 ? 1 : 1 / everySeconds;
      await this.runFpsExtract(videoPath, fpsValue, requestedCount, tempDir);

      const files = readdirSync(tempDir)
        .filter((f) => f.endsWith(".png"))
        .sort();

      const frames: FrameManifest[] = [];
      for (let i = 0; i < files.length; i++) {
        const framePath = join(tempDir, files[i]);
        const frameBytes = readFileSync(framePath);
        const timestamp = Math.min(i * everySeconds, effectiveDuration);
        const meta = await this.artifactStore.putBytes(frameBytes, {
          mimeType: "image/png",
          originalName: `frame_${i}.png`,
          origin: "generated",
          extra: {
            sourceVideo: videoPath,
            frameIndex: i,
            timestampSec: Math.round(timestamp * 1000) / 1000,
          },
        });

        frames.push({
          frameIndex: i,
          timestampSec: Math.round(timestamp * 1000) / 1000,
          artifactId: meta.id,
          width: videoInfo.width,
          height: videoInfo.height,
        });
      }

      return { frames, warnings, videoInfo };
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private runFpsExtract(videoPath: string, fpsValue: number, maxFrames: number, tempDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", videoPath,
        "-vf", `fps=${fpsValue}`,
        "-frames:v", String(maxFrames),
        "-q:v", "2",
        "-y",
        join(tempDir, "frame_%04d.png"),
      ]);

      let stderr = "";
      ffmpeg.stderr.on("data", (data) => { stderr += data; });

      ffmpeg.on("close", (code) => {
        // ffmpeg may exit 0 even with partial output; check if any frames were produced
        if (code !== 0) {
          // Non-zero is acceptable if frames were extracted (e.g. truncated output)
          const files = readdirSync(tempDir).filter((f) => f.endsWith(".png"));
          if (files.length === 0) {
            reject(new Error(`ffmpeg failed and produced no frames: ${stderr}`));
            return;
          }
        }
        resolve();
      });
    });
  }
}

function parseFps(rate: unknown): number {
  if (typeof rate !== "string" || rate.length === 0) return 0;
  const [numeratorRaw, denominatorRaw] = rate.split("/");
  const numerator = Number(numeratorRaw);
  const denominator = denominatorRaw === undefined ? 1 : Number(denominatorRaw);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}
