---
status: active
priority: P0
estimated_effort: L
---

# M1 — LLM Polish + Multi-Provider

## Goal

Add LLM-powered text cleanup and support multiple STT/LLM providers.

## Features

### M1.1 — LLM Polish Pipeline
- [ ] `LlmProvider` trait defined
- [ ] OpenRouter implementation (covers most models with one key)
- [ ] Groq implementation (ultra-fast)
- [ ] Default polish prompt: remove fillers, fix grammar, keep meaning
- [ ] Chinese filler word handling ("那个", "就是", "然后", "嗯")
- [ ] Toggle: raw vs polished output
- [ ] **Verify**: same input, compare raw vs polished output

### M1.2 — Additional STT Providers
- [ ] OpenAI Whisper API
- [ ] Gemini multimodal audio
- [ ] Local whisper.cpp (offline fallback)
- [ ] Provider selection in settings UI

### M1.3 — App-Aware Polish
- [ ] Detect foreground app name
- [ ] Per-app prompt customization in config
- [ ] Default presets: casual (chat), professional (email), technical (code)

## Success Criteria

> I can dictate in Chinese with "嗯那个我想说的是明天下午三点开会",
> and get back "明天下午三点开会" — clean, no fillers, professional tone.
