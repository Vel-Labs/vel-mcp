import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createGlassesServer } from "../src/server.js";

describe("G10 — Non-coding tools", () => {
  let tempDir: string;
  let server: ReturnType<typeof createGlassesServer>;

  beforeAll(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "vel-noncoding-test-"));
    server = createGlassesServer({
      artifactStore: resolve(tempDir, "artifacts"),
      allowedImageRoots: [tempDir],
    });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function makeImage(value: string) {
    return { kind: "file_path" as const, value };
  }

  it("glasses.describe returns description with style", async () => {
    const png = resolve(tempDir, "test.png");
    writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
    const tool = server.router.getForTool("describe");
    const result = await tool.describe!({ image: makeImage(png), style: "concise" });
    expect(result.data.description).toBeTruthy();
    expect(result.data.style).toBe("concise");
  });

  it("glasses.ask returns answer", async () => {
    const png = resolve(tempDir, "test.png");
    writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
    const tool = server.router.getForTool("ask");
    const result = await tool.ask!({ image: makeImage(png), question: "how many buttons" });
    expect(result.data.answer).toBeTruthy();
  });

  it("glasses.read_document returns pages", async () => {
    const png = resolve(tempDir, "test.png");
    writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
    const tool = server.router.getForTool("read_document");
    const result = await tool.readDocument!({ document: makeImage(png), mode: "full" });
    expect(result.data.pages.length).toBeGreaterThan(0);
    expect(result.data.metadata.totalPages).toBeGreaterThan(0);
  });

  it("glasses.detect_anomalies returns anomalies", async () => {
    const png = resolve(tempDir, "test.png");
    writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
    const tool = server.router.getForTool("detect_anomalies");
    const result = await tool.detectAnomalies!({ expected: makeImage(png), actual: makeImage(png), sensitivity: "medium" });
    expect(result.data.anomalies).toBeDefined();
  });
});
