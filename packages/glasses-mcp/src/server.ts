import { createVelServer, registerVelTool } from "@vel/mcp-base";
import { AuditLog, WorkerSupervisor, ArtifactStore, PathPolicy } from "@vel/core";
import { homedir } from "node:os";
import { resolve } from "node:path";
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

  const artifactStore = new ArtifactStore(opts.artifactStore ?? resolve(homedir(), ".vel/artifacts"));
  const pathPolicy = new PathPolicy(opts.allowedImageRoots ?? [process.cwd(), resolve(homedir(), "vel", "glasses", "inputs")]);
  const imageLoader = new ImageLoader({
    artifactStore,
    auditLog: audit,
    pathPolicy,
    allowHttpImageLoading: opts.allowHttpImageLoading ?? false,
    maxImageDimension: opts.maxImageDimension ?? 8192,
    warnFileSizeMb: opts.warnFileSizeMb ?? 25
  });

  const modelRegistry = new ModelRegistry(opts.config);
  const defaultProvider = opts.config?.defaultProvider as string | undefined
    ?? process.env.VEL_GLASSES_PROVIDER
    ?? "mock";

  const router = new ProviderRouter({
    defaultProviderId: defaultProvider,
    modelRegistry,
  });

  router.register(new MockVisionProvider(), { priority: 10, enabled: true });

  const providersConfig = (opts.config?.providers ?? {}) as Record<string, Record<string, unknown>>;

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
  return { server, router, audit, supervisor, modelRegistry };
}
