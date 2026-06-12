# Roadmap: evals

## Purpose

VEL should be benchmarkable from the beginning. Evals prove whether Glasses acts as useful “eyes” or “glasses.”

## Glasses metrics

- bounding-box IoU
- center-point distance
- GUI click success radius
- OCR exact match
- character error rate
- object/label precision-recall
- video timestamp error later
- latency p50/p95
- cost per successful task

## Milestone E0 — Dataset schema

Tasks:

- [ ] Define image/video task schema.
- [ ] Support golden boxes/points/text.
- [ ] Support task type tags.
- [ ] Support provider constraints.

Acceptance:

- `sample-tasks.jsonl` validates.

## Milestone E1 — Runner

Tasks:

- [ ] Load tasks.
- [ ] Call provider/tool.
- [ ] Compute metrics.
- [ ] Emit JSON and Markdown report.

Acceptance:

- Mock provider gets deterministic score.

## Milestone E2 — Bench modes

Tasks:

- [ ] no-vision baseline
- [ ] eyes mode: text-only LLM + Glasses
- [ ] native-vision mode
- [ ] native-vision + Glasses mode

Acceptance:

- Can measure correction rate, conflict rate, false override rate, and net success delta.
