# Module Boundaries

## Keep separate

| Module | Raw inputs it may see | Persistent state | Model-visible? | Notes |
|---|---|---:|---:|---|
| Glasses MCP | images, screenshots, videos | artifact metadata | yes | No raw privacy mapping. |
| Speech MCP | text to synthesize, audio files | voice cache | yes | TTS is okay as MCP; automatic read-aloud belongs in UI. |
| Brain MCP | user-approved notes | wiki/index | yes | Writes require approval. |
| Privacy gateway | raw prompts, mapping table | encrypted maps/audit | no | Must run before LLM. |
| Privacy MCP | redaction stats only | no raw map | limited | Never exposes rehydration. |
| Control MCP | module status | process state | yes | Avoid secrets in status output. |

## Anti-patterns

- One process with all permissions.
- A model-visible tool that can reverse privacy placeholders.
- A vision tool that performs UI clicks directly.
- A memory tool that silently writes permanent notes.
- A speech tool that captures microphone input without UI-level consent.
