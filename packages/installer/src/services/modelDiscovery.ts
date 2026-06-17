import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { ModelSuggestion } from "./buildInstallPayload.js";

const MODEL_CATALOG: Array<{
  id: string;
  displayName: string;
  role: string;
  kind: string;
  sizeGb: number;
  licenseWarning: string;
}> = [
  {
    id: "mlx-community/LocateAnything-3B-bf16",
    displayName: "LocateAnything-3B BF16 (MLX-VLM)",
    role: "spatial-grounding",
    kind: "mlx-vlm",
    sizeGb: 7.2,
    licenseWarning: "Non-commercial (inherits from upstream NVIDIA model)",
  },
  {
    id: "mlx-community/Qwen3-VL-4B-Instruct-5bit",
    displayName: "Qwen3-VL-4B Instruct 5-bit (MLX, default)",
    role: "vision-language-reasoning",
    kind: "mlx-vlm",
    sizeGb: 5.0,
    licenseWarning: "Apache 2.0; verify downstream model card terms before production use.",
  },
  {
    id: "mlx-community/Qwen3-VL-4B-Instruct-8bit",
    displayName: "Qwen3-VL-4B Instruct 8-bit (MLX, quality)",
    role: "vision-language-reasoning",
    kind: "mlx-vlm",
    sizeGb: 8.0,
    licenseWarning: "Apache 2.0; verify downstream model card terms before production use.",
  },
  {
    id: "mlx-community/Qwen2.5-VL-7B-Instruct-4bit",
    displayName: "Qwen2.5-VL-7B Instruct 4-bit (MLX)",
    role: "vision-language-reasoning",
    kind: "mlx-vlm",
    sizeGb: 5.5,
    licenseWarning: "Apache 2.0; verify downstream model card terms before production use.",
  },
  {
    id: "mlx-community/InternVL3-8B-MLX-4bit",
    displayName: "InternVL3-8B 4-bit (MLX)",
    role: "vision-language-reasoning",
    kind: "mlx-vlm",
    sizeGb: 5.5,
    licenseWarning: "Verify upstream model card terms before production use.",
  },
  {
    id: "sahilchachra/locateanything-3b-mxfp4-mlx",
    displayName: "LocateAnything-3B MXFP4 4-bit (MLX)",
    role: "spatial-grounding",
    kind: "mlx",
    sizeGb: 2.5,
    licenseWarning: "Non-commercial (inherits upstream). 4-bit quality not yet evaluated.",
  },
  {
    id: "andai-labs/LocateAnything-3B-MLX",
    displayName: "LocateAnything-3B MLX (andai-labs)",
    role: "spatial-grounding",
    kind: "mlx",
    sizeGb: 7.0,
    licenseWarning: "Non-commercial (inherits from upstream NVIDIA model)",
  },
];

const ROLE_MAP: Record<string, string> = {
  "spatial-grounding": "spatial-grounding",
  "vision-language-reasoning": "general_vlm",
};

function isModelDir(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

export function modelPath(id: string): string {
  return resolve(homedir(), "30_AI-Lab/_cache/models", id);
}

export function firstAvailableModelPath(ids: string[]): string | undefined {
  for (const id of ids) {
    const p = modelPath(id);
    if (isModelDir(p)) return p;
  }
  return undefined;
}

export function discoverLocalModels(activeModel: string, activeVlmModel?: string): ModelSuggestion[] {
  return MODEL_CATALOG.map((model) => {
    const path = modelPath(model.id);
    const exists = isModelDir(path);
    const role = ROLE_MAP[model.role] ?? model.role;
    const activeForRole = role === "general_vlm" ? activeVlmModel : activeModel;
    return {
      id: model.id,
      displayName: model.displayName,
      role,
      kind: model.kind,
      sizeGb: model.sizeGb,
      status: exists ? "available" : "not-installed",
      runtimeReady: exists && !!activeForRole
        && (activeForRole === path || activeForRole === model.id || activeForRole.endsWith(model.id)),
      path: exists ? path : undefined,
      huggingFaceUrl: `https://huggingface.co/${model.id}`,
      licenseWarning: model.licenseWarning,
      setupInstructions: [
        "python3.11 -m venv .vel/venvs/glasses-mlx",
        ".vel/venvs/glasses-mlx/bin/python -m pip install -e packages/glasses-mcp/workers/vel-worker",
        ".vel/venvs/glasses-mlx/bin/python -m pip install mlx-vlm huggingface_hub",
        `huggingface-cli download ${model.id} --local-dir ~/30_AI-Lab/_cache/models/${model.id}`,
      ],
    };
  });
}
