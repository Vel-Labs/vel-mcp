# Package roadmap: `@vel/privacy-gateway`

## Purpose

Privacy protects data before it reaches any LLM. It is intentionally last because incorrect implementation creates a false sense of security.

## Components

```text
privacy-gateway/
  detector providers
  synthetic mapper
  local encrypted mapping table
  A/B review payloads
  response rehydration
  audit chain
  optional HTTP proxy / SDK hook
```

## Milestone P0 — Threat model

Tasks:

- [ ] Define trusted boundary.
- [ ] Define attacker assumptions: model provider, malicious prompt text, malicious image text, compromised MCP tool, untrusted URL.
- [ ] Define what privacy does and does not guarantee.
- [ ] Add warning copy to README and review UI.

Acceptance:

- No docs claim anonymization, compliance, or perfect redaction.

## Milestone P1 — Detector provider contract

Tasks:

- [ ] Define span format: start, end, label, score, detector, policy.
- [ ] Implement regex detector for secrets, keys, IPs, hostnames, emails.
- [ ] Implement OpenAI Privacy Filter provider later.
- [ ] Merge overlapping spans deterministically.
- [ ] Add tests for overlap and false-positive policy.

Acceptance:

- Raw text produces a sorted, merged span list.

## Milestone P2 — Synthetic mapper

Tasks:

- [ ] Map real values to type-preserving fake values.
- [ ] Preserve consistency within a session.
- [ ] Use HMAC-based placeholder IDs.
- [ ] Encrypt local mapping at rest.
- [ ] Never expose reverse map to MCP tools.

Acceptance:

- Same input within a session maps consistently; different sessions can rotate.

## Milestone P3 — A/B review contract

Tasks:

- [ ] Generate original vs sanitized diff.
- [ ] Highlight span categories.
- [ ] Allow manual add/remove span edits.
- [ ] Record human approval event.
- [ ] Generate response vs rehydrated response diff.

Acceptance:

- User can verify exactly what crosses the boundary.

## Milestone P4 — Gateway integration

Tasks:

- [ ] Implement local HTTP proxy mode.
- [ ] Implement SDK hook mode.
- [ ] Add provider-specific adapters later.
- [ ] Ensure no raw prompt is logged.
- [ ] Add replay-safe mapping lookup.

Acceptance:

- A prompt can be sanitized before provider call and rehydrated after response.

## Milestone P5 — OpenAI Privacy Filter provider

Tasks:

- [ ] Pin repo/model commit.
- [ ] Verify hashes.
- [ ] Load locally through Python or Transformers.js.
- [ ] Map labels to VEL policy labels.
- [ ] Add calibration settings.
- [ ] Add in-domain eval harness.

Acceptance:

- Detector results include model version, operating point, and limitations.

## Explicit non-goals

- Do not let LLM call `privacy.restore`.
- Do not automatically send raw prompt to LLM for redaction.
- Do not claim formal anonymization.
- Do not implement ZK proof in MVP. Start with tamper-evident audit logs.
