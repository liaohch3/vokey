---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# Hard Rules

These rules are mandatory. If you cannot comply, stop and explain why.

1. Gate checks before every commit: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `cd frontend && npm run lint && npm run build`.
2. UI changes require before/after screenshots in the PR body.
3. One concern per commit. Do not mix refactoring with features or bug fixes.
4. English only in code, comments, commit messages, docs, and skill files.
5. Pre-work checklist is required before coding; pre-PR checklist is required before opening a PR.
6. After changes, you must `git add`, `git commit`, and `git push origin <branch>`.
7. You must create the GitHub PR with `gh pr create`; work is not done until PR exists.
8. Complex features require an execution plan in `docs/plans/` before implementation begins.
9. Do not commit generated files, `node_modules/`, `target/`, or `.DS_Store`.
10. API keys and secrets must never appear in code, config, or docs. Use placeholders.
