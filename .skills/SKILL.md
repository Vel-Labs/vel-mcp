# Vel Glasses — Skill Index

Load only the skill files needed for the current request. Each domain has its own file for token efficiency.

| Domain | File | When to load |
|--------|------|-------------|
| Setup | `.skills/setup/SKILL.md` | Agent needs to install or verify the MCP |
| Vision | `.skills/vision/SKILL.md` | User asks about images, screenshots, UI, documents, comparison |
| Video | `.skills/video/SKILL.md` | User provides a video file |
| CLI | `.skills/cli/SKILL.md` | User asks to run a vision command directly in the terminal |

**Common rule**: All errors are structured (code + message + next step). Tools return perception only — never click, type, or mutate state. Coordinates are normalized [0, 1000].
