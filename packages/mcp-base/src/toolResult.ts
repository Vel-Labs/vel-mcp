export interface VelResultEnvelope<T = unknown> {
  schemaVersion: string;
  ok: boolean;
  result?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  };
  warnings: string[];
  provider?: {
    name: string;
    version?: string;
    mode?: string;
  };
  timingMs?: number;
}

export function envelope<T>(result: T, options: Partial<Omit<VelResultEnvelope<T>, "ok" | "result" | "schemaVersion" | "warnings"> & { warnings: string[] }> = {}): VelResultEnvelope<T> {
  return {
    schemaVersion: "2026-06-06",
    ok: true,
    result,
    warnings: options.warnings ?? [],
    provider: options.provider,
    timingMs: options.timingMs
  };
}

export function errorEnvelope(error: { code: string; message: string; details?: unknown; retryable?: boolean }, warnings: string[] = []): VelResultEnvelope<never> {
  return {
    schemaVersion: "2026-06-06",
    ok: false,
    error,
    warnings
  };
}

export function toMcpJsonResult(payload: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
  };
}

export function toMcpErrorResult(error: unknown) {
  const normalized = error instanceof Error ? { code: error.name || "ERROR", message: error.message } : { code: "ERROR", message: String(error) };
  return toMcpJsonResult(errorEnvelope(normalized));
}
