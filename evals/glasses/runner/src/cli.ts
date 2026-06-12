#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { runEvals } from "./evalRunner.js";
import type { EvalReport } from "./index.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const glassesCli = resolve(repoRoot, "packages/glasses-mcp/dist/cli.js");

interface CliOptions {
  provider: "mock" | "glasses-grounding";
  dataset: string;
  outJson?: string;
  outMarkdown?: string;
  allowFailures: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const dataset = resolve(process.cwd(), options.dataset);
  const datasetDir = dirname(dataset);
  const report = await runEvals({
    tasksPath: dataset,
    provider: options.provider === "mock" ? createMockProvider() : createCliProvider(datasetDir, options.provider)
  });

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outJson) await writeOutput(resolve(process.cwd(), options.outJson), json);
  if (options.outMarkdown) await writeOutput(resolve(process.cwd(), options.outMarkdown), renderMarkdownReport(report));
  if (!options.outJson && !options.outMarkdown) process.stdout.write(json);
  if (report.summary.failed > 0 && !options.allowFailures) process.exitCode = 1;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    provider: "mock",
    dataset: "../sample-tasks.jsonl",
    allowFailures: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    if (arg === "--provider") {
      if (value !== "mock" && value !== "glasses-grounding") throw new Error("--provider must be mock or glasses-grounding");
      options.provider = value;
      i++;
    } else if (arg === "--dataset") {
      if (!value) throw new Error("--dataset requires a path");
      options.dataset = value;
      i++;
    } else if (arg === "--out-json") {
      if (!value) throw new Error("--out-json requires a path");
      options.outJson = value;
      i++;
    } else if (arg === "--out-md" || arg === "--out-markdown") {
      if (!value) throw new Error(`${arg} requires a path`);
      options.outMarkdown = value;
      i++;
    } else if (arg === "--allow-failures") {
      options.allowFailures = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(helpText());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function createMockProvider() {
  const spans = [
    { text: "Search", bboxNorm1000: [700, 80, 940, 150], readingOrder: 1 },
    { text: "Submit", bboxNorm1000: [700, 820, 940, 900], readingOrder: 2 },
    { text: "Cancel", bboxNorm1000: [500, 820, 680, 900], readingOrder: 3 }
  ];
  return {
    async locate(input: Record<string, unknown>) {
      const query = String(input.query ?? "").toLowerCase();
      if (query.includes("nothing")) return { matches: [] };
      const target = query.includes("search")
        ? { label: "Search button", bboxNorm1000: [700, 80, 940, 150], centerNorm1000: [820, 115] }
        : { label: String(input.query ?? "button"), bboxNorm1000: [100, 200, 400, 300], centerNorm1000: [250, 250] };
      return { matches: [target], timingMs: 1 };
    },
    async ocr(input: Record<string, unknown>) {
      const mode = input.mode ?? "localized";
      const region = input.regionNorm1000 as [number, number, number, number] | undefined;
      const filtered = region ? spans.filter((span) => intersects(span.bboxNorm1000 as [number, number, number, number], region)) : spans;
      const ordered = mode === "layout" ? [filtered[0], filtered[2], filtered[1]].filter(Boolean) : filtered;
      return { text: ordered.map((span) => span.text).join("\n"), spans: mode === "text_only" ? [] : ordered, timingMs: 1 };
    }
  };
}

function createCliProvider(datasetDir: string, provider: string) {
  return {
    async locate(input: Record<string, unknown>) {
      const started = Date.now();
      const image = normalizeImagePath(input, datasetDir);
      const args = [
        glassesCli,
        "--provider", provider,
        "benchmark", "locate-anything",
        "--image", image,
        "--query", String(input.query ?? ""),
        "--target-type", String(input.targetType ?? "any"),
        "--output-type", String(input.outputType ?? "box")
      ];
      const maxResults = input.maxResults;
      if (typeof maxResults === "number" && Number.isInteger(maxResults)) args.push("--max-results", String(maxResults));
      if (input.allowEmptyMatch === true) args.push("--allow-empty-match");
      const labels = input.labels as string[] | undefined;
      if (labels?.length) args.push("--labels", labels.join(","));
      const { stdout } = await execFileAsync(process.execPath, args, { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024, timeout: 240_000 });
      const payload = JSON.parse(stdout);
      return { ...(payload.result ?? payload), timingMs: payload.timingMs ?? Date.now() - started };
    },
    async ocr(input: Record<string, unknown>) {
      const started = Date.now();
      const image = normalizeImagePath(input, datasetDir);
      const args = [
        glassesCli,
        "--provider", provider,
        "ocr", image,
        "--mode", String(input.mode ?? "localized")
      ];
      const { stdout } = await execFileAsync(process.execPath, args, { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024, timeout: 240_000 });
      return { ...JSON.parse(stdout), timingMs: Date.now() - started };
    }
  };
}

function normalizeImagePath(input: Record<string, unknown>, datasetDir: string): string {
  const image = input.image as { kind?: string; value?: string } | undefined;
  if (!image || image.kind !== "file_path" || !image.value) throw new Error("Eval CLI only supports file_path image refs");
  if (image.value.startsWith("/") || image.value.startsWith("~")) return image.value;
  return resolve(datasetDir, image.value);
}

function intersects(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return Math.max(a[0], b[0]) < Math.min(a[2], b[2]) && Math.max(a[1], b[1]) < Math.min(a[3], b[3]);
}

async function writeOutput(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

function renderMarkdownReport(report: EvalReport): string {
  const lines = [
    "# VEL Glasses Eval Report",
    "",
    "## Summary",
    "",
    `- Total: ${report.summary.total}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    "",
    "## Cases",
    "",
    "| ID | Type | Status | Metrics | Errors |",
    "|---|---|---|---|---|",
    ...report.tasks.map((task) => `| ${task.id} | ${task.taskType} | ${task.pass ? "pass" : "fail"} | ${task.metrics.map((m) => `${m.name}: ${m.value}`).join("<br>")} | ${task.errors.join("<br>").replace(/\|/g, "\\|")} |`)
  ];
  return `${lines.join("\n")}\n`;
}

function helpText(): string {
  return [
    "Usage: vel-glasses-eval --provider mock|glasses-grounding --dataset path [--out-json path] [--out-md path]",
    "",
    "Runs VEL glasses eval tasks and emits deterministic JSON/Markdown reports.",
    ""
  ].join("\n");
}

main().catch((error) => {
  console.error(`[vel-glasses-eval] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
