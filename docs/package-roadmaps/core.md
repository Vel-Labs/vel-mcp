# Package roadmap: `@vel/core`

## Purpose

`@vel/core` is the shared runtime substrate. It must not depend on MCP SDKs or any specialist model.

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

- [ ] Define `VelConfig`, `ModuleConfig`, `ProviderConfig`, `WorkerConfig`.
- [ ] Implement environment interpolation for `${ENV}` and `${ENV:-default}`.
- [ ] Implement config path resolution for `~`, relative paths, and absolute paths.
- [ ] Validate required fields.
- [ ] Add unit tests for missing env vars, defaults, and invalid paths.

Acceptance:

- `loadVelConfig("vel.config.example.yaml")` returns typed config.
- Invalid config returns structured errors; it does not throw raw YAML parser errors.

## Milestone C1 — Artifact store

Tasks:

- [ ] Implement `putFile(path, metadata)`.
- [ ] Implement `putBytes(buffer, metadata)`.
- [ ] Implement `getArtifact(id)`.
- [ ] Implement `openReadStream(id)`.
- [ ] Store metadata as JSON beside the binary.
- [ ] Content-address artifacts using SHA-256.
- [ ] Store original filename only as metadata.
- [ ] Add MIME detection hook but do not trust client MIME blindly.

Acceptance:

- Same bytes produce same artifact ID.
- Artifact metadata includes hash, byte length, MIME, created time, and origin.
- Raw file paths are not returned to model-visible tools unless explicitly allowed.

## Milestone C2 — Audit log

Tasks:

- [ ] Implement append-only JSONL audit events.
- [ ] Chain each event hash to the previous event hash.
- [ ] Include event type, timestamp, package, operation, actor, redacted metadata.
- [ ] Add `verifyChain()`.
- [ ] Add tests for tamper detection.

Acceptance:

- Removing or editing any event causes verification failure.
- Audit log never stores raw image bytes, audio bytes, or privacy plaintext.

## Milestone C3 — Worker supervisor

Tasks:

- [ ] Implement lazy start using command/args/env/cwd.
- [ ] Implement health wait with timeout.
- [ ] Implement idle TTL shutdown.
- [ ] Implement max restart count.
- [ ] Implement JSONL request client for worker processes.
- [ ] Route worker stderr to logs/audit, never stdout.
- [ ] Add tests with a fake worker script.

Acceptance:

- A worker starts only on first request.
- Worker exits after idle TTL.
- A crashed worker returns a structured error and can restart.

## Milestone C4 — Provider registry

Tasks:

- [ ] Register providers by stable ID.
- [ ] Track provider health and setup warnings.
- [ ] Support default provider selection by module config.
- [ ] Support explicit provider override per tool call.
- [ ] Add tests for missing provider and disabled provider.

Acceptance:

- Provider routing is deterministic and logged.

## Milestone C5 — Security helpers

Tasks:

- [ ] Implement `PathPolicy` for allowed roots.
- [ ] Block symlink traversal by default.
- [ ] Block HTTP URL loading unless module config enables it.
- [ ] Add max-file-size guards.

Acceptance:

- File operations cannot escape configured roots in tests.
