import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkerSupervisor } from "@vel/core";
import { VelVisionProvider } from "../src/providers/velVisionProvider.js";
import type { VelVisionConfig } from "../src/providers/velVisionProvider.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FAKE_WORKER_PATH = resolve(__dirname, "../../core/tests/fake-worker.mjs");

function makeProvider(supervisor: WorkerSupervisor, overrides: Partial<VelVisionConfig> = {}) {
  return new VelVisionProvider(supervisor, {
    python: "node",
    model: "fake-vision-model",
    workerArgs: [FAKE_WORKER_PATH],
    ...overrides
  });
}

describe("VelVisionProvider integration (fake worker)", () => {
  let supervisor: WorkerSupervisor;
  let provider: VelVisionProvider;

  beforeAll(() => {
    process.env.FAKE_WORKER_MODE = "vision-echo";
    supervisor = new WorkerSupervisor();
    provider = makeProvider(supervisor);
  });

  afterAll(async () => {
    delete process.env.FAKE_WORKER_MODE;
    await supervisor.stopAll();
  });

  it("health check passes with fake worker", async () => {
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);
  });

  it("locate maps ground_multi and returns parsed matches", async () => {
    const result = await provider.locate({
      image: { kind: "file_path", value: "/fake/test.png" },
      query: "Search button",
      targetType: "any",
      outputType: "box",
      maxResults: 10,
      includeRawModelOutput: false
    });

    expect(result.data.matches).toHaveLength(1);
    expect(result.data.matches[0].label).toBe("Search button");
    expect(result.data.matches[0].bboxNorm1000).toEqual([700, 80, 940, 150]);
    expect(result.data.matches[0].centerNorm1000).toEqual([820, 115]);
    expect(result.provider.name).toBe("glasses-vision");
    expect(result.timingMs).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("Verify before use"))).toBe(true);
  });

  it("locate with targetType=gui maps to ground_gui", async () => {
    const result = await provider.locate({
      image: { kind: "file_path", value: "/fake/test.png" },
      query: "Submit",
      targetType: "gui",
      outputType: "box",
      maxResults: 10,
      includeRawModelOutput: false
    });

    expect(result.data.matches).toHaveLength(1);
    expect(result.data.matches[0].label).toBe("Submit");
    expect(result.data.matches[0].bboxNorm1000).toEqual([700, 80, 940, 150]);
  });

  it("locate with labels and targetType=object maps to detect", async () => {
    const result = await provider.locate({
      image: { kind: "file_path", value: "/fake/test.png" },
      query: "screen objects",
      labels: ["button", "icon"],
      targetType: "object",
      outputType: "box",
      maxResults: 10,
      includeRawModelOutput: false
    });

    expect(result.data.matches).toHaveLength(1);
    expect(result.data.matches[0].label).toBe("detected");
    expect(result.data.matches[0].bboxNorm1000).toEqual([100, 100, 400, 400]);
  });

  it("locate with outputType=point maps to point", async () => {
    const result = await provider.locate({
      image: { kind: "file_path", value: "/fake/test.png" },
      query: "target point",
      targetType: "point",
      outputType: "point",
      maxResults: 10,
      includeRawModelOutput: false
    });

    expect(result.data.matches).toHaveLength(1);
    expect(result.data.matches[0].label).toBe("target point");
    expect(result.data.matches[0].centerNorm1000).toEqual([500, 500]);
    expect(result.data.matches[0].bboxNorm1000).toBeUndefined();
  });

  it("ocr returns parsed text spans with reading order", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "/fake/test.png" },
      mode: "localized",
      mergeLines: false
    });

    expect(result.data.spans).toHaveLength(3);
    expect(result.data.spans[0].text).toBe("Search");
    expect(result.data.spans[0].readingOrder).toBe(1);
    expect(result.data.text).toContain("Search");
    expect(result.data.text).toContain("Submit");
    expect(result.data.text).toContain("Cancel");
    expect(result.provider.name).toBe("glasses-vision");
  });

  it("includes license warning on all outputs", async () => {
    const result = await provider.inspectImage({
      image: { kind: "file_path", value: "/fake/test.png" },
      detail: "medium",
      includeText: true,
      includeObjects: true,
      includeLayout: true
    });

    expect(result.warnings.some((w) => w.includes("non-commercial"))).toBe(true);
    expect(result.data.observations.length).toBeGreaterThan(0);
  });

  it("does not use a grounding-only provider for open-ended image inspection", async () => {
    const groundingProvider = makeProvider(supervisor, { role: "grounding", providerId: "glasses-grounding" });
    const result = await groundingProvider.inspectImage({
      image: { kind: "file_path", value: "/fake/test.png" },
      detail: "medium",
      includeText: true,
      includeObjects: true,
      includeLayout: true
    });

    expect(result.provider.name).toBe("glasses-grounding");
    expect(result.data.observations).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes("VEL_VISION_VLM_MODEL"))).toBe(true);
  });

  it("locate with includeRawModelOutput preserves raw answer", async () => {
    const result = await provider.locate({
      image: { kind: "file_path", value: "/fake/test.png" },
      query: "button",
      targetType: "any",
      outputType: "box",
      maxResults: 10,
      includeRawModelOutput: true
    });

    expect(result.data.matches[0].evidence?.rawModelOutput).toBeDefined();
    expect(result.data.matches[0].evidence?.rawModelOutput).toContain("<ref>");
  });

  it("cancellation works via supervisor", async () => {
    const cancelProvider = makeProvider(supervisor);
    const result = await cancelProvider.locate({
      image: { kind: "file_path", value: "/fake/test.png" },
      query: "quick",
      targetType: "any",
      outputType: "box",
      maxResults: 10,
      includeRawModelOutput: false
    });

    expect(result.data.matches).toHaveLength(1);
    expect(result.data.matches[0].label).toBe("quick");
  });
});

describe("LocateAnythingProvider OCR modes (G5)", () => {
  let supervisor: WorkerSupervisor;
  let provider: LocateAnythingProvider;

  beforeAll(() => {
    process.env.FAKE_WORKER_MODE = "vision-echo";
    supervisor = new WorkerSupervisor();
    provider = makeProvider(supervisor);
  });

  afterAll(async () => {
    delete process.env.FAKE_WORKER_MODE;
    await supervisor.stopAll();
  });

  it("text_only mode returns text but strips spans", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "/fake/test.png" },
      mode: "text_only",
      mergeLines: true
    });
    expect(result.data.spans).toHaveLength(0);
    expect(result.data.text).toContain("Search");
    expect(result.data.text).toContain("Submit");
  });

  it("layout mode reorders spans by y-band then x", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "/fake/test.png" },
      mode: "layout",
      mergeLines: false
    });
    expect(result.data.spans).toHaveLength(3);
    expect(result.data.spans[0].text).toBe("Search");
    expect(result.data.spans[0].readingOrder).toBe(1);
    expect(result.data.spans[1].readingOrder).toBe(2);
    expect(result.data.spans[2].readingOrder).toBe(3);
  });

  it("mergeLines=true merges spans on same y-band", async () => {
    const result = await provider.ocr({
      image: { kind: "file_path", value: "/fake/test.png" },
      mode: "localized",
      mergeLines: true
    });
    expect(result.data.spans).toHaveLength(2);
    expect(result.data.spans[0].text).toBe("Search");
    expect(result.data.spans[1].text).toBe("Cancel Submit");
  });
});
