import type { ModelConfig } from "@vel/core";

export interface RoleEntry {
  preferred: string;
  fallback: string[];
}

export interface ResolvedModel {
  modelId: string;
  role: string;
  fallbackChain: string[];
}

export class ModelRegistry {
  private models: ModelConfig[] = [];
  private roles: Record<string, RoleEntry> = {};
  private toolToRole: Record<string, string> = {};

  constructor(config?: Record<string, unknown>) {
    this.models = (config?.models as ModelConfig[]) ?? [];

    const rawRoles = config?.roles as Record<string, unknown> | undefined;
    if (rawRoles) {
      for (const [roleName, entry] of Object.entries(rawRoles)) {
        const e = entry as Record<string, unknown>;
        this.roles[roleName] = {
          preferred: String(e.preferred ?? ""),
          fallback: (e.fallback as string[]) ?? [],
        };
      }
    }

    const rawT2R = config?.toolToRole as Record<string, string> | undefined;
    if (rawT2R) {
      this.toolToRole = { ...rawT2R };
    }
  }

  resolveModelForTool(toolName: string): ResolvedModel | null {
    const roleName = this.toolToRole[toolName];
    if (!roleName) return null;

    return this.resolveModelForRole(roleName);
  }

  resolveModelForRole(roleName: string): ResolvedModel | null {
    const roleEntry = this.roles[roleName];
    if (!roleEntry) return null;

    const fallbackChain = [roleEntry.preferred, ...roleEntry.fallback];
    const firstAvailable = fallbackChain.find((mid) => this.isModelAvailable(mid));

    if (!firstAvailable) {
      return {
        modelId: roleEntry.preferred,
        role: roleName,
        fallbackChain,
      };
    }

    return {
      modelId: firstAvailable,
      role: roleName,
      fallbackChain,
    };
  }

  getModelConfig(modelId: string): ModelConfig | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  getModelsForRole(roleName: string): ModelConfig[] {
    return this.models.filter((m) => m.role === roleName && m.enabled !== false);
  }

  isModelAvailable(modelId: string): boolean {
    const model = this.getModelConfig(modelId);
    if (!model) return false;
    return model.enabled !== false;
  }

  getAllModels(): ModelConfig[] {
    return [...this.models];
  }

  getRoles(): Record<string, RoleEntry> {
    return { ...this.roles };
  }

  getToolToRole(): Record<string, string> {
    return { ...this.toolToRole };
  }

  hasRole(roleName: string): boolean {
    return !!this.roles[roleName];
  }
}
