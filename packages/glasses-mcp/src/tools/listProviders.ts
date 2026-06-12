import { envelope, toMcpJsonResult, type VelToolSpec } from "@vel/mcp-base";
import { ListProvidersInputSchema } from "../schemas.js";
import type { ProviderRouter } from "../providers/providerRouter.js";

export function listProvidersTool(router: ProviderRouter): VelToolSpec<typeof ListProvidersInputSchema.shape> {
  return {
    name: "glasses.list_providers",
    title: "List vision providers",
    description: "List all registered vision providers with their capabilities, health status, and routing information.",
    inputSchema: ListProvidersInputSchema.shape,
    handler: async (_input) => {
      const entries = router.listEntries();
      const providers = await Promise.all(
        entries.map(async (entry) => {
          const health = await (entry.provider.healthCheck?.() ?? Promise.resolve(null));
          const capabilities = [
            "inspectImage",
            "locate",
            "ocr",
            "inspectRegion",
            "compare",
            "videoScan",
            entry.provider.describe ? "describe" : null,
            entry.provider.ask ? "ask" : null,
            entry.provider.readDocument ? "readDocument" : null,
            entry.provider.detectAnomalies ? "detectAnomalies" : null,
          ].filter(Boolean);
          return {
            id: entry.provider.id,
            displayName: entry.provider.displayName,
            enabled: entry.enabled,
            priority: entry.priority,
            modelId: entry.modelId,
            role: entry.role,
            capabilities,
            health: health
              ? { ok: health.ok, error: health.error, warnings: health.warnings }
              : null,
          };
        })
      );
      return toMcpJsonResult(envelope({ providers }, { provider: { name: "glasses-router", version: "0.1.0" }, timingMs: 0, warnings: [] }));
    },
  };
}
