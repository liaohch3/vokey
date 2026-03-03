# 技能：实现功能

按执行计划实现功能时使用此技能。

## 步骤

1. 读 `AGENTS.md` 了解项目上下文
2. 读执行计划 `docs/plans/<plan-file>.md`
3. 读计划中引用的相关设计文档
4. 读相关源码了解当前状态

5. 对计划中的每个任务：
   a. 实现改动
   b. 跑 gate check：
      ```bash
      cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test
      cd ../frontend && npm run lint && npm run build
      ```
   c. 修复问题
   d. 更新计划文件：勾选完成的任务，记录决策

6. 自审：
   a. `git diff origin/main --stat` — 确认范围
   b. `git diff origin/main` — 逐行读每个改动
   c. 验证计划中的验收标准

7. 提交并推送：
   ```bash
   git add -A
   git commit -m "<type>: <description>"
   git push origin <branch>
   ```

8. 开 PR：
   ```bash
   gh pr create --title "<type>: <description>" --body "<PR body>"
   ```

9. 通知完成：
   ```bash
   openclaw system event --text "Done: <摘要>" --mode now
   ```
