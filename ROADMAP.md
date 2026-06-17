# VEL-MCP Roadmap

Completed phases (0–5): see [ROADMAP-ARCHIVE.md](./ROADMAP-ARCHIVE.md).
Sprint gap closure: see [sprint_roadmap.md](./sprint_roadmap.md) (not tracked in git).

---

## Current state (2026-06-16)

`@vel/glasses-mcp` ships 14 MCP tools covering image inspection, spatial grounding (LocateAnything), OCR, comparison, video scan with temporal reasoning, URL capture (Playwright), and full visual review. 127 tests. Mock and MLX providers operational. Provider registry with role-based routing. Content-addressable artifact store, hash-chained audit log, lazy worker supervisor with sliding-window restart tracking. Installer (`vel-mcp`) published to npm for one-command Agent project bootstrap.

## Phase 6 — Brain MCP

Goal: local inspectable memory/wiki, not autonomous hidden memory.

Tools:

- `brain.search`
- `brain.read`
- `brain.propose_write`
- `brain.commit_write`
- `brain.forget`
- `brain.link`

Acceptance criteria:

- Memory writes require either explicit user approval or a local policy file allowing that scope.
- Search returns snippets, source note IDs, and confidence; it does not dump the whole wiki.

## Phase 7 — Speech MCP

Goal: local TTS artifact generation first; STT later.

Tools:

- `speech.synthesize`
- `speech.list_voices`
- `speech.transcribe` later

Acceptance criteria:

- TTS returns an audio artifact handle with format, duration, provider, and sample rate metadata.

## Phase 8 — Privacy Gateway

Goal: pre-model redaction and response rehydration with local-only mapping.

Components:

- local proxy/gateway
- privacy detector provider interface
- OpenAI Privacy Filter provider
- regex/rule provider
- deterministic synthetic mapper
- A/B review UI contract
- tamper-evident audit log

Acceptance criteria:

- Raw sensitive input can be transformed to synthetic input before reaching an LLM.
- The LLM-visible layer cannot resolve placeholders.
- The user can visually compare original vs sanitized and model response vs restored response.
