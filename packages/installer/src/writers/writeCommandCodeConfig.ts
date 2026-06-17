import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function writeCommandCodeConfig(path: string, commandCodeJson: unknown): void {
  const incoming = commandCodeJson as { mcpServers?: Record<string, unknown> };
  const existing = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>
    : {};
  const merged = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers as Record<string, unknown> | undefined ?? {}),
      ...(incoming.mcpServers ?? {}),
    },
  };
  writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`);
}
