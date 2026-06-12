# ADR-0001: Use modular MCP servers, not one mega-MCP

Status: accepted for scaffold.

## Decision

VEL is a single ecosystem with multiple MCP servers by capability:

- `vel-glasses-mcp`
- `vel-brain-mcp`
- `vel-speech-mcp`
- `vel-control-mcp`
- limited `vel-privacy-mcp` later, with privacy gateway separate

## Rationale

Each capability has different permissions, dependencies, hardware needs, and trust boundaries. Modularity keeps the tool surface smaller and allows workers to lazy-load only when called.

## Consequences

- The install/config story must hide multi-server complexity.
- A `vel-control-mcp` can expose status across modules.
- Shared runtime code belongs in `@vel/core`.
