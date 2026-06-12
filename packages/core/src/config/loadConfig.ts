import { readFile } from "node:fs/promises";
import { resolveHome, resolvePath } from "../security/pathPolicy.js";
import type { VelConfig, WorkerConfig } from "./types.js";
import YAML from "yaml";

const ENV_PATTERN = /\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/gi;

const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  maxRestarts: 3,
  restartWindowSec: 60,
  startupTimeoutSec: 30
};

export function interpolateEnv(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(ENV_PATTERN, (_, name: string, fallback: string | undefined) => {
    const actual = env[name];
    if (actual !== undefined) return actual;
    if (fallback !== undefined) return fallback;
    return "";
  });
}

function deepInterpolate(input: unknown): unknown {
  if (typeof input === "string") return resolveHome(interpolateEnv(input));
  if (Array.isArray(input)) return input.map(deepInterpolate);
  if (input && typeof input === "object") {
    return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, deepInterpolate(v)]));
  }
  return input;
}

export async function loadVelConfig(path = process.env.VEL_CONFIG ?? "vel.config.example.yaml"): Promise<VelConfig> {
  const configPath = resolvePath(path, process.cwd());
  const raw = await readFile(configPath, "utf8");
  const parsed = YAML.parse(raw);
  const interpolated = deepInterpolate(parsed) as Record<string, unknown>;
  const config = applyConfigDefaults(interpolated) as VelConfig;
  validateVelConfig(config);
  return config;
}

export function applyConfigDefaults(raw: Record<string, unknown>): unknown {
  const vel = (raw.vel ?? {}) as Record<string, unknown>;
  const worker = (vel.worker ?? {}) as Record<string, unknown>;

  return {
    ...raw,
    vel: {
      ...vel,
      workerIdleTtlSeconds: vel.workerIdleTtlSeconds ?? 600,
      logLevel: vel.logLevel ?? "info",
      warnFileSizeMb: vel.warnFileSizeMb ?? 25,
      worker: {
        maxRestarts: worker.maxRestarts ?? DEFAULT_WORKER_CONFIG.maxRestarts,
        restartWindowSec: worker.restartWindowSec ?? DEFAULT_WORKER_CONFIG.restartWindowSec,
        startupTimeoutSec: worker.startupTimeoutSec ?? DEFAULT_WORKER_CONFIG.startupTimeoutSec
      }
    }
  };
}

export function validateVelConfig(config: VelConfig): void {
  if (!config || typeof config !== "object") throw new Error("VEL config must be an object");
  if (!config.vel) throw new Error("VEL config missing 'vel' section");
  if (!config.modules) throw new Error("VEL config missing 'modules' section");
  if (!config.vel.home) config.vel.home = "~/.vel";
  if (!config.vel.artifactStore) config.vel.artifactStore = "~/.vel/artifacts";
  if (!config.vel.auditStore) config.vel.auditStore = "~/.vel/audit";
  if (!config.vel.worker) config.vel.worker = DEFAULT_WORKER_CONFIG;
}
