# Package roadmap: `@vel/core`

## Purpose

`@vel/core` is the shared runtime substrate. It must not depend on MCP SDKs or any specialist model.

## Design decisions (from Phase 1 discussion, 2026-06-07)

- **Worker restart**: max 3 restarts per session within a 60s sliding window. Configurable via `vel.worker.maxRestarts` / `vel.worker.restartWindowSec`.
- **Startup timeout**: 30s default, `vel.worker.startupTimeoutSec`.
- **Request timeout**: 180s default, overridable per provider via `modules.<name>.providers.<id>.requestTimeoutSec`. Workers may emit progress heartbeats (`{"id":"x","progress":{...}}`) on stdout.
- **Max memory**: `maxMemoryMb` on worker spec. Supervisor polls rss periodically; warning on exceed, not kill.
- **File size**: soft warning via `vel.warnFileSizeMb`, not hard block. Warning appended to tool result `warnings`.
- **Artifact store**: CA backing store at `~/.vel/artifacts/`. User-facing layout: `~/glasses/inputs/` and `~/glasses/outputs/<mcp-name>/` via `ArtifactStore.organize()` creating symlinks.
- **Provider priority**: `priority` field (1, 2, 3) on provider config. Router tries priority 1 first; falls through on health failure or error.
- **Symlink traversal**: `PathPolicy` resolves realpath before root check.
- **Audit integration**: `WorkerSupervisor` emits audit events on worker lifecycle; tool call auditing lives in `mcp-base`.

## Public API target

```ts
export type VelConfig;
export function loadVelConfig(path?: string): Promise<VelConfig>;
export class ArtifactStore;
export class AuditLog;
export class WorkerSupervisor;
export class ProviderRegistry<TProvider>;
export class PathPolicy;
```

## Milestone C0 — Types and config

Tasks:

- [x] Define `VelConfig`, `ModuleConfig`, `ProviderConfig` types.
- [ ] Add `WorkerConfig` section to `VelConfig.vel`: `maxRestarts`, `restartWindowSec`, `startupTimeoutSec`, `warnFileSizeMb`.
- [ ] Add `requestTimeoutSec` and `maxMemoryMb` to `ProviderConfig`.
- [ ] Add `priority` field to `ProviderConfig` for fallback ordering.
- [x] Implement environment interpolation for `${ENV}` and `${ENV:-default}`.
- [x] Implement config path resolution for `~`, relative paths, and absolute paths.
- [x] Validate required fields.
- [ ] Add unit tests for worker config defaults and priority ordering.

Acceptance:

- `loadVelConfig("vel.config.example.yaml")` returns typed config with all new fields defaulted.
- Invalid config returns structured errors; it does not throw raw YAML parser errors.

## Milestone C1 — Artifact store

Tasks:

- [x] Implement `putFile(path, metadata)`.
- [x] Implement `putBytes(buffer, metadata)`.
- [x] Implement `getMetadata(id)`.
- [x] Implement `openReadStream(id)`.
- [x] Store metadata as JSON beside the binary.
- [x] Content-address artifacts using SHA-256.
- [x] Store original filename only as metadata.
- [ ] Add `organize(id, logicalPath)` method creating user-facing symlinks: `~/glasses/inputs/<mcp>/` and `~/glasses/outputs/<mcp>/`.
- [ ] Add MIME detection hook (file extension mapping), fallback to caller-provided `mimeType`.
- [ ] Guard raw file paths from leaking to model-visible tool outputs.

Acceptance:

- Same bytes produce same artifact ID.
- Artifact metadata includes hash, byte length, MIME, created time, and origin.
- User can browse `~/glasses/outputs/glasses-mcp/` to find processed images.

## Milestone C2 — Audit log

Tasks:

- [x] Implement append-only JSONL audit events.
- [x] Chain each event hash to the previous event hash.
- [x] Include event type, timestamp, package, operation, actor, redacted metadata.
- [x] Add `verifyChain()`.
- [x] Add tests for tamper detection.
- [ ] Integrate with `WorkerSupervisor`: emit events on worker start, crash, restart, idle-stop.
- [ ] Add `maxFileSizeBytes` guard — log refuses to store raw image/audio bytes or privacy plaintext.

Acceptance:

- Removing or editing any event causes verification failure.
- Worker lifecycle is fully auditable.
- Audit log never stores raw image bytes, audio bytes, or privacy plaintext.

## Milestone C3 — Worker supervisor

Tasks:

- [x] Implement lazy start using command/args/env/cwd.
- [ ] Implement health wait with timeout (`startupTimeoutSec` from config).
- [x] Implement idle TTL shutdown.
- [ ] Implement max restart count with sliding window (`maxRestarts` / `restartWindowSec`).
- [x] Implement JSONL request client for worker processes.
- [ ] Parse progress heartbeats (`"progress"` key on JSONL line) and emit events.
- [ ] Poll child process rss; warn via audit log and stderr when exceeding `maxMemoryMb`.
- [x] Route worker stderr to logs/audit, never stdout.
- [ ] Add tests with a fake worker script that can simulate crash, slow start, progress heartbeats, and memory growth.

Acceptance:

- A worker starts only on first request.
- Worker exits after idle TTL.
- A crashed worker restarts up to maxRestarts within the window; exceeding it returns structured error.
- Fake worker tests cover all lifecycle states.

## Milestone C4 — Provider registry

Tasks:

- [x] Register providers by stable ID.
- [x] Track provider health and setup warnings.
- [ ] Support priority-ordered fallback: try priority 1, on health failure or error try 2, then 3.
- [ ] Support `enabled: false` — skip disabled providers in the chain.
- [x] Support default provider selection by module config.
- [x] Support explicit provider override per tool call.
- [ ] Log provider selection to audit log.
- [ ] Add tests for priority fallback, disabled skip, and all-providers-down.

Acceptance:

- Provider routing is deterministic, logged, and follows priority order.

## Milestone C5 — Security helpers

Tasks:

- [x] Implement `PathPolicy` for allowed roots.
- [ ] Block symlink traversal: `assertAllowed()` resolves realpath before root check.
- [ ] Block HTTP URL loading unless module config enables it (`allowHttpImageLoading: true`).
- [ ] Add max image dimension warning (e.g. 8K) — append to provider result warnings.
- [x] Add `warnFileSizeMb` config field (soft check in artifact store).

Acceptance:

- File operations cannot escape configured roots via symlinks.
- HTTP image loading is disabled by default and must be explicitly opted into.
