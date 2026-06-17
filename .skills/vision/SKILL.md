# Vel Glasses — Vision (images, screenshots, UI, documents)

Use this skill when the user asks about what's in an image, screenshot, UI, webpage, document, or design — or asks for visual review, description, or comparison. The user does not need to mention tool names.

## Routing

| User says | Call |
|-----------|------|
| "what do you see", "describe this", "review this" | `glasses.review_visual` |
| "where is the X", "which button", "click target", "find" | `glasses.locate` |
| "read this", "extract text", "what does this say" | `glasses.ocr` |
| "compare these", "what changed", "before/after" | `glasses.compare` then `glasses.review_visual` |
| "look at this URL", "check localhost:3000" | `glasses.capture_url` then `glasses.review_visual` |
| "does this look right", "any issues" | `glasses.detect_anomalies` |
| "describe this image" | `glasses.describe` |
| "what is this" or free-form visual question | `glasses.ask` |
| "read this document" | `glasses.read_document` |

## Defaults

- Use `mode: "ui_review"` for app screens, websites, dashboards.
- Use `mode: "target_check"` for find-the-button requests.
- Use `mode: "design_revision"` for before/after comparisons.
- Always return observations, evidence, coordinates, and uncertainty.
- Do not claim certainty when the tool reports weak grounding.
- Do not click, type, or mutate state. Glasses is perception only.

## Models

- LocateAnything: grounding — boxes, points, GUI targets, localized text. Not a general narrator.
- Qwen3-VL: general VLM — descriptions, reasoning, critique. Slower and less precise for coordinates.
- `glasses.review_visual` is the preferred orchestrator when the user's request mixes understanding + focus + OCR.
