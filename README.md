# Vokey

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Open-source, BYOK voice dictation. Speak naturally, get polished text — using your own API keys.

## Why

Voice dictation apps either cost $12+/month or ship your audio to someone else's cloud. Vokey lets you bring your own keys and choose your own providers. No accounts, no subscriptions, no vendor lock-in.

## How It Works

```
Press hotkey → Speak → Release → Polished text appears at cursor
```

1. **Record** — Global hotkey captures audio via system microphone
2. **Transcribe** — Your choice of STT provider converts speech to raw text
3. **Polish** — Your choice of LLM cleans up filler words, fixes grammar, matches tone
4. **Paste** — Clean text inserted at cursor position in any app

## BYOK Providers

### Speech-to-Text
| Provider | Speed | Cost | Offline |
|----------|-------|------|---------|
| Groq Whisper | ⚡ ~3.7s/10min | $0.111/hr | ❌ |
| OpenAI Whisper | Fast | $0.006/min | ❌ |
| Gemini Audio | Fast | Pay per token | ❌ |
| Local Whisper | Depends on HW | Free | ✅ |

### LLM Polish
| Provider | Why |
|----------|-----|
| OpenRouter | One key, 100+ models |
| Groq | Ultra-fast inference |
| OpenAI | GPT-5 family |
| Gemini | Cheap + fast |
| Ollama | Fully offline |

## Features

- 🎤 **System-wide dictation** — Works in any app
- 🔑 **BYOK** — Bring your own API keys, no subscription
- 🌏 **Chinese-first** — Smart filler word removal for Mandarin
- 🎯 **Context-aware polish** — Different tones for different apps
- 📖 **Personal dictionary** — Custom terms and terminology
- 🔒 **Private** — API keys in OS keychain, audio never stored
- ⚡ **Lightweight** — Tauri, not Electron (~5MB vs ~150MB)

## Install

> Coming soon. macOS first, Windows to follow.

## Development

### Prerequisites
- Rust 1.75+
- Node.js 20+
- Tauri CLI: `cargo install tauri-cli`

### Setup
```bash
git clone https://github.com/liaohch3/vokey.git
cd vokey
npm install
cargo tauri dev
```

### Testing
```bash
# Rust tests
cargo test

# Frontend tests
cd frontend && npm test

# Full lint
cargo fmt --check && cargo clippy -- -D warnings
cd frontend && npm run lint && npm run typecheck
```

## Architecture

See [AGENTS.md](AGENTS.md) for full architecture details and development guidelines.

```
Frontend (React/TS) ←→ Tauri Commands ←→ Rust Backend
                                            ├── Audio Capture (cpal)
                                            ├── STT Provider (trait)
                                            ├── LLM Provider (trait)
                                            ├── Pipeline Orchestrator
                                            └── Config + Keychain
```

## License

MIT
