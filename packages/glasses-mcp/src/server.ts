import { createVelServer, registerVelTool } from "@vel/mcp-base";
import { AuditLog, WorkerSupervisor, ArtifactStore, PathPolicy } from "@vel/core";
import { homedir } from "node:os";
import { delimiter, resolve } from "node:path";
import { ProviderRouter } from "./providers/providerRouter.js";
import { MockVisionProvider } from "./providers/mockVisionProvider.js";
import { VelVisionProvider } from "./providers/velVisionProvider.js";
import { ImageLoader } from "./services/imageLoader.js";
import { ModelRegistry } from "./services/modelRegistry.js";
import { inspectImageTool } from "./tools/inspectImage.js";
import { locateTool } from "./tools/locate.js";
import { ocrTool } from "./tools/ocr.js";
import { inspectRegionTool } from "./tools/inspectRegion.js";
import { compareTool } from "./tools/compare.js";
import { videoScanTool } from "./tools/videoScan.js";
import { describeTool } from "./tools/describe.js";
import { askTool } from "./tools/ask.js";
import { readDocumentTool } from "./tools/readDocument.js";
import { detectAnomaliesTool } from "./tools/detectAnomalies.js";
import { listProvidersTool } from "./tools/listProviders.js";
import { setupTool } from "./tools/setup.js";

export interface GlassesServerOptions {
  auditStore?: string;
  artifactStore?: string;
  allowedImageRoots?: string[];
  allowHttpImageLoading?: boolean;
  maxImageDimension?: number;
  warnFileSizeMb?: number;
  config?: Record<string, unknown>;
}

export function createGlassesServer(opts: GlassesServerOptions = {}) {
  const server = createVelServer({ name: "vel-glasses-mcp", version: "0.1.0" });
  const audit = opts.auditStore ? new AuditLog(opts.auditStore) : undefined;
  const auditOpts = { auditLog: audit, serverPackage: "glasses" };
  const supervisor = new WorkerSupervisor();
  const config = withEnvVisionDefaults(opts.config);

  const artifactStore = new ArtifactStore(opts.artifactStore ?? resolve(homedir(), ".vel/artifacts"));
  const pathPolicy = new PathPolicy(resolveAllowedImageRoots(opts.allowedImageRoots, config));
  const imageLoader = new ImageLoader({
    artifactStore,
    auditLog: audit,
    pathPolicy,
    allowHttpImageLoading: opts.allowHttpImageLoading ?? false,
    maxImageDimension: opts.maxImageDimension ?? 8192,
    warnFileSizeMb: opts.warnFileSizeMb ?? 25
  });

  const modelRegistry = new ModelRegistry(config);
  const defaultProvider = config?.defaultProvider as string | undefined
    ?? process.env.VEL_GLASSES_PROVIDER
    ?? "mock";

  const router = new ProviderRouter({
    defaultProviderId: defaultProvider,
    modelRegistry,
  });

  router.register(new MockVisionProvider(), { priority: 10, enabled: true });

  const providersConfig = (config?.providers ?? {}) as Record<string, Record<string, unknown>>;

  const groundingResolved = modelRegistry.resolveModelForRole("grounding");
  if (groundingResolved) {
    const groundingModel = modelRegistry.getModelConfig(groundingResolved.modelId);
    if (groundingModel) {
      const hasGroundingEnv = !!process.env.VEL_VISION_MODEL;
      const pgConfig = providersConfig["glasses-grounding"] ?? {};
      router.register(
        new VelVisionProvider(supervisor, {
          model: groundingResolved.modelId,
          providerId: "glasses-grounding",
          role: "grounding",
          python: pgConfig.python as string | undefined,
          workerArgs: pgConfig.workerArgs as string[] | undefined,
          workerCwd: pgConfig.workerCwd as string | undefined,
        }),
        {
          priority: 1,
          enabled: hasGroundingEnv || groundingModel.enabled !== false,
          modelId: groundingResolved.modelId,
          role: "grounding",
        }
      );
    }
  }

  const vlmResolved = modelRegistry.resolveModelForRole("general_vlm");
  if (vlmResolved) {
    const vlmModel = modelRegistry.getModelConfig(vlmResolved.modelId);
    if (vlmModel) {
      const hasVlmEnv = !!process.env.VEL_VISION_VLM_MODEL
        || (!!process.env.VEL_VISION_MODEL && process.env.VEL_VISION_MODEL.includes("Qwen"));
      const pvConfig = providersConfig["glasses-vlm"] ?? {};
      router.register(
        new VelVisionProvider(supervisor, {
          model: vlmResolved.modelId,
          providerId: "glasses-vlm",
          role: "general_vlm",
          python: pvConfig.python as string | undefined,
          workerArgs: pvConfig.workerArgs as string[] | undefined,
          workerCwd: pvConfig.workerCwd as string | undefined,
        }),
        {
          priority: 1,
          enabled: hasVlmEnv || vlmModel.enabled !== false,
          modelId: vlmResolved.modelId,
          role: "general_vlm",
        }
      );
    }
  }

  registerVelTool(server, inspectImageTool(router, imageLoader), auditOpts);
  registerVelTool(server, locateTool(router, imageLoader), auditOpts);
  registerVelTool(server, ocrTool(router, imageLoader), auditOpts);
  registerVelTool(server, inspectRegionTool(router, imageLoader, artifactStore), auditOpts);
  registerVelTool(server, compareTool(router, imageLoader), auditOpts);
  registerVelTool(server, videoScanTool(router, imageLoader, artifactStore), auditOpts);
  registerVelTool(server, describeTool(router, imageLoader), auditOpts);
  registerVelTool(server, askTool(router, imageLoader), auditOpts);
  registerVelTool(server, readDocumentTool(router, imageLoader), auditOpts);
  registerVelTool(server, detectAnomaliesTool(router, imageLoader), auditOpts);
  registerVelTool(server, listProvidersTool(router), auditOpts);
  registerVelTool(server, setupTool(router), auditOpts);
  return { server, router, audit, supervisor, modelRegistry, imageLoader, artifactStore };
}

function withEnvVisionDefaults(config?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!process.env.VEL_VISION_MODEL && !process.env.VEL_VISION_VLM_MODEL) return config;

  const models = Array.isArray(config?.models) ? [...config.models] : [];
  const roles = { ...((config?.roles as Record<string, unknown> | undefined) ?? {}) };
  const toolToRole = { ...((config?.toolToRole as Record<string, string> | undefined) ?? {}) };
  const providers = { ...((config?.providers as Record<string, Record<string, unknown>> | undefined) ?? {}) };

  if (process.env.VEL_VISION_MODEL && !models.some((model) => (model as Record<string, unknown>).id === process.env.VEL_VISION_MODEL)) {
    models.push({
      id: process.env.VEL_VISION_MODEL,
      displayName: "VEL_VISION_MODEL",
      kind: "mlx-vlm",
      role: "grounding",
      enabled: true,
      taskAffinity: ["locate", "ocr", "gui"],
    });
  }

  if (process.env.VEL_VISION_MODEL) {
    roles.grounding = withPreferredRole(roles.grounding, process.env.VEL_VISION_MODEL);
    toolToRole.locate ??= "grounding";
    toolToRole.ocr ??= "grounding";
    toolToRole.video_scan ??= "grounding";
    providers["glasses-grounding"] ??= {};
    if (process.env.VEL_VISION_PYTHON && !providers["glasses-grounding"].python) {
      providers["glasses-grounding"] = {
        ...providers["glasses-grounding"],
        python: process.env.VEL_VISION_PYTHON,
      };
    }
  }

  if (process.env.VEL_VISION_VLM_MODEL) {
    if (!models.some((model) => (model as Record<string, unknown>).id === process.env.VEL_VISION_VLM_MODEL)) {
      models.push({
        id: process.env.VEL_VISION_VLM_MODEL,
        displayName: "VEL_VISION_VLM_MODEL",
        kind: "mlx-vlm",
        role: "general_vlm",
        enabled: true,
        taskAffinity: ["inspect_image", "describe", "ask", "document-understanding"],
      });
    }
    roles.general_vlm = withPreferredRole(roles.general_vlm, process.env.VEL_VISION_VLM_MODEL);
    toolToRole.inspect_image ??= "general_vlm";
    toolToRole.describe ??= "general_vlm";
    toolToRole.ask ??= "general_vlm";
    toolToRole.inspect_region ??= "general_vlm";
    providers["glasses-vlm"] ??= {};
    if (process.env.VEL_VISION_PYTHON && !providers["glasses-vlm"].python) {
      providers["glasses-vlm"] = {
        ...providers["glasses-vlm"],
        python: process.env.VEL_VISION_PYTHON,
      };
    }
  }

  return {
    ...(config ?? {}),
    models,
    roles,
    toolToRole,
    providers,
  };
}

function withPreferredRole(existing: unknown, preferred: string): { preferred: string; fallback: string[] } {
  const entry = existing as Record<string, unknown> | undefined;
  const existingPreferred = typeof entry?.preferred === "string" ? entry.preferred : undefined;
  const existingFallback = Array.isArray(entry?.fallback)
    ? entry.fallback.filter((model): model is string => typeof model === "string")
    : [];
  const fallback = [
    ...(existingPreferred && existingPreferred !== preferred ? [existingPreferred] : []),
    ...existingFallback,
  ].filter((model, index, all) => model !== preferred && all.indexOf(model) === index);
  return { preferred, fallback };
}

function resolveAllowedImageRoots(explicit?: string[], config?: Record<string, unknown>): string[] {
  if (explicit?.length) return explicit;

  const configured = config?.allowedImageRoots;
  if (Array.isArray(configured)) {
    const roots = configured.filter((root): root is string => typeof root === "string" && root.length > 0);
    if (roots.length) return roots;
  }

  const envRoots = process.env.VEL_ALLOWED_IMAGE_ROOTS;
  if (envRoots) {
    try {
      const parsed = JSON.parse(envRoots);
      if (Array.isArray(parsed)) {
        const roots = parsed.filter((root): root is string => typeof root === "string" && root.length > 0);
        if (roots.length) return roots;
      }
    } catch {
      const roots = envRoots.split(delimiter).map((root) => root.trim()).filter(Boolean);
      if (roots.length) return roots;
    }
  }

  return [process.cwd(), resolve(homedir(), "vel", "glasses", "inputs")];
}
