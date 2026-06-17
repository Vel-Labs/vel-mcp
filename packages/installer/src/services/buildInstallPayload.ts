import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { InstallOptions, InstallTarget } from "../args.js";
import { discoverLocalModels, firstAvailableModelPath } from "./modelDiscovery.js";
import { AGENT_SKILL_RELATIVE_PATH, agentSkillText, agentInstructionsText } from "./skillTemplates.js";

export const OPENCODE_TIMEOUT_MS = 180_000;

export interface ModelSuggestion {
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

export interface InstallPayload {
  schemaVersion: string;
  target: InstallTarget;
  modelRoles: Array<{
    role: string;
    purpose: string;
    tools: string[];
    limitations: string[];
    env: string[];
  }>;
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
  agentSkillPath: string;
  agentSkill: string;
  agentInstructionsPath: string;
  agentInstructions: string;
  mcpJson: {
    mcpServers: Record<string, {
      command: string;
      args: string[];
      env: Record<string, string>;
    }>;
  };
  commandCodeJson: {
    mcpServers: Record<string, {
      transport: "stdio";
      enabled: boolean;
      command: string;
      args: string[];
      env: Record<string, string>;
    }>;
  };
  commandCodeAddCommand: string;
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

export function isVelMcpRepo(path: string): boolean {
  return existsSync(resolve(path, "packages/glasses-mcp/package.json")) && existsSync(resolve(path, "pnpm-workspace.yaml"));
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function commandCodeCliCommand(serverName: string, env: Record<string, string>, args: string[]): string {
  const envArgs = Object.entries(env).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
  return ["cmd", "mcp", "add", "--scope", "project", ...envArgs, serverName, "--", "pnpm", ...args]
    .map(shellQuote)
    .join(" ");
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

function modelRoleGuide(): InstallPayload["modelRoles"] {
  return [
    {
      role: "grounding",
      purpose: "Find visual targets and return deterministic coordinates.",
      tools: ["glasses.locate", "glasses.ocr", "glasses.review_visual focus grounding", "glasses.video_scan event localization"],
      limitations: [
        "LocateAnything-style grounding is not a general image narrator.",
        "Use it for boxes, points, GUI elements, and localized text, not open-ended scene descriptions."
      ],
      env: ["VEL_VISION_MODEL"]
    },
    {
      role: "general_vlm",
      purpose: "Describe images, answer visual questions, and reason over screenshots/documents.",
      tools: ["glasses.inspect_image", "glasses.describe", "glasses.ask", "glasses.review_visual whole-image and region reasoning"],
      limitations: [
        "Qwen3-VL-4B-Instruct-5bit is the recommended default; Qwen3-VL-4B-Instruct-8bit is the local quality option.",
        "General VLMs can be slower and less precise at click coordinates than grounding models.",
        "They should not replace LocateAnything for GUI-target boxes unless grounding is unavailable."
      ],
      env: ["VEL_VISION_VLM_MODEL"]
    },
    {
      role: "temporal_vlm",
      purpose: "Summarize event order across sampled video frames.",
      tools: ["future glasses.video_summarize", "video_scan summaries"],
      limitations: [
        "Current video support is bounded sampling plus event manifests.",
        "Real scene-change and temporal reasoning require an installed general or temporal VLM."
      ],
      env: ["VEL_VISION_VLM_MODEL"]
    }
  ];
}

function restartInstructions(target: InstallOptions["target"]): string[] {
  if (target === "commandcode") {
    return [
      "Restart CommandCode or open `/mcp` in the project and confirm vel-glasses is enabled.",
      "Run `cmd mcp list` from the target project and confirm vel-glasses appears with project scope.",
    ];
  }
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

export function buildInstallPayload(opts: InstallOptions): InstallPayload {
  const visionPython = opts.visionPython ?? process.env.VEL_VISION_PYTHON ?? resolve(opts.kitDir, ".vel/venvs/glasses-mlx/bin/python");
  const likelyModel = resolve(homedir(), "30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16");
  const visionModel = opts.visionModel ?? process.env.VEL_VISION_MODEL ?? (existsSync(likelyModel) ? likelyModel : "mlx-community/LocateAnything-3B-bf16");
  const vlmCandidates = [
    "mlx-community/Qwen3-VL-4B-Instruct-5bit",
    "mlx-community/Qwen3-VL-4B-Instruct-8bit",
    "mlx-community/Qwen2.5-VL-7B-Instruct-4bit",
    "mlx-community/InternVL3-8B-MLX-4bit",
  ];
  const discoveredVlmModel = firstAvailableModelPath(vlmCandidates);
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
  const commandCodeJson: InstallPayload["commandCodeJson"] = {
    mcpServers: {
      [opts.serverName]: {
        transport: "stdio",
        enabled: true,
        command: "pnpm",
        args,
        env,
      },
    },
  };
  return {
    schemaVersion: "2026-06-15",
    target: opts.target,
    modelRoles: modelRoleGuide(),
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
    agentSkillPath: resolve(opts.projectDir, AGENT_SKILL_RELATIVE_PATH),
    agentSkill: agentSkillText(opts.serverName),
    agentInstructionsPath: resolve(opts.projectDir, "AGENTS.md"),
    agentInstructions: agentInstructionsText(AGENT_SKILL_RELATIVE_PATH),
    mcpJson: {
      mcpServers: {
        [opts.serverName]: {
          command: "pnpm",
          args,
          env,
        },
      },
    },
    commandCodeJson,
    commandCodeAddCommand: commandCodeCliCommand(opts.serverName, env, args),
    opencodeJson: {
      $schema: "https://opencode.ai/config.json",
      mcp: {
        [opts.serverName]: {
          type: "local",
          command,
          cwd: opts.projectDir,
          enabled: true,
          timeout: OPENCODE_TIMEOUT_MS,
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
