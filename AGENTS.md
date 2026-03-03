# AGENTS.md — Vokey

This file is the **table of contents**, not the encyclopedia.
Read it first, then follow pointers to deeper docs as needed.

## Project Identity

Open-source, BYOK voice dictation for macOS (Windows later).
Tauri v2 + Rust backend + React/TypeScript frontend.
Core loop: **hotkey → record → STT → LLM polish → paste at cursor**.

## Non-negotiable Rules

1. **Gate checks before every commit** — see `docs/standards/validation-and-gates.md`
2. **One concern per commit** — no mixed refactor + feature
3. **English only** in code/comments/docs/commits (exception: `README_zh.md`)
4. **Evidence required** for UI changes — screenshots in PR body
5. **Pre-work checklist** before coding, **pre-PR checklist** before opening PR
6. **Must push and open PR** — work isn't done until `gh pr create` runs
7. **Plans are first-class** — complex work needs an execution plan in `docs/plans/`

## Standards Catalog

| Standard | Location |
|----------|----------|
| Hard rules | `docs/standards/hard-rules.md` |
| Validation gates | `docs/standards/validation-and-gates.md` |
| Coding standards | `docs/standards/coding-standards.md` |
| Architecture | `docs/standards/architecture.md` |
| Auto-pilot workflow | `docs/standards/autopilot.md` |

## Architecture (quick map)

```
frontend/src/          → React UI (pages, components, i18n)
src-tauri/src/         → Rust backend
  ├── audio.rs         → mic capture (cpal)
  ├── commands.rs      → Tauri command handlers + pipeline orchestrator
  ├── config.rs        → TOML config at ~/.vokey/config.toml
  ├── paste.rs         → clipboard + Cmd+V simulation
  ├── stt/             → STT provider trait + implementations
  └── llm/             → LLM provider trait + implementations
docs/
  ├── design/          → product & UI design specs
  ├── standards/       → engineering standards (this catalog)
  └── plans/           → execution plans (active, completed, cancelled)
scripts/               → CI, linting, automation scripts
.agents/skills/        → agent skills (reusable task recipes)
```

## Config

TOML at `~/.vokey/config.toml`. See `src-tauri/src/config.rs` for schema.

## Key Traits

```rust
// STT — src-tauri/src/stt/mod.rs
trait SttProvider: Send + Sync {
    fn transcribe(&self, wav_data: &[u8]) -> Result<String, SttError>;
    fn name(&self) -> &str;
}

// LLM — src-tauri/src/llm/mod.rs
trait LlmProvider: Send + Sync {
    fn polish(&self, raw_text: &str, system_prompt: &str) -> Result<String, LlmError>;
    fn name(&self) -> &str;
}
```

## Brain + Hands Protocol

- **Human / Claude Opus** = planning brain. Architecture, design, review decisions.
- **Codex** = execution hands. Writes code, runs tests, opens PRs.

Never delegate architecture decisions to execution tools.
Never hand-write code when Codex can do it.

## Compounding Engineering

Record lessons learned:
- Error experience: `docs/error-experience/YYYY-MM-DD-<slug>.md`
- Good experience: `docs/good-experience/YYYY-MM-DD-<slug>.md`

## Auto-pilot

See `docs/standards/autopilot.md` for the full self-iterating workflow.

TL;DR: human submits requirement → Codex writes code + tests → agent reviews → PR opened → CI validates → human merges (or auto-merge if all checks pass).
