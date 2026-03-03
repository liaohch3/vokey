# Skill: Review PR

Use this skill when reviewing a pull request for merge-readiness.

## Steps

1. Read `AGENTS.md` for project standards
2. Fetch the PR diff:
   ```bash
   gh pr diff <number>
   ```

3. Check every changed file against:
   - `docs/standards/coding-standards.md` — style and patterns
   - `docs/standards/architecture.md` — layer violations, dependency direction
   - `docs/standards/hard-rules.md` — non-negotiable rules

4. Verify:
   - [ ] Gate checks pass (`cargo fmt --check`, `cargo clippy`, `cargo test`, `npm run lint`, `npm run build`)
   - [ ] One concern per commit
   - [ ] No dead code, commented-out code, or speculative abstractions
   - [ ] Provider-specific logic behind traits (not in pipeline)
   - [ ] i18n: all new user-visible strings in `t()` function
   - [ ] No secrets, API keys, or hardcoded URLs
   - [ ] Scope is minimal — only relevant files changed

5. If UI was changed:
   - [ ] Screenshots present in PR body
   - [ ] Both light and dark themes considered

6. Post review:
   ```bash
   gh pr review <number> --approve     # if all checks pass
   gh pr review <number> --comment     # if minor suggestions
   gh pr review <number> --request-changes  # if blocking issues
   ```
