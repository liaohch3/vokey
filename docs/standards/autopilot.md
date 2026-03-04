---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# Auto-pilot 工作流

## 概述

Auto-pilot 实现完全 agent 驱动的开发闭环：

```
人提需求 → 执行计划 → Codex 实现 → Agent 自审 → CI 验证 → PR 就绪
```

人负责方向，Agent 负责执行。

## 闭环流程

### 第 1 步：需求 → 计划

人用自然语言描述需求。编排器（OpenClaw）转化为执行计划：

```markdown
# docs/plans/YYYY-MM-DD-<slug>.md
---
status: active
priority: P0
estimated_effort: M
---

## 目标
<一句话>

## 上下文
- 相关设计文档章节
- 当前代码状态
- 依赖关系

## 任务
- [ ] 任务 1：描述（文件：`path/to/file.rs`）
- [ ] 任务 2：描述（文件：`path/to/component.tsx`）
- [ ] 任务 3：写测试
- [ ] 任务 4：更新 i18n
- [ ] 任务 5：跑 gate check

## 验收标准
- [ ] 标准 1
- [ ] 标准 2
- [ ] 所有 gate check 通过

## 决策记录
（执行过程中填写）
```

### 第 2 步：计划 → Codex 执行

编排器通过 tmux 启动 Codex：

```bash
tmux new-session -d -s vokey-<slug> -c /path/to/vokey
tmux send-keys -t vokey-<slug> "codex --dangerously-bypass-approvals-and-sandbox \"
先读 AGENTS.md。
读执行计划 docs/plans/YYYY-MM-DD-<slug>.md。
按顺序执行所有任务。
每完成一个任务，跑 gate check（见 docs/standards/validation-and-gates.md）。
更新计划文件：勾选完成的任务，记录决策。
完成后提交所有改动并推送到 feat/<slug> 分支。
然后运行：gh pr create --title '<标题>' --body '<内容>'
最后运行：openclaw system event --text 'Done: <摘要>' --mode now
\"" Enter
```

### 第 3 步：Agent 自审

开 PR 前，Codex 自我审查：

1. 跑所有 gate check（fmt、clippy、test、lint、build）
2. `git diff origin/main` — 逐行审查每个改动
3. 确认只改了相关文件（没有范围蔓延）
4. 检查计划中所有任务是否完成
5. 验证验收标准
6. 更新计划状态为 `completed`

### 第 4 步：CI 验证

GitHub Actions 在每个 PR 上运行：

1. **Lint** — `cargo fmt --check` + `cargo clippy` + `npm run lint`
2. **Build** — `cargo check` + `npm run build`
3. **Test** — `cargo test`
4. **Legibility** — `python3 scripts/check_legibility.py`

### 第 5 步：人审查（可选）

人收到 PR 链接，可以：
- CI 通过且改动没问题 → 直接合并
- 留评审意见 → Codex 响应并迭代
- 要求改动 → 新一轮 Codex 执行

### 第 6 步：沉淀复盘（必须）

PR 合并后，编排器执行沉淀：

1. **更新计划状态** — `status: completed`，补充 `## 复盘` 节（耗时、效果、做得好、可改进）
2. **记录踩坑** — 遇到的问题写入 `docs/error-experience/YYYY-MM-DD-<slug>.md`
3. **记录好实践** — 值得推广的做法写入 `docs/good-experience/YYYY-MM-DD-<slug>.md`
4. **效果截图** — 关键效果截图存入 `docs/screenshots/` 或计划文件中引用
5. **提交沉淀** — 沉淀内容单独 commit 到 main（`docs: retrospective for <slug>`）

> 这一步不能跳过。没有复盘的闭环是断的。

## 监控

cron job 监控活跃的 Codex 会话：

1. 检查 tmux 输出看进度/错误
2. Codex 完成 → 跑验收验证
3. Codex 出错 → 报告给人
4. Codex 卡住（>30min 无输出）→ 告警

## 计划生命周期

```
active → completed     （所有任务完成，PR 合并）
active → cancelled     （需求变了，计划废弃）
```

计划版本化到 git。不要删除计划 — 标记 completed 或 cancelled。

## 约定

### 分支命名
```
feat/<slug>          — 新功能
fix/<slug>           — 修 bug
refactor/<slug>      — 代码改善
docs/<slug>          — 纯文档
infra/<slug>         — CI、工具、脚本
```

### 提交信息
```
feat: add OpenAI Whisper STT provider
fix: handle empty audio buffer in pipeline
refactor: extract settings into tabbed components
docs: update architecture diagram
infra: add legibility CI workflow
```

### PR body 模板
```markdown
## 做了什么
<一句话摘要>

## 为什么
<动机 / 关联的执行计划>

## 怎么做的
<实现方案>

## 计划
关联 docs/plans/YYYY-MM-DD-<slug>.md

## 检查清单
- [ ] 本地 gate check 通过
- [ ] 计划任务全部完成
- [ ] 验收标准全部满足
- [ ] i18n 已更新（如果改了 UI）
- [ ] 截图已附上（如果改了 UI）
```

## 黄金原则

机械化强制执行，适用于所有 agent 输出：

1. **边界验证** — 在 API/IPC 边界解析和验证数据
2. **Trait 优先** — 每个 provider 都在 trait 后面
3. **配置驱动** — 行为由 `~/.vokey/config.toml` 控制，不硬编码
4. **测试有意义的东西** — 逻辑写单测，管线写集成测试
5. **结构化日志** — `log::info!()` 带上下文，不用 `println!()`
6. **i18n 一切** — 所有用户可见文案走 `t()` 函数
7. **无聊的技术** — 优先选稳定、文档好、可组合的依赖
8. **小 PR** — 一个 PR 一件事，容易审查和回滚。复杂计划拆成多个 PR：每个 PR 对应计划中的一组任务（如 STT 扩展一个 PR、LLM 扩展一个 PR），不要把整个计划塞进一个大 PR
