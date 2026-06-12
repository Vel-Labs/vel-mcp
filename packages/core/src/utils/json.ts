export function safeJsonParse<T>(raw: string): { ok: true; value: T } | { ok: false; error: Error } {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export function redactForLog(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > 160) return `${value.slice(0, 80)}…<redacted:${value.length}>`;
    return value;
  }
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => {
      if (/key|token|secret|password|credential/i.test(k)) return [k, "<redacted>"];
      return [k, redactForLog(v)];
    }));
  }
  return value;
}
