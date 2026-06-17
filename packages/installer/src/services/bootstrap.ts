import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { InstallOptions } from "../args.js";
import { isVelMcpRepo } from "./buildInstallPayload.js";
import { log } from "../render.js";

function requireCommand(command: string): void {
  if (spawnSync("which", [command], { stdio: "ignore" }).status !== 0) {
    throw new Error(`${command} not found on PATH. Install ${command} and try again.`);
  }
}

function run(command: string, args: string[], opts: { cwd?: string } = {}): void {
  const result = spawnSync(command, args, {
    stdio: ["inherit", "pipe", "pipe"],
    cwd: opts.cwd,
    encoding: "utf-8",
  });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
}

export function bootstrap(opts: InstallOptions): void {
  requireCommand("git");
  requireCommand("pnpm");
  mkdirSync(dirname(opts.kitDir), { recursive: true });
  if (isVelMcpRepo(opts.kitDir)) {
    log("");
    log(`[vel-mcp] Kit exists, updating...`);
    run("git", ["pull"], { cwd: opts.kitDir });
  } else {
    log("");
    log(`─────── ═══ Vel Glasses Installer ═══ ───────`);
    log(`  Bootstrapping kit ~/.vel/kits/vel-mcp`);
    log(`  Target project: ${opts.projectDir}`);
    log(`────────────────────────────────────────────────`);
    log("");
    log(`[vel-mcp] Cloning ${opts.repoUrl} → ${opts.kitDir}`);
    run("git", ["clone", opts.repoUrl, opts.kitDir]);
  }
  if (opts.ref) run("git", ["checkout", opts.ref], { cwd: opts.kitDir });
  log(`[vel-mcp] Installing dependencies (pnpm install)...`);
  run("pnpm", ["install"], { cwd: opts.kitDir });
  log(`[vel-mcp] Building packages (pnpm build)...`);
  run("pnpm", ["build"], { cwd: opts.kitDir });
}
