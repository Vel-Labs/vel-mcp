import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { CaptureUrlInputSchema } from "../schemas.js";
import { PlaywrightUrlCapturer, type UrlCapturer } from "../services/urlCapture.js";
import type { ArtifactStore } from "@vel/core";

export function captureUrlTool(
  artifactStore: ArtifactStore,
  capturer: UrlCapturer = new PlaywrightUrlCapturer(artifactStore)
): VelToolSpec<typeof CaptureUrlInputSchema.shape> {
  return {
    name: "glasses.capture_url",
    title: "Capture URL screenshot",
    description: "Capture a bounded screenshot of an HTTP(S) URL or localhost page and store it as a VEL artifact for visual review.",
    inputSchema: CaptureUrlInputSchema.shape,
    handler: async (input) => {
      const started = Date.now();
      const result = await capturer.capture(input);
      return toMcpJsonResult(envelope(result, {
        provider: { name: "glasses-capture-url", version: "0.1.0" },
        timingMs: Date.now() - started,
        warnings: result.warnings,
      }));
    },
  };
}
