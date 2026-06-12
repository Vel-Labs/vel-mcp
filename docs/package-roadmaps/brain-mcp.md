# Package roadmap: `@vel/brain-mcp`

## Purpose

Brain is a local, inspectable memory/wiki. It should never be hidden autonomous memory.

## Storage design

```text
~/.vel/brain/
  notes/
    projects/
    people/
    decisions/
    preferences/
  index/
    fts.sqlite
    embeddings.sqlite
  proposals/
  audit/
```

## Tool surface

| Tool | Purpose |
|---|---|
| `brain.search` | Search notes/snippets. |
| `brain.read` | Read a specific note by ID. |
| `brain.propose_write` | Propose a memory/wiki write. |
| `brain.commit_write` | Commit an approved proposal. |
| `brain.forget` | Delete or tombstone a note. |
| `brain.link` | Link notes/entities. |
| `brain.timeline` | Return event timeline for an entity/project. |

## Milestone B0 — Wiki store

Tasks:

- [ ] Define note ID format.
- [ ] Define note frontmatter schema.
- [ ] Implement Markdown file read/write.
- [ ] Implement tombstone deletes.
- [ ] Implement source provenance.
- [ ] Add tests for path traversal and frontmatter validation.

Acceptance:

- Notes can be created, read, listed, and tombstoned locally.

## Milestone B1 — Search

Tasks:

- [ ] Implement simple full-text search first.
- [ ] Return snippets, note ID, title, tags, score.
- [ ] Add scopes: project, people, decisions, preferences.
- [ ] Add recency and pin boosts.

Acceptance:

- Search returns minimal relevant snippets, not whole notes.

## Milestone B2 — Approval flow

Tasks:

- [ ] Implement `propose_write` that writes proposal file.
- [ ] Implement `commit_write` that requires approval token or policy.
- [ ] Implement diff preview.
- [ ] Add audit events for proposals and commits.

Acceptance:

- No permanent memory write occurs silently.

## Milestone B3 — Embeddings optional

Tasks:

- [ ] Add provider interface for embedding models.
- [ ] Add local embedding provider.
- [ ] Add vector index.
- [ ] Add hybrid search.

Acceptance:

- Brain works without embeddings; embeddings improve retrieval when installed.

## Milestone B4 — Memory policy

Tasks:

- [ ] Define policy file for allowed memory types.
- [ ] Add TTL/expiration for volatile memories.
- [ ] Add protected scopes.
- [ ] Add export/import.

Acceptance:

- User can inspect and edit memory policy manually.
