---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# 硬性规则

以下规则不可违反。如果做不到，停下来说明原因。

1. 每次提交前跑 gate check：`cargo fmt --check`、`cargo clippy -- -D warnings`、`cargo test`、`cd frontend && npm run lint && npm run build`。
2. UI 变更必须在 PR body 里附上前后截图。
3. 一次提交只做一件事。不要把重构和功能/修复混在一起。
4. 代码、注释、提交信息用英文。
5. 编码前跑 pre-work 检查清单；开 PR 前跑 pre-PR 检查清单。
6. 改完代码必须 `git add`、`git commit`、`git push origin <branch>`。
7. 必须用 `gh pr create` 创建 PR；PR 没开就不算完成。
8. 复杂功能需要先在 `docs/plans/` 写执行计划再动手。
9. 不要提交生成文件、`node_modules/`、`target/`、`.DS_Store`。
10. API key 和密钥绝不能出现在代码、配置或文档中，用占位符。
