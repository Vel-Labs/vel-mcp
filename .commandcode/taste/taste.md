# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Architecture
- Per-user artifact store layout: ~/(user)/glasses/inputs for user-provided content, ~/(user)/glasses/outputs for LLM-processed results, with each MCP having its own subfolder under both. Confidence: 0.70
- Use a general config.yaml for operator-adjustable runtime features (worker restarts, timeouts, provider priority). Confidence: 0.65

# Workers
- Default max worker restart count to 3, operator-configurable via config file. Confidence: 0.70

# Security
- Warn on large file sizes rather than hard-blocking; surface awareness to the user that higher volume content increases processing time. Confidence: 0.60
- Allow agent attachment temp directories (e.g., /tmp, os.tmpdir()) in PathPolicy allowed roots, or add a helper that copies attachments from temp paths into allowed roots before loading. Agent-provided file paths typically land outside process.cwd() and ~/vel/glasses/inputs, causing path policy rejections. Confidence: 0.75

# Providers
- Provider config supports priority ordering (1, 2, 3) set by the user to determine fallback sequence. Confidence: 0.65

# Auditing
- Audit log integration via registerVelTool wrapper (tool call before/after) and WorkerSupervisor (worker lifecycle events) as the canonical audit surface. Confidence: 0.70

# CI/CD
- Run smoke tests in CI after pnpm verify to catch MCP protocol-level breakage that unit tests miss. Confidence: 0.70

# Workflow
See [workflow/taste.md](workflow/taste.md)
# CLI
- CLI tools for each sense should be detailed and driven by what that specific sense offers, not generic. Each MCP lane gets its own CLI surface tailored to its capabilities. Confidence: 0.75
- Installer/setup output should be concise — a compact success banner with the essentials (MCP name, config path, restart note) rather than a wall of text dumping every config snippet, model list, and readiness check into the terminal. Confidence: 0.80
- When writing CLI output for npx-distributed tools, use console.log (stdout) instead of console.error (stderr) for user-visible messages — npx swallows stderr output when the child process exits with code 0, making install progress invisible to users. Confidence: 0.85
- Always rebuild dist (pnpm build) before npm publish — dist/ is gitignored but included in the npm tarball, so stale dist produces a published package that doesn't match the committed source. Build must run immediately before publish, not just before commit. Confidence: 0.85
- The bootstrap/install process must handle existing kit directories gracefully: git pull + pnpm install + pnpm build (not skip) to prevent stale/partially-built clones from failing. Running --bootstrap on an existing kit should result in a fully updated and working install, not a silent skip. Confidence: 0.80

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

# MCP-Integration
- Package a skills/agents file with the MCP that provides NLP-to-tool conversion guidance so coding agents know how to invoke glasses tools from natural-language user requests without users needing to know exact tool names and parameters. Confidence: 0.75
- Use a skills directory with separate files per domain (images, video, wiki, etc.) rather than a single monolithic SKILL.md. Each domain gets its own skill file for cleaner organization and token efficiency. Confidence: 0.70
- Generate config snippets for multiple coding agents (OpenCode, Codex, CommandCode) as part of the setup wizard, not just a single agent format. Each agent has different config schemas and the installer should detect or ask which agent to configure. Confidence: 0.75

# Setup
- The install/setup experience should be a global CLI wizard that walks users through: detecting local vision models, suggesting models with HuggingFace links if none found, configuring the MCP connection for the user's coding agent, and providing clear next steps. Aim for an npx-equivalent one-command bootstrap. Confidence: 0.75
- Setup scripts must handle existing config files gracefully — if a config file already exists, merge or warn with a clear message rather than crashing with EEXIST. Confidence: 0.70

# Package-Management
- Placeholder/stub packages without real implementation should be gitignored from the repo until they contain working code and tests. Scaffolded packages create noise for new users and agents exploring the codebase. Confidence: 0.70

# Git
- Scope .gitignore patterns to root level (e.g., `/artifacts/`) when the intent is to ignore top-level runtime output directories. Unscoped patterns like `artifacts/` match nested source directories (e.g., `packages/core/src/artifacts/`), silently blocking source files from being tracked. Confidence: 0.85

# Design-Philosophy
- Prioritize low cognitive lift and low context-waste tooling — avoid telemetry, avoid unnecessary complexity, keep the tool focused and lightweight so it doesn't introduce drift or overhead into the user's workflow. Confidence: 0.70
- No silent failures: every error path must produce a structured warning with actionable detail surfaced in the result envelope. Graceful degradation means the operation continues but the user always knows what didn't work and why. Detailed understanding of failure is imperative. Confidence: 0.85

# Documentation
- README should follow a specific flow: (1) what this does, (2) quickstart for user + agent, (3) example messages / how to test, (4) testing with own content, (5) two-column capability table mapping user intent (OCR, image counting, location, image reasoning, video reasoning) to implementation (model, LocateAnything, etc.), (6) optional expanded table with model, functionality, and system requirements. Confidence: 0.70
- README should be designed "agent-first" — if a user tells their coding agent to go to this README, the agent should be able to set everything up and get them started from the README content alone. Confidence: 0.70
- README should include a quick start section with explicit per-agent instructions (commandcode, opencode, codex, mcp) rather than consolidating all targets into a single prose paragraph. Each agent gets its own subheading with the exact npx invocation. Confidence: 0.65
- Include a self-contained copy-paste block per agent that bundles the install command with enough context (what it does, what to expect, next steps) so an agent reading the README can execute without hunting for surrounding prose. Confidence: 0.70

# Naming
- Keep worker names specific to their role in the glasses pipeline (e.g., vel-glasses for the MCP, a vision worker under it), not generic like vel-worker; the config file supplies which models to use, so the worker doesn't need the model in its name. Confidence: 0.65

