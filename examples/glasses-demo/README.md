# VEL Glasses Demo Pack

This pack contains generated, royalty-free assets for validating whether a local or cloud LLM can use VEL Glasses through MCP.

## Assets

- `dashboard.png` - UI screenshot with buttons, notes, and a warning.
- `receipt.png` - document/OCR image with receipt fields.
- `before.png` and `after.png` - comparison/anomaly pair.
- `button-appears.mp4` - short video where the blue approval button appears after the first two seconds and a warning appears later.

Regenerate the assets with:

```bash
node examples/glasses-demo/generate-assets.mjs
```

## Direct CLI Checks

Build first:

```bash
pnpm build
```

Locate the approval button:

```bash
VEL_VISION_PYTHON=.vel/venvs/glasses-mlx/bin/python \
VEL_VISION_MODEL=/Users/steven/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16 \
node packages/glasses-mcp/dist/cli.js --provider glasses-grounding locate \
  examples/glasses-demo/dashboard.png "Approve button" \
  --target-type gui --output-type point
```

Locate multiple blue buttons:

```bash
VEL_VISION_PYTHON=.vel/venvs/glasses-mlx/bin/python \
VEL_VISION_MODEL=/Users/steven/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16 \
node packages/glasses-mcp/dist/cli.js --provider glasses-grounding locate \
  examples/glasses-demo/dashboard.png "blue buttons" \
  --target-type any --output-type box
```

Scan the video:

```bash
VEL_VISION_PYTHON=.vel/venvs/glasses-mlx/bin/python \
VEL_VISION_MODEL=/Users/steven/30_AI-Lab/_cache/models/mlx-community/LocateAnything-3B-bf16 \
node packages/glasses-mcp/dist/cli.js --provider glasses-grounding video-scan \
  examples/glasses-demo/button-appears.mp4 \
  --every-seconds 1 \
  --max-frames 8 \
  --max-duration-sec 8 \
  --query "blue Approve button"
```

## Agent Integration Prompts

Use these prompts in any MCP-capable agent configured with `vel-glasses-mcp`.

### GUI Grounding

Prompt:

```text
Look at examples/glasses-demo/dashboard.png. What should I click to approve the deployment? Return the target label and normalized coordinates. Do not click anything.
```

Expected tool behavior:

- Calls `glasses.locate` with `query` similar to `Approve button`.
- Uses `targetType: "gui"` or `targetType: "any"`.
- Answers from `centerNorm1000` or `bboxNorm1000`.

### OCR / Document

Prompt:

```text
Read examples/glasses-demo/receipt.png and extract the receipt id, date, total, and status.
```

Expected tool behavior:

- Calls `glasses.ocr` or `glasses.read_document`.
- Returns fields derived from tool output, not from guessing.

### Comparison

Prompt:

```text
Compare examples/glasses-demo/before.png and examples/glasses-demo/after.png. What changed?
```

Expected tool behavior:

- Calls `glasses.compare` or `glasses.detect_anomalies`.
- Reports the changed warning/status region.

### Video

Prompt:

```text
Scan examples/glasses-demo/button-appears.mp4. When does the blue Approve button become visible? Return timestamps and frame references.
```

Expected tool behavior:

- Calls `glasses.video_scan` with bounded sampling, such as `everySeconds: 1`, `maxFrames: 8`, and `maxDurationSec: 8`.
- Returns timestamped frame/event data. The first expected target event is at about `2` seconds.

## Pass Criteria

The agent is "wearing the glasses" when it calls VEL tools and grounds its answer in structured tool output. A direct multimodal answer without a VEL tool call does not prove MCP integration.
