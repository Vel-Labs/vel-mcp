import { readFileSync, statSync } from "node:fs";
import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { VideoScanInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";
import { VideoSampler } from "../services/videoSampler.js";
import { FrameGridCompositor } from "../services/frameGridCompositor.js";
import type { ArtifactStore } from "@vel/core";

const DEFAULT_MAX_LOCATE_FRAMES = 20;
const DEFAULT_LOCATE_TIMEOUT_MS = 30_000;

export function videoScanTool(
  router: ProviderRouter,
  imageLoader: ImageLoader,
  artifactStore: ArtifactStore
): VelToolSpec<typeof VideoScanInputSchema.shape> {
  const sampler = new VideoSampler(artifactStore);

  return {
    name: "glasses.video_scan",
    title: "Scan video",
    description: "Sample a bounded video into timestamped frames and run structured visual analysis. Never processes unbounded video silently.",
    inputSchema: VideoScanInputSchema.shape,
    handler: async (input) => {
      const started = Date.now();
      const warnings: string[] = [];

      // Stat-before-read: reject oversized videos before loading into memory
      const maxBytes = input.sampling?.maxBytes ?? 250 * 1024 * 1024;
      if (input.video.kind === "file_path") {
        const fileBytes = statSync(input.video.value).size;
        if (fileBytes > maxBytes) {
          throw Object.assign(
            new Error(`Video file exceeds maxBytes policy (${fileBytes} > ${maxBytes}).`),
            { code: "VIDEO_TOO_LARGE" }
          );
        }
      }

      const loaded = await imageLoader.load(input.video);
      warnings.push(...loaded.warnings);

      // Video must be loaded from file_path for ffmpeg
      if (loaded.meta.source.kind !== "file_path") {
        throw new Error(`Video scanning currently only supports file_path inputs. Got: ${loaded.meta.source.kind}`);
      }
      if (input.sampling?.everySeconds && input.sampling?.fps) {
        throw new Error("Video sampling accepts either everySeconds or fps, not both.");
      }
      if (input.sampling?.sceneChangeThreshold !== undefined) {
        warnings.push("sceneChangeThreshold is accepted for policy compatibility but scene-change sampling is not implemented yet; interval/fps sampling was used.");
      }

      const videoPath = loaded.meta.source.value;
      const { frames, warnings: sampleWarnings, videoInfo } = await sampler.sampleFrames(videoPath, {
        everySeconds: input.sampling?.everySeconds,
        fps: input.sampling?.fps,
        maxFrames: input.sampling?.maxFrames,
        maxDurationSec: input.sampling?.maxDurationSec,
      });
      warnings.push(...sampleWarnings);

      if (frames.length === 0) {
        warnings.push("No frames extracted. Video may be too short, unsupported codec, or ffmpeg produced empty output.");
      }

      const events: Array<{
        timestampSec: number;
        frameIndex: number;
        frameArtifactId: string;
        label: string;
        bboxNorm1000?: [number, number, number, number];
        centerNorm1000?: [number, number];
        confidence?: number;
        uncertainty?: string;
        evidence?: { text?: string; rawModelOutput?: string; cropArtifactId?: string; frameArtifactId: string };
      }> = [];

      let locateProvider = { name: "glasses-video", version: "0.1.0" };

      // If query provided, run locate on bounded subset of frames
      if (input.query && frames.length > 0) {
        const provider = router.getForTool("video_scan", input.provider);
        locateProvider = { name: provider.id, version: (provider as any).displayName ?? provider.id };

        const maxLocateFrames = DEFAULT_MAX_LOCATE_FRAMES;
        const locateTimeout = DEFAULT_LOCATE_TIMEOUT_MS;
        const scanFrames = frames.slice(0, maxLocateFrames);

        if (frames.length > maxLocateFrames) {
          warnings.push(`Locate capped at ${maxLocateFrames} of ${frames.length} sampled frames.`);
        }

        for (let i = 0; i < scanFrames.length; i++) {
          const frame = scanFrames[i];
          try {
            const locateResult = await withTimeout(
              provider.locate({
                image: { kind: "file_path", value: artifactStore.dataPath(frame.artifactId), mimeType: "image/png" },
                query: input.query,
                outputType: "box",
                targetType: "any",
                maxResults: 5,
                includeRawModelOutput: false,
              }),
              locateTimeout,
              `Frame ${frame.frameIndex} locate timed out after ${locateTimeout}ms`
            );
            for (const match of locateResult.data.matches) {
              events.push({
                timestampSec: frame.timestampSec,
                frameIndex: frame.frameIndex,
                frameArtifactId: frame.artifactId,
                label: match.label,
                bboxNorm1000: match.bboxNorm1000,
                centerNorm1000: match.centerNorm1000,
                confidence: match.confidence,
                uncertainty: match.uncertainty,
                evidence: {
                  ...match.evidence,
                  frameArtifactId: frame.artifactId,
                },
              });
            }
          } catch (err) {
            warnings.push(`Frame ${frame.frameIndex} locate failed: ${(err as Error).message}`);
          }
        }

        if (scanFrames.length > 0) {
          warnings.push(`Scanned ${scanFrames.length} frame(s) for query "${input.query}". ${events.length} event(s) found.`);
        }
      }

      const timingMs = Date.now() - started;

      // Temporal reasoning: composite frames into a grid and ask VLM for cross-frame analysis
      let temporalSummary: {
        description?: string;
        artifactId?: string;
        warnings: string[];
      } = { warnings: [] };

      if (frames.length >= 2) {
        try {
          const vlmProvider = router.getForTool("ask", undefined);
          if (vlmProvider.ask) {
            temporalSummary = await buildTemporalSummary(vlmProvider, frames, artifactStore, videoInfo);
          }
        } catch (err) {
          temporalSummary.warnings.push(
            `Temporal reasoning unavailable: ${(err as Error).message}`
          );
        }
      }
      warnings.push(...temporalSummary.warnings);

      return toMcpJsonResult(envelope({
        frames,
        events,
        temporalSummary: temporalSummary.description
          ? {
              description: temporalSummary.description,
              gridArtifactId: temporalSummary.artifactId,
            }
          : undefined,
        videoInfo: {
          durationSec: videoInfo.durationSec,
          width: videoInfo.width,
          height: videoInfo.height,
          fps: videoInfo.fps,
          format: videoInfo.format,
        },
        policy: {
          maxBytes,
          maxDurationSec: input.sampling?.maxDurationSec ?? 600,
          maxFrames: input.sampling?.maxFrames ?? 60,
          sampling: input.sampling?.fps
            ? { fps: input.sampling.fps }
            : { everySeconds: input.sampling?.everySeconds ?? 2 },
          truncated: videoInfo.durationSec > (input.sampling?.maxDurationSec ?? 600),
        },
      }, {
        provider: locateProvider,
        timingMs,
        warnings,
      }));
    },
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(message), { code: "LOCATE_TIMEOUT" })), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function buildTemporalSummary(
  vlmProvider: any,
  frames: Array<{ artifactId: string; timestampSec: number }>,
  artifactStore: ArtifactStore,
  videoInfo: { width: number; height: number; durationSec: number; fps: number }
): Promise<{ description?: string; artifactId?: string; warnings: string[] }> {
  const warnings: string[] = [];
  const gridFrames = frames.slice(0, FrameGridCompositor.MAX_GRID_FRAMES);

  if (gridFrames.length < 2) {
    return { warnings: ["Temporal reasoning requires at least 2 frames."] };
  }

  try {
    // Read frame bytes from artifact store
    const frameData = gridFrames.map((f) => ({
      imageBytes: readFileSync(artifactStore.dataPath(f.artifactId)),
      timestampSec: f.timestampSec,
    }));

    // Composite into grid
    const gridBytes = await FrameGridCompositor.compose(frameData, videoInfo.width, videoInfo.height);

    // Store grid as artifact
    const gridMeta = await artifactStore.putBytes(gridBytes, {
      mimeType: "image/png",
      originalName: "video-frame-grid.png",
      origin: "generated",
      extra: {
        sourceFrames: frames.length,
        gridFrames: gridFrames.length,
        videoDuration: videoInfo.durationSec,
      },
    });

    // Build temporal prompt
    const timestamps = gridFrames.map((f) => `t=${f.timestampSec.toFixed(1)}s`).join(", ");
    const question = [
      `This is a grid of ${gridFrames.length} frames sampled from a ${videoInfo.durationSec.toFixed(1)}s video.`,
      `Frames are labeled left-to-right, top-to-bottom at timestamps: ${timestamps}.`,
      `Describe the sequence of events: what appears, disappears, moves, or changes across the frames.`,
      `Keep the answer concise — 3-6 sentences. Focus on temporal changes, not static scene description.`,
    ].join(" ");

    // Send to VLM via ask (free-form visual Q&A)
    const result = await vlmProvider.ask({
      image: { kind: "artifact_id", value: gridMeta.id, mimeType: "image/png" },
      question,
    });

    const description = result.data?.answer ?? "";
    if (result.warnings?.length) warnings.push(...result.warnings);

    return { description, artifactId: gridMeta.id, warnings };
  } catch (err) {
    warnings.push(`Temporal reasoning failed: ${(err as Error).message}`);
    return { warnings };
  }
}
