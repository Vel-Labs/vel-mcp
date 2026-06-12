import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateLocate, evaluateOcr, type EvalTask, type EvalTaskResult, type EvalReport } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface EvalRunnerOptions {
  tasksPath: string;
  provider: {
    locate: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    ocr: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
}

export async function loadTasks(tasksPath: string): Promise<EvalTask[]> {
  const raw = await readFile(resolve(tasksPath), "utf8");
  return raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as EvalTask);
}

export async function runEvals(opts: EvalRunnerOptions): Promise<EvalReport> {
  const tasks = await loadTasks(opts.tasksPath);
  const results: EvalTaskResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const task of tasks) {
    const started = Date.now();
    const result: EvalTaskResult = {
      id: task.id,
      taskType: task.taskType,
      pass: false,
      metrics: [],
      durationMs: 0,
      errors: []
    };

    try {
      let pred: Record<string, unknown>;
      switch (task.taskType) {
        case "locate":
          pred = await opts.provider.locate(task.input);
          result.metrics = evaluateLocate(pred, task.expected, task.metrics);
          break;
        case "ocr":
          pred = await opts.provider.ocr(task.input);
          result.metrics = evaluateOcr(pred, task.expected, task.metrics);
          break;
        default:
          result.errors.push(`Unsupported task type: ${task.taskType}`);
          break;
      }
    } catch (err) {
      result.errors.push(`Provider error: ${String(err)}`);
    }

    result.durationMs = Date.now() - started;
    result.pass = result.metrics.length > 0 && result.metrics.every((m) => m.pass) && result.errors.length === 0;
    if (result.pass) passed++;
    else failed++;

    results.push(result);
  }

  return {
    summary: { total: tasks.length, passed, failed, skipped: 0 },
    tasks: results,
    meta: { runner: "@vel/glasses-evals", timestamp: new Date().toISOString() }
  };
}
