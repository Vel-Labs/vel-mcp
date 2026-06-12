# MCP SDK reference notes

## Current SDK decision

Use `@modelcontextprotocol/sdk` v1.x for production-oriented scaffolding, but keep SDK imports inside `@vel/mcp-base`.

The official TypeScript SDK repository currently documents v2 split packages (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`) on `main`, while also stating that v1.x remains recommended for production until stable v2 is released.

## Adapter requirements

`@vel/mcp-base` must expose:

- `createVelServer`
- `registerVelTool`
- `connectStdio`
- `toMcpJsonResult`
- `toMcpErrorResult`

No other VEL package should import MCP SDK packages directly.

## Tool schema rules

- Tool names use `module.action`, e.g. `glasses.locate`.
- Tool descriptions are short and usage-oriented.
- Input schemas are precise and forbid additional properties unless extensibility is intended.
- Outputs use a stable JSON envelope.
