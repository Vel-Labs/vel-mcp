import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ArtifactStore } from "@vel/core";
import { captureUrlTool } from "../src/tools/captureUrl.js";
import { PlaywrightUrlCapturer } from "../src/services/urlCapture.js";

describe("captureUrlTool", () => {
  let tempDir: string;
  let artifactStore: ArtifactStore;

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "vel-capture-url-test-"));
    artifactStore = new ArtifactStore(resolve(tempDir, "artifacts"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns a screenshot artifact from an injected capturer", async () => {
    const tool = captureUrlTool(artifactStore, {
      async capture(input) {
        const meta = await artifactStore.putBytes(Buffer.from("png"), { mimeType: "image/png", origin: "generated" });
        return {
          artifactId: meta.id,
          image: { kind: "artifact_id", value: meta.id, mimeType: "image/png" },
          url: input.url,
          viewport: input.viewport,
          captured: { width: input.viewport.width, height: input.viewport.height, fullPage: input.fullPage },
          warnings: ["fake capture"],
        };
      },
    });

    const raw = await tool.handler({
      url: "http://localhost:3000",
      viewport: { width: 1024, height: 768 },
      fullPage: false,
      waitMs: 0,
      timeoutMs: 1000,
      maxHeightPx: 2000,
    }) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(raw.content[0].text);

    expect(parsed.ok).toBe(true);
    expect(parsed.result.artifactId).toMatch(/^sha256-/);
    expect(parsed.result.image.kind).toBe("artifact_id");
    expect(parsed.result.viewport).toEqual({ width: 1024, height: 768 });
    expect(parsed.warnings).toContain("fake capture");
  });

  it("reports a structured error when Playwright is unavailable", async () => {
    const capturer = new PlaywrightUrlCapturer(artifactStore, async () => {
      throw Object.assign(new Error("missing"), { code: "PLAYWRIGHT_UNAVAILABLE" });
    });

    await expect(capturer.capture({
      url: "http://localhost:3000",
      viewport: { width: 1280, height: 800 },
      fullPage: false,
      waitMs: 0,
      timeoutMs: 1000,
      maxHeightPx: 2000,
    })).rejects.toMatchObject({ code: "PLAYWRIGHT_UNAVAILABLE" });
  });
});
