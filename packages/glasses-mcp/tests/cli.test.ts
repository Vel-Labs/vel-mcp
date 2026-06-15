import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(__dirname, "../dist/cli.js");

describe("G12 — CLI", () => {
  it("vel-glasses --help exits 0", () => {
    const out = execSync(`node ${CLI} --help`, { encoding: "utf-8" });
    expect(out).toContain("inspect");
    expect(out).toContain("describe");
    expect(out).toContain("ask");
    expect(out).toContain("locate");
    expect(out).toContain("ocr");
    expect(out).toContain("providers");
  });

  it("vel-glasses providers returns JSON with mock provider", () => {
    const out = execSync(`node ${CLI} providers`, { encoding: "utf-8" });
    const parsed = JSON.parse(out);
    expect(parsed.providers).toBeDefined();
    expect(parsed.providers.some((p: any) => p.id === "mock")).toBe(true);
  });

  it("vel-glasses setup locate-anything prints MLX-first setup guidance", () => {
    const out = execSync(`node ${CLI} setup locate-anything`, { encoding: "utf-8" });
    const parsed = JSON.parse(out);
    expect(parsed.target).toBe("locate-anything");
    expect(parsed.mode).toBe("mlx-vlm");
    expect(parsed.env.VEL_VISION_PYTHON).toContain("glasses-mlx/bin/python");
    expect(parsed.commands.some((cmd: string) => cmd.includes("doctor locate-anything"))).toBe(true);
  });

  it("vel-glasses install codex prints Codex form fields", () => {
    const out = execSync(`node ${CLI} install codex --glasses-provider mock --project-dir /tmp`, { encoding: "utf-8" });
    expect(out).toContain("VEL Glasses Codex MCP setup");
    expect(out).toContain("Transport: STDIO");
    expect(out).toContain("Command to launch: pnpm");
    expect(out).toContain("Working directory: /tmp");
    expect(out).toContain("Machine-readable MCP JSON");
  });

  it("vel-glasses install codex can emit machine-readable JSON", () => {
    const out = execSync(`node ${CLI} install codex --glasses-provider mock --project-dir /tmp --format json`, { encoding: "utf-8" });
    const parsed = JSON.parse(out);
    expect(parsed.target).toBe("codex");
    expect(parsed.codexForm.transport).toBe("stdio");
    expect(parsed.codexForm.command).toBe("pnpm");
    expect(parsed.codexForm.arguments).toContain("@vel/glasses-mcp");
    expect(parsed.codexForm.environmentVariables.VEL_GLASSES_PROVIDER).toBe("mock");
    expect(parsed.mcpJson.mcpServers["vel-glasses"]).toBeDefined();
  });

  it("vel-glasses health checks mock provider", () => {
    const out = execSync(`node ${CLI} health mock`, { encoding: "utf-8" });
    const parsed = JSON.parse(out);
    expect(parsed.provider).toBe("mock");
    expect(parsed.health.ok).toBe(true);
  });
});
