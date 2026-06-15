# Glasses MCP — Image / Video Lane Architecture

## Design Principle

Glasses is model-role-based, not model-specific. Users declare models by **role** (general_vlm, grounding, ocr, temporal_vlm) and Glasses routes tools to the right model. Swapping models is a config change, never a code change.

For agent-facing visual review sequences, see `docs/glasses-ux-workflows.md`.

## Lanes

### Image Lane
Single artifact → model inference → structured result.

| Tool | Primary Role | Fallback |
|------|-------------|----------|
| `glasses.inspect_image` | general_vlm | — |
| `glasses.locate` | grounding | general_vlm (if grounding unavailable) |
| `glasses.ocr` | ocr | general_vlm |
| `glasses.inspect_region` | crop → general_vlm or grounding | depends on query |
| `glasses.compare` | image diff → general_vlm summary | — |

### Video Lane
Video artifact → metadata → frame sampling → scene index → keyframe VLM → temporal VLM → event summary.

| Tool | Pipeline Stage | Primary Role |
|------|---------------|-------------|
| `glasses.video_scan` | frame sampling | video_frame_vlm |
| `glasses.video_locate` | locate over keyframes | grounding |
| `glasses.video_summarize` | temporal analysis | temporal_vlm |

Pipeline stages:
1. Extract metadata (duration, fps, resolution, audio)
2. Sample frames (every N seconds + scene-change + user-requested timestamps)
3. Run image-lane models on sampled frames
4. Build scene index (frame_id, timestamp, caption, objects, text, UI elements, confidence)
5. Answer video questions from index (optionally inspect neighbor frames)

## Model Roles

| Role | Purpose | Example Model |
|------|---------|---------------|
| `general_vlm` | Image QA, screenshot reading, document reasoning, video frame reasoning | Qwen3-VL-4B-Instruct-5bit |
| `grounding` | Object localization, GUI targeting, bounding boxes, click targets, text localization | LocateAnything-3B-4bit (MLX) |
| `ocr` | Text extraction, layout reading order | LocateAnything-3B (OCR mode), paddleocr_vl |
| `temporal_vlm` | Video summarization, event sequencing, multi-frame context | Qwen3-VL-8B (video mode) |
| `video_frame_vlm` | Keyframe captioning, frame QA | Qwen3-VL-4B, Qwen3-VL-8B |

### Role Boundaries

`grounding` models answer "where is it?" They should return points, boxes, GUI elements, and localized text spans. LocateAnything is strong here because its output format is built around `<ref>` and `<box>` tokens in normalized `[0,1000]` space. That same specialization is its limitation: it is not a general narrator and should not be expected to produce rich scene descriptions.

`general_vlm` models answer "what is in this image?" and "what does this screenshot mean?" They are used for `inspect_image`, `describe`, and `ask`. Qwen3-VL-4B-Instruct-5bit is the recommended default on Apple Silicon; Qwen3-VL-4B-Instruct-8bit is the local quality option when memory budget allows. Qwen2.5-VL and InternVL remain fallback candidates. These models are usually slower and less deterministic for click coordinates, so they complement rather than replace LocateAnything.

`temporal_vlm` and `video_frame_vlm` models reason over sampled video frames. Until real temporal reasoning is enabled, `video_scan` remains a bounded frame/event manifest with explicit truncation metadata.

## Provider Registry

```yaml
providers:
  qwen3_vl_4b_default:
    runtime: mlx-vlm
    model_id: mlx-community/Qwen3-VL-4B-Instruct-5bit
    roles: [general_vlm, video_frame_vlm]
    lazy_load: true
    idle_ttl_seconds: 600

  qwen3_vl_4b_quality:
    runtime: mlx-vlm
    model_id: mlx-community/Qwen3-VL-4B-Instruct-8bit
    roles: [general_vlm, temporal_vlm, video_frame_vlm]
    lazy_load: true
    idle_ttl_seconds: 300

  qwen25_vl_7b_stable:
    runtime: mlx-vlm
    model_id: mlx-community/Qwen2.5-VL-7B-Instruct-4bit
    roles: [general_vlm, video_frame_vlm]
    lazy_load: true

  internvl3_8b_alt:
    runtime: mlx-vlm
    model_id: mlx-community/InternVL3-8B-MLX-4bit
    roles: [general_vlm]
    lazy_load: true

  locateanything_3b_mlx:
    runtime: mlx-vlm
    model_id: mlx-community/LocateAnything-3B-4bit
    roles: [grounding, ocr]
    lazy_load: true
```

## Role-to-Model Routing

```yaml
roles:
  general_vlm:
    preferred: qwen3_vl_4b_default
    fallback:
      - qwen3_vl_4b_quality
      - qwen25_vl_7b_stable

  grounding:
    preferred: locateanything_3b_mlx
    fallback:
      - qwen3_vl_4b_quality

  ocr:
    preferred: builtin_ocr
    fallback:
      - locateanything_3b_mlx
      - qwen3_vl_8b_quality

  video_frame_vlm:
    preferred: qwen3_vl_4b_default
    fallback:
      - qwen3_vl_4b_quality

  temporal_vlm:
    preferred: qwen3_vl_4b_quality
```

## Tool Routing Logic

```
glasses.inspect_image  → general_vlm
glasses.locate         → grounding → fallback general_vlm
glasses.ocr            → builtin_ocr → fallback general_vlm
glasses.inspect_region → crop → general_vlm or grounding (query-dependent)
glasses.compare        → image diff → general_vlm summary
glasses.video_scan     → frame sampler → video_frame_vlm over keyframes
glasses.video_locate   → grounding over keyframes
glasses.video_summarize → temporal_vlm
```

## Verified Models (Apple Silicon MLX)

| Model | Role | Status | Inference |
|-------|------|--------|-----------|
| `mlx-community/LocateAnything-3B-bf16` | grounding | ✅ Verified | 0.9s |
| `mlx-community/Qwen3-VL-4B-Instruct-5bit` | general_vlm | Recommended default | — |
| `mlx-community/Qwen3-VL-4B-Instruct-8bit` | general_vlm | Local quality option | — |
| `mlx-community/Qwen2.5-VL-7B-Instruct-4bit` | general_vlm | Identified | — |
| `mlx-community/LocateAnything-3B-4bit` | grounding | Identified | — |
| `mlx-community/InternVL3-8B-MLX-4bit` | general_vlm | Identified | — |

## Community Model Compatibility

Users bring their own models. Report what works via GitHub issues. The `providers` and `roles` sections in `vel.config.yaml` are the canonical registry.

Models we will NOT bundle or auto-download:
- `nvidia/Eagle2.5-8B` — gated, no MLX conversion, no MPS support
- `nvidia/LocateAnything-3B` (Transformers) — deprecated, use MLX conversion

## Non-Apple Silicon Paths

For CUDA/Linux users, the same roles apply with different model IDs:
- `general_vlm`: Qwen3-VL-8B (transformers/vllm), Qwen3-VL-32B (vllm)
- `grounding`: LocateAnything-3B (official Eagle worker)
- Cloud: OpenAI Vision, Gemini, Claude Vision
