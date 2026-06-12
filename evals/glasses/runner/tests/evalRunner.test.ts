import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runEvals } from "../src/evalRunner.js";
import { evaluateLocate, spanIoU, readingOrderCorrelation } from "../src/index.js";
import { MockVisionProvider } from "../../../../packages/glasses-mcp/src/providers/mockVisionProvider.js";
import type { LocateInput, OcrInput } from "../../../../packages/glasses-mcp/src/schemas.js";

const TASKS_PATH = resolve(__dirname, "../../sample-tasks.jsonl");

function mockProvider() {
  const mock = new MockVisionProvider();
  return {
    locate: async (input: Record<string, unknown>) => {
      const result = await mock.locate(input as unknown as LocateInput);
      const best = result.data.matches[0];
      return {
        matches: [{
          label: best?.label,
          bboxNorm1000: best?.bboxNorm1000,
          centerNorm1000: best?.centerNorm1000,
          confidence: best?.confidence
        }]
      };
    },
    ocr: async (input: Record<string, unknown>) => {
      const result = await mock.ocr(input as unknown as OcrInput);
      return {
        text: result.data.text,
        spans: result.data.spans
      };
    }
  };
}

describe("Eval Runner", () => {
  it("runs sample tasks against mock provider", async () => {
    const report = await runEvals({
      tasksPath: TASKS_PATH,
      provider: mockProvider()
    });

    expect(report.summary.total).toBe(7);
    expect(report.tasks).toHaveLength(7);
    expect(report.meta.runner).toBe("@vel/glasses-evals");

    for (const task of report.tasks) {
      expect(task.errors).toEqual([]);
    }
  });

  it("mock locate passes bbox_iou metric", async () => {
    const report = await runEvals({
      tasksPath: TASKS_PATH,
      provider: mockProvider()
    });
    const locate = report.tasks.find((t) => t.id === "mock-gui-search");
    expect(locate).toBeDefined();
    expect(locate!.pass).toBe(true);
    const iouMetric = locate!.metrics.find((m) => m.name === "bbox_iou");
    expect(iouMetric).toBeDefined();
    expect(iouMetric!.pass).toBe(true);
  });

  it("mock ocr passes ocr_exact metric", async () => {
    const report = await runEvals({
      tasksPath: TASKS_PATH,
      provider: mockProvider()
    });
    const ocr = report.tasks.find((t) => t.id === "mock-ocr-buttons");
    expect(ocr).toBeDefined();
    expect(ocr!.pass).toBe(true);
    const exactMetric = ocr!.metrics.find((m) => m.name === "ocr_exact");
    expect(exactMetric).toBeDefined();
    expect(exactMetric!.pass).toBe(true);
  });

  it("produces report with timestamps and duration", async () => {
    const report = await runEvals({
      tasksPath: TASKS_PATH,
      provider: mockProvider()
    });
    expect(report.meta.timestamp).toBeDefined();
    for (const task of report.tasks) {
      expect(task.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("span_iou passes for matching spans", async () => {
    const report = await runEvals({
      tasksPath: TASKS_PATH,
      provider: mockProvider()
    });
    const task = report.tasks.find((t) => t.id === "mock-ocr-spans");
    expect(task).toBeDefined();
    const iouMetric = task!.metrics.find((m) => m.name === "span_iou");
    expect(iouMetric).toBeDefined();
    expect(iouMetric!.pass).toBe(true);
    expect(iouMetric!.value).toBeGreaterThan(0.9);
  });

  it("reading_order_correlation passes for correct order", async () => {
    const report = await runEvals({
      tasksPath: TASKS_PATH,
      provider: mockProvider()
    });
    const task = report.tasks.find((t) => t.id === "mock-ocr-spans");
    expect(task).toBeDefined();
    const corrMetric = task!.metrics.find((m) => m.name === "reading_order_correlation");
    expect(corrMetric).toBeDefined();
    expect(corrMetric!.pass).toBe(true);
  });

  it("layout task passes with correct reading order", async () => {
    const report = await runEvals({
      tasksPath: TASKS_PATH,
      provider: mockProvider()
    });
    const task = report.tasks.find((t) => t.id === "mock-ocr-layout");
    expect(task).toBeDefined();
    expect(task!.pass).toBe(true);
  });

  it("region filter task returns only matching span text", async () => {
    const report = await runEvals({
      tasksPath: TASKS_PATH,
      provider: mockProvider()
    });
    const task = report.tasks.find((t) => t.id === "mock-ocr-region");
    expect(task).toBeDefined();
    expect(task!.pass).toBe(true);
  });
});

describe("spanIoU", () => {
  it("returns meanIoU=1 for identical spans", () => {
    const spans = [
      { bboxNorm1000: [100, 100, 200, 200] as [number, number, number, number] },
      { bboxNorm1000: [300, 300, 400, 400] as [number, number, number, number] },
    ];
    const { meanIoU, matchedCount, totalCount } = spanIoU(spans, spans);
    expect(meanIoU).toBe(1);
    expect(matchedCount).toBe(2);
    expect(totalCount).toBe(2);
  });

  it("returns low meanIoU for non-overlapping spans", () => {
    const pred = [{ bboxNorm1000: [0, 0, 50, 50] as [number, number, number, number] }];
    const gold = [{ bboxNorm1000: [500, 500, 550, 550] as [number, number, number, number] }];
    const { meanIoU } = spanIoU(pred, gold);
    expect(meanIoU).toBe(0);
  });
});

describe("evaluateLocate", () => {
  it("passes no_match when no predictions are returned", () => {
    const metrics = evaluateLocate(
      { matches: [], timingMs: 5 },
      { noMatch: true, matchCount: 0 },
      ["no_match", "match_count", "latency_budget_ms"]
    );

    expect(metrics).toEqual([
      { name: "no_match", value: 0, pass: true, threshold: 0 },
      { name: "match_count", value: 0, pass: true, threshold: 0 },
      { name: "latency_budget_ms", value: 5, pass: true, threshold: 30000 }
    ]);
  });

  it("scores multiple expected boxes using one-to-one IoU matching", () => {
    const metrics = evaluateLocate(
      {
        matches: [
          { bboxNorm1000: [100, 100, 200, 200] },
          { bboxNorm1000: [500, 100, 600, 200] },
        ],
        timingMs: 5
      },
      {
        matchCount: 2,
        matches: [
          { bboxNorm1000: [100, 100, 200, 200] },
          { bboxNorm1000: [500, 100, 600, 200] },
        ]
      },
      ["match_count", "multi_bbox_iou"]
    );

    expect(metrics).toEqual([
      { name: "match_count", value: 2, pass: true, threshold: 2 },
      { name: "multi_bbox_iou", value: 1, pass: true, threshold: 0.5 }
    ]);
  });

  it("fails latency_budget_ms when provider timing exceeds the task budget", () => {
    const metrics = evaluateLocate(
      { matches: [{ centerNorm1000: [10, 10] }], timingMs: 2500 },
      { centerNorm1000: [10, 10], latencyBudgetMs: 1000 },
      ["latency_budget_ms"]
    );

    expect(metrics).toEqual([{ name: "latency_budget_ms", value: 2500, pass: false, threshold: 1000 }]);
  });
});

describe("readingOrderCorrelation", () => {
  it("returns 1 for correct order", () => {
    const spans = [
      { bboxNorm1000: [0, 0, 10, 10] as [number, number, number, number], readingOrder: 1 },
      { bboxNorm1000: [10, 10, 20, 20] as [number, number, number, number], readingOrder: 2 },
      { bboxNorm1000: [20, 20, 30, 30] as [number, number, number, number], readingOrder: 3 },
    ];
    expect(readingOrderCorrelation(spans, spans)).toBe(1);
  });

  it("returns negative for reversed order", () => {
    const pred = [
      { bboxNorm1000: [20, 20, 30, 30] as [number, number, number, number], readingOrder: 1 },
      { bboxNorm1000: [10, 10, 20, 20] as [number, number, number, number], readingOrder: 2 },
      { bboxNorm1000: [0, 0, 10, 10] as [number, number, number, number], readingOrder: 3 },
    ];
    const gold = [
      { bboxNorm1000: [0, 0, 10, 10] as [number, number, number, number], readingOrder: 1 },
      { bboxNorm1000: [10, 10, 20, 20] as [number, number, number, number], readingOrder: 2 },
      { bboxNorm1000: [20, 20, 30, 30] as [number, number, number, number], readingOrder: 3 },
    ];
    expect(readingOrderCorrelation(pred, gold)).toBe(-1);
  });
});
