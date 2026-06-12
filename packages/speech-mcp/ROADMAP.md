# Package roadmap: `@vel/speech-mcp`

## Purpose

Speech provides audio generation and later transcription. The first implementation should be TTS artifact generation, not automatic read-aloud UI behavior.

## Tool surface

| Tool | Purpose |
|---|---|
| `speech.synthesize` | Convert text to an audio artifact. |
| `speech.list_voices` | Return available voices and capabilities. |
| `speech.transcribe` | Later: convert audio to text with timestamps. |

## Milestone S0 — Provider contract

Tasks:

- [ ] Define `SpeechProvider` interface.
- [ ] Define voice metadata: ID, name, language, sample rates, styles, local/cloud.
- [ ] Define synthesize request: text, voice, format, speed, style, output policy.
- [ ] Define audio artifact response.
- [ ] Implement mock provider returning a tiny generated placeholder WAV or metadata-only result.

Acceptance:

- `speech.list_voices` and `speech.synthesize` work with mock provider.

## Milestone S1 — Artifact integration

Tasks:

- [ ] Store generated audio in `ArtifactStore`.
- [ ] Return artifact ID, MIME, duration, bytes, sample rate.
- [ ] Add max text length guard.
- [ ] Add audit event without storing full text unless configured.

Acceptance:

- Tool returns artifact handle, not raw base64 audio by default.

## Milestone S2 — Local TTS provider

Tasks:

- [ ] Choose first local TTS backend.
- [ ] Implement lazy worker.
- [ ] Add voice discovery.
- [ ] Add CPU/GPU config.
- [ ] Add timeout and cancellation.

Acceptance:

- Local synthesis works without loading model until first call.

## Milestone S3 — STT later

Tasks:

- [ ] Define transcription result: text, segments, word timestamps, confidence.
- [ ] Add audio file ingestion.
- [ ] Add diarization as optional future feature.

Acceptance:

- STT produces timestamped segments and artifact provenance.

## Out of scope for MCP

Automatic reading of every agent response aloud should live in host UI/plugin logic, not as a tool the LLM calls every turn.
