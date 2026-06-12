import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { SetupInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";

export function setupTool(router: ProviderRouter): VelToolSpec<typeof SetupInputSchema.shape> {
  return {
    name: "glasses.setup",
    title: "Model discovery and setup guide",
    description: "Scan for available vision models, report their readiness, and provide specific setup instructions for missing dependencies. Use this to understand which providers are operational and what needs to be installed.",
    inputSchema: SetupInputSchema.shape,
    examples: [
      { description: "Check all available models and their status", input: {} },
      { description: "Check a specific provider's model readiness", input: { provider: "glasses-vision" } },
    ],
    handler: async (input) => {
      const provider = router.getForTool("setup", input.provider);

      if (provider.setup) {
        const result = await provider.setup();
        return toMcpJsonResult(envelope(result.data, {
          provider: result.provider,
          timingMs: result.timingMs,
          warnings: result.warnings,
        }));
      }

      return toMcpJsonResult(envelope({ models: [] }, {
        provider: { name: provider.id, version: (provider as any).displayName ?? provider.id },
        timingMs: 0,
        warnings: [`Provider "${provider.id}" does not support model discovery.`],
      }));
    }
  };
}
