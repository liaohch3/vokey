# Vokey v1.0 — Complete Design Specification

> Pure client-side, BYOK AI voice input for desktop.
> Zero server, zero account, zero subscription.

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Architecture](#2-architecture)
3. [Core Modes](#3-core-modes)
4. [UI Design](#4-ui-design)
5. [Data Model](#5-data-model)
6. [STT Layer](#6-stt-layer)
7. [LLM Layer](#7-llm-layer)
8. [Prompt System](#8-prompt-system)
9. [App Context Detection](#9-app-context-detection)
10. [Audio Pipeline](#10-audio-pipeline)
11. [Output System](#11-output-system)
12. [Dictionary](#12-dictionary)
13. [Onboarding](#13-onboarding)
14. [System Tray](#14-system-tray)
15. [Delta from Current Code](#15-delta-from-current-code)

---

## 1. Product Vision

Vokey = **hotkey → speak → polished text appears at cursor**.

Three modes:
- **Dictation**: clean up speech → output text
- **Ask Anything**: speak a question → AI answers → output text
- **Translation**: speak in any language → output translated text

All processing via user's own API keys. No cloud backend. No accounts. No usage limits.

---

## 2. Architecture

Current architecture is already solid. Key changes are additive, not structural.

```
┌──────────────────────────────────────────────────┐
│                  Frontend (React/TS)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │   Home   │ │ History  │ │ Settings │         │
│  │ (record  │ │ (SQLite) │ │ (config) │         │
│  │  + stats)│ │          │ │          │         │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘         │
│       └─────────────┴────────────┘               │
│                     │ Tauri Commands              │
├─────────────────────┴────────────────────────────┤
│                 Rust Backend                      │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐      │
│  │  Audio   │ │    STT    │ │    LLM     │      │
│  │ Capture  │ │  Adapter  │ │   Adapter  │      │
│  │ (cpal)   │ │ (trait)   │ │  (trait)   │      │
│  └────┬─────┘ └─────┬─────┘ └─────┬──────┘      │
│       │              │             │              │
│  ┌────┴──────────────┴─────────────┴───────────┐ │
│  │          Pipeline Orchestrator               │ │
│  │  record → STT → polish/ask/translate → paste │ │
│  └──────────────────────────────────────────────┘ │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐      │
│  │ Hotkey   │ │  Config   │ │   Dict     │      │
│  │ Manager  │ │ (TOML)    │ │  (SQLite)  │      │
│  └──────────┘ └───────────┘ └────────────┘      │
│  ┌──────────────────────────────────────────┐    │
│  │         App Context Detector             │    │
│  │  (foreground app name / bundle ID /      │    │
│  │   browser tab domain)                    │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

### What's new vs current code

| Component | Current | Target |
|-----------|---------|--------|
| Modes | Dictation only | + Ask Anything, + Translation |
| STT providers | Groq + Mock | + OpenAI Whisper, Deepgram, GLM-ASR, SiliconFlow |
| LLM providers | Gemini + OpenAI-compat + None | + DeepSeek, Ollama, OpenRouter, Groq, Claude, etc. |
| Hotkeys | Single global hotkey | 3 independent hotkeys (dictation/ask/translate) |
| Storage | localStorage | SQLite (history + dictionary) |
| Dictionary | None | User dictionary with auto-learn |
| App context | None | Detect foreground app → adjust prompt |
| Onboarding | None | 5-step guided setup |
| Settings | Single page | Tabbed: General / STT / LLM / Dictionary / About |
| Floating bar | None | Transparent overlay for recording status |

---

## 3. Core Modes

### 3.1 Dictation (existing, enhance)

```
hotkey → record → STT → LLM polish (optional) → paste
```

- Default hotkey: `Cmd+Shift+Space` (current)
- Hold-to-talk and toggle modes
- Auto-detect app context for prompt adjustment
- Dictionary words injected into prompt

### 3.2 Ask Anything (new)

```
hotkey → record → STT → LLM generate answer → paste
```

- Separate hotkey (user-configurable)
- System prompt: "Answer the following question concisely."
- Can operate on selected text: select text → press hotkey → speak instruction → AI applies

### 3.3 Translation (new)

```
hotkey → record → STT → LLM translate → paste
```

- Separate hotkey (user-configurable)
- Auto-detect source language
- Configurable target language (default: English)
- System prompt: "Translate the following text to {target_lang}. Output only the translation."

### Pipeline change

Current pipeline is hardcoded to dictation. Change to:

```rust
pub enum VoiceMode {
    Dictation,
    AskAnything,
    Translation { target_lang: String },
}
```

The pipeline orchestrator selects system prompt based on mode.

---

## 4. UI Design

### 4.1 Main Window Layout (existing, refine)

Current sidebar layout is good. Changes:

```
┌──────────────────────────────────────┐
│           Title Bar (draggable)      │
├────────────┬─────────────────────────┤
│            │                         │
│  Sidebar   │    Content Area         │
│            │                         │
│  🏠 Home    │                         │
│  📋 History │                         │
│  📖 Dict    │    ← NEW               │
│            │                         │
│  ─────────  │                         │
│  ⚙️ Settings│                         │
│            │                         │
│  🌐 Lang    │                         │
│  v0.1.0    │                         │
└────────────┴─────────────────────────┘
```

**New nav item**: Dictionary (📖)

### 4.2 Home Page (existing, enhance)

Current home is good. Add:
- Mode indicator showing which mode is active
- Current STT/LLM provider summary card
- Quick-setup prompt if no API keys configured

### 4.3 History Page (existing, enhance)

Current history uses localStorage. Migrate to SQLite. Add:
- Mode badge per entry (🎙 Dictation / 💬 Ask / 🌐 Translate)
- Expand to show raw vs polished
- Search/filter
- Retention policy setting

### 4.4 Dictionary Page (new)

```
┌─────────────────────────────────────┐
│  📖 Dictionary              [+ Add] │
├─────────────────────────────────────┤
│  All │ Manual │ Auto-learned   🔍   │
├─────────────────────────────────────┤
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │OpenAI│ │Claude│ │Tauri │       │
│  └──────┘ └──────┘ └──────┘       │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │BYOK  │ │Vokey │ │cpal  │       │
│  └──────┘ └──────┘ └──────┘       │
│                                     │
└─────────────────────────────────────┘
```

- Chip/tag layout for quick scanning
- Filter by source (manual vs auto-learned)
- Click to edit/delete
- Auto-learn: when user corrects polished text, extract new terms

### 4.5 Settings (existing, restructure)

Current settings is a single scrollable page. Change to tabbed:

| Tab | Content |
|-----|---------|
| **General** | Hotkeys (×3), hotkey mode, output mode, max recording, mic select, sound effects, auto-start, history retention |
| **STT** | Provider selector, API key, model, language |
| **LLM** | Provider selector, API key, model, base URL, system prompt, feature toggles (polish/translate/ask) |
| **Dictionary** | Same as dictionary page (or link to it) |
| **About** | Version, GitHub, license, check updates |

#### General tab detail

```
Hotkeys
────────────────────────
Dictation      [⌘⇧Space        ] ← current, keep
Ask Anything   [record shortcut  ]
Translation    [record shortcut  ]

Hotkey Mode    (●) Hold to talk  (○) Toggle

Output
────────────────────────
Mode           (●) Keyboard sim  (○) Clipboard paste

Recording
────────────────────────
Max duration   ────●──── 30s
Microphone     [▼ System Default     ]
Sound effects  [●]

Startup
────────────────────────
Launch at login [○]
Start minimized [○] (shown when launch at login is on)

Data
────────────────────────
History retention [▼ Forever       ]
```

#### STT tab detail

Add more providers to the segmented control:

```
Provider  [Groq] [OpenAI] [Deepgram] [GLM-ASR] [SiliconFlow] [Mock]

API Key   [••••••••••••] [👁️]
          Keys are stored locally only.

Model     [whisper-large-v3-turbo    ]
Language  [▼ Auto / Chinese / English / Japanese ]
```

#### LLM tab detail

```
Provider  [Gemini] [OpenAI-compat] [OpenRouter] [Ollama] [None]

API Key   [••••••••••••] [👁️]
Model     [gemini-2.0-flash          ] [🔄 fetch]
Base URL  [https://...               ] (shown for OpenAI-compat/OpenRouter/Ollama)

System Prompt  [textarea, 5 rows]

Features
────────────────────────
AI Polish      [●]
Translation    [○]  → Target lang: [▼ English ]
Ask Anything   [○]
```

### 4.6 Floating Bar (new)

A small transparent overlay window showing recording status:

```
Idle:          (invisible or minimal dot)
Recording:     🔴 ~~~~ 0:05     (red pulse + waveform + timer)
Transcribing:  ⏳ Transcribing...
Polishing:     ✨ Polishing...
Done:          ✅ (flash 1s then hide)
Error:         ❌ Error (click to dismiss)
```

- Draggable
- Always on top
- Left click: start/stop recording
- Right click: mode switch menu

**Implementation**: Separate Tauri window with `transparent: true`, `decorations: false`, `always_on_top: true`.

### 4.7 Color System

Keep current dark theme as default. Add light + system-follow.

| Token | Dark | Light |
|-------|------|-------|
| bg-primary | #1A1A1A | #FFFFFF |
| bg-secondary | #262626 | #F5F5F5 |
| text-primary | #F5F5F5 | #1A1A1A |
| text-secondary | #A0A0A0 | #666666 |
| accent | #2ABBA7 | #2ABBA7 |
| error | #E53E3E | #E53E3E |
| success | #38A169 | #38A169 |
| border | #333333 | #E5E5E5 |

---

## 5. Data Model

### 5.1 Config (existing, extend)

Current: TOML at `~/.vokey/config.toml`. Keep this, extend:

```toml
[hotkey]
dictation = "CmdOrCtrl+Shift+Space"
ask = ""           # NEW: empty = disabled
translate = ""     # NEW: empty = disabled
mode = "hold"      # hold | toggle

[output]
method = "keyboard"     # keyboard | clipboard
max_recording_secs = 30

[audio]
device = ""        # empty = system default
sound_effects = true
auto_mute = false  # NEW: mute other audio during recording

[app]
auto_start = false
start_minimized = false
theme = "system"   # dark | light | system

[history]
retention = "forever"   # forever | never | 30d | 90d | 1y

[stt]
provider = "groq"
api_key = ""
[stt.groq]
model = "whisper-large-v3-turbo"
language = "zh"
# NEW: sections for each provider
[stt.openai]
model = "whisper-1"
[stt.deepgram]
model = "nova-3"
[stt.glm_asr]
model = "glm-asr"
[stt.siliconflow]
model = "whisper-large-v3"

[llm]
provider = "none"
api_key = ""
system_prompt = "..."
[llm.gemini]
model = "gemini-2.0-flash"
[llm.openai]
model = "gpt-4o-mini"
base_url = "https://api.openai.com"
# NEW:
[llm.openrouter]
model = "anthropic/claude-haiku-4-5"
[llm.ollama]
model = "llama3"
base_url = "http://localhost:11434"
[llm.deepseek]
model = "deepseek-chat"

[translation]
enabled = false
target_lang = "en"

[ask]
enabled = false
```

### 5.2 History (migrate from localStorage to SQLite)

```sql
CREATE TABLE history (
  id              TEXT PRIMARY KEY,
  mode            TEXT NOT NULL DEFAULT 'dictation',  -- dictation | ask | translate
  raw_text        TEXT NOT NULL,
  polished_text   TEXT NOT NULL,
  duration_ms     INTEGER,
  language        TEXT,
  app_name        TEXT,
  app_bundle_id   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_history_created_at ON history(created_at DESC);
```

### 5.3 Dictionary (new)

```sql
CREATE TABLE dictionary (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word        TEXT NOT NULL UNIQUE,
  source      TEXT NOT NULL DEFAULT 'manual',  -- manual | auto
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 6. STT Layer

### Current

```rust
pub trait SttProvider: Send + Sync {
    fn transcribe(&self, wav_data: &[u8]) -> Result<String, SttError>;
    fn name(&self) -> &str;
}
```

Implementations: `GroqWhisper`, `MockStt`.

### Target: add providers

| Provider | Endpoint | Auth | Notes |
|----------|---------|------|-------|
| Groq Whisper ✅ | api.groq.com | Bearer token | Fastest, current default |
| OpenAI Whisper | api.openai.com | Bearer token | Most universal |
| Deepgram Nova-3 | api.deepgram.com | Bearer token | Best English accuracy |
| GLM-ASR (智谱) | open.bigmodel.cn | Bearer token | Best Chinese, no GFW |
| SiliconFlow | api.siliconflow.cn | Bearer token | China-accessible, cheap |
| Mock ✅ | — | — | For CI |

All use the same Whisper-compatible multipart API (file + model + language), except:
- Deepgram: REST with audio body + query params
- GLM-ASR: REST with base64 audio in JSON body

### Config-driven provider creation

```rust
pub fn create_provider(config: &SttConfig) -> Result<Box<dyn SttProvider>, SttError> {
    match config.provider.as_str() {
        "groq" => ...,
        "openai" => ...,    // NEW
        "deepgram" => ...,  // NEW
        "glm-asr" => ...,   // NEW
        "siliconflow" => ..., // NEW
        "mock" => ...,
        _ => Err(SttError::UnsupportedProvider(...)),
    }
}
```

---

## 7. LLM Layer

### Current

```rust
pub trait LlmProvider: Send + Sync {
    fn polish(&self, raw_text: &str, system_prompt: &str) -> Result<String, LlmError>;
    fn name(&self) -> &str;
}
```

Implementations: `GeminiProvider`, `OpenAiCompatibleProvider`, `PassthroughProvider`.

### Target: enhance trait

```rust
pub trait LlmProvider: Send + Sync {
    fn generate(&self, system_prompt: &str, user_message: &str) -> Result<String, LlmError>;
    fn name(&self) -> &str;
}
```

Rename `polish` → `generate` since it now serves dictation polish, ask, and translation.

### Providers

Most LLM providers use OpenAI-compatible API. Reuse `OpenAiCompatibleProvider` with different base URLs:

| Provider | Base URL | Notes |
|----------|---------|-------|
| Gemini ✅ | generativelanguage.googleapis.com | Custom API format |
| OpenAI-compat ✅ | configurable | Covers OpenAI, DeepSeek, Groq, Moonshot, Qwen |
| OpenRouter | openrouter.ai/api/v1 | One key → 100+ models |
| Ollama | localhost:11434 | Offline, no key needed |
| None ✅ | — | Passthrough |

**Key insight**: Most providers are just OpenAI-compatible with different base URLs. No need for separate implementations — the current `OpenAiCompatibleProvider` already handles them all. Just provide presets:

```rust
fn default_base_url(provider: &str) -> &str {
    match provider {
        "openai" => "https://api.openai.com",
        "openrouter" => "https://openrouter.ai/api",
        "deepseek" => "https://api.deepseek.com",
        "groq" => "https://api.groq.com/openai",
        "moonshot" => "https://api.moonshot.cn",
        "qwen" => "https://dashscope.aliyuncs.com/compatible-mode",
        "siliconflow" => "https://api.siliconflow.cn",
        "ollama" => "http://localhost:11434",
        _ => "",
    }
}
```

---

## 8. Prompt System

### 8.1 Dictation prompt (existing, enhance)

Current system prompt is a single configurable string. Enhance with structured rules:

**Base prompt** (built-in, not user-editable):
```
You are a dictation cleanup assistant.

Rules (in priority order):
1. PUNCTUATION — Add punctuation at speech pauses
2. CLEANUP — Remove filler words, false starts, repetitions
3. LISTS — Detect enumeration signals, format as numbered lists
4. PARAGRAPHS — Separate distinct topics with blank lines
5. PRESERVE — Keep original language, technical terms, proper nouns
6. OUTPUT — Return only the cleaned text, no explanation

{dictionary_injection}
{app_context_injection}
{user_custom_prompt}
```

### 8.2 Dictionary injection

```
Custom vocabulary (always use exact spelling):
- OpenAI
- Tauri
- Vokey
- {user's dictionary words}
```

### 8.3 App context injection

```
Context: User is typing in {app_type} ({app_name}).
{app_type_specific_instruction}
```

| App type | Instruction |
|----------|------------|
| Email | Use complete sentences and professional tone. |
| Chat/IM | Keep it casual and concise. |
| Document | Use paragraph structure. Support Markdown. |
| Code editor | Minimal processing. Preserve technical terms exactly. |

### 8.4 Ask Anything prompt

```
You are a helpful assistant. Answer the user's question concisely.
If the user references selected text, apply their instruction to that text.
Output only the result, no explanation or preamble.
```

### 8.5 Translation prompt

```
Translate the following text to {target_language}.
Preserve the original meaning, tone, and formatting.
Output only the translation, no explanation.
```

---

## 9. App Context Detection

### Current: None

### Target: detect foreground app

```rust
pub struct AppContext {
    pub app_name: String,        // "Google Chrome"
    pub bundle_id: String,       // "com.google.Chrome"
    pub app_type: AppType,       // Email | Chat | Document | Code | General
    pub window_title: Option<String>,
}

pub enum AppType {
    Email,
    Chat,
    Document,
    Code,
    General,
}
```

**macOS implementation**: Use `NSWorkspace.shared.frontmostApplication` via objc FFI (already have `core-graphics` dependency).

**App type detection**:

```rust
fn detect_app_type(bundle_id: &str, window_title: &str) -> AppType {
    match bundle_id {
        "com.apple.mail" | "com.microsoft.Outlook" => AppType::Email,
        "com.tinyspeck.slackmacgap" | "com.tencent.xinWeChat" => AppType::Chat,
        // ... pattern matching on known bundle IDs
        _ => {
            // Check window title for web apps
            if window_title.contains("Gmail") { AppType::Email }
            else if window_title.contains("Slack") { AppType::Chat }
            // ...
            else { AppType::General }
        }
    }
}
```

---

## 10. Audio Pipeline

### Current: solid, no major changes needed

- `cpal` for capture ✅
- 16kHz mono WAV encoding ✅
- Linear resampling ✅
- Mic permission request ✅

### Additions

1. **Max recording duration**: enforce `config.output.max_recording_secs` (currently not enforced in Rust)
2. **Silence detection**: if entire recording is silence, warn user instead of sending to STT
3. **Sound effects**: play start/stop beep (optional)
4. **Auto-mute**: mute system audio during recording (optional, macOS only)

---

## 11. Output System

### Current

Clipboard + Cmd+V simulation. Saves and restores previous clipboard content. ✅

### Additions

1. **Keyboard simulation mode**: use `enigo` crate to type characters directly (avoids clipboard hijack)
   - Caveat: slower for long text, may not work in all apps
2. **User choice**: `output.method = "keyboard" | "clipboard"` in config
3. **Streaming output**: for long text, output as LLM generates (requires streaming LLM API)

---

## 12. Dictionary

### Purpose

Users often dictate domain-specific terms that STT/LLM get wrong. The dictionary:
1. **Manual entries**: user adds terms they frequently use
2. **Auto-learned**: when user edits polished output, diff against raw to find new terms
3. **Prompt injection**: all dictionary words are included in LLM prompt

### Auto-learn flow

```
User dictates → STT: "I'm using taury" → LLM polishes: "I'm using Tauri"
User accepts polished text.
System diffs: "taury" → "Tauri" → auto-add "Tauri" to dictionary.
```

This requires tracking user edits, which means:
- When user copies polished text and modifies it → can't track (out of our control)
- When user uses in-app "edit before paste" → can track

For v1, start with manual dictionary only. Auto-learn can be added later.

---

## 13. Onboarding (new)

5-step flow on first launch:

```
Step 1: Welcome
  "Voice to text, your way."
  Select primary language: [Auto] [中文] [English] [日本語] ...

Step 2: Speech-to-Text
  Choose STT provider: [Groq ⚡] [OpenAI] [Deepgram] ...
  API Key: [____________] [Test ✓]
  "Keys stored locally. Never sent to our servers (we don't have any)."

Step 3: AI Polish (optional)
  Choose LLM provider: [Gemini] [OpenRouter] [Ollama 🔒] [Skip]
  API Key: [____________] [Test ✓]
  Model: [____________]

Step 4: Try it!
  [🎤 Press to record]
  → Real-time demo: speak → see raw → see polished
  "Your first dictation!"

Step 5: Done
  Show hotkey: ⌘⇧Space
  Show three modes: Dictation / Ask / Translate
  [Start using Vokey →]
```

Store onboarding completion in config: `onboarding_completed = true`.

---

## 14. System Tray (new)

macOS menu bar icon with dropdown:

```
┌─────────────────────┐
│  Open Vokey         │
│  ─────────────────  │
│  🎙 Dictation  ⌘⇧⎵ │
│  💬 Ask         ... │
│  🌐 Translate   ... │
│  ─────────────────  │
│  🎤 Microphone  ▸   │  → submenu: list of mics
│  📖 Add to Dict     │
│  ⚙️ Settings        │
│  ─────────────────  │
│  Check for Updates  │
│  Quit Vokey         │
└─────────────────────┘
```

---

## 15. Delta from Current Code

Summary of what needs to change, ordered by priority.

### P0 — Must have for v1

| Area | Change | Effort |
|------|--------|--------|
| **Pipeline** | Add `VoiceMode` enum, route to different prompts | S |
| **Hotkeys** | Support 3 independent hotkeys in config + lib.rs | M |
| **Settings UI** | Refactor to tabbed layout (General/STT/LLM/Dict/About) | M |
| **Settings: General** | Add hotkey recording, output mode, mic select, sound effects, auto-start, retention | M |
| **STT providers** | Add OpenAI Whisper, Deepgram, GLM-ASR, SiliconFlow | M |
| **LLM providers** | Add OpenRouter, Ollama, DeepSeek (mostly reuse OpenAI-compat) | S |
| **History** | Migrate from localStorage to SQLite | M |
| **Dictionary** | New page + SQLite table + prompt injection | M |
| **Onboarding** | 5-step first-run wizard | M |

### P1 — Important for good UX

| Area | Change | Effort |
|------|--------|--------|
| **App context** | Detect foreground app, adjust prompt | M |
| **Floating bar** | New Tauri window for recording status | M |
| **System tray** | Menu bar icon + dropdown | S |
| **Theme** | Light/dark/system with CSS variables | S |
| **History search** | Full-text search on history entries | S |
| **Sound effects** | Play start/stop audio cues | S |

### P2 — Nice to have

| Area | Change | Effort |
|------|--------|--------|
| **Keyboard output** | Alternative to clipboard paste via enigo | M |
| **Streaming LLM** | Stream LLM response for long text | M |
| **Auto-learn dict** | Extract new terms from user corrections | L |
| **Silence detection** | Warn if recording is silent | S |
| **Recording timeout** | Enforce max_recording_secs in Rust | S |
| **Windows support** | Port macOS-specific code (paste, app detect) | L |

### Effort key
- **S** = Small (< 1 day)
- **M** = Medium (1-3 days)
- **L** = Large (3+ days)

---

## Appendix: File Change Map

Mapping design to actual source files:

| Design area | Files to create/modify |
|-------------|----------------------|
| VoiceMode + pipeline | `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` |
| 3 hotkeys | `src-tauri/src/lib.rs`, `src-tauri/src/config.rs` |
| New STT providers | `src-tauri/src/stt/openai.rs`, `stt/deepgram.rs`, `stt/glm.rs`, `stt/siliconflow.rs`, `stt/mod.rs` |
| LLM provider presets | `src-tauri/src/llm/mod.rs`, `src-tauri/src/config.rs` |
| App context | `src-tauri/src/app_context.rs` (new) |
| Dictionary | `src-tauri/src/dictionary.rs` (new), SQLite migration |
| History SQLite | `src-tauri/src/history.rs` (new), SQLite migration |
| Floating bar | `src-tauri/src/lib.rs` (new window), `frontend/src/FloatingBar.tsx` (new) |
| Settings tabs | `frontend/src/App.tsx` or split into components |
| Dictionary page | `frontend/src/Dictionary.tsx` (new) |
| Onboarding | `frontend/src/Onboarding.tsx` (new) |
| System tray | `src-tauri/src/tray.rs` (new), `src-tauri/src/lib.rs` |
| i18n | `frontend/src/i18n/*.ts` (add new keys) |
| Prompt system | `src-tauri/src/prompts.rs` (new) |
