export type LogLevel = "debug" | "info" | "warn" | "error";

export interface WorkerConfig {
  maxRestarts: number;
  restartWindowSec: number;
  startupTimeoutSec: number;
}

export interface VelConfig {
  vel: {
    home: string;
    artifactStore: string;
    auditStore: string;
    workerIdleTtlSeconds: number;
    logLevel: LogLevel;
    worker: WorkerConfig;
    warnFileSizeMb: number;
  };
  modules: Record<string, ModuleConfig>;
}

export interface ModuleConfig {
  enabled: boolean;
  defaultProvider?: string;
  providers?: Record<string, ProviderConfig>;
  allowHttpImageLoading?: boolean;
  maxImageDimension?: number;
  models?: ModelConfig[];
  taskToModel?: Record<string, string>;
  [key: string]: unknown;
}

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
  runtime?: Record<string, string>;
  setupInstructions?: string[];
  enabled?: boolean;
}

export interface ProviderConfig {
  enabled: boolean;
  priority?: number;
  workerIdleTtlSeconds?: number;
  requestTimeoutSec?: number;
  maxMemoryMb?: number;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  [key: string]: unknown;
}

export interface StructuredError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}
