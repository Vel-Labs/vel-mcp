#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const installerCli = resolve(repoRoot, "packages/installer/dist/cli.js");

const [target = "opencode", ...rawRest] = process.argv.slice(2);
const rest = rawRest[0] === "--" ? rawRest.slice(1) : rawRest;

if (target === "--help" || target === "-h" || !["opencode", "codex", "mcp", "commandcode"].includes(target)) {
  console.log([
    "Usage:",
    "  node scripts/setup-mcp.mjs opencode --project-dir /path/to/project [--write]",
    "  node scripts/setup-mcp.mjs commandcode --project-dir /path/to/project [--write]",
    "  node scripts/setup-mcp.mjs codex --project-dir /path/to/project",
    "  node scripts/setup-mcp.mjs mcp --project-dir /path/to/project --write",
    "",
    "Examples:",
    "  node scripts/setup-mcp.mjs opencode --project-dir .",
    "  node scripts/setup-mcp.mjs commandcode --project-dir .",
    "  pnpm setup:opencode -- --project-dir .",
    "  pnpm setup:commandcode -- --project-dir .",
  ].join("\n"));
  process.exit(target === "--help" || target === "-h" ? 0 : 1);
}

runPnpm(["install"], "Install workspace dependencies");
runPnpm(["--filter", "@vel/mcp", "build"], "Build the installer");
if (!existsSync(installerCli)) {
  throw new Error(`Installer build missing after setup: ${installerCli}`);
}

const installerArgs = ["install", target, "--kit-dir", repoRoot, ...rest];
if (!installerArgs.includes("--project-dir")) {
  installerArgs.push("--project-dir", process.cwd());
}
if ((target === "opencode" || target === "commandcode") && !installerArgs.includes("--write")) {
  installerArgs.push("--write");
}

run("node", [installerCli, ...installerArgs], "Run VEL MCP installer");

function runPnpm(args, label) {
  const pnpm = run("pnpm", args, label, { allowFailure: true });
  if (pnpm.status === 0) return;

  const corepack = run("corepack", ["pnpm", ...args], `${label} via corepack`, { allowFailure: true });
  if (corepack.status === 0) return;

  throw new Error(`${label} failed. Install pnpm or enable Corepack, then retry.`);
}

function run(command, args, label, opts = {}) {
  console.error(`[vel-mcp setup] ${label}: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (!opts.allowFailure && result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}`);
  }
  return result;
}
