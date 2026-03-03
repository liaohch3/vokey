---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# 验证门禁

## 提交前检查

每次提交前运行：

```bash
# Rust
cargo fmt --check
cargo clippy -- -D warnings
cargo test

# 前端
cd frontend && npm run lint && npm run build
```

全部通过才能提交。格式化不过就跑 `cargo fmt` 再检查。

## 编码前检查清单

动手写代码前：

```bash
git diff --stat            # 有没有未提交的改动
git log --oneline -10      # 了解最近的历史
git fetch origin           # 拉最新远端
git rebase origin/main     # 保持最新
```

## 开 PR 前检查清单

开 PR 之前：

```bash
# 确保干净状态
git rebase origin/main

# 跑所有门禁
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cd frontend && npm run lint && npm run build

# 自审改动
git diff origin/main --stat
git diff origin/main           # 逐行读每个改动

# 确认范围：只改了相关文件
```

## 验证级别

| 级别 | 内容 | 时机 |
|------|------|------|
| **L0 — 单元** | `cargo test` + `npm run build` | 每次提交 |
| **L1 — Lint** | `cargo clippy` + `npm run lint` + legibility 检查 | 每次提交 |
| **L2 — E2E** | `cargo tauri dev` 构建应用，测试完整语音链路 | 里程碑功能 |
| **L3 — 发布** | 全套测试 + E2E + 干净系统上测试二进制 | 每次发版 |

## CI 管线

```
lint (fmt + clippy + eslint) → build (cargo check + vite build) → test (cargo test) → legibility
```
