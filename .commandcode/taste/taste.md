# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Architecture
- Per-user artifact store layout: ~/(user)/glasses/inputs for user-provided content, ~/(user)/glasses/outputs for LLM-processed results, with each MCP having its own subfolder under both. Confidence: 0.70
- Use a general config.yaml for operator-adjustable runtime features (worker restarts, timeouts, provider priority). Confidence: 0.65

# Workers
- Default max worker restart count to 3, operator-configurable via config file. Confidence: 0.70

# Security
- Warn on large file sizes rather than hard-blocking; surface awareness to the user that higher volume content increases processing time. Confidence: 0.60

# Providers
- Provider config supports priority ordering (1, 2, 3) set by the user to determine fallback sequence. Confidence: 0.65

# Auditing
- Audit log integration via registerVelTool wrapper (tool call before/after) and WorkerSupervisor (worker lifecycle events) as the canonical audit surface. Confidence: 0.70

# CI/CD
- Run smoke tests in CI after pnpm verify to catch MCP protocol-level breakage that unit tests miss. Confidence: 0.70

# Workflow
- Address scaling concerns (audit log rotation, artifact eviction, repetitive patterns) proactively before advancing phases rather than deferring them. Confidence: 0.65
- Close fake/mock integration gaps with real subprocess or real-model tests rather than documenting them as known limitations; validate actual protocol contracts end-to-end. Confidence: 0.65
- Each MCP sense (glasses, memory, etc.) should have its own roadmap file (e.g., roadmap_glasses.md, roadmap_memory.md) in addition to the per-package ROADMAP.md and the global ROADMAP.md. Confidence: 0.80
- When phase tasks are completed, update both the global ROADMAP.md checkboxes AND add detailed completion summaries with component breakdowns and test counts, matching the Phase 0/1 documentation style. Confidence: 0.70

# CLI
- CLI tools for each sense should be detailed and driven by what that specific sense offers, not generic. Each MCP lane gets its own CLI surface tailored to its capabilities. Confidence: 0.75

# Vision
See [vision/taste.md](vision/taste.md)
# Model-Discovery
- Use auto-detect + setup helper pattern for model discovery: scan known filesystem paths for model weights, report status per model (available/partial/not-installed), and provide a glasses.setup tool that returns structured guidance with exact install commands. Never bundle model weights into the MCP distribution — use config pointers only. Confidence: 0.75
- Support multiple vision model lanes in config with role-based routing: map task types (image_qa, grounding, ocr, video_frame_vlm) to preferred model roles, with fallback chains per role. Use named roles (general_vlm, grounding, ocr, document_model, video_frame_vlm, temporal_vlm) rather than hardcoding specific models. Confidence: 0.80
- Separate spatial grounding (LocateAnything — bounding boxes, point localization, GUI targeting, OCR/layout) from vision-language reasoning (Qwen3-VL — image/video description, document understanding, scene reasoning, multi-frame context). Combined flow: VLM interprets scene intent and emits target concepts, grounding model locates those concepts as boxes/points, downstream tool acts on coordinates. Confidence: 0.80

# Deployment
- On Apple Silicon workstations, use only MLX variants; drop Transformers/MPS paths entirely since MLX is 4x faster with same accuracy. LocateAnything-3B-BF16 or 4bit for grounding, Qwen3-VL for general VLM. Confidence: 0.80

# Community
- Maintain a community-tested model compatibility list via GitHub issues rather than bundling or prescribing specific models; users bring their own models and report what works/doesn't work. Confidence: 0.70

# Naming
- Keep worker names specific to their role in the glasses pipeline (e.g., vel-glasses for the MCP, a vision worker under it), not generic like vel-worker; the config file supplies which models to use, so the worker doesn't need the model in its name. Confidence: 0.65

