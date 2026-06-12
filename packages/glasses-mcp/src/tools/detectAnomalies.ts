import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { DetectAnomaliesInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";
import type { ImageLoader } from "../services/imageLoader.js";

export function detectAnomaliesTool(router: ProviderRouter, imageLoader: ImageLoader): VelToolSpec<typeof DetectAnomaliesInputSchema.shape> {
  return {
    name: "glasses.detect_anomalies",
    title: "Detect visual anomalies",
    description: "Compare an expected image against an actual image and detect visual differences, layout drift, and missing elements.",
    inputSchema: DetectAnomaliesInputSchema.shape,
    handler: async (input) => {
      const [expected, actual] = await Promise.all([
        imageLoader.load(input.expected),
        imageLoader.load(input.actual),
      ]);
      const provider = router.getForTool("detect_anomalies", input.provider);
      if (!provider.detectAnomalies) {
        throw new Error(`Provider ${provider.id} does not support detect_anomalies.`);
      }
      const result = await provider.detectAnomalies(input);
      return toMcpJsonResult(envelope({
        anomalies: result.data.anomalies,
      }, {
        provider: result.provider,
        timingMs: result.timingMs,
        warnings: [...expected.warnings, ...actual.warnings, ...result.warnings],
      }));
    },
  };
}
