export const AGENT_SKILL_RELATIVE_PATH = ".vel/skills/vel-glasses/SKILL.md";
export const AGENT_INSTRUCTIONS_BEGIN = "<!-- VEL-GLASSES:BEGIN -->";
export const AGENT_INSTRUCTIONS_END = "<!-- VEL-GLASSES:END -->";

export function agentSkillText(serverName: string): string {
  return `# Vel Glasses Visual Skill

Use this skill when the user asks an agent to look at an image, screenshot, UI, webpage, local app, video frame, visual design, visible text, or click target. The user does not need to mention MCP or tool names.

## MCP Server

Use the configured MCP server named \`${serverName}\`.

## Natural Language Routing

- If the user attaches an image or video, use that current attachment's available file path or artifact reference. Do not substitute earlier examples, prior test images, or filenames from conversation history.
- If the host agent cannot access the attachment path, ask the user to save the file under an allowed image root such as the current project or \`~/vel/glasses/inputs\`, then retry with that path.
- If the user asks "what do you see", "describe this", "review this screenshot", "does this look right", or asks for visual/design feedback, call \`glasses.review_visual\`.
- If the user includes a focus phrase such as "focus on the checkout area", "look at the dialogue box", "inspect the button", or "check the right panel", call \`glasses.review_visual\` with \`focus\`.
- If the user asks where something is, what to click, which button, target coordinates, or asks for a GUI element, call \`glasses.locate\`.
- If the user asks what text is visible, asks about copy, or the image is text-heavy, call \`glasses.ocr\` or use \`glasses.review_visual\` in \`ui_review\` mode.
- If the user gives a URL or localhost address, call \`glasses.capture_url\` first, then pass the returned \`artifactId\` to \`glasses.review_visual\` as \`screenshotArtifactId\`.
- If the user compares before/after images, use \`glasses.compare\`, then \`glasses.review_visual\` on the relevant focus area.
- If the user gives video, use \`glasses.video_scan\` with bounded \`fps\`, \`maxDurationSec\`, and \`maxBytes\`.

## Tool Defaults

- Use \`mode: "ui_review"\` for app screens, websites, dashboards, forms, game UI, and social/media screenshots.
- Use \`mode: "target_check"\` when the user needs a specific target, object, text span, button, or coordinates.
- Use \`mode: "design_revision"\` for before/after visual changes.
- Return structured observations, coordinates, evidence, OCR snippets when relevant, uncertainty, and suggested next actions.
- Do not claim certainty when the tool reports missing confidence or weak grounding.
- Do not click, type, browse, or mutate external state just because \`glasses.locate\` returns coordinates.

## Model Roles

- LocateAnything is the grounding lane. Use it for boxes, points, GUI targets, and localized text. It is not a general image narrator.
- Qwen3-VL is the general visual reasoning lane. Use it for whole-image descriptions, critique, and focused region interpretation. It is slower and less precise for click coordinates.
- \`glasses.review_visual\` is the preferred orchestrator when the user's request mixes image understanding, focus regions, OCR, and confidence checks.

## Response Style

- Answer the user's actual question, not the internal tool plan.
- Mention the tool only when useful for transparency.
- Keep the answer scoped to the current image, URL, or video. Do not summarize other known images unless the user explicitly asks for comparison.
- If the user asks for a short description, return a short description. If they ask for details, organize details by visible region.
- Include normalized coordinates as \`bboxNorm1000\` and \`centerNorm1000\` when target location matters.
- State when only the visible viewport was reviewed for URL captures.
- Keep observations grounded in the image; mark interpretations as uncertainty.
`;
}

export function agentInstructionsText(skillRelativePath: string): string {
  return `## Vel Glasses MCP

When the user asks visual questions about images, screenshots, UI, local webpages, video frames, visible text, or click targets, use the local Vel Glasses MCP server instead of answering from text alone.

Read ${skillRelativePath} for routing rules. In short:

- Use \`glasses.review_visual\` for normal visual review and focused screenshot questions.
- Use \`glasses.locate\` for "where is it", click targets, buttons, objects, and coordinate requests.
- Use \`glasses.ocr\` for visible text and copy-heavy screenshots.
- Use \`glasses.capture_url\` before reviewing a URL or localhost page.
- For attachments, use the current attachment path or artifact reference only. If it is unavailable, ask the user to save it under the project or \`~/vel/glasses/inputs\`.
- Return observations, evidence, coordinates, OCR snippets when relevant, and uncertainty.`;
}
