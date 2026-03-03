---
status: active
priority: P0
estimated_effort: M
---

# 扩展 STT/LLM Providers + VoiceMode 管线

## 目标

扩展 STT 和 LLM provider 支持，并引入 VoiceMode 多模式管线，为三大核心功能（听写/问答/翻译）打基础。

## 上下文

- 设计文档：`docs/design/DESIGN.md` 第 6-8 章
- 当前 STT：Groq Whisper + Mock（2 个）
- 当前 LLM：Gemini + OpenAI-compatible + None（3 个）
- 当前管线：只支持听写模式，system prompt 硬编码

## 任务

### STT 扩展

- [x] 1. 新增 `src-tauri/src/stt/openai.rs` — OpenAI Whisper provider（Whisper API，multipart 上传）
- [x] 2. 新增 `src-tauri/src/stt/deepgram.rs` — Deepgram Nova-3（REST，audio body + query params）
- [x] 3. 新增 `src-tauri/src/stt/siliconflow.rs` — SiliconFlow（Whisper 兼容 API，国内可用）
- [x] 4. 更新 `src-tauri/src/stt/mod.rs` — 在 `create_provider` 中注册新 provider
- [x] 5. 更新 `src-tauri/src/config.rs` — 为每个新 provider 加配置 section

### LLM Provider 预设

- [x] 6. 重构 `src-tauri/src/llm/mod.rs` — 大多数 provider 复用 OpenAI-compatible，只需不同 base_url 预设
- [x] 7. 加 `default_base_url()` 函数，支持：openai、openrouter、deepseek、groq、moonshot、qwen、siliconflow、ollama
- [x] 8. 更新 `src-tauri/src/config.rs` — LLM provider 列表扩展 + 各 provider 的默认 model/base_url

### VoiceMode 管线

- [x] 9. 新增 `VoiceMode` 枚举（Dictation / AskAnything / Translation）在 `src-tauri/src/commands.rs`
- [x] 10. 管线编排器根据 mode 选择不同的 system prompt
- [x] 11. 新增 `src-tauri/src/prompts.rs` — 结构化 prompt 生成（听写/问答/翻译各一套）
- [x] 12. 翻译模式：配置 `target_lang`，prompt 里注入目标语言

### 前端适配

- [x] 13. Settings 页 STT provider 选择器加入新 provider 选项
- [x] 14. Settings 页 LLM provider 选择器加入新 provider 选项（带预设 base_url 自动填充）
- [x] 15. 更新 i18n（en.ts + zh-CN.ts）— 新 provider 名称和描述

### 质量

- [x] 16. 为每个新 STT provider 写 mock test
- [x] 17. 为 `prompts.rs` 写单测（不同 mode 生成不同 prompt）
- [x] 18. 跑全套 gate check：cargo fmt/clippy/test + npm lint/build
- [x] 19. 跑 legibility check

## 验收标准

- [ ] `cargo test` 全部通过
- [ ] `cargo clippy -- -D warnings` 无警告
- [ ] `npm run lint && npm run build` 通过
- [ ] `python3 scripts/check_legibility.py` 通过
- [ ] 配置文件里切换 provider，代码能正确路由到对应实现
- [ ] VoiceMode::Translation 的 prompt 包含目标语言
- [ ] 没有 provider 专属逻辑泄露到管线编排器中

## 决策记录

- STT providers were implemented as dedicated modules mirroring `groq.rs` to keep API contract differences isolated (multipart for OpenAI/SiliconFlow, raw audio + query params for Deepgram).
- LLM providers were consolidated through `OpenAiCompatibleProvider` with provider-specific preset config sections and `default_base_url()` fallback.
- Voice mode prompt generation was extracted into `prompts.rs` so orchestrator logic only passes `(mode, raw_text)` into provider generation.
- Translation target language was added to config as `llm.target_lang` and injected when `VoiceMode::Translation` is selected.
- The hardware-bound audio unit test was marked `#[ignore]` to keep `cargo test` deterministic in headless/no-microphone environments during gate checks.
