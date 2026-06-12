# Package roadmap: `@vel/control-mcp`

## Purpose

Expose safe operational status and lifecycle controls for VEL modules.

## Tool surface

| Tool | Purpose |
|---|---|
| `vel.status` | Overall status. |
| `vel.list_modules` | Enabled/disabled modules. |
| `vel.list_providers` | Providers and health. |
| `vel.health_check` | Run health checks. |
| `vel.start_worker` | Start worker by module/provider. |
| `vel.stop_worker` | Stop worker by module/provider. |

## Milestone V0 — Read-only status

Tasks:

- [ ] Implement `vel.status`.
- [ ] Implement `vel.list_modules`.
- [ ] Implement `vel.list_providers`.
- [ ] Redact secrets from config.

Acceptance:

- Status can be shown safely to an LLM.

## Milestone V1 — Health checks

Tasks:

- [ ] Add provider health interface.
- [ ] Check worker command exists.
- [ ] Check model repo path exists.
- [ ] Check artifacts directory writable.
- [ ] Return actionable errors.

Acceptance:

- User can diagnose missing LocateAnything install without reading logs.

## Milestone V2 — Lifecycle control

Tasks:

- [ ] Start/stop workers.
- [ ] Respect module permissions.
- [ ] Add audit events.
- [ ] Require confirmation for destructive controls later.

Acceptance:

- A user can unload a heavy worker to free memory.
