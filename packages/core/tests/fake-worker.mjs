#!/usr/bin/env node
// Fake JSONL worker for testing WorkerSupervisor lifecycle.
// Behavior controlled via FAKE_WORKER_MODE env var:
//   echo        — responds to any op with {id, ok:true, result:{op}},
//                  emitting a progress heartbeat before responding.
//   slow-start — waits FAKE_WORKER_START_DELAY_MS (default 40000) before first line.
//   crash      — exits immediately with code 1.
//   crash-mid  — responds to first request, then exits on second.
//   memory     — fork-bombs itself to grow RSS (for memory_warning tests).
//   no-progress — responds without progress heartbeat.

import { createInterface } from "node:readline";

const mode = process.env.FAKE_WORKER_MODE ?? "echo";
const startDelayMs = parseInt(process.env.FAKE_WORKER_START_DELAY_MS ?? "0", 10);
let requestCount = 0;

function reply(line) {
  process.stdout.write(JSON.stringify(line) + "\n");
}

const rl = createInterface({ input: process.stdin });

function startup() {
  if (mode === "crash") {
    process.stderr.write("fake-worker: crashing on startup\n");
    process.exit(1);
  }
  if (startDelayMs > 0) {
    setTimeout(() => {
      process.stderr.write("fake-worker: slow start complete\n");
      rl.on("line", handleLine);
    }, startDelayMs);
  } else {
    rl.on("line", handleLine);
  }
}

function handleLine(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return; }
  const id = parsed.id ?? "no-id";

  if (mode === "crash-mid") {
    requestCount++;
    if (requestCount >= 2) {
      process.stderr.write("fake-worker: crashing mid-stream\n");
      process.exit(1);
    }
  }

  if (mode === "memory") {
    // allocate ~50MB per request to trigger memory warning
    const chunks = [];
    for (let i = 0; i < 500; i++) {
      chunks.push(Buffer.alloc(100_000, "x"));
    }
    // keep references alive so GC doesn't collect
    if (!global._fakeWorkerChunks) global._fakeWorkerChunks = [];
    global._fakeWorkerChunks.push(...chunks);
  }

  if (mode !== "no-progress") {
    reply({ id, progress: { current: 1, total: 2, message: "processing" } });
  }

  if (mode === "vision-echo") {
    // Return parseable LocateAnything box output for vision provider integration tests
    let answer;
    const op = parsed.op;
    if (op === "health") {
      reply({ id, ok: true, result: { status: "ok", model: "fake-vision-model" } });
      return;
    }
    if (op === "ground_gui" || op === "ground_multi") {
      answer = `<ref>${parsed.query ?? "button"}</ref><box><700><80><940><150></box>`;
    } else if (op === "point") {
      answer = `<ref>${parsed.query ?? "point"}</ref><box><500><500></box>`;
    } else if (op === "detect_text") {
      answer = "<ref>Search</ref><box><700><80><940><150></box><ref>Submit</ref><box><700><820><940><900></box><ref>Cancel</ref><box><500><820><680><900></box>";
    } else if (op === "detect") {
      answer = "<ref>detected</ref><box><100><100><400><400></box>";
    } else {
      answer = `<ref>${parsed.op ?? "result"}</ref><box><0><0><500><500></box>`;
    }
    reply({ id, ok: true, result: { answer, timingMs: 5 } });
    return;
  }

  reply({ id, ok: true, result: { op: parsed.op, received: true } });
}

startup();
