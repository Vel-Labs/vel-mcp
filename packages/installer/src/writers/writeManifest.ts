import { writeFileSync } from "node:fs";

export function writeManifest(path: string, mcpJson: unknown): void {
  writeFileSync(path, `${JSON.stringify(mcpJson, null, 2)}\n`, { flag: "wx" });
}
