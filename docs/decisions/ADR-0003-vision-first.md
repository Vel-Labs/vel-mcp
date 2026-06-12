# ADR-0003: Build Glasses first

Status: accepted for scaffold.

## Decision

The first functional VEL module is `vel-glasses-mcp`.

## Rationale

Vision gives immediate measurable value to text-only and multimodal LLMs. It has clear benchmarks: OCR exact match, bounding-box IoU, GUI grounding distance, and task success. It also proves the VEL substrate: artifacts, worker lifecycle, provider routing, structured outputs, and evals.

## Consequences

- Core and MCP-base must be just enough to support Glasses.
- Privacy is designed but postponed.
- Speech and Brain receive roadmaps and stubs but are not first implementation targets.
