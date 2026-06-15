# Glasses UX Workflows

This document defines how an agent harness should use `vel-glasses` for image, screenshot, and local website review. The goal is an intuitive visual layer: users can provide a visual reference plus a focus request, and the agent can choose a deterministic tool sequence without guessing.

## Core Principle

Use the models as complementary specialists:

- LocateAnything answers **where is it?** Use it for GUI elements, text spans, boxes, points, and candidate regions.
- Qwen3-VL answers **what does it mean?** Use it for whole-image descriptions, visual QA, design critique, and focused region reasoning.

Do not silently run every model for every request. Use the tandem flow when the user asks about a specific focus area, click target, design issue, or confidence check.

## Current Tool Primitives

| Tool | Primary model lane | Use when |
|------|--------------------|----------|
| `glasses.inspect_image` | `general_vlm` | User asks what is visible, asks for a design read, or gives no specific target. |
| `glasses.locate` | `grounding` | User names an element, button, object, text-ish target, or region to find. |
| `glasses.ocr` | `grounding` / OCR | User asks what text is visible or the screen is text-heavy. |
| `glasses.inspect_region` | crop + `general_vlm`, optional local locate | User asks about a specific area or after `locate` returns a region to inspect. |

## Flow A: Image With Focus Request

Example user request:

> Look at this dashboard image and focus on the approval area. Does it look ready to ship?

Agent sequence:

1. Call `glasses.inspect_image` on the full image for whole-screen context.
2. Call `glasses.locate` with the focus phrase, such as `"approval area"` or `"Approve button"`.
3. If `locate` returns a usable box, call `glasses.inspect_region` on that box with the user focus as `query`.
4. If visible text matters, call `glasses.ocr` on the full image or on the region.
5. Return:
   - whole-image notes,
   - focus-area notes,
   - coordinates/evidence,
   - uncertainty,
   - suggested next action.

Expected response shape:

```json
{
  "summary": "Brief answer to the user's question.",
  "wholeImage": ["Observation about layout/context."],
  "focusArea": {
    "query": "Approve button",
    "bboxNorm1000": [414, 352, 589, 465],
    "notes": ["Focused observation about the target area."]
  },
  "text": ["Relevant OCR snippets."],
  "uncertainty": ["Any weak evidence or missing context."],
  "nextActions": ["Recommended design or QA step."]
}
```

## Flow B: Image Without Focus Request

Example user request:

> What do you see in this screenshot?

Agent sequence:

1. Call `glasses.inspect_image`.
2. If the result indicates text-heavy UI or the user asks about copy, call `glasses.ocr`.
3. Do not call `glasses.locate` unless a target emerges from the user's question or the answer needs coordinates.

## Flow C: Find or Click Target

Example user request:

> What should I click to approve the deployment?

Agent sequence:

1. Call `glasses.locate` with `targetType: "gui"` and `outputType: "both"`.
2. Optionally call `glasses.inspect_region` on the returned box when confidence is low or the action is important.
3. Return label, `bboxNorm1000`, `centerNorm1000`, confidence/uncertainty, and reasoning.
4. Do not click automatically. `glasses.locate` returns perception, not automation.

## Flow D: Webpage URL or Localhost

`vel-glasses` can capture bounded screenshots with `glasses.capture_url`, then analyze the resulting screenshot artifact.

For a request like:

> Look at `http://localhost:3000` and tell me whether the pricing section is clear.

Agent sequence:

1. Call `glasses.capture_url` with the URL and bounded viewport/full-page options.
2. Pass the returned `artifactId` to `glasses.review_visual` as `screenshotArtifactId`.
3. If the user names a page section, provide that phrase as `focus` so review runs LocateAnything and region inspection.
4. For long pages, capture bounded full-page slices or multiple viewport screenshots, then review each slice with frame/page identifiers.

## Flow E: Design Revision Loop

Example user request:

> I changed the CTA area. Compare before and after and tell me if it improved.

Agent sequence:

1. Call `glasses.compare` for metadata/pixel/layout diff.
2. Call `glasses.locate` on the changed target or CTA area in both images.
3. Call `glasses.inspect_region` on the before and after boxes.
4. Return a concise change review with:
   - what changed,
   - whether the focus area improved,
   - any regressions in copy, contrast, spacing, or hierarchy,
   - coordinates and uncertainty.

## Prompting Guidance For Host LLMs

When the user provides an image:

- If they ask "what do you see", use `inspect_image`.
- If they ask "where", "which button", "click", "target", or name a visual element, use `locate`.
- If they mention text/copy/content, use `ocr`.
- If they provide a focus phrase, use `locate` then `inspect_region`.
- If the first result is uncertain, use the other lane for verification.

When the user provides a URL:

- Capture a screenshot first.
- Do not pass the URL directly as a webpage to `glasses` unless the URL points to an image file and HTTP image loading is enabled.
- Tell the user when only the visible viewport was reviewed.

## Implementation Roadmap

1. Harden `glasses.review_visual` with real eval fixtures and UX-specific scoring.
2. Add eval fixtures for:
   - focus query over a dashboard,
   - text-heavy screen,
   - no-text visual composition,
   - before/after CTA revision,
   - low-confidence target requiring Qwen verification.
3. Decide whether `glasses.review_ui` should become an alias or remain a `review_visual` mode.
