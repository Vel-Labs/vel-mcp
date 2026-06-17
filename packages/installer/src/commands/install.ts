import type { CommandHandler } from "../registry.js";
import { parseArgs, helpText } from "../args.js";
import { buildInstallPayload } from "../services/buildInstallPayload.js";
import { bootstrap } from "../services/bootstrap.js";
import { renderInstall, log } from "../render.js";
import { writeManifest } from "../writers/writeManifest.js";
import { writeCommandCodeConfig } from "../writers/writeCommandCodeConfig.js";
import { writeOpenCodeConfig } from "../writers/writeOpenCodeConfig.js";
import { writeAgentSkill } from "../writers/writeAgentSkill.js";
import { writeAgentInstructions } from "../writers/writeAgentInstructions.js";

export const installCommand: CommandHandler = {
  async run({ args }) {
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      log(helpText());
      return;
    }
    const opts = parseArgs(["install", ...args]);
    if (opts.bootstrap) bootstrap(opts);
    const payload = buildInstallPayload(opts);
    if (opts.write && opts.target === "opencode") writeOpenCodeConfig(payload.opencodeConfigPath, payload.opencodeJson);
    else if (opts.write && opts.target === "commandcode") writeCommandCodeConfig(payload.localManifest, payload.commandCodeJson);
    else if (opts.write) writeManifest(payload.localManifest, payload.mcpJson);
    if (opts.write) {
      writeAgentSkill(payload.agentSkillPath, payload.agentSkill);
      writeAgentInstructions(payload.agentInstructionsPath, payload.agentInstructions);
      log("");
      log(`─────── ═══ Vel Glasses Ready ═══ ───────`);
      log(`  MCP server: vel-glasses`);
      log(`  Config written: ${payload.localManifest}`);
      log(`  Restart your agent, then verify with:`);
      if (opts.target === "commandcode") log(`    cmd mcp list  (from this project)`);
      else if (opts.target === "opencode") log(`    opencode mcp list`);
      else log(`    Check your agent's MCP server list`);
      log(`────────────────────────────────────────────────`);
      log("");
      return;
    }
    if (opts.format === "json") log(JSON.stringify(payload, null, 2));
    else log(renderInstall(payload));
  },
};
