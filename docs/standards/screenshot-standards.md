---
owner: vokey-maintainers
last_reviewed: 2026-03-04
source_of_truth: AGENTS.md
---

# 截图标准

这些规则适用于 PR 中用来验证 UI 变更的截图。

## 视口规则

1. 桌面截图视口宽度至少 `1280px`。
2. 如果改动只影响桌面，不要用手机布局截图作为主要证据。
3. 深浅两种主题都要截图（如果变更影响到了主题）。

## 内容验证规则

1. 每张截图必须展示 PR 描述中声称的具体功能或修复。
2. 设置页改动：截图必须展示改动的那个 tab 和具体的表单项。
3. 录音状态改动：截图必须展示 Floating Bar 在对应状态下的样子。
4. 提交前确认截图路径和文件名与 PR markdown 链接匹配。

## 截图存放

- PR 截图放在 `docs/evidence/` 目录
- 文件名格式：`pr<number>-<description>.png`
- PR body 里用 `raw.githubusercontent.com` 绝对 URL 引用

## 截图提交前检查清单

提交包含截图的 PR 之前：

1. 视口宽度 ≥ 1280px
2. 截图包含证明修复的确切目标状态
3. 没有乱码字符或编码损坏
4. 图片清晰可读，不是大面积空白
5. 本地自动检查通过：

```bash
python3 scripts/check_screenshots.py docs/evidence/
```
