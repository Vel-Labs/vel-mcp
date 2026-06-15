import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildInstallPayload, helpText, parseArgs, renderInstall, writeManifest } from "../src/cli.js";

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
      "--server-name",
      "vel-glasses-local",
      "--format",
      "json",
    ]);

    expect(opts.target).toBe("mcp");
    expect(opts.projectDir).toBe("/tmp/example-project");
    expect(opts.kitDir).toBe("/tmp/vel-mcp-kit");
    expect(opts.provider).toBe("mock");
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
    expect(payload.mcpJson.mcpServers["vel-glasses"].command).toBe("pnpm");
    expect(payload.localManifest).toBe("/tmp/example-project/.mcp.json");
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
    expect(out).toContain("Machine-readable MCP JSON:");
    expect(out).toContain("First image prompt:");
    expect(out).toContain("examples/glasses-demo/dashboard.png");
    expect(out).toContain("First video prompt:");
    expect(out).toContain("examples/glasses-demo/button-appears.mp4");
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

  it("documents npx and pnpm dlx usage", () => {
    const out = helpText();
    expect(out).toContain("npx @vel/mcp install mcp");
    expect(out).toContain("pnpm dlx @vel/mcp install codex");
  });
});
