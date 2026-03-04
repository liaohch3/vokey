# AGENTS.md — Vokey

本文件是**目录**，不是百科全书。
先读这里，然后按指引深入具体文档。

## 项目定位

开源、BYOK 语音输入桌面应用，macOS 优先（后续支持 Windows）。
技术栈：Tauri v2 + Rust 后端 + React/TypeScript 前端。
核心链路：**快捷键 → 录音 → STT → LLM 润色 → 粘贴到光标处**。

## 不可违反的规则

1. **每次提交前必须跑 gate check** — 见 `docs/standards/validation-and-gates.md`
2. **一次提交只做一件事** — 不混合重构和功能
3. **代码/注释/文档/提交信息用英文**（例外：`README_zh.md`、中文文档）
4. **UI 变更必须截图** — PR body 里附上截图
5. **编码前跑 pre-work 检查清单**，**开 PR 前跑 pre-PR 检查清单**
6. **必须推送并开 PR** — `gh pr create` 跑了才算完
7. **复杂功能需要执行计划** — 放在 `docs/plans/`

## 标准目录

| 标准 | 位置 |
|------|------|
| 硬性规则 | `docs/standards/hard-rules.md` |
| 验证门禁 | `docs/standards/validation-and-gates.md` |
| 编码规范 | `docs/standards/coding-standards.md` |
| 架构 | `docs/standards/architecture.md` |
| Auto-pilot 工作流 | `docs/standards/autopilot.md` |
| 调试标准 | `docs/standards/debugging-standards.md` |
| 截图标准 | `docs/standards/screenshot-standards.md` |

## 架构速览

```
frontend/src/          → React UI（页面、组件、i18n）
src-tauri/src/         → Rust 后端
  ├── audio.rs         → 麦克风采集（cpal）
  ├── commands.rs      → Tauri 命令 + 管线编排
  ├── config.rs        → TOML 配置 ~/.vokey/config.toml
  ├── paste.rs         → 剪贴板 + Cmd+V 模拟
  ├── stt/             → STT provider trait + 实现
  └── llm/             → LLM provider trait + 实现
docs/
  ├── design/          → 产品和 UI 设计文档
  ├── standards/       → 工程标准（本目录）
  └── plans/           → 执行计划（active / completed / cancelled）
scripts/               → CI、lint、自动化脚本
.agents/skills/        → Agent 技能（可复用的任务配方）
```

## 配置

TOML 文件位于 `~/.vokey/config.toml`，schema 见 `src-tauri/src/config.rs`。

## 核心 Trait

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

## Brain + Hands 协议

- **人 / Claude Opus** = 规划大脑。架构、设计、审查决策。
- **Codex** = 执行双手。写代码、跑测试、开 PR。

不要把架构决策交给执行工具。
能让 Codex 写的代码就不要手写。

## 开发闭环（必须遵守）

每个功能/重构都必须走完完整闭环：

```
规划 → 执行 → 验证 → 沉淀
```

### 1. 规划（开发前）
- 复杂功能写执行计划：`docs/plans/YYYY-MM-DD-<slug>.md`
- 计划包含：目标、任务清单、验收标准
- **不允许没有计划就开始写代码**（简单 bug fix 除外）

### 2. 执行（开发中）
- 见 Auto-pilot 工作流：`docs/standards/autopilot.md`
- 关键进展要截图/录屏留档

### 3. 验证（开发后）
- gate check 全部通过
- UI 变更必须截图（before/after 对比）
- 更新计划状态为 `completed`

### 4. 沉淀（PR 合并后，必须执行）
每个 PR 合并后，编排器必须回顾并沉淀：

**踩坑记录**（遇到问题时）：`docs/error-experience/YYYY-MM-DD-<slug>.md`
```markdown
## 问题
发生了什么？

## 根因
为什么会这样？

## 解决方案
怎么修的？

## 教训
下次怎么避免？
```

**好实践记录**（做得好时）：`docs/good-experience/YYYY-MM-DD-<slug>.md`
```markdown
## 实践
做了什么？

## 效果
带来了什么好处？数据/截图证明。

## 推广
哪些场景可以复用？
```

**进展报告**：在计划文件底部追加 `## 复盘` 节：
```markdown
## 复盘
- **耗时**：实际 vs 预估
- **效果**：截图/数据证明
- **做得好**：...
- **可改进**：...
- **沉淀到**：docs/error-experience/... 或 docs/good-experience/...
```

> 没有沉淀的开发 = 白做。经验不记录就会重复踩坑。

## Auto-pilot

完整工作流见 `docs/standards/autopilot.md`。

一句话：人提需求 → 执行计划 → Codex 写代码 + 测试 → Agent 自审 → PR → CI 验证 → 人合并 → **沉淀复盘**。
