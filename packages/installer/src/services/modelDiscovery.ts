import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { discoverModels } from "@vel/glasses-mcp";
import type { ModelSuggestion } from "./buildInstallPayload.js";

const ROLE_MAP: Record<string, string> = {
  "spatial-grounding": "spatial-grounding",
  "vision-language-reasoning": "general_vlm",
  "ocr-specialist": "ocr-specialist",
};

export function discoverLocalModels(activeModel: string, activeVlmModel?: string): ModelSuggestion[] {
  const result = discoverModels();
  return result.models.map((m) => {
    const role = ROLE_MAP[m.role] ?? m.role;
    const activeForRole = role === "general_vlm" ? activeVlmModel : activeModel;
    const status = m.status === "partial" ? "available" : m.status;
    return {
      id: m.id,
      displayName: m.displayName,
      role,
      kind: m.kind,
      sizeGb: m.sizeGb ?? 0,
      status,
      runtimeReady: status === "available" && !!activeForRole
        && (activeForRole === m.path || activeForRole === m.id || activeForRole.endsWith(m.id)),
      path: m.path,
      huggingFaceUrl: `https://huggingface.co/${m.id}`,
      licenseWarning: m.licenseWarning ?? "",
      setupInstructions: m.setupInstructions,
    };
  });
}

export function modelPath(id: string): string {
  return resolve(homedir(), "30_AI-Lab/_cache/models", id);
}

export function firstAvailableModelPath(ids: string[]): string | undefined {
  for (const id of ids) {
    const p = modelPath(id);
    if (existsSync(p)) return p;
  }
  return undefined;
}
