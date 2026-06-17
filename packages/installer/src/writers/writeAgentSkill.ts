import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function writeAgentSkill(path: string, skillText: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, skillText.endsWith("\n") ? skillText : `${skillText}\n`);
}
