---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# 架构

## 分层模型

```
前端 (React/TS)
    ↕ Tauri Commands (IPC 边界)
Rust 后端
    ├── 音频采集 (cpal)
    ├── STT Providers (trait)
    ├── LLM Providers (trait)
    ├── 管线编排器
    ├── App 上下文检测
    ├── 词典 (SQLite)
    ├── 历史记录 (SQLite)
    └── 配置 (TOML)
```

## 依赖规则

1. **前端 → 后端**：只通过 Tauri invoke 命令，不直接调 Rust FFI。
2. **STT/LLM providers**：必须实现 trait，管线中不出现 provider 专属逻辑。
3. **配置**：唯一来源 `~/.vokey/config.toml`，后端负责读写，前端通过命令读取。
4. **存储**：SQLite 存结构化数据（历史、词典），配置用 TOML（方便人读写）。
5. **前端不发网络请求**：所有 API 调用走 Rust 后端。

## 领域地图

| 领域 | 主要文件 | 说明 |
|------|---------|------|
| 音频 | `src-tauri/src/audio.rs` | 麦克风采集、WAV 编码、重采样 |
| STT | `src-tauri/src/stt/` | 语音转文字 trait + 各 provider 实现 |
| LLM | `src-tauri/src/llm/` | 大模型 trait + 各 provider 实现 |
| 管线 | `src-tauri/src/commands.rs` | 编排 录音 → STT → LLM → 粘贴 |
| 输出 | `src-tauri/src/paste.rs` | 剪贴板 + 键盘模拟 |
| 配置 | `src-tauri/src/config.rs` | TOML 配置 schema + 读写 |
| UI: 首页 | `frontend/src/App.tsx`（home 部分） | 仪表盘、录音、统计 |
| UI: 历史 | `frontend/src/App.tsx`（history 部分） | 历史转录记录 |
| UI: 设置 | `frontend/src/App.tsx`（settings 部分） | 配置编辑 |
| i18n | `frontend/src/i18n/` | 11 种语言文件 |

## 预期文件

以下文件必须存在，legibility CI 会检查。

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
