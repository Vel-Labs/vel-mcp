#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const DEFAULT_REPO_URL = "https://github.com/Vel-Labs/vel-mcp.git";
const DEFAULT_KIT_DIR = resolve(homedir(), ".vel/kits/vel-mcp");

interface InstallOptions {
  target: "mcp" | "codex" | "opencode";
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

interface ModelSuggestion {
  id: string;
  displayName: string;
  role: string;
  kind: string;
  sizeGb: number;
  status: "available" | "not-installed";
  runtimeReady: boolean;
  path?: string;
  huggingFaceUrl: string;
  licenseWarning: string;
  setupInstructions: string[];
}

interface InstallPayload {
  schemaVersion: string;
  target: "mcp" | "codex" | "opencode";
  kit: {
    dir: string;
    repoUrl: string;
    ref?: string;
    exists: boolean;
  };
  bootstrap: {
    requested: boolean;
    commands: string[];
  };
  codexForm: {
    name: string;
    transport: "stdio";
    command: string;
    arguments: string[];
    environmentVariables: Record<string, string>;
    environmentVariablePassthrough: string[];
    workingDirectory: string;
  };
  localManifest: string;
  opencodeConfigPath: string;
  mcpJson: {
    mcpServers: Record<string, {
      command: string;
      args: string[];
      env: Record<string, string>;
    }>;
  };
  opencodeJson: {
    $schema: string;
    mcp: Record<string, {
      type: "local";
      command: string[];
      cwd: string;
      enabled: boolean;
      timeout: number;
      environment: Record<string, string>;
    }>;
  };
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  restartInstructions: string[];
  modelDiscovery: ModelSuggestion[];
  nextPrompts: {
    image: string;
    video: string;
  };
}

const MODEL_SUGGESTIONS = [
  {
    id: "mlx-community/LocateAnything-3B-bf16",
    displayName: "LocateAnything-3B BF16 (MLX-VLM)",
    role: "spatial-grounding",
    kind: "mlx-vlm",
    sizeGb: 7.2,
    licenseWarning: "Non-commercial (inherits from upstream NVIDIA model)",
  },
  {
    id: "mlx-community/Qwen3-VL-8B-Thinking-8bit",
    displayName: "Qwen3-VL-8B Thinking 8-bit (MLX)",
    role: "general_vlm",
    kind: "mlx-vlm",
    sizeGb: 9.5,
    licenseWarning: "Apache 2.0; verify downstream model card terms before production use.",
  },
  {
    id: "mlx-community/Qwen3-VL-4B-Instruct-5bit",
    displayName: "Qwen3-VL-4B Instruct 5-bit (MLX)",
    role: "general_vlm",
    kind: "mlx-vlm",
    sizeGb: 5.0,
    licenseWarning: "Apache 2.0; verify downstream model card terms before production use.",
  },
  {
    id: "mlx-community/Qwen2.5-VL-7B-Instruct-4bit",
    displayName: "Qwen2.5-VL-7B Instruct 4-bit (MLX)",
    role: "general_vlm",
    kind: "mlx-vlm",
    sizeGb: 5.5,
    licenseWarning: "Apache 2.0; verify downstream model card terms before production use.",
  },
  {
    id: "mlx-community/InternVL3-8B-MLX-4bit",
    displayName: "InternVL3-8B 4-bit (MLX)",
    role: "general_vlm",
    kind: "mlx-vlm",
    sizeGb: 5.5,
    licenseWarning: "Verify upstream model card terms before production use.",
  },
  {
    id: "sahilchachra/locateanything-3b-mxfp4-mlx",
    displayName: "LocateAnything-3B MXFP4 4-bit (MLX)",
    role: "spatial-grounding",
    kind: "mlx",
    sizeGb: 2.5,
    licenseWarning: "Non-commercial (inherits upstream). 4-bit quality not yet evaluated.",
  },
  {
    id: "andai-labs/LocateAnything-3B-MLX",
    displayName: "LocateAnything-3B MLX (andai-labs)",
    role: "spatial-grounding",
    kind: "mlx",
    sizeGb: 7.0,
    licenseWarning: "Non-commercial (inherits from upstream NVIDIA model)",
  },
];

export function parseArgs(argv: string[]): InstallOptions {
  const [command, target, ...rest] = argv;
  if (command !== "install" || (target !== "mcp" && target !== "codex" && target !== "opencode")) {
    throw new Error(helpText());
  }

  const localRepo = findRepo(process.cwd());
  const opts: InstallOptions = {
    target,
    projectDir: process.cwd(),
    kitDir: localRepo ?? process.env.VEL_MCP_KIT_DIR ?? DEFAULT_KIT_DIR,
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

export function buildInstallPayload(opts: InstallOptions): InstallPayload {
  const visionPython = opts.visionPython ?? process.env.VEL_VISION_PYTHON ?? resolve(opts.kitDir, ".vel/venvs/glasses-mlx/bin/python");
  const likelyModel = resolve(homedir(), "30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16");
  const visionModel = opts.visionModel ?? process.env.VEL_VISION_MODEL ?? (existsSync(likelyModel) ? likelyModel : "mlx-community/LocateAnything-3B-bf16");
  const discoveredVlmModel = firstAvailableModelPath(MODEL_SUGGESTIONS.filter((model) => model.role === "general_vlm").map((model) => model.id));
  const visionVlmModel = opts.visionVlmModel ?? process.env.VEL_VISION_VLM_MODEL ?? discoveredVlmModel;
  const allowedImageRoots = [opts.projectDir, opts.kitDir, resolve(homedir(), "vel", "glasses", "inputs")];
  const env: Record<string, string> = { VEL_GLASSES_PROVIDER: opts.provider };
  env.VEL_ALLOWED_IMAGE_ROOTS = JSON.stringify(allowedImageRoots);
  if (opts.provider === "glasses-grounding") {
    env.VEL_VISION_PYTHON = visionPython;
    env.VEL_VISION_MODEL = visionModel;
    if (visionVlmModel) env.VEL_VISION_VLM_MODEL = visionVlmModel;
  }

  const args = ["--dir", opts.kitDir, "--filter", "@vel/glasses-mcp", "dev"];
  const command = ["pnpm", ...args];
  return {
    schemaVersion: "2026-06-15",
    target: opts.target,
    kit: {
      dir: opts.kitDir,
      repoUrl: opts.repoUrl,
      ref: opts.ref,
      exists: isVelMcpRepo(opts.kitDir),
    },
    bootstrap: {
      requested: opts.bootstrap,
      commands: bootstrapCommands(opts),
    },
    codexForm: {
      name: opts.serverName,
      transport: "stdio",
      command: "pnpm",
      arguments: args,
      environmentVariables: env,
      environmentVariablePassthrough: [] as string[],
      workingDirectory: opts.projectDir,
    },
    localManifest: resolve(opts.projectDir, ".mcp.json"),
    opencodeConfigPath: resolve(opts.projectDir, "opencode.json"),
    mcpJson: {
      mcpServers: {
        [opts.serverName]: {
          command: "pnpm",
          args,
          env,
        },
      },
    },
    opencodeJson: {
      $schema: "https://opencode.ai/config.json",
      mcp: {
        [opts.serverName]: {
          type: "local",
          command,
          cwd: opts.projectDir,
          enabled: true,
          timeout: 60000,
          environment: env,
        },
      },
    },
    checks: [
      { name: "kitRepo", ok: isVelMcpRepo(opts.kitDir), detail: opts.kitDir },
      { name: "projectDir", ok: existsSync(opts.projectDir), detail: opts.projectDir },
      { name: "visionPython", ok: opts.provider !== "glasses-grounding" || existsSync(visionPython), detail: visionPython },
      { name: "visionModel", ok: opts.provider !== "glasses-grounding" || !visionModel.startsWith("/") || existsSync(visionModel), detail: visionModel },
      { name: "visionVlmModel", ok: opts.provider !== "glasses-grounding" || !!visionVlmModel, detail: visionVlmModel ?? "not configured; inspect_image/describe/ask require a general VLM" },
      { name: "allowedImageRoots", ok: allowedImageRoots.some((root) => existsSync(root)), detail: allowedImageRoots.join(", ") },
    ],
    restartInstructions: restartInstructions(opts.target),
    modelDiscovery: discoverLocalModels(visionModel, visionVlmModel),
    nextPrompts: {
      image: `Use vel-glasses. Look at ${resolve(opts.kitDir, "examples/glasses-demo/dashboard.png")}. What should I click to approve the deployment? Return the target label and normalized coordinates. Do not click anything.`,
      video: `Use vel-glasses. Scan ${resolve(opts.kitDir, "examples/glasses-demo/button-appears.mp4")}. When does the blue Approve button become visible? Return timestamps and frame references.`,
    },
  };
}

export function renderInstall(payload: ReturnType<typeof buildInstallPayload>): string {
  const envLines = Object.entries(payload.codexForm.environmentVariables).map(([key, value]) => `  ${key} = ${value}`).join("\n");
  const checkLines = payload.checks.map((check) => `  ${check.ok ? "OK" : "MISSING"} ${check.name}: ${check.detail}`).join("\n");
  const bootstrapLines = payload.bootstrap.commands.map((cmd) => `  ${cmd}`).join("\n");
  const modelLines = payload.modelDiscovery.map((model) => [
    `  ${model.runtimeReady ? "READY" : model.status === "available" ? "FOUND" : "MISSING"} ${model.displayName} (${model.id})`,
    `    role: ${model.role}; kind: ${model.kind}; size: ${model.sizeGb} GB`,
    `    link: ${model.huggingFaceUrl}`,
    `    license: ${model.licenseWarning}`,
    model.path ? `    path: ${model.path}` : undefined,
  ].filter(Boolean).join("\n")).join("\n");

  const title = payload.target === "codex"
    ? "VEL MCP Codex setup wizard"
    : payload.target === "opencode"
      ? "VEL MCP OpenCode setup wizard"
      : "VEL MCP generic setup wizard";
  const restartLines = payload.restartInstructions.map((line) => `  ${line}`).join("\n");

  return [
    title,
    "",
    payload.kit.exists ? `Kit: ${payload.kit.dir}` : `Kit missing: ${payload.kit.dir}`,
    payload.kit.exists ? "" : "Bootstrap with:",
    payload.kit.exists ? "" : bootstrapLines,
    "",
    "STDIO MCP fields:",
    `Name: ${payload.codexForm.name}`,
    "Transport: STDIO",
    `Command to launch: ${payload.codexForm.command}`,
    "Arguments:",
    ...payload.codexForm.arguments.map((arg) => `  ${arg}`),
    "Environment variables:",
    envLines || "  none",
    `Working directory: ${payload.codexForm.workingDirectory}`,
    "",
    "Readiness checks:",
    checkLines,
    "",
    "Machine-readable MCP JSON:",
    JSON.stringify(payload.mcpJson, null, 2),
    "",
    "OpenCode JSON:",
    JSON.stringify(payload.opencodeJson, null, 2),
    "",
    `Local manifest path: ${payload.localManifest}`,
    `OpenCode config path: ${payload.opencodeConfigPath}`,
    `Write it with: vel-mcp install mcp --project-dir ${payload.codexForm.workingDirectory} --write`,
    `Write OpenCode config with: vel-mcp install opencode --project-dir ${payload.codexForm.workingDirectory} --write`,
    "",
    "After installing:",
    restartLines,
    "",
    "Local visual model discovery:",
    modelLines,
    "",
    "First image prompt:",
    payload.nextPrompts.image,
    "",
    "First video prompt:",
    payload.nextPrompts.video,
  ].filter((line) => line !== undefined).join("\n");
}

function bootstrap(opts: InstallOptions): void {
  if (isVelMcpRepo(opts.kitDir)) return;
  mkdirSync(dirname(opts.kitDir), { recursive: true });
  run("git", ["clone", opts.repoUrl, opts.kitDir]);
  if (opts.ref) run("git", ["checkout", opts.ref], { cwd: opts.kitDir });
  run("pnpm", ["install"], { cwd: opts.kitDir });
  run("pnpm", ["build"], { cwd: opts.kitDir });
}

export function writeManifest(path: string, mcpJson: unknown): void {
  writeFileSync(path, `${JSON.stringify(mcpJson, null, 2)}\n`, { flag: "wx" });
}

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

function bootstrapCommands(opts: InstallOptions): string[] {
  const commands = [
    `git clone ${opts.repoUrl} ${opts.kitDir}`,
  ];
  if (opts.ref) commands.push(`cd ${opts.kitDir} && git checkout ${opts.ref}`);
  commands.push(`cd ${opts.kitDir} && pnpm install`);
  commands.push(`cd ${opts.kitDir} && pnpm build`);
  return commands;
}

function discoverLocalModels(activeModel: string, activeVlmModel?: string): ModelSuggestion[] {
  return MODEL_SUGGESTIONS.map((model) => {
    const path = modelPath(model.id);
    const status = path && existsSync(path) ? "available" : "not-installed";
    const activeForRole = model.role === "general_vlm" ? activeVlmModel : activeModel;
    return {
      ...model,
      status,
      runtimeReady: status === "available" && !!activeForRole && (activeForRole === path || activeForRole === model.id || activeForRole.endsWith(model.id)),
      path: status === "available" ? path : undefined,
      huggingFaceUrl: `https://huggingface.co/${model.id}`,
      setupInstructions: [
        "python3.11 -m venv .vel/venvs/glasses-mlx",
        ".vel/venvs/glasses-mlx/bin/python -m pip install -e packages/glasses-mcp/workers/vel-worker",
        ".vel/venvs/glasses-mlx/bin/python -m pip install mlx-vlm huggingface_hub",
        `huggingface-cli download ${model.id} --local-dir ~/30_AI-Lab/_cache/models/${model.id}`,
      ],
    };
  });
}

function modelPath(id: string): string {
  return resolve(homedir(), "30_AI-Lab/_cache/models", id);
}

function firstAvailableModelPath(ids: string[]): string | undefined {
  for (const id of ids) {
    const path = modelPath(id);
    if (existsSync(path)) return path;
  }
  return undefined;
}

function findRepo(start: string): string | undefined {
  let current = resolve(start);
  for (;;) {
    if (isVelMcpRepo(current)) return current;
    const next = dirname(current);
    if (next === current) return undefined;
    current = next;
  }
}

function isVelMcpRepo(path: string): boolean {
  return existsSync(resolve(path, "packages/glasses-mcp/package.json")) && existsSync(resolve(path, "pnpm-workspace.yaml"));
}

function run(command: string, args: string[], opts: { cwd?: string } = {}): void {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: opts.cwd });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
}

function requiredValue(arg: string, value?: string): string {
  if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
  return value;
}

export function helpText(): string {
  return [
    "Usage:",
    "  vel-mcp install mcp [--project-dir path] [--write] [--bootstrap]",
    "  vel-mcp install codex [--project-dir path] [--vision-vlm-model path] [--format human|json]",
    "  vel-mcp install opencode [--project-dir path] [--vision-vlm-model path] [--write] [--format human|json]",
    "",
    "Examples:",
    "  npx @vel/mcp install mcp --project-dir . --bootstrap --write",
    "  pnpm dlx @vel/mcp install codex --project-dir .",
    "  pnpm dlx @vel/mcp install opencode --project-dir . --write",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    return;
  }
  const opts = parseArgs(argv);
  if (opts.bootstrap) bootstrap(opts);
  const payload = buildInstallPayload(opts);
  if (opts.write && opts.target === "opencode") writeOpenCodeConfig(payload.opencodeConfigPath, payload.opencodeJson);
  else if (opts.write) writeManifest(payload.localManifest, payload.mcpJson);
  if (opts.format === "json") console.log(JSON.stringify(payload, null, 2));
  else console.log(renderInstall(payload));
}

function restartInstructions(target: InstallOptions["target"]): string[] {
  if (target === "opencode") {
    return [
      "Close and reopen the entire OpenCode process; starting a new chat is not enough.",
      "Run `opencode mcp list` from the target project and confirm vel-glasses is connected.",
    ];
  }
  if (target === "codex") {
    return [
      "Save the custom MCP entry in Codex and restart the Codex session if tools do not appear immediately.",
      "Verify that vel-glasses appears in the available tool list before asking for image analysis.",
    ];
  }
  return [
    "Restart or reconnect the MCP client so it reloads local server configuration.",
    "Confirm the client lists vel-glasses before asking it to inspect images or video.",
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
