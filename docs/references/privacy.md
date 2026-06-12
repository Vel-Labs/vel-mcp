# Privacy reference notes

## Scope

Privacy is intentionally later than Glasses. This document preserves the architecture decisions so the implementation does not accidentally become a model-visible redaction tool.

## OpenAI Privacy Filter

Use as one detector provider, not as a complete privacy solution. The model card describes a bidirectional token-classification model for PII detection/masking with categories including account number, address, email, private person, phone, URL, private date, and secret.

Implementation notes:

- run locally when possible;
- calibrate precision/recall per policy;
- combine with regex/rule detectors;
- require human review for high-risk flows;
- never claim anonymization/compliance guarantees.

## PromptZero pattern

PromptZero demonstrates a local proxy pattern:

```text
raw prompt → local detection → synthetic replacement → model provider → response → local rehydration
```

VEL should borrow the pattern, but keep the rehydration map hidden from any LLM-visible MCP tools.

## VEL privacy components

- `privacy-gateway`: pre-model proxy/hook.
- `redactor-provider`: OpenAI Privacy Filter, regex, Presidio, custom rules.
- `synthetic-mapper`: deterministic fake values by type.
- `review-ui-contract`: A/B visual review payload.
- `audit-log`: hash-chained proof that a redaction pass occurred.
- `privacy-mcp` later: safe stats and review control only.
