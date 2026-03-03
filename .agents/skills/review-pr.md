# 技能：审查 PR

审查 PR 是否可以合并时使用此技能。

## 步骤

1. 读 `AGENTS.md` 了解项目标准
2. 获取 PR diff：
   ```bash
   gh pr diff <number>
   ```

3. 对每个改动文件检查：
   - `docs/standards/coding-standards.md` — 风格和模式
   - `docs/standards/architecture.md` — 分层违规、依赖方向
   - `docs/standards/hard-rules.md` — 不可违反的规则

4. 验证：
   - [ ] Gate check 通过（`cargo fmt --check`、`cargo clippy`、`cargo test`、`npm run lint`、`npm run build`）
   - [ ] 一个提交一件事
   - [ ] 没有死代码、注释掉的代码、投机性抽象
   - [ ] Provider 逻辑在 trait 后面（不在管线里）
   - [ ] i18n：所有新的用户可见文案走 `t()` 函数
   - [ ] 没有密钥、API key、硬编码 URL
   - [ ] 范围最小 — 只改了相关文件

5. 如果改了 UI：
   - [ ] PR body 里有截图
   - [ ] 考虑了深浅两种主题

6. 发布审查结果：
   ```bash
   gh pr review <number> --approve          # 全部通过
   gh pr review <number> --comment          # 有小建议
   gh pr review <number> --request-changes  # 有阻塞问题
   ```
