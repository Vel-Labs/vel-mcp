# Package roadmap: `@vel/mcp-base`

## Purpose

Centralize MCP SDK details so capability packages do not break when the SDK changes.

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

- [ ] Choose production SDK version.
- [ ] Implement server creation.
- [ ] Implement stdio transport.
- [ ] Implement tool registration against both `registerTool` and `tool` APIs.
- [ ] Add smoke test that lists tools through MCP Inspector or a simple JSON-RPC fixture.

Acceptance:

- Other packages import no MCP SDK modules directly.

## Milestone M1 — Tool spec format

Tasks:

- [ ] Define `VelToolSpec` with name, title, description, input schema, optional output schema, handler.
- [ ] Require tool names matching `^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$`.
- [ ] Require descriptions under 800 characters.
- [ ] Support examples in docs, not oversized tool descriptions.

Acceptance:

- Invalid tool specs fail at server startup.

## Milestone M2 — Result envelopes

Tasks:

- [ ] Define JSON result envelope.
- [ ] Include schema version.
- [ ] Include provider metadata where relevant.
- [ ] Include warnings array.
- [ ] Include structured error format.

Acceptance:

- All tool handlers return consistent JSON content.

## Milestone M3 — Transport policy

Tasks:

- [ ] Support stdio first.
- [ ] Add Streamable HTTP later behind explicit config.
- [ ] For local HTTP, bind to `127.0.0.1` by default.
- [ ] Validate origin/host headers in HTTP mode.

Acceptance:

- Default dev server is safe for local agent clients.
