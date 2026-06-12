import { ProviderRegistry, type ProviderHealth } from "@vel/core";
import type { VisionProvider } from "./types.js";
import type { ModelRegistry } from "../services/modelRegistry.js";

export interface ProviderRouterOptions {
  defaultProviderId: string;
  modelRegistry?: ModelRegistry;
}

export interface ProviderEntry {
  provider: VisionProvider;
  priority: number;
  enabled: boolean;
  modelId?: string;
  role?: string;
}

export class ProviderRouter {
  private registry = new ProviderRegistry<VisionProvider>();
  private entries = new Map<string, { priority: number; enabled: boolean; modelId?: string; role?: string }>();
  private providerModelMap = new Map<string, string>();
  private selectionLog: Array<{ timestamp: string; requested: string | undefined; selected: string }> = [];
  private modelRegistry: ModelRegistry | null;

  constructor(private readonly options: ProviderRouterOptions) {
    this.modelRegistry = options.modelRegistry ?? null;
  }

  register(
    provider: VisionProvider,
    opts?: { priority?: number; enabled?: boolean; modelId?: string; role?: string }
  ): void {
    this.registry.register(provider);
    const modelId = opts?.modelId;
    this.entries.set(provider.id, {
      priority: opts?.priority ?? 10,
      enabled: opts?.enabled ?? true,
      modelId,
      role: opts?.role,
    });
    if (modelId) {
      this.providerModelMap.set(modelId, provider.id);
    }
  }

  get(providerId?: string): VisionProvider {
    const requested = providerId;
    const resolvedId = requested ?? this.options.defaultProviderId;
    const entry = this.entries.get(resolvedId);
    if (entry && !entry.enabled) {
      throw new Error(`Provider ${resolvedId} is disabled`);
    }
    const provider = this.registry.get(resolvedId);
    this.selectionLog.push({
      timestamp: new Date().toISOString(),
      requested: requested ?? null as unknown as string | undefined,
      selected: resolvedId,
    });
    return provider;
  }

  getForTool(toolName: string, explicitProviderId?: string): VisionProvider {
    if (explicitProviderId) return this.get(explicitProviderId);

    if (!this.modelRegistry) {
      return this.get(this.options.defaultProviderId);
    }

    const resolved = this.modelRegistry.resolveModelForTool(toolName);
    if (!resolved) return this.get(this.options.defaultProviderId);

    const providerId = this.providerModelMap.get(resolved.modelId);
    if (!providerId) {
      const roleName = resolved.role;
      const available = resolved.fallbackChain.find((mid) => this.providerModelMap.has(mid));
      if (available) {
        this.selectionLog.push({
          timestamp: new Date().toISOString(),
          requested: toolName,
          selected: `${available} (fallback from ${resolved.modelId})`,
        });
        return this.get(this.providerModelMap.get(available)!);
      }

      throw new Error(
        `No provider available for tool "${toolName}" (role: ${roleName}). ` +
        `Configured models: ${resolved.fallbackChain.join(", ")}. ` +
        `Run glasses.setup to check model availability.`
      );
    }

    return this.get(providerId);
  }

  async resolve(providerId?: string): Promise<{ provider: VisionProvider; health: ProviderHealth | null }> {
    if (providerId) return this.resolveExplicit(providerId);

    const sorted = this.listEntries()
      .filter((e) => e.enabled)
      .sort((a, b) => a.priority - b.priority);

    if (sorted.length === 0) throw new Error("No providers registered");

    for (const entry of sorted) {
      const health = await (entry.provider.healthCheck?.() ?? Promise.resolve(null));
      if (!health || health.ok) return { provider: entry.provider, health };
    }

    throw new Error(`No healthy provider available`);
  }

  async resolveForTool(toolName: string, explicitProviderId?: string): Promise<{ provider: VisionProvider; health: ProviderHealth | null }> {
    if (explicitProviderId) return this.resolveExplicit(explicitProviderId);

    if (!this.modelRegistry) {
      return this.resolve(this.options.defaultProviderId);
    }

    const resolved = this.modelRegistry.resolveModelForTool(toolName);
    if (!resolved) return this.resolve(this.options.defaultProviderId);

    for (const modelId of resolved.fallbackChain) {
      const providerId = this.providerModelMap.get(modelId);
      if (!providerId) continue;

      try {
        const { provider, health } = await this.resolveExplicit(providerId);
        if (!health || health.ok) return { provider, health };
      } catch {
        continue;
      }
    }

    throw new Error(
      `No healthy provider available for tool "${toolName}" (role: ${resolved.role}). ` +
      `Tried: ${resolved.fallbackChain.join(", ")}`
    );
  }

  private async resolveExplicit(providerId: string): Promise<{ provider: VisionProvider; health: ProviderHealth | null }> {
    const entry = this.entries.get(providerId);
    if (entry && !entry.enabled) throw new Error(`Provider ${providerId} is disabled`);
    const provider = this.registry.get(providerId);
    const health = await (provider.healthCheck?.() ?? Promise.resolve(null));
    return { provider, health };
  }

  list(): VisionProvider[] {
    return this.registry.list();
  }

  listEntries(): ProviderEntry[] {
    return this.registry.list().map((p) => ({
      provider: p,
      priority: this.entries.get(p.id)?.priority ?? 10,
      enabled: this.entries.get(p.id)?.enabled ?? true,
      modelId: this.entries.get(p.id)?.modelId,
      role: this.entries.get(p.id)?.role,
    }));
  }

  flushSelectionLog(): Array<{ timestamp: string; requested: string | undefined; selected: string }> {
    const log = [...this.selectionLog];
    this.selectionLog.length = 0;
    return log;
  }
}
