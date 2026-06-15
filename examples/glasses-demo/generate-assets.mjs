#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const outDir = resolve(import.meta.dirname);
const require = createRequire(import.meta.url);
const sharp = require("../../packages/glasses-mcp/node_modules/sharp");

const palette = {
  ink: "#111827",
  muted: "#64748b",
  line: "#cbd5e1",
  page: "#f8fafc",
  blue: "#2563eb",
  green: "#16a34a",
  red: "#ef4444",
  amber: "#f59e0b",
  white: "#ffffff"
};

function shellEscape(path) {
  return path.replace(/'/g, "'\\''");
}

function text(x, y, content, size = 24, fill = palette.ink, weight = 500) {
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${content}</text>`;
}

function button(x, y, label, fill = palette.blue) {
  return [
    `<rect x="${x}" y="${y}" width="168" height="72" rx="10" fill="${fill}"/>`,
    text(x + 42, y + 44, label, 24, palette.white, 700)
  ].join("\n");
}

async function png(name, svg) {
  await writeFile(resolve(outDir, name), await sharp(Buffer.from(svg)).png().toBuffer());
}

function dashboardSvg({ showButton = true, showWarning = true, includeInstructions = true } = {}) {
  const primaryNote = includeInstructions
    ? "The agent should locate the blue Approve button before continuing."
    : "The deployment control changes state during this video.";
  const secondaryNote = includeInstructions
    ? "Do not click automatically; return coordinates and reasoning."
    : "Scan frames and report when the blue action button is visible.";
  return `<svg width="960" height="640" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="640" fill="${palette.page}"/>
  <rect x="0" y="0" width="960" height="78" fill="${palette.ink}"/>
  ${text(34, 49, "VEL Ops Console", 26, palette.white, 700)}
  ${text(700, 49, "Agent Mode", 20, "#bfdbfe", 600)}
  <rect x="34" y="112" width="280" height="172" rx="8" fill="${palette.white}" stroke="${palette.line}"/>
  ${text(58, 154, "Queue", 28, palette.ink, 700)}
  ${text(58, 196, "Open tasks", 22, palette.muted)}
  ${text(220, 196, "17", 32, palette.blue, 700)}
  ${button(58, 224, "Review", palette.blue)}
  <rect x="354" y="112" width="280" height="172" rx="8" fill="${palette.white}" stroke="${palette.line}"/>
  ${text(378, 154, "Deploy", 28, palette.ink, 700)}
  ${text(378, 196, "Last run", 22, palette.muted)}
  ${text(514, 196, "OK", 32, palette.green, 700)}
  ${showButton ? button(398, 224, "Approve", palette.blue) : text(398, 260, "Pending signal", 24, palette.muted, 700)}
  <rect x="674" y="112" width="252" height="172" rx="8" fill="${palette.white}" stroke="${palette.line}"/>
  ${text(698, 154, "Health", 28, palette.ink, 700)}
  ${text(698, 196, "Region", 22, palette.muted)}
  ${text(798, 196, "US-C", 26, palette.ink, 700)}
  ${button(698, 224, "Details", palette.muted)}
  <rect x="34" y="324" width="892" height="230" rx="8" fill="${palette.white}" stroke="${palette.line}"/>
  ${text(58, 366, "Incident Notes", 28, palette.ink, 700)}
  ${text(58, 410, primaryNote, 24, palette.ink)}
  ${text(58, 450, secondaryNote, 24, palette.muted)}
  ${showWarning ? `<rect x="58" y="486" width="584" height="44" rx="6" fill="#fef3c7" stroke="${palette.amber}"/>${text(78, 516, "Warning: billing limit near threshold", 22, "#92400e", 700)}` : ""}
</svg>`;
}

function receiptSvg() {
  return `<svg width="720" height="920" xmlns="http://www.w3.org/2000/svg">
  <rect width="720" height="920" fill="#e2e8f0"/>
  <rect x="130" y="54" width="460" height="812" rx="8" fill="${palette.white}" stroke="${palette.line}"/>
  ${text(182, 122, "VEL DEMO RECEIPT", 30, palette.ink, 700)}
  ${text(182, 174, "Receipt ID: VEL-0427", 24)}
  ${text(182, 218, "Date: 2026-06-14", 24)}
  <line x1="182" y1="254" x2="538" y2="254" stroke="${palette.line}" stroke-width="2"/>
  ${text(182, 304, "Vision adapter setup", 23)}
  ${text(446, 304, "$24.00", 23)}
  ${text(182, 354, "Frame sampling check", 23)}
  ${text(446, 354, "$12.50", 23)}
  ${text(182, 404, "OCR validation", 23)}
  ${text(446, 404, "$8.75", 23)}
  <line x1="182" y1="454" x2="538" y2="454" stroke="${palette.line}" stroke-width="2"/>
  ${text(182, 512, "Total", 30, palette.ink, 700)}
  ${text(426, 512, "$45.25", 30, palette.ink, 700)}
  <rect x="182" y="594" width="356" height="72" rx="8" fill="#dcfce7" stroke="${palette.green}"/>
  ${text(215, 640, "Status: PAID", 28, "#166534", 700)}
  ${text(182, 736, "Ask an agent to extract:", 23, palette.muted)}
  ${text(182, 778, "receipt id, date, total, status", 23, palette.muted)}
</svg>`;
}

function comparisonSvg(changed) {
  return `<svg width="960" height="540" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="540" fill="${palette.page}"/>
  <rect x="60" y="70" width="840" height="360" rx="8" fill="${palette.white}" stroke="${palette.line}"/>
  ${text(96, 128, "Service Status", 32, palette.ink, 700)}
  ${text(96, 184, "API latency", 24, palette.muted)}
  <rect x="300" y="160" width="420" height="34" rx="17" fill="#dbeafe"/>
  <rect x="300" y="160" width="${changed ? 345 : 210}" height="34" rx="17" fill="${changed ? palette.red : palette.green}"/>
  ${text(740, 187, changed ? "High" : "Normal", 24, changed ? palette.red : palette.green, 700)}
  ${text(96, 254, "Queue depth", 24, palette.muted)}
  ${text(300, 254, changed ? "243" : "42", 34, changed ? palette.red : palette.ink, 700)}
  ${changed ? `<rect x="96" y="314" width="438" height="58" rx="7" fill="#fee2e2" stroke="${palette.red}"/>${text(120, 351, "Alert: retry storm detected", 26, "#991b1b", 700)}` : `<rect x="96" y="314" width="312" height="58" rx="7" fill="#dcfce7" stroke="${palette.green}"/>${text(120, 351, "System stable", 26, "#166534", 700)}`}
</svg>`;
}

function videoFrameSvg(second) {
  const showButton = second >= 2;
  const showWarning = second >= 5;
  return `<svg width="960" height="640" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="640" fill="${palette.page}"/>
  <rect x="0" y="0" width="960" height="78" fill="${palette.ink}"/>
  ${text(34, 49, `VEL Video Demo T+${second}s`, 26, palette.white, 700)}
  <rect x="120" y="130" width="720" height="360" rx="8" fill="${palette.white}" stroke="${palette.line}"/>
  ${text(162, 190, "Deployment Gate", 34, palette.ink, 700)}
  ${text(162, 244, showButton ? "Action is now available." : "Waiting for release signal.", 28, showButton ? palette.green : palette.muted, 700)}
  ${showButton ? `<rect x="372" y="292" width="216" height="86" rx="10" fill="${palette.blue}"/>${text(423, 346, "Approve", 30, palette.white, 700)}` : ""}
  ${showWarning ? `<rect x="162" y="414" width="478" height="46" rx="6" fill="#fef3c7" stroke="${palette.amber}"/>${text(184, 445, "Warning: billing limit near threshold", 23, "#92400e", 700)}` : ""}
</svg>`;
}

async function main() {
  await png("dashboard.png", dashboardSvg());
  await png("receipt.png", receiptSvg());
  await png("before.png", comparisonSvg(false));
  await png("after.png", comparisonSvg(true));

  const frameDir = await mkdtemp(join(tmpdir(), "vel-glasses-demo-"));
  try {
    for (let i = 0; i < 8; i++) {
      await writeFile(join(frameDir, `frame_${String(i).padStart(4, "0")}.png`), await sharp(Buffer.from(videoFrameSvg(i))).png().toBuffer());
    }
    const outVideo = resolve(outDir, "button-appears.mp4");
    const result = spawnSync("ffmpeg", [
      "-y",
      "-framerate", "1",
      "-i", join(frameDir, "frame_%04d.png"),
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outVideo,
    ], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`ffmpeg failed: ${result.stderr}`);
    }
  } finally {
    await rm(frameDir, { recursive: true, force: true });
  }

  console.log(`Generated demo assets in '${shellEscape(outDir)}'`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
