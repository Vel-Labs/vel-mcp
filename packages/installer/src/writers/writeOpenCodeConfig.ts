import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function writeOpenCodeConfig(path: string, opencodeJson: unknown): void {
  const incoming = opencodeJson as { mcp?: Record<string, unknown> };
  const existing = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>
    : {};
  const merged = {
    ...existing,
    ...opencodeJson as Record<string, unknown>,
    mcp: {
      ...(existing.mcp as Record<string, unknown> | undefined ?? {}),
      ...(incoming.mcp ?? {}),
    },
  };
  writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`);
}
