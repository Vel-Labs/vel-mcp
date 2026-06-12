import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { VideoScanInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";
import { VideoSampler } from "../services/videoSampler.js";
import type { ArtifactStore } from "@vel/core";

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
      const loaded = await imageLoader.load(input.video);
      const warnings = [...loaded.warnings];

      // Video must be loaded from file_path for ffmpeg
      if (loaded.meta.source.kind !== "file_path") {
        throw new Error(`Video scanning currently only supports file_path inputs. Got: ${loaded.meta.source.kind}`);
      }
      const maxBytes = input.sampling?.maxBytes ?? 250 * 1024 * 1024;
      if (loaded.meta.bytes > maxBytes) {
        throw new Error(`Video file exceeds maxBytes policy (${loaded.meta.bytes} > ${maxBytes}).`);
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

      // If query provided, run locate on each frame
      if (input.query && frames.length > 0) {
        const provider = router.getForTool("video_scan", input.provider);
        for (const frame of frames) {
          try {
            const locateResult = await provider.locate({
              image: { kind: "artifact_id", value: frame.artifactId, mimeType: "image/png" },
              query: input.query,
              outputType: "box",
              targetType: "any",
              maxResults: 5,
              includeRawModelOutput: false,
            });
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
      }

      return toMcpJsonResult(envelope({
        frames,
        events,
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
        provider: { name: "glasses-video", version: "0.1.0" },
        timingMs: 0,
        warnings,
      }));
    },
  };
}
