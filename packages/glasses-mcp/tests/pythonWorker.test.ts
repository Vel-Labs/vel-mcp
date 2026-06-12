import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { WorkerSupervisor } from "@vel/core";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WORKER_DIR = resolve(__dirname, "../workers/vel-worker");

function createTestPng(dir: string): string {
  const path = resolve(dir, "test.png");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  writeFileSync(path, png);
  return path;
}

function makeSupervisor() {
  return new WorkerSupervisor(undefined, {
    maxRestarts: 2,
    restartWindowSec: 10,
  });
}

describe("Python worker integration (FAKE_WORKER_MODE)", () => {
  let tempDir: string;
  let testPng: string;
  let supervisor: WorkerSupervisor;

  beforeAll(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "vel-test-python-worker-"));
    testPng = createTestPng(tempDir);
    supervisor = makeSupervisor();
  });

  afterAll(async () => {
    await supervisor.stopAll();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // …existing fake-mode tests unchanged…


  it("health check returns ok", async () => {
    const worker = supervisor.getOrCreate({
      id: "test-python-health",
      command: "python3",
      args: ["-m", "vel_glasses_worker.main"],
      cwd: WORKER_DIR,
      env: {
        FAKE_WORKER_MODE: "1",
        VEL_VISION_MODEL: "/fake",
        PYTHONPATH: WORKER_DIR,
        PATH: process.env.PATH ?? "",
      },
      idleTtlMs: 5000,
    });

    const res = await worker.request({ op: "health" });
    expect(res.ok).toBe(true);
    expect((res.result as any).status).toBe("ok");
    expect((res.result as any).model).toBe("fake-vision-model");
  });

  it("detect_text returns 3 parsed spans", async () => {
    const worker = supervisor.getOrCreate({
      id: "test-python-ocr",
      command: "python3",
      args: ["-m", "vel_glasses_worker.main"],
      cwd: WORKER_DIR,
      env: {
        FAKE_WORKER_MODE: "1",
        VEL_VISION_MODEL: "/fake",
        PYTHONPATH: WORKER_DIR,
        PATH: process.env.PATH ?? "",
      },
      idleTtlMs: 5000,
    });

    const res = await worker.request({
      op: "detect_text",
      image: { kind: "file_path", value: testPng },
      mode: "localized",
      mergeLines: false,
    });

    expect(res.ok).toBe(true);
    const answer = String((res.result as any)?.answer ?? "");
    expect(answer).toContain("Search");
    expect(answer).toContain("Submit");
    expect(answer).toContain("Cancel");
    expect(answer).toContain("<box><700><80><940><150></box>");
  });

  it("ground_multi returns parseable locate output", async () => {
    const worker = supervisor.getOrCreate({
      id: "test-python-locate",
      command: "python3",
      args: ["-m", "vel_glasses_worker.main"],
      cwd: WORKER_DIR,
      env: {
        FAKE_WORKER_MODE: "1",
        VEL_VISION_MODEL: "/fake",
        PYTHONPATH: WORKER_DIR,
        PATH: process.env.PATH ?? "",
      },
      idleTtlMs: 5000,
    });

    const res = await worker.request({
      op: "ground_multi",
      image: { kind: "file_path", value: testPng },
      query: "Search button",
    });

    expect(res.ok).toBe(true);
    const answer = String((res.result as any)?.answer ?? "");
    expect(answer).toContain("Search button");
    expect(answer).toContain("<box><700><80><940><150></box>");
  });

  it("ground_gui returns parseable output", async () => {
    const worker = supervisor.getOrCreate({
      id: "test-python-gui",
      command: "python3",
      args: ["-m", "vel_glasses_worker.main"],
      cwd: WORKER_DIR,
      env: {
        FAKE_WORKER_MODE: "1",
        VEL_VISION_MODEL: "/fake",
        PYTHONPATH: WORKER_DIR,
        PATH: process.env.PATH ?? "",
      },
      idleTtlMs: 5000,
    });

    const res = await worker.request({
      op: "ground_gui",
      image: { kind: "file_path", value: testPng },
      query: "Submit",
    });

    expect(res.ok).toBe(true);
    const answer = String((res.result as any)?.answer ?? "");
    expect(answer).toContain("Submit");
    expect(answer).toContain("<box>");
  });

  it("point returns point output", async () => {
    const worker = supervisor.getOrCreate({
      id: "test-python-point",
      command: "python3",
      args: ["-m", "vel_glasses_worker.main"],
      cwd: WORKER_DIR,
      env: {
        FAKE_WORKER_MODE: "1",
        VEL_VISION_MODEL: "/fake",
        PYTHONPATH: WORKER_DIR,
        PATH: process.env.PATH ?? "",
      },
      idleTtlMs: 5000,
    });

    const res = await worker.request({
      op: "point",
      image: { kind: "file_path", value: testPng },
      query: "target point",
    });

    expect(res.ok).toBe(true);
    const answer = String((res.result as any)?.answer ?? "");
    expect(answer).toContain("target point");
    expect(answer).toContain("<box><500><500></box>");
  });

  it("invalid op returns error", async () => {
    const worker = supervisor.getOrCreate({
      id: "test-python-invalid",
      command: "python3",
      args: ["-m", "vel_glasses_worker.main"],
      cwd: WORKER_DIR,
      env: {
        FAKE_WORKER_MODE: "1",
        VEL_VISION_MODEL: "/fake",
        PYTHONPATH: WORKER_DIR,
        PATH: process.env.PATH ?? "",
      },
      idleTtlMs: 5000,
    });

    const res = await worker.request({
      op: "nonexistent_op",
      image: { kind: "file_path", value: testPng },
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("ValueError");
  });
});

describe("Python worker integration (real model, opt-in)", () => {
  const VEL_REPO = process.env.VEL_VISION_MODEL;
  const VEL_MODEL = process.env.VEL_VISION_MODEL;
  const VEL_PYTHON = process.env.VEL_VISION_PYTHON ?? "python3";

  const skip = !VEL_REPO || !VEL_MODEL;

  const testOrSkip = skip ? it.skip : it;
  const describeOrSkip = skip ? describe.skip : describe;

  let supervisor: WorkerSupervisor;
  let testPng: string;

  beforeAll(() => {
    supervisor = makeSupervisor();
    const tempDir = mkdtempSync(resolve(tmpdir(), "vel-test-real-worker-"));
    // Create a simple 1x1 red pixel PNG for the model to ground
    const redPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    testPng = resolve(tempDir, "real-test.png");
    writeFileSync(testPng, redPng);
  });

  afterAll(async () => {
    await supervisor.stopAll();
  });

  describeOrSkip("real model inference", () => {
    testOrSkip("health check reports real model name", async () => {
      const worker = supervisor.getOrCreate({
        id: "test-real-health",
        command: VEL_PYTHON,
        args: ["-m", "vel_glasses_worker.main"],
        cwd: WORKER_DIR,
        env: {
          VEL_VISION_MODEL: VEL_REPO ?? "",
          PYTHONPATH: [VEL_REPO ?? "", WORKER_DIR].join(":"),
          PATH: process.env.PATH ?? "",
        },
        idleTtlMs: 300_000,
        startupTimeoutMs: 120_000,
      });

      const res = await worker.request({ op: "health" });
      expect(res.ok).toBe(true);
      expect((res.result as any).status).toBe("ok");
      expect((res.result as any).model).toContain("LocateAnything");
    }, 130_000);

    testOrSkip("ground_multi returns real <ref>/<box> output", async () => {
      const worker = supervisor.getOrCreate({
        id: "test-real-locate",
        command: VEL_PYTHON,
        args: ["-m", "vel_glasses_worker.main"],
        cwd: WORKER_DIR,
        env: {
          VEL_VISION_MODEL: VEL_REPO ?? "",
          PYTHONPATH: [VEL_REPO ?? "", WORKER_DIR].join(":"),
          PATH: process.env.PATH ?? "",
        },
        idleTtlMs: 300_000,
        startupTimeoutMs: 120_000,
      });

      const res = await worker.request({
        op: "ground_multi",
        image: { kind: "file_path", value: testPng },
        query: "red pixel",
      });

      expect(res.ok).toBe(true);
      const answer = String((res.result as any)?.answer ?? "");
      expect(answer).toMatch(/<ref>.*<\/ref>/);
      expect(answer).toMatch(/<box><\d+><\d+><\d+><\d+><\/box>/);
      expect((res.result as any).timingMs).toBeGreaterThan(0);
    }, 180_000);

    testOrSkip("detect_text returns real OCR output", async () => {
      const worker = supervisor.getOrCreate({
        id: "test-real-ocr",
        command: VEL_PYTHON,
        args: ["-m", "vel_glasses_worker.main"],
        cwd: WORKER_DIR,
        env: {
          VEL_VISION_MODEL: VEL_REPO ?? "",
          PYTHONPATH: [VEL_REPO ?? "", WORKER_DIR].join(":"),
          PATH: process.env.PATH ?? "",
        },
        idleTtlMs: 300_000,
        startupTimeoutMs: 120_000,
      });

      const res = await worker.request({
        op: "detect_text",
        image: { kind: "file_path", value: testPng },
        mode: "localized",
        mergeLines: false,
      });

      expect(res.ok).toBe(true);
      const answer = String((res.result as any)?.answer ?? "");
      expect(answer.length).toBeGreaterThan(0);
    }, 180_000);
  });
});
