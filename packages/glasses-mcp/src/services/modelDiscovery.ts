import { accessSync, constants } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

export interface ModelConfig {
  id: string;
  displayName?: string;
  kind: "transformers" | "mlx" | "mlx-vlm";
  role: "spatial-grounding" | "vision-language-reasoning" | "ocr-specialist";
  path?: string;
  sizeGb?: number;
  licenseWarning?: string;
  dependencies?: string[];
  taskAffinity?: string[];
  setupInstructions?: string[];
  enabled?: boolean;
}

export interface ModelDiscovery {
  id: string;
  displayName: string;
  kind: "transformers" | "mlx" | "mlx-vlm";
  role: "spatial-grounding" | "vision-language-reasoning" | "ocr-specialist";
  status: "available" | "partial" | "not-installed";
  path?: string;
  sizeGb?: number;
  licenseWarning?: string;
  runtimeReady: boolean;
  setupInstructions: string[];
  dependencies?: string[];
  taskAffinity?: string[];
}

export interface DiscoveryResult {
  models: ModelDiscovery[];
  scannedAt: string;
}

function fileExists(p: string): boolean {
  try {
    accessSync(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function dirHasFiles(p: string): boolean {
  try {
    accessSync(join(p, "config.json"), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function resolvePath(path?: string): string | undefined {
  if (!path) return undefined;
  return resolve(path.replace(/^~/, homedir()));
}

const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: "nvidia/LocateAnything-3B",
    displayName: "LocateAnything-3B",
    kind: "transformers",
    role: "spatial-grounding",
    sizeGb: 7.3,
    licenseWarning: "Non-commercial research/development only",
    taskAffinity: ["locate", "ocr", "gui", "document-layout"],
  },
  {
    id: "mlx-community/LocateAnything-3B-bf16",
    displayName: "LocateAnything-3B BF16 (MLX-VLM)",
    kind: "mlx-vlm",
    role: "spatial-grounding",
    sizeGb: 7.2,
    licenseWarning: "Non-commercial (inherits from upstream NVIDIA model)",
    taskAffinity: ["locate", "ocr", "gui"],
    dependencies: ["mlx-vlm>=0.6.2", "huggingface_hub"],
  },
  {
    id: "sahilchachra/locateanything-3b-mxfp4-mlx",
    displayName: "LocateAnything-3B MXFP4 4-bit (MLX)",
    kind: "mlx",
    role: "spatial-grounding",
    sizeGb: 2.5,
    licenseWarning: "Non-commercial (inherits upstream). 4-bit quality not yet evaluated.",
    taskAffinity: ["locate", "ocr"],
  },
  {
    id: "andai-labs/LocateAnything-3B-MLX",
    displayName: "LocateAnything-3B MLX (andai-labs)",
    kind: "mlx",
    role: "spatial-grounding",
    sizeGb: 7.0,
    licenseWarning: "Non-commercial (inherits from upstream NVIDIA model)",
    taskAffinity: ["locate", "ocr", "gui", "document-layout"],
  },
  {
    id: "nvidia/Eagle2.5-8B",
    displayName: "Eagle2.5-8B",
    kind: "transformers",
    role: "vision-language-reasoning",
    sizeGb: 16.1,
    licenseWarning: "⚠️ Gated model — requires NVIDIA authorization on HuggingFace before download.",
    taskAffinity: ["inspect_image", "describe", "ask", "video_summarize", "document-understanding"],
    enabled: false,
    setupInstructions: [
      "🔒 Gated repo — request access at https://huggingface.co/nvidia/Eagle2.5-8B",
      "After approval: huggingface-cli login && huggingface-cli download nvidia/Eagle2.5-8B --local-dir ~/30_AI-Lab/_cache/models/nvidia/Eagle2.5-8B",
      "General VLM for image/video understanding — NOT a spatial grounding model.",
      "Provider not yet implemented in glasses MCP (separate lane from LocateAnything).",
    ],
  },
];

function modelPath(model: ModelConfig): string | undefined {
  if (model.path) return resolvePath(model.path);

  const parts = model.id.split("/");
  const org = parts[0];
  const name = parts.slice(1).join("/");

  if (model.kind === "mlx" || model.kind === "mlx-vlm") {
    return resolve(homedir(), ".cache", "huggingface", "hub", `models--${org}--${name}`, "snapshots");
  }

  return resolve(homedir(), "30_AI-Lab", "_cache", "models", model.id);
}

function pathExists(model: ModelConfig): boolean {
  const p = modelPath(model);
  if (!p) return false;
  return model.kind === "transformers" ? dirHasFiles(p) : fileExists(p);
}

function buildDiscovery(model: ModelConfig): ModelDiscovery {
  const exists = pathExists(model);
  const modelEnv = process.env.VEL_VISION_MODEL;

  const runtimeReady =
    model.role === "spatial-grounding"
      ? exists && !!modelEnv
      : exists;

  const setupInstructions = model.setupInstructions ?? buildDefaultInstructions(model);

  return {
    id: model.id,
    displayName: model.displayName ?? model.id,
    kind: model.kind,
    role: model.role,
    status: exists ? "available" : "not-installed",
    path: exists ? modelPath(model) : undefined,
    sizeGb: model.sizeGb,
    licenseWarning: model.licenseWarning,
    runtimeReady,
    setupInstructions,
    dependencies: model.dependencies,
    taskAffinity: model.taskAffinity,
  };
}

function buildDefaultInstructions(model: ModelConfig): string[] {
  const lines: string[] = [];

  if (!model.path) {
    lines.push(`Model not found locally. Configure a path in vel.config.yaml under modules.glasses.models.`);
  }

  if (model.kind === "mlx" || model.kind === "mlx-vlm") {
    lines.push("Apple Silicon native MLX model.");
    lines.push(`Install: pip install ${model.kind === "mlx-vlm" ? "mlx-vlm" : "mlx"} huggingface_hub`);
    lines.push(`Download: huggingface-cli download ${model.id} --local-dir ~/30_AI-Lab/_cache/models/${model.id}`);
  } else {
    const isGrounding = model.role === "spatial-grounding";
    if (isGrounding) {
      lines.push("Requires Eagle repo + locateanything_worker package.");
      lines.push("Clone: git clone https://github.com/NVlabs/Eagle.git ~/_cache/repos/NVlabs-Eagle");
      lines.push(`Set: export VEL_LOCATEANYTHING_REPO=~/_cache/repos/NVlabs-Eagle/Embodied`);
      lines.push("Install: pip install vel-locate-anything-worker[eagle]");
      lines.push(`Download: huggingface-cli download ${model.id} --local-dir ~/30_AI-Lab/_cache/models/${model.id}`);
    } else {
      lines.push("General VLM — provider setup varies by model.");
      lines.push(`Download: huggingface-cli download ${model.id} --local-dir ~/30_AI-Lab/_cache/models/${model.id}`);
    }
  }

  return lines;
}

export function discoverModels(configModels?: ModelConfig[]): DiscoveryResult {
  const sourceModels = configModels && configModels.length > 0
    ? configModels
    : DEFAULT_MODELS;

  const models = sourceModels
    .filter((m) => m.enabled !== false)
    .map(buildDiscovery);

  return { models, scannedAt: new Date().toISOString() };
}

export function getTaskToModel(config?: Record<string, unknown>): Record<string, string> {
  const taskMap = config?.taskToModel as Record<string, string> | undefined;
  if (!taskMap) return {};
  return taskMap;
}
