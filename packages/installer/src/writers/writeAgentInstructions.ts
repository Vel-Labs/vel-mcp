import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { AGENT_INSTRUCTIONS_BEGIN, AGENT_INSTRUCTIONS_END } from "../services/skillTemplates.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function writeAgentInstructions(path: string, instructions: string): void {
  const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
  const block = `${AGENT_INSTRUCTIONS_BEGIN}\n${instructions.trim()}\n${AGENT_INSTRUCTIONS_END}`;
  const pattern = new RegExp(`${escapeRegExp(AGENT_INSTRUCTIONS_BEGIN)}[\\s\\S]*?${escapeRegExp(AGENT_INSTRUCTIONS_END)}`);
  const next = pattern.test(existing)
    ? existing.replace(pattern, block)
    : [existing.trimEnd(), block].filter(Boolean).join("\n\n");
  writeFileSync(path, `${next}\n`);
}
