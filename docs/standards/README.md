---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# 标准元数据

`docs/standards/*.md` 下所有文件必须包含 YAML frontmatter：

- `owner`：负责更新的团队或维护者
- `last_reviewed`：最后审查日期，ISO 格式 `YYYY-MM-DD`
- `source_of_truth`：规范策略的权威来源

## 维护流程

1. 更新相关标准文件，刷新 `last_reviewed`。
2. 保持 `AGENTS.md` 作为简洁的索引，指向更新后的文件。
3. 本地运行 `python3 scripts/check_legibility.py` 验证。
4. 如果策略行为发生了变化，在 PR 描述中记录原因。

## 新鲜度

超过 60 天未审查的标准会触发警告，由 legibility CI 检查强制执行。
