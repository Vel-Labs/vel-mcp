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
  ink: "#0f172a",
  muted: "#64748b",
  line: "#d5e1ee",
  page: "#eef4fb",
  panel: "#ffffff",
  blue: "#2f6df6",
  blueDark: "#164fc7",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#f59e0b",
  cyan: "#38bdf8",
  white: "#ffffff"
};

function shellEscape(path) {
  return path.replace(/'/g, "'\\''");
}

function text(x, y, content, size = 24, fill = palette.ink, weight = 500) {
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${content}</text>`;
}

function defs() {
  return `<defs>
    <linearGradient id="app-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eaf2ff"/>
      <stop offset="0.48" stop-color="#f7fbff"/>
      <stop offset="1" stop-color="#e8fff7"/>
    </linearGradient>
    <linearGradient id="nav-bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#08111f"/>
      <stop offset="0.55" stop-color="#10243d"/>
      <stop offset="1" stop-color="#0e7490"/>
    </linearGradient>
    <linearGradient id="blue-btn" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
    <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>`;
}

function card(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${palette.panel}" stroke="${palette.line}" filter="url(#soft-shadow)"/>`;
}

function button(x, y, label, fill = "url(#blue-btn)") {
  return [
    `<rect x="${x}" y="${y}" width="168" height="72" rx="12" fill="${fill}"/>`,
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
  ${defs()}
  <rect width="960" height="640" fill="url(#app-bg)"/>
  <rect x="0" y="0" width="960" height="86" fill="url(#nav-bg)"/>
  <circle cx="43" cy="43" r="14" fill="${palette.cyan}" opacity="0.9"/>
  <circle cx="43" cy="43" r="6" fill="${palette.white}"/>
  ${text(70, 53, "VEL Ops Console", 28, palette.white, 700)}
  <rect x="706" y="24" width="168" height="38" rx="19" fill="#12385d" stroke="#2dd4bf"/>
  ${text(732, 50, "Agent Mode", 20, "#d9fbff", 700)}
  ${card(34, 116, 280, 174)}
  ${text(58, 156, "Queue", 28, palette.ink, 700)}
  ${text(58, 198, "Open tasks", 22, palette.muted)}
  ${text(220, 198, "17", 34, palette.blue, 700)}
  ${button(58, 226, "Review")}
  ${card(354, 116, 280, 174)}
  ${text(378, 156, "Deploy", 28, palette.ink, 700)}
  ${text(378, 198, "Last run", 22, palette.muted)}
  <rect x="514" y="170" width="62" height="36" rx="18" fill="#dcfce7"/>
  ${text(532, 196, "OK", 24, palette.green, 700)}
  ${showButton ? button(398, 226, "Approve") : text(398, 262, "Pending signal", 24, palette.muted, 700)}
  ${card(674, 116, 252, 174)}
  ${text(698, 156, "Health", 28, palette.ink, 700)}
  ${text(698, 198, "Region", 22, palette.muted)}
  ${text(798, 198, "US-C", 26, palette.ink, 700)}
  ${button(698, 226, "Details", "#6b7c93")}
  ${card(34, 330, 892, 226)}
  ${text(58, 372, "Incident Notes", 28, palette.ink, 700)}
  ${text(58, 416, primaryNote, 24, palette.ink)}
  ${text(58, 456, secondaryNote, 24, palette.muted)}
  ${showWarning ? `<rect x="58" y="492" width="584" height="46" rx="8" fill="#fff7d6" stroke="${palette.amber}"/>${text(78, 523, "Warning: billing limit near threshold", 22, "#92400e", 700)}` : ""}
</svg>`;
}

function receiptSvg() {
  return `<svg width="720" height="920" xmlns="http://www.w3.org/2000/svg">
  ${defs()}
  <rect width="720" height="920" fill="url(#app-bg)"/>
  <rect x="108" y="42" width="504" height="836" rx="14" fill="${palette.white}" stroke="${palette.line}" filter="url(#soft-shadow)"/>
  <rect x="108" y="42" width="504" height="92" rx="14" fill="url(#nav-bg)"/>
  ${text(158, 101, "VEL DEMO RECEIPT", 30, palette.white, 700)}
  ${text(158, 176, "Receipt ID: VEL-0427", 24)}
  ${text(158, 220, "Date: 2026-06-14", 24)}
  <line x1="158" y1="264" x2="562" y2="264" stroke="${palette.line}" stroke-width="2"/>
  ${text(158, 318, "Vision adapter setup", 23)}
  ${text(470, 318, "$24.00", 23)}
  ${text(158, 372, "Frame sampling check", 23)}
  ${text(470, 372, "$12.50", 23)}
  ${text(158, 426, "OCR validation", 23)}
  ${text(470, 426, "$8.75", 23)}
  <line x1="158" y1="486" x2="562" y2="486" stroke="${palette.line}" stroke-width="2"/>
  ${text(158, 548, "Total", 32, palette.ink, 700)}
  ${text(448, 548, "$45.25", 32, palette.ink, 700)}
  <rect x="158" y="620" width="404" height="76" rx="12" fill="#dcfce7" stroke="${palette.green}"/>
  ${text(200, 668, "Status: PAID", 29, "#166534", 700)}
  ${text(158, 768, "Ask an agent to extract:", 23, palette.muted)}
  ${text(158, 810, "receipt id, date, total, status", 23, palette.muted)}
</svg>`;
}

function comparisonSvg(changed) {
  return `<svg width="960" height="540" xmlns="http://www.w3.org/2000/svg">
  ${defs()}
  <rect width="960" height="540" fill="url(#app-bg)"/>
  ${card(60, 66, 840, 386)}
  <rect x="60" y="66" width="840" height="74" rx="10" fill="url(#nav-bg)"/>
  ${text(96, 114, "Service Status", 32, palette.white, 700)}
  ${text(96, 192, "API latency", 24, palette.muted)}
  <rect x="300" y="168" width="420" height="34" rx="17" fill="#dbeafe"/>
  <rect x="300" y="168" width="${changed ? 345 : 210}" height="34" rx="17" fill="${changed ? palette.red : palette.green}"/>
  ${text(740, 195, changed ? "High" : "Normal", 24, changed ? palette.red : palette.green, 700)}
  ${text(96, 270, "Queue depth", 24, palette.muted)}
  ${text(300, 270, changed ? "243" : "42", 36, changed ? palette.red : palette.ink, 700)}
  ${changed ? `<rect x="96" y="338" width="454" height="62" rx="9" fill="#fee2e2" stroke="${palette.red}"/>${text(120, 378, "Alert: retry storm detected", 26, "#991b1b", 700)}` : `<rect x="96" y="338" width="322" height="62" rx="9" fill="#dcfce7" stroke="${palette.green}"/>${text(120, 378, "System stable", 26, "#166534", 700)}`}
</svg>`;
}

function videoFrameSvg(second) {
  const showButton = second >= 2;
  const showWarning = second >= 5;
  return `<svg width="960" height="640" xmlns="http://www.w3.org/2000/svg">
  ${defs()}
  <rect width="960" height="640" fill="url(#app-bg)"/>
  <rect x="0" y="0" width="960" height="86" fill="url(#nav-bg)"/>
  ${text(34, 54, `VEL Video Demo T+${second}s`, 27, palette.white, 700)}
  ${card(118, 132, 724, 374)}
  <rect x="118" y="132" width="724" height="82" rx="10" fill="#f8fbff"/>
  ${text(162, 190, "Deployment Gate", 34, palette.ink, 700)}
  ${text(162, 262, showButton ? "Action is now available." : "Waiting for release signal.", 28, showButton ? palette.green : palette.muted, 700)}
  ${showButton ? `<rect x="372" y="312" width="216" height="86" rx="12" fill="url(#blue-btn)"/>${text(423, 366, "Approve", 30, palette.white, 700)}` : ""}
  ${showWarning ? `<rect x="162" y="430" width="478" height="48" rx="8" fill="#fff7d6" stroke="${palette.amber}"/>${text(184, 462, "Warning: billing limit near threshold", 23, "#92400e", 700)}` : ""}
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
