---
status: completed
priority: P0
estimated_effort: L
---

# M0 — MVP Plan

## Goal

Minimal viable loop: **hotkey → record → STT → paste raw text at cursor**.

No LLM polish yet. Just prove the core pipeline works end-to-end on macOS.

## Milestones

### M0.1 — Project Scaffold ✅
- [x] Tauri v2 project initialized
- [x] AGENTS.md with verification loop
- [x] CI pipeline (lint + test)
- [x] README + LICENSE

### M0.2 — Audio Capture
- [x] Record audio from default microphone via `cpal`
- [x] Global hotkey to start/stop recording (Tauri global shortcut)
- [x] Audio saved as WAV in memory (not to disk)
- [x] Frontend overlay: recording indicator
- [x] **Verify**: unit test for audio buffer capture

### M0.3 — STT Integration (Groq first)
- [x] `SttProvider` trait defined
- [x] `GroqWhisper` implementation (send WAV → get text)
- [x] Mock provider for CI tests
- [x] Config: API key via OS keychain
- [x] **Verify**: integration test with mock, manual test with real Groq key

### M0.4 — Text Pasting
- [x] Paste transcribed text at cursor position
- [x] macOS: use accessibility API or clipboard + Cmd+V simulation
- [x] **Verify**: E2E — speak into mic, text appears in TextEdit

### M0.5 — MVP Complete
- [x] Full loop works: hotkey → record → Groq STT → paste
- [x] Settings UI: configure API key, hotkey
- [x] History: last 10 transcriptions in SQLite
- [x] **Verify**: L2 E2E test documented with screenshot

## Non-goals for M0

- LLM polish (M1)
- Multiple STT providers (M1)
- Chinese filler word removal (M1)
- Personal dictionary (M2)
- Windows support (M2)
- App-specific prompts (M2)

## Success Criteria

> I can press a hotkey, say "let's schedule a meeting for tomorrow at 3pm",
> release the hotkey, and see the raw text pasted in whatever app I'm using.
> Latency under 3 seconds for a 10-second utterance.
