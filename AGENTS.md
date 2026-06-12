# Coding Agent Instructions for VEL-MCP

This repo is intended to be implemented by coding agents. Treat this document as the working contract.

## Current priority

Implement the vision layer first:

1. `packages/core`
2. `packages/mcp-base`
3. `packages/glasses-mcp`
4. `evals/glasses`

Do **not** implement `privacy-gateway` before the vision layer is functional, benchmarked, and stable.

## Non-negotiable architecture constraints

1. Do not make one mega-MCP containing all tools.
2. Do not preload specialist models at MCP server startup.
3. Do not let any model-visible tool access privacy rehydration maps.
4. Do not put raw image bytes into logs.
5. Do not write anything except MCP JSON-RPC messages to stdout in MCP servers.
6. Put operational logs on stderr or in the audit store.
7. Keep all tool outputs structured and deterministic.
8. Use normalized coordinates `[0, 1000]` as the internal canonical coordinate space; add pixel coordinates only when image dimensions are known.
9. Add provider metadata and confidence/uncertainty to every non-trivial result.
10. Every long-running model call must have timeout, cancellation, and explicit error objects.

## Code style

- TypeScript packages use ESM.
- Prefer small modules with explicit exported interfaces.
- Avoid hidden global state except the `WorkerSupervisor` registry.
- Tool handlers should be thin. Business logic belongs in providers/services.
- Validate all external inputs.
- Use artifact handles instead of raw file paths where possible.
- Tests must cover both success and structured failure paths.

## MCP SDK compatibility

The MCP TypeScript SDK is changing. Keep SDK-specific imports inside `packages/mcp-base`. Other packages should register VEL tool specs through the base adapter.

## Vision implementation rules

- `glasses.locate` returns points/boxes; it does not write click automation.
- `glasses.ocr` returns text spans with regions and reading order.
- `glasses.inspect_image` returns observations, not open-ended essays.
- `glasses.video_scan` returns frame/timestamp manifests and events; never silently process an unbounded video.
- LocateAnything-specific parsing belongs in `src/parsers/locateAnything.ts` and the Python worker package.

## Privacy implementation rules for later

- Privacy is not a normal MCP-first package.
- The redaction gateway runs before prompts reach any LLM or agent harness.
- The rehydration map must never be visible to an LLM tool.
- Any automated redaction flow must have optional A/B human review.
