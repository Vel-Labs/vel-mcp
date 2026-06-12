import { existsSync } from "node:fs";

const required = [
  "packages/core/src/index.ts",
  "packages/mcp-base/src/server.ts",
  "packages/glasses-mcp/src/server.ts",
  "packages/glasses-mcp/workers/locate-anything/vel_locate_anything_worker/main.py",
  "docs/package-roadmaps/glasses-mcp.md",
  "evals/glasses/dataset.schema.json"
];

let ok = true;
for (const path of required) {
  if (!existsSync(path)) {
    console.error(`Missing required scaffold file: ${path}`);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log("VEL scaffold structural verification passed.");
