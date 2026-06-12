# Package roadmap: `@vel/mcp-base`

## Purpose

Centralize MCP SDK details so capability packages do not break when the SDK changes.

## Design decisions (from Phase 1 discussion, 2026-06-07)

- **Tool spec examples**: `VelToolSpec` gains `examples?: Array<{ description: string; input: Record<string, unknown> }>`. Included in MCP `tools/list` metadata.
- **Audit log integration**: `registerVelTool` wraps handlers with audit `append()` calls (before/after tool execution). Tool call audit events include package, operation, timing, and redacted input.
- **Description validation**: descriptions under 800 characters, enforced at registration time.

## Public API target

```ts
export function createVelServer(options): VelMcpServer;
export function registerVelTool(server, spec): void;
export function connectStdio(server): Promise<void>;
export function toMcpJsonResult(payload): McpToolResult;
export function toMcpErrorResult(error): McpToolResult;
```

## Milestone M0 — SDK adapter

Tasks:

- [x] Choose production SDK version (`@modelcontextprotocol/sdk` v1.29.0).
- [x] Implement server creation.
- [x] Implement stdio transport.
- [x] Implement tool registration against both `registerTool` and `tool` APIs.
- [x] Add smoke test (lives in `scripts/smoke-glasses.sh`).

Acceptance:

- Other packages import no MCP SDK modules directly.

## Milestone M1 — Tool spec format

Tasks:

- [x] Define `VelToolSpec` with name, title, description, input schema, handler.
- [x] Require tool names matching `^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$`.
- [ ] Require descriptions under 800 characters — validate at registration.
- [ ] Add `examples` field: `{ description: string; input: Record<string, unknown> }[]`. Pass through to MCP `tools/list` metadata.
- [ ] Add optional `outputSchema` field for tools that want to declare their return shape.

Acceptance:

- Invalid tool specs fail at server startup.
- `tools/list` returns rich metadata including examples where provided.

## Milestone M2 — Result envelopes

Tasks:

- [x] Define JSON result envelope (`VelResultEnvelope`).
- [x] Include schema version (`"2026-06-06"`).
- [x] Include provider metadata where relevant.
- [x] Include warnings array.
- [x] Include structured error format.

Acceptance:

- All tool handlers return consistent JSON content.

## Milestone M3 — Transport policy

Tasks:

- [x] Support stdio first.
- [ ] Add Streamable HTTP later behind explicit config.
- [ ] For local HTTP, bind to `127.0.0.1` by default.
- [ ] Validate origin/host headers in HTTP mode.

Acceptance:

- Default dev server is safe for local agent clients.
