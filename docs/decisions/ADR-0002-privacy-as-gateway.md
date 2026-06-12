# ADR-0002: Privacy must be a gateway first

Status: accepted for scaffold.

## Decision

Privacy redaction and rehydration live in a pre-model gateway/hook. A future privacy MCP may expose only safe metadata and review operations.

## Rationale

If an LLM decides to call a redaction tool after receiving raw prompt text, privacy has already failed. The gateway must transform content before it reaches any LLM or agent harness.

## Consequences

- The rehydration map is never model-visible.
- The privacy package has a different deployment model than the other MCPs.
- A/B review is part of the product, not an optional afterthought.
