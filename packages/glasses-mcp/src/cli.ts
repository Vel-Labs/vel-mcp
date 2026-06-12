#!/usr/bin/env node
import { Command } from "commander";
import { createGlassesServer } from "./server.js";
import { loadVelConfig } from "@vel/core";

async function createServer() {
  let config: Record<string, unknown> | undefined;
  try {
    const velConfig = await loadVelConfig();
    config = velConfig.modules?.glasses as Record<string, unknown> | undefined;
  } catch {
    // Non-fatal: server starts with defaults if config is missing or invalid
  }
  return createGlassesServer({ config });
}

function fmt(data: unknown) {
  return JSON.stringify(data, null, 2);
}

function imageRef(path: string) {
  return { kind: "file_path" as const, value: path };
}

const program = new Command("vel-glasses")
  .description("VEL Glasses CLI — vision tools for images, documents, and video")
  .version("0.1.0")
  .option("--provider <id>", "Force specific provider")
  .option("--output <format>", "Output format: json or text", "json")
  .option("--config <path>", "Config file path")
  .option("--verbose", "Show warnings and timing");

program
  .command("inspect <image>")
  .description("Run structured visual inspection on an image")
  .option("--detail <level>", "Detail level: low, medium, high", "medium")
  .action(async (imagePath, opts) => {
    const { router } = await createServer();
    const provider = router.getForTool("inspect_image", program.opts().provider);
    const result = await provider.inspectImage({
      image: imageRef(imagePath),
      detail: opts.detail,
      includeObjects: true,
      includeText: true,
      includeLayout: true,
    });
    console.log(fmt(result.data));
  });

program
  .command("describe <image>")
  .description("Generate a natural language description of an image")
  .option("--style <style>", "Style: concise, detailed, bullet, alt-text", "detailed")
  .action(async (imagePath, opts) => {
    const { router } = await createServer();
    const provider = router.getForTool("describe", program.opts().provider);
    if (!provider.describe) {
      console.error("Provider does not support describe");
      process.exit(1);
    }
    const result = await provider.describe({ image: imageRef(imagePath), style: opts.style });
    console.log(fmt(result.data));
  });

program
  .command("ask <image> <question>")
  .description("Ask a free-form visual question about an image")
  .action(async (imagePath, question) => {
    const { router } = await createServer();
    const provider = router.getForTool("ask", program.opts().provider);
    if (!provider.ask) {
      console.error("Provider does not support ask");
      process.exit(1);
    }
    const result = await provider.ask({ image: imageRef(imagePath), question });
    console.log(fmt(result.data));
  });

program
  .command("locate <image> <query>")
  .description("Find an object, text, or GUI element in an image")
  .option("--target-type <type>", "Target type: any, object, text, gui, point, region", "any")
  .option("--output-type <type>", "Output type: box, point, both", "box")
  .option("--labels <labels>", "Comma-separated object labels for dense detection")
  .option("--include-raw-model-output", "Include raw provider output as evidence")
  .action(async (imagePath, query, opts) => {
    const { router } = await createServer();
    const provider = router.getForTool("locate", program.opts().provider);
    const result = await provider.locate({
      image: imageRef(imagePath),
      query,
      labels: opts.labels ? String(opts.labels).split(",").map((label) => label.trim()).filter(Boolean) : undefined,
      targetType: opts.targetType,
      outputType: opts.outputType,
      maxResults: 10,
      includeRawModelOutput: Boolean(opts.includeRawModelOutput),
    });
    console.log(fmt(result.data));
  });

program
  .command("ocr <image>")
  .description("Extract text from an image with optional localization")
  .option("--mode <mode>", "Mode: text_only, localized, layout", "localized")
  .action(async (imagePath, opts) => {
    const { router } = await createServer();
    const provider = router.getForTool("ocr", program.opts().provider);
    const result = await provider.ocr({
      image: imageRef(imagePath),
      mode: opts.mode,
      mergeLines: true,
    });
    console.log(fmt(result.data));
  });

program
  .command("read <document>")
  .description("Read a document (image or PDF) and extract structured content")
  .option("--mode <mode>", "Mode: ocr, summarize, extract_tables, full", "full")
  .action(async (docPath, opts) => {
    const { router } = await createServer();
    const provider = router.getForTool("read_document", program.opts().provider);
    if (!provider.readDocument) {
      console.error("Provider does not support read_document");
      process.exit(1);
    }
    const result = await provider.readDocument({ document: imageRef(docPath), mode: opts.mode });
    console.log(fmt(result.data));
  });

program
  .command("crop <image> <bbox>")
  .description("Crop a region [x1,y1,x2,y2] from an image and inspect it")
  .action(async (imagePath, bboxStr) => {
    const coords = bboxStr.split(",").map((s: string) => parseInt(s.trim(), 10));
    if (coords.length !== 4) {
      console.error("bbox must be 4 comma-separated integers: x1,y1,x2,y2");
      process.exit(1);
    }
    const { router } = await createServer();
    const provider = router.getForTool("inspect_region", program.opts().provider);
    const result = await provider.inspectRegion({
      image: imageRef(imagePath),
      regionNorm1000: coords as [number, number, number, number],
      detail: "high",
    });
    console.log(fmt(result.data));
  });

program
  .command("diff <before> <after>")
  .description("Compare two images and return changed regions")
  .option("--mode <mode>", "Mode: metadata, pixel, ocr, layout, auto", "metadata")
  .action(async (beforePath, afterPath, opts) => {
    const { router } = await createServer();
    const provider = router.getForTool("compare", program.opts().provider);
    const result = await provider.compare({
      before: imageRef(beforePath),
      after: imageRef(afterPath),
      mode: opts.mode,
    });
    console.log(fmt(result.data));
  });

program
  .command("anomalies <expected> <actual>")
  .description("Detect visual anomalies between expected and actual images")
  .option("--sensitivity <level>", "Sensitivity: low, medium, high", "medium")
  .action(async (expectedPath, actualPath, opts) => {
    const { router } = await createServer();
    const provider = router.getForTool("detect_anomalies", program.opts().provider);
    if (!provider.detectAnomalies) {
      console.error("Provider does not support detect_anomalies");
      process.exit(1);
    }
    const result = await provider.detectAnomalies({
      expected: imageRef(expectedPath),
      actual: imageRef(actualPath),
      sensitivity: opts.sensitivity,
    });
    console.log(fmt(result.data));
  });

program
  .command("video-scan <video>")
  .description("Sample video frames and analyze them")
  .option("--every-seconds <n>", "Sample every N seconds", "2")
  .option("--max-frames <n>", "Maximum frames to sample", "60")
  .option("--query <query>", "Optional query to run on each frame")
  .action(async (videoPath, opts) => {
    const { router } = await createServer();
    const provider = router.getForTool("video_scan", program.opts().provider);
    const result = await provider.videoScan({
      video: imageRef(videoPath),
      sampling: {
        everySeconds: parseFloat(opts.everySeconds),
        maxFrames: parseInt(opts.maxFrames, 10),
      },
      query: opts.query,
    });
    console.log(fmt(result.data));
  });

program
  .command("providers")
  .description("List registered vision providers with health and capabilities")
  .action(async () => {
    const { router } = await createServer();
    const entries = router.listEntries();
    const providers = await Promise.all(
      entries.map(async (entry) => {
        const health = await (entry.provider.healthCheck?.() ?? Promise.resolve(null));
        const capabilities = [
          "inspectImage",
          "locate",
          "ocr",
          "inspectRegion",
          "compare",
          "videoScan",
          entry.provider.describe ? "describe" : null,
          entry.provider.ask ? "ask" : null,
          entry.provider.readDocument ? "readDocument" : null,
          entry.provider.detectAnomalies ? "detectAnomalies" : null,
        ].filter(Boolean);
        return {
          id: entry.provider.id,
          displayName: entry.provider.displayName,
          enabled: entry.enabled,
          priority: entry.priority,
          role: entry.role,
          capabilities,
          health: health ? { ok: health.ok, error: health.error, warnings: health.warnings } : null,
        };
      })
    );
    console.log(fmt({ providers }));
  });

program
  .command("health [provider]")
  .description("Check provider health")
  .action(async (providerId) => {
    const { router } = await createServer();
    const provider = router.get(providerId);
    const health = await (provider.healthCheck?.() ?? Promise.resolve(null));
    console.log(fmt({ provider: provider.id, health }));
  });

program
  .command("doctor <target>")
  .description("Run provider setup diagnostics")
  .action(async (target) => {
    if (target !== "locate-anything") {
      console.error("Supported doctor target: locate-anything");
      process.exit(1);
    }
    const { router } = await createServer();
    const provider = router.get(program.opts().provider ?? "glasses-grounding");
    const health = await (provider.healthCheck?.() ?? Promise.resolve(null));
    const payload = {
      schemaVersion: "2026-06-11",
      provider: provider.id,
      ok: health?.ok ?? true,
      warnings: health?.warnings ?? [],
      error: health?.error,
      env: {
        VEL_VISION_MODEL: process.env.VEL_VISION_MODEL,
        VEL_VISION_PYTHON: process.env.VEL_VISION_PYTHON,
        VEL_GLASSES_PROVIDER: process.env.VEL_GLASSES_PROVIDER
      }
    };
    console.log(fmt(payload));
    process.exit(payload.ok ? 0 : 1);
  });

program
  .command("benchmark <target>")
  .description("Run a real provider benchmark probe")
  .requiredOption("--image <path>", "Image path")
  .requiredOption("--query <text>", "Locate query")
  .option("--target-type <type>", "Target type: any, object, text, gui, point, region", "any")
  .option("--output-type <type>", "Output type: box, point, both", "box")
  .option("--labels <labels>", "Comma-separated object labels")
  .option("--include-raw-model-output", "Include raw provider output as evidence")
  .action(async (target, opts) => {
    if (target !== "locate-anything") {
      console.error("Supported benchmark target: locate-anything");
      process.exit(1);
    }
    const { router } = await createServer();
    const provider = router.get(program.opts().provider ?? "glasses-grounding");
    const started = Date.now();
    const result = await provider.locate({
      image: imageRef(opts.image),
      query: opts.query,
      labels: opts.labels ? String(opts.labels).split(",").map((label) => label.trim()).filter(Boolean) : undefined,
      targetType: opts.targetType,
      outputType: opts.outputType,
      maxResults: 10,
      includeRawModelOutput: Boolean(opts.includeRawModelOutput)
    });
    const payload = {
      schemaVersion: "2026-06-11",
      benchmark: "locate-anything.locate",
      ok: result.data.matches.length > 0,
      provider: result.provider,
      timingMs: result.timingMs,
      wallClockMs: Date.now() - started,
      warnings: result.warnings,
      result: result.data
    };
    console.log(fmt(payload));
    process.exit(payload.ok ? 0 : 1);
  });

program.parse();
