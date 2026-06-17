import { writeSync } from "node:fs";
import type { InstallPayload } from "./services/buildInstallPayload.js";

// npx connects children via pipe -> Node buffers stdout in 8KB blocks.
// writeSync to fd 1 flushes immediately so users see progress in real time.
export const log = (msg = "") => writeSync(1, msg + "\n");

export function renderInstall(payload: InstallPayload): string {
  const envLines = Object.entries(payload.codexForm.environmentVariables).map(([key, value]) => `  ${key} = ${value}`).join("\n");
  const checkLines = payload.checks.map((check) => `  ${check.ok ? "OK" : "MISSING"} ${check.name}: ${check.detail}`).join("\n");
  const bootstrapLines = payload.bootstrap.commands.map((cmd) => `  ${cmd}`).join("\n");
  const roleLines = payload.modelRoles.map((role) => [
    `  ${role.role}: ${role.purpose}`,
    `    tools: ${role.tools.join(", ")}`,
    `    env: ${role.env.join(", ")}`,
    `    limits: ${role.limitations.join(" ")}`,
  ].join("\n")).join("\n");
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
      : payload.target === "commandcode"
        ? "VEL MCP CommandCode setup wizard"
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
    "Model roles:",
    roleLines,
    "",
    "Machine-readable MCP JSON:",
    JSON.stringify(payload.mcpJson, null, 2),
    "",
    "CommandCode project .mcp.json:",
    JSON.stringify(payload.commandCodeJson, null, 2),
    "",
    "CommandCode CLI equivalent:",
    payload.commandCodeAddCommand,
    "",
    "OpenCode JSON:",
    JSON.stringify(payload.opencodeJson, null, 2),
    "",
    `Local manifest path: ${payload.localManifest}`,
    `OpenCode config path: ${payload.opencodeConfigPath}`,
    `Agent skill path: ${payload.agentSkillPath}`,
    `Agent instructions path: ${payload.agentInstructionsPath}`,
    `Write it with: vel-mcp install mcp --project-dir ${payload.codexForm.workingDirectory} --write`,
    `Write OpenCode config with: vel-mcp install opencode --project-dir ${payload.codexForm.workingDirectory} --write`,
    `Write CommandCode config with: vel-mcp install commandcode --project-dir ${payload.codexForm.workingDirectory} --write`,
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
