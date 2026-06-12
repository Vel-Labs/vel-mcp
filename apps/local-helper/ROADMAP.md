# App roadmap: `apps/local-helper`

## Purpose

Local helper handles OS/UI/device tasks that do not belong inside MCP server logic.

## Functions

- screenshot current display/window
- crop image
- save artifact
- optional pre-vision redaction preview later
- upload to local/remote VEL artifact store

## Milestone L0 — CLI helper

Tasks:

- [ ] Implement `vel-helper screenshot --out ...`.
- [ ] Implement `vel-helper crop --image ... --bbox ...`.
- [ ] Implement `vel-helper artifact put ...`.
- [ ] Add OS-specific provider modules.
- [ ] Add permission prompts in docs.

Acceptance:

- User can capture a screenshot and pass an artifact ID to Glasses.

## Milestone L1 — Client integration

Tasks:

- [ ] Cursor command recipe.
- [ ] OpenCode recipe.
- [ ] Claude Code recipe.
- [ ] Generic shell workflow.

Acceptance:

- Client docs show end-to-end screenshot → locate flow.
