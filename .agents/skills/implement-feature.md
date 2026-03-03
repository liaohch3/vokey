# Skill: Implement Feature

Use this skill when implementing a feature from an execution plan.

## Steps

1. Read `AGENTS.md` for project context
2. Read the execution plan at `docs/plans/<plan-file>.md`
3. Read relevant design docs referenced in the plan
4. Read relevant source files to understand current state

5. For each task in the plan:
   a. Implement the change
   b. Run gate checks:
      ```bash
      cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test
      cd ../frontend && npm run lint && npm run build
      ```
   c. Fix any issues
   d. Update the plan file: check off the task, log any decisions

6. Self-review:
   a. `git diff origin/main --stat` — verify scope
   b. `git diff origin/main` — read every changed line
   c. Verify acceptance criteria from the plan

7. Commit and push:
   ```bash
   git add -A
   git commit -m "<type>: <description>"
   git push origin <branch>
   ```

8. Open PR:
   ```bash
   gh pr create --title "<type>: <description>" --body "<PR body with plan reference>"
   ```

9. Notify completion:
   ```bash
   openclaw system event --text "Done: <summary>" --mode now
   ```
