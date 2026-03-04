# Plan: Add OpenRouter as STT Provider

- **Issue**: #33
- **Branch**: `feat/openrouter-stt`
- **Status**: completed

## Context

OpenRouter proxies OpenAI Whisper API at `https://openrouter.ai/api/v1/audio/transcriptions`.
The implementation mirrors `openai.rs` with a different base URL and default model.
LLM side already supports OpenRouter — this adds STT parity.

## Changes

### Backend (`src-tauri/src/`)

1. **`stt/openrouter.rs`** (new file)
   - Copy structure from `openai.rs`
   - Base URL: `https://openrouter.ai/api/v1/audio/transcriptions`
   - Default model: `openai/whisper-large-v3`
   - `name()` returns `"openrouter"`

2. **`stt/mod.rs`**
   - Add `mod openrouter;`
   - Add `"openrouter"` match arm in `create_provider()`
   - Add test `create_provider_routes_to_openrouter`

3. **`config.rs`**
   - Add `const DEFAULT_OPENROUTER_STT_MODEL: &str = "openai/whisper-large-v3";`
   - Add `openrouter: SttProviderConfig` field to `SttConfig`
   - Add `SttProviderConfig::openrouter_default()` method
   - Update `SttConfig::default()` to include openrouter

### Frontend (`frontend/src/`)

4. **`types/app.ts`**
   - Add `'openrouter'` to `SttProvider` union type
   - Add `openrouter: SttProviderConfig` to `AppConfig.stt`

5. **`pages/Settings.tsx`**
   - Add OpenRouter option in STT provider dropdown
   - Show model/language fields when OpenRouter selected

6. **`utils/app.ts`**
   - Add openrouter to `getActiveSttConfig` / `setActiveSttConfig` if needed

7. **i18n files** (all 11 locales)
   - Add `settings.sttOpenRouter: "OpenRouter"` key

## Verification

- `cargo fmt --check && cargo clippy -- -D warnings && cargo test`
- `cd frontend && npm run lint && npm run build`
- Screenshots of Settings STT tab with OpenRouter selected

## NOT in scope

- Extracting shared `OpenAiCompatibleSttProvider` (future refactor, separate issue)
- Testing with real OpenRouter API key (acceptance test, not gate check)
