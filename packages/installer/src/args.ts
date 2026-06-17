import { resolve } from "node:path";
import { homedir } from "node:os";

export const DEFAULT_REPO_URL = "https://github.com/Vel-Labs/vel-mcp.git";
export const DEFAULT_KIT_DIR = resolve(homedir(), ".vel/kits/vel-mcp");

export type InstallTarget = "mcp" | "codex" | "opencode" | "commandcode";

export interface InstallOptions {
  target: InstallTarget;
  projectDir: string;
  kitDir: string;
  repoUrl: string;
  ref?: string;
  serverName: string;
  provider: string;
  visionPython?: string;
  visionModel?: string;
  visionVlmModel?: string;
  format: "human" | "json";
  write: boolean;
  bootstrap: boolean;
}

function requiredValue(arg: string, value?: string): string {
  if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
  return value;
}

export function isInstallTarget(value: string | undefined): value is InstallTarget {
  return value === "mcp" || value === "codex" || value === "opencode" || value === "commandcode";
}

export function parseArgs(argv: string[]): InstallOptions {
  const [command, target, ...rest] = argv;
  if (command !== "install" || !isInstallTarget(target)) {
    throw new Error(helpText());
  }

  const opts: InstallOptions = {
    target,
    projectDir: process.cwd(),
    kitDir: DEFAULT_KIT_DIR,
    repoUrl: DEFAULT_REPO_URL,
    serverName: "vel-glasses",
    provider: "glasses-grounding",
    format: "human",
    write: false,
    bootstrap: false,
  };

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    const value = rest[i + 1];
    switch (arg) {
      case "--project-dir":
        opts.projectDir = requiredValue(arg, value);
        i++;
        break;
      case "--kit-dir":
        opts.kitDir = requiredValue(arg, value);
        i++;
        break;
      case "--repo-url":
        opts.repoUrl = requiredValue(arg, value);
        i++;
        break;
      case "--ref":
        opts.ref = requiredValue(arg, value);
        i++;
        break;
      case "--server-name":
        opts.serverName = requiredValue(arg, value);
        i++;
        break;
      case "--glasses-provider":
        opts.provider = requiredValue(arg, value);
        i++;
        break;
      case "--vision-python":
        opts.visionPython = requiredValue(arg, value);
        i++;
        break;
      case "--vision-model":
        opts.visionModel = requiredValue(arg, value);
        i++;
        break;
      case "--vision-vlm-model":
        opts.visionVlmModel = requiredValue(arg, value);
        i++;
        break;
      case "--format":
        if (value !== "human" && value !== "json") throw new Error("--format must be human or json");
        opts.format = value;
        i++;
        break;
      case "--write":
        opts.write = true;
        break;
      case "--bootstrap":
        opts.bootstrap = true;
        break;
      case "--help":
      case "-h":
        throw new Error(helpText());
      default:
        throw new Error(`Unknown argument: ${arg}\n\n${helpText()}`);
    }
  }

  opts.projectDir = resolve(opts.projectDir);
  opts.kitDir = resolve(opts.kitDir);
  return opts;
}

export function helpText(): string {
  return [
    "Usage:",
    "  vel-mcp install mcp [--project-dir path] [--write] [--bootstrap]",
    "  vel-mcp install codex [--project-dir path] [--vision-vlm-model path] [--format human|json]",
    "  vel-mcp install opencode [--project-dir path] [--vision-vlm-model path] [--write] [--format human|json]",
    "  vel-mcp install commandcode [--project-dir path] [--vision-vlm-model path] [--write] [--format human|json]",
    "",
    "Examples:",
    "  npx vel-mcp install mcp --project-dir . --bootstrap --write",
    "  pnpm dlx vel-mcp install codex --project-dir .",
    "  pnpm dlx vel-mcp install opencode --project-dir . --write",
    "  pnpm dlx vel-mcp install commandcode --project-dir . --write",
  ].join("\n");
}
