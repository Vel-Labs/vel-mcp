# VEL Architecture

## Mental model

VEL lets the primary LLM specialize in completion, reasoning, planning, and code generation while purpose-built modules supply sensory or stateful capabilities:

```text
Primary LLM
  ├─ Glasses: vision, OCR, grounding, video scan
  ├─ Speech: text-to-speech and later speech-to-text
  ├─ Brain: local inspectable wiki/memory
  ├─ Privacy: pre-model redaction gateway
  └─ Control: status, provider health, worker lifecycle
```

## Runtime architecture

```text
MCP host / coding agent
        │
        ├─ stdio/HTTP MCP connection → vel-glasses-mcp ── lazy worker → LocateAnything / OCR / cloud VLM
        ├─ stdio/HTTP MCP connection → vel-brain-mcp   ── local wiki + index
        ├─ stdio/HTTP MCP connection → vel-speech-mcp  ── local/cloud TTS worker
        └─ stdio/HTTP MCP connection → vel-control-mcp ── supervisor state

User prompt before LLM
        │
        └─ vel-privacy-gateway → sanitized prompt → LLM provider
```

## Separation of responsibilities

### `core`

Owns shared non-model runtime primitives:

- config loading
- artifact storage
- audit chain
- worker supervisor
- provider registry
- path safety checks

### `mcp-base`

Owns SDK-specific MCP mechanics:

- server creation
- stdio connection
- tool registration adapter
- JSON result formatting
- future v1/v2 SDK migration

### Capability MCP packages

Own model-visible tools. They do not own raw OS capture or privacy preprocessing unless explicitly scoped.

### Workers

Workers are isolated model runners. They may be Python, Node, Rust, local binaries, or remote HTTP providers. MCP servers should communicate with them through stable JSON contracts.

## Tool output principle

Every capability output should be:

```json
{
  "schemaVersion": "2026-06-06",
  "provider": { "name": "mock", "version": "0.1.0" },
  "timingMs": 123,
  "warnings": [],
  "result": {}
}
```

## Coordinate standard

VEL uses normalized `[0, 1000]` coordinates internally:

```json
{
  "bboxNorm1000": [100, 200, 300, 400],
  "centerNorm1000": [200, 300]
}
```

Pixel coordinates are optional and should only be emitted when image dimensions are known:

```json
{
  "bboxPx": [192, 216, 576, 432],
  "centerPx": [384, 324],
  "imageSize": { "width": 1920, "height": 1080 }
}
```

## Lazy loading

MCP servers should start quickly and load no heavy models at startup. The flow is:

```text
Tool call arrives
  ↓
Provider router selects provider
  ↓
WorkerSupervisor starts worker if not active
  ↓
Tool waits for health-ready or timeout
  ↓
Provider returns structured result
  ↓
Worker remains active until idle TTL expires
```

## Security posture

- Stdio servers must never write logs to stdout.
- Remote HTTP servers must bind to localhost by default when local.
- All file reads pass through `PathPolicy`.
- Tool descriptions are treated as untrusted by clients; do not rely on annotations for security.
- Privacy rehydration maps are not tools.
