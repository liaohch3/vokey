# Vokey — Agent Instructions

## Project Identity

Open-source, BYOK voice dictation for macOS (Windows later).  
Tauri v2 + Rust backend + React/TypeScript frontend.  
Core loop: **hotkey → record → STT → LLM polish → paste at cursor**.

---

## Pre-commit CI checks

Before every `git commit`, run these checks locally (mirrors GitHub CI):

```bash
# Rust
cargo fmt --check
cargo clippy -- -D warnings
cargo test

# Frontend
cd frontend && npm run lint && npm run typecheck && npm test
```

All must pass before committing.

## Pre-work Checklist

Before any code change, run:

```bash
git diff --stat            # Check for uncommitted changes
git log --oneline -10      # Understand recent history
git fetch origin           # Get latest remote state
```

Ensure you are working on a clean, up-to-date branch.

---

## Verification Loop (NON-NEGOTIABLE)

Every feature must be verified end-to-end before merge. No exceptions.

### Levels of verification

| Level | What | When |
|-------|------|------|
| **L0 — Unit** | `cargo test` + `npm test` | Every commit |
| **L1 — Integration** | Cross-layer tests (Rust↔Frontend via Tauri commands) | Every PR |
| **L2 — E2E Manual** | Record voice → see text pasted in a real app | Every milestone feature |
| **L3 — Regression** | Run full test suite + L2 on release branches | Every release |

### E2E Validation Requirements

For changes affecting: audio capture, STT pipeline, LLM processing, hotkey handling, or text pasting:

1. Build the app: `cargo tauri dev`
2. Test the full loop: press hotkey → speak → verify text appears at cursor
3. Record evidence (screenshot or terminal output) in PR description
4. Test with at least 2 STT providers (e.g., Groq + local Whisper)

If E2E cannot run (e.g., no API key in CI), document the reason and residual risk in PR.

### CI Pipeline

```
lint (fmt + clippy + eslint) → unit tests → build check → integration tests
```

Integration tests use mock STT/LLM providers to avoid API key requirements in CI.

---

## Language

All code, comments, commit messages, docs, and skill files must be in English.
Exception: Chinese-specific docs like `README_zh.md`.

---

## Coding Standards

### DO

| Practice | Why |
|----------|-----|
| Delete dead code | Dead code misleads and rots |
| Fix root cause of test failures | Patching symptoms creates fragile tests |
| Use existing patterns | Consistency beats novelty |
| Modify only relevant files | Minimize blast radius |
| Keep functions focused | One function, one purpose |
| Trust type invariants | Don't add redundant runtime checks for typed values |
| Provider-agnostic interfaces | Every STT/LLM provider behind a trait/interface |
| Test with mock providers | CI must never require real API keys |

### DON'T

| Anti-pattern | Why |
|--------------|-----|
| Leave commented-out code | Use version control, not comments |
| Add speculative abstractions | YAGNI — wait until you need it |
| Suppress linter warnings without justification | Fix or document false positives |
| Commit generated files | Regenerate from source |
| Mix refactoring with feature work | One concern per commit |
| Hardcode provider-specific logic in core | Everything goes through traits |
| Skip E2E for "trivial" changes | The pipeline is the product |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│            React + TypeScript                │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Overlay  │ │ Settings │ │   History    │ │
│  │ (record) │ │  (keys)  │ │  (SQLite)   │ │
│  └────┬─────┘ └────┬─────┘ └──────┬──────┘ │
│       │             │              │         │
│       └─────────────┴──────────────┘         │
│                     │ Tauri Commands          │
├─────────────────────┴───────────────────────┤
│                 Rust Backend                  │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐  │
│  │  Audio   │ │    STT    │ │  LLM       │  │
│  │ Capture  │ │ Provider  │ │ Provider   │  │
│  │ (cpal)   │ │  (trait)  │ │  (trait)   │  │
│  └────┬─────┘ └─────┬─────┘ └─────┬──────┘  │
│       │              │             │          │
│  ┌────┴──────────────┴─────────────┴───────┐ │
│  │            Pipeline Orchestrator         │ │
│  │  record → STT → polish → paste          │ │
│  └──────────────────────────────────────────┘ │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐  │
│  │ Hotkey   │ │  Config   │ │  Keychain  │  │
│  │ Manager  │ │ (TOML)    │ │ (API keys) │  │
│  └──────────┘ └───────────┘ └────────────┘  │
└──────────────────────────────────────────────┘
```

### Key Traits

```rust
trait SttProvider {
    async fn transcribe(&self, audio: &[u8], config: &SttConfig) -> Result<String>;
}

trait LlmProvider {
    async fn polish(&self, raw_text: &str, context: &PolishContext) -> Result<String>;
}
```

Implementations:
- **STT**: `GroqWhisper`, `OpenAiWhisper`, `GeminiAudio`, `LocalWhisper`
- **LLM**: `OpenRouter`, `Groq`, `OpenAi`, `Gemini`, `Ollama`

### Config

TOML file at `~/.vokey/config.toml`:

```toml
[hotkey]
trigger = "CmdOrCtrl+Shift+Space"

[stt]
provider = "groq"          # groq | openai | gemini | local
# API keys stored in OS keychain, not config file

[llm]
provider = "openrouter"    # openrouter | groq | openai | gemini | ollama
model = "anthropic/claude-haiku-4-5"

[polish]
default_prompt = "Clean up this dictation..."
remove_fillers = true
language = "auto"          # auto | zh | en | ...

[polish.app_prompts]
slack = "Casual, concise tone"
email = "Professional, polished tone"
code = "Convert to code comments or variable names"
```

---

## Worktree Workflow

```bash
git worktree add -b feat/<name> /tmp/vokey-<name> main
cd /tmp/vokey-<name>
# develop and test
cd /path/to/vokey
git merge --ff-only feat/<name>
git worktree remove /tmp/vokey-<name>
git branch -d feat/<name>
```

---

## Compounding Engineering

Record lessons learned:

- **Error experience**: `docs/error-experience/YYYY-MM-DD-<slug>.md`
- **Good experience**: `docs/good-experience/YYYY-MM-DD-<slug>.md`
- **Plans**: `docs/plans/`

---

## Code Review

Before every commit:

1. `cargo fmt --check` + `cargo clippy` — Rust lint
2. `npm run lint` + `npm run typecheck` — Frontend lint
3. `cargo test` + `npm test` — Tests pass
4. `git diff` — Review every changed line
5. Verify scope: only relevant files modified

---

## Brain + Hands Protocol

- **Claude Code (Opus)** = planning brain. Architecture, API design, pattern decisions.
- **Codex** = execution hands. Writes code, runs tests, applies changes.

Never delegate architecture to execution tools.

---

## Release Checklist

- [ ] All L0 tests pass
- [ ] L1 integration tests pass
- [ ] L2 E2E manual test completed and documented
- [ ] CHANGELOG.md updated
- [ ] Version bumped in `Cargo.toml` and `package.json`
- [ ] `cargo tauri build` produces working binary
- [ ] Binary tested on clean macOS install (or VM)
