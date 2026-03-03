---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# Architecture

## Layer Model

```
Frontend (React/TS)
    ↕ Tauri Commands (IPC boundary)
Rust Backend
    ├── Audio Capture (cpal)
    ├── STT Providers (trait)
    ├── LLM Providers (trait)
    ├── Pipeline Orchestrator
    ├── App Context Detector
    ├── Dictionary (SQLite)
    ├── History (SQLite)
    └── Config (TOML)
```

## Dependency Rules

1. **Frontend → Backend**: only through Tauri invoke commands. No direct Rust FFI.
2. **STT/LLM providers**: must implement the trait. No provider-specific logic in pipeline.
3. **Config**: single source at `~/.vokey/config.toml`. Backend owns read/write, frontend reads via command.
4. **Storage**: SQLite for structured data (history, dictionary). Config stays in TOML for human readability.
5. **No network calls from frontend**: all API calls go through Rust backend.

## Domain Map

| Domain | Owner files | Description |
|--------|------------|-------------|
| Audio | `src-tauri/src/audio.rs` | Mic capture, WAV encoding, resampling |
| STT | `src-tauri/src/stt/` | Speech-to-text provider trait + impls |
| LLM | `src-tauri/src/llm/` | Language model provider trait + impls |
| Pipeline | `src-tauri/src/commands.rs` | Orchestrates record → STT → LLM → paste |
| Output | `src-tauri/src/paste.rs` | Clipboard + keyboard simulation |
| Config | `src-tauri/src/config.rs` | TOML config schema + read/write |
| UI: Home | `frontend/src/App.tsx` (home section) | Dashboard, recording, stats |
| UI: History | `frontend/src/App.tsx` (history section) | Past transcriptions |
| UI: Settings | `frontend/src/App.tsx` (settings section) | Config editing |
| i18n | `frontend/src/i18n/` | 11 language files |

## Expected Files

These files must exist. Legibility CI will fail if any are missing.

```yaml
expected_paths:
  - 'AGENTS.md'
  - 'docs/design/DESIGN.md'
  - 'docs/standards/hard-rules.md'
  - 'docs/standards/validation-and-gates.md'
  - 'docs/standards/coding-standards.md'
  - 'docs/standards/architecture.md'
  - 'docs/standards/autopilot.md'
  - 'src-tauri/src/lib.rs'
  - 'src-tauri/src/commands.rs'
  - 'src-tauri/src/config.rs'
  - 'src-tauri/src/audio.rs'
  - 'src-tauri/src/paste.rs'
  - 'src-tauri/src/stt/mod.rs'
  - 'src-tauri/src/llm/mod.rs'
  - 'frontend/src/App.tsx'
  - 'frontend/src/i18n/en.ts'
```
