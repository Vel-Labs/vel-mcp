import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildInstallPayload, helpText, parseArgs, renderInstall, writeAgentInstructions, writeAgentSkill, writeCommandCodeConfig, writeManifest, writeOpenCodeConfig } from "../src/cli.js";

describe("@vel/mcp installer", () => {
  it("parses npx-style generic MCP install options", () => {
    const opts = parseArgs([
      "install",
      "mcp",
      "--project-dir",
      "/tmp/example-project",
      "--kit-dir",
      "/tmp/vel-mcp-kit",
      "--glasses-provider",
      "mock",
      "--vision-vlm-model",
      "/tmp/qwen-vlm",
      "--server-name",
      "vel-glasses-local",
      "--format",
      "json",
    ]);

    expect(opts.target).toBe("mcp");
    expect(opts.projectDir).toBe("/tmp/example-project");
    expect(opts.kitDir).toBe("/tmp/vel-mcp-kit");
    expect(opts.provider).toBe("mock");
    expect(opts.visionVlmModel).toBe("/tmp/qwen-vlm");
    expect(opts.serverName).toBe("vel-glasses-local");
    expect(opts.format).toBe("json");
  });

  it("builds machine-readable MCP and Codex form payloads", () => {
    const payload = buildInstallPayload(parseArgs([
      "install",
      "codex",
      "--project-dir",
      "/tmp/example-project",
      "--kit-dir",
      process.cwd(),
      "--glasses-provider",
      "mock",
    ]));

    expect(payload.target).toBe("codex");
    expect(payload.codexForm.transport).toBe("stdio");
    expect(payload.codexForm.command).toBe("pnpm");
    expect(payload.codexForm.arguments).toEqual(["--dir", process.cwd(), "--filter", "@vel/glasses-mcp", "dev"]);
    expect(payload.codexForm.environmentVariables.VEL_GLASSES_PROVIDER).toBe("mock");
    expect(payload.codexForm.environmentVariables.VEL_ALLOWED_IMAGE_ROOTS).toContain("/tmp/example-project");
    expect(payload.mcpJson.mcpServers["vel-glasses"].command).toBe("pnpm");
    expect(payload.localManifest).toBe("/tmp/example-project/.mcp.json");
    expect(payload.agentSkillPath).toBe("/tmp/example-project/.vel/skills/vel-glasses/SKILL.md");
    expect(payload.agentSkill).toContain("Natural Language Routing");
    expect(payload.agentSkill).toContain("glasses.review_visual");
    expect(payload.agentInstructionsPath).toBe("/tmp/example-project/AGENTS.md");
    expect(payload.agentInstructions).toContain("Read .vel/skills/vel-glasses/SKILL.md");
    expect(payload.modelRoles.find((role) => role.role === "grounding")?.limitations.join(" ")).toContain("not a general image narrator");
  });

  it("includes a configured general VLM model for inspect_image, describe, and ask", () => {
    const payload = buildInstallPayload(parseArgs([
      "install",
      "opencode",
      "--project-dir",
      "/tmp/example-project",
      "--kit-dir",
      process.cwd(),
      "--vision-vlm-model",
      "/tmp/qwen-vlm",
    ]));

    expect(payload.opencodeJson.mcp["vel-glasses"].environment.VEL_VISION_VLM_MODEL).toBe("/tmp/qwen-vlm");
    expect(payload.checks.find((check) => check.name === "visionVlmModel")?.ok).toBe(true);
  });

  it("surfaces general VLM readiness for open-ended image tools", () => {
    const previousVlm = process.env.VEL_VISION_VLM_MODEL;
    delete process.env.VEL_VISION_VLM_MODEL;

    try {
      const payload = buildInstallPayload(parseArgs([
        "install",
        "opencode",
        "--project-dir",
        "/tmp/example-project",
        "--kit-dir",
        process.cwd(),
      ]));

      const check = payload.checks.find((entry) => entry.name === "visionVlmModel");
      expect(check).toBeDefined();
      if (check?.ok) {
        expect(check.detail).toContain("Qwen3-VL");
      } else {
        expect(check?.detail).toContain("inspect_image");
      }
      expect(payload.modelDiscovery.some((model) => model.role === "general_vlm")).toBe(true);
    } finally {
      if (previousVlm === undefined) delete process.env.VEL_VISION_VLM_MODEL;
      else process.env.VEL_VISION_VLM_MODEL = previousVlm;
    }
  });

  it("builds OpenCode-native config with restart guidance", () => {
    const payload = buildInstallPayload(parseArgs([
      "install",
      "opencode",
      "--project-dir",
      "/tmp/example-project",
      "--kit-dir",
      process.cwd(),
      "--glasses-provider",
      "mock",
    ]));

    expect(payload.target).toBe("opencode");
    expect(payload.opencodeJson.$schema).toBe("https://opencode.ai/config.json");
    expect(payload.opencodeJson.mcp["vel-glasses"].type).toBe("local");
    expect(payload.opencodeJson.mcp["vel-glasses"].command).toEqual(["pnpm", "--dir", process.cwd(), "--filter", "@vel/glasses-mcp", "dev"]);
    expect(payload.opencodeJson.mcp["vel-glasses"].cwd).toBe("/tmp/example-project");
    expect(payload.opencodeJson.mcp["vel-glasses"].timeout).toBe(180000);
    expect(payload.opencodeJson.mcp["vel-glasses"].environment.VEL_ALLOWED_IMAGE_ROOTS).toContain(process.cwd());
    expect(payload.opencodeConfigPath).toBe("/tmp/example-project/opencode.json");
    expect(payload.restartInstructions.some((line) => line.includes("Close and reopen"))).toBe(true);
  });

  it("builds CommandCode project MCP config and CLI guidance", () => {
    const payload = buildInstallPayload(parseArgs([
      "install",
      "commandcode",
      "--project-dir",
      "/tmp/example-project",
      "--kit-dir",
      process.cwd(),
      "--glasses-provider",
      "mock",
    ]));

    expect(payload.target).toBe("commandcode");
    expect(payload.commandCodeJson.mcpServers["vel-glasses"].transport).toBe("stdio");
    expect(payload.commandCodeJson.mcpServers["vel-glasses"].enabled).toBe(true);
    expect(payload.commandCodeJson.mcpServers["vel-glasses"].command).toBe("pnpm");
    expect(payload.commandCodeJson.mcpServers["vel-glasses"].args).toEqual(["--dir", process.cwd(), "--filter", "@vel/glasses-mcp", "dev"]);
    expect(payload.localManifest).toBe("/tmp/example-project/.mcp.json");
    expect(payload.commandCodeAddCommand).toContain("cmd mcp add --scope project");
    expect(payload.commandCodeAddCommand).toContain("vel-glasses -- pnpm");
    expect(payload.restartInstructions.some((line) => line.includes("cmd mcp list"))).toBe(true);
  });

  it("renders human wizard output with first image and video prompts", () => {
    const payload = buildInstallPayload(parseArgs([
      "install",
      "mcp",
      "--project-dir",
      "/tmp/example-project",
      "--kit-dir",
      process.cwd(),
      "--glasses-provider",
      "mock",
    ]));

    const out = renderInstall(payload);
    expect(out).toContain("VEL MCP generic setup wizard");
    expect(out).toContain("STDIO MCP fields:");
    expect(out).toContain("Model roles:");
    expect(out).toContain("VEL_VISION_VLM_MODEL");
    expect(out).toContain("Machine-readable MCP JSON:");
    expect(out).toContain("CommandCode project .mcp.json:");
    expect(out).toContain("CommandCode CLI equivalent:");
    expect(out).toContain("Write CommandCode config with:");
    expect(out).toContain("First image prompt:");
    expect(out).toContain("examples/glasses-demo/dashboard.png");
    expect(out).toContain("First video prompt:");
    expect(out).toContain("examples/glasses-demo/button-appears.mp4");
    expect(out).toContain("Agent skill path:");
    expect(out).toContain("Agent instructions path:");
    expect(out).toContain("Qwen3-VL");
  });

  it("writes a local .mcp.json manifest without overwriting", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "vel-mcp-installer-test-"));
    const manifestPath = resolve(dir, ".mcp.json");
    try {
      const payload = buildInstallPayload(parseArgs([
        "install",
        "mcp",
        "--project-dir",
        dir,
        "--kit-dir",
        process.cwd(),
        "--glasses-provider",
        "mock",
      ]));

      writeManifest(manifestPath, payload.mcpJson);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(manifest.mcpServers["vel-glasses"].env.VEL_GLASSES_PROVIDER).toBe("mock");
      expect(() => writeManifest(manifestPath, payload.mcpJson)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes local agent guidance for natural language glasses routing", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "vel-mcp-skill-test-"));
    try {
      const payload = buildInstallPayload(parseArgs([
        "install",
        "opencode",
        "--project-dir",
        dir,
        "--kit-dir",
        process.cwd(),
        "--glasses-provider",
        "mock",
      ]));

      writeAgentSkill(payload.agentSkillPath, payload.agentSkill);
      const skill = readFileSync(payload.agentSkillPath, "utf-8");
      expect(skill).toContain("# Vel Glasses Visual Skill");
      expect(skill).toContain("The user does not need to mention MCP or tool names.");
      expect(skill).toContain("glasses.capture_url");
      expect(skill).toContain("bboxNorm1000");
      expect(skill).toContain("Do not substitute earlier examples");
      expect(skill).toContain("Keep the answer scoped to the current image");

      writeAgentInstructions(payload.agentInstructionsPath, payload.agentInstructions);
      const agents = readFileSync(payload.agentInstructionsPath, "utf-8");
      expect(agents).toContain("VEL-GLASSES:BEGIN");
      expect(agents).toContain("Read .vel/skills/vel-glasses/SKILL.md");
      expect(agents).toContain("For attachments, use the current attachment path");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("updates only the managed AGENTS.md block", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "vel-mcp-agents-test-"));
    const agentsPath = resolve(dir, "AGENTS.md");
    try {
      writeAgentInstructions(agentsPath, "old instructions");
      writeAgentInstructions(agentsPath, "new instructions");
      const agents = readFileSync(agentsPath, "utf-8");
      expect(agents).toContain("new instructions");
      expect(agents).not.toContain("old instructions");
      expect((agents.match(/VEL-GLASSES:BEGIN/g) ?? []).length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges OpenCode config without removing existing settings", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "vel-mcp-opencode-test-"));
    const configPath = resolve(dir, "opencode.json");
    try {
      writeOpenCodeConfig(configPath, {
        $schema: "https://opencode.ai/config.json",
        provider: { ollama: { name: "Ollama" } },
        mcp: { existing: { type: "local", command: ["echo", "ok"], enabled: true } },
      });

      const payload = buildInstallPayload(parseArgs([
        "install",
        "opencode",
        "--project-dir",
        dir,
        "--kit-dir",
        process.cwd(),
        "--glasses-provider",
        "mock",
      ]));

      writeOpenCodeConfig(configPath, payload.opencodeJson);
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.provider.ollama.name).toBe("Ollama");
      expect(config.mcp.existing.command).toEqual(["echo", "ok"]);
      expect(config.mcp["vel-glasses"].type).toBe("local");
      expect(config.mcp["vel-glasses"].environment.VEL_GLASSES_PROVIDER).toBe("mock");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges CommandCode .mcp.json without removing existing servers", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "vel-mcp-commandcode-test-"));
    const configPath = resolve(dir, ".mcp.json");
    try {
      writeCommandCodeConfig(configPath, {
        mcpServers: {
          existing: {
            transport: "stdio",
            enabled: true,
            command: "echo",
            args: ["ok"],
          },
        },
      });

      const payload = buildInstallPayload(parseArgs([
        "install",
        "commandcode",
        "--project-dir",
        dir,
        "--kit-dir",
        process.cwd(),
        "--glasses-provider",
        "mock",
      ]));

      writeCommandCodeConfig(configPath, payload.commandCodeJson);
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.mcpServers.existing.command).toBe("echo");
      expect(config.mcpServers["vel-glasses"].transport).toBe("stdio");
      expect(config.mcpServers["vel-glasses"].enabled).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("documents npx and pnpm dlx usage", () => {
    const out = helpText();
    expect(out).toContain("npx @vel/mcp install mcp");
    expect(out).toContain("pnpm dlx @vel/mcp install codex");
    expect(out).toContain("pnpm dlx @vel/mcp install opencode");
    expect(out).toContain("pnpm dlx @vel/mcp install commandcode");
  });
});
