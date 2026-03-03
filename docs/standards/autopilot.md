---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# Auto-pilot Workflow

## Overview

The auto-pilot system enables a fully agent-driven development loop:

```
Human requirement → Execution plan → Codex implements → Agent reviews → CI validates → PR ready
```

Humans steer. Agents execute.

## The Loop

### Step 1: Requirement → Plan

Human describes what they want in natural language. The orchestrator (OpenClaw) translates this into an execution plan:

```markdown
# docs/plans/YYYY-MM-DD-<slug>.md
---
status: active
priority: P0
estimated_effort: M
---

## Goal
<one sentence>

## Context
- Relevant design doc sections
- Current code state
- Dependencies

## Tasks
- [ ] Task 1: description (files: `path/to/file.rs`)
- [ ] Task 2: description (files: `path/to/component.tsx`)
- [ ] Task 3: write tests
- [ ] Task 4: update i18n
- [ ] Task 5: run gate checks

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] All gate checks pass

## Decisions
(filled in during execution)
```

### Step 2: Plan → Codex Execution

The orchestrator launches Codex via tmux with a structured prompt:

```bash
tmux new-session -d -s vokey-<slug> -c /path/to/vokey
tmux send-keys -t vokey-<slug> "codex --dangerously-bypass-approvals-and-sandbox \"
Read AGENTS.md first.
Read the execution plan at docs/plans/YYYY-MM-DD-<slug>.md.
Execute all tasks in order.
After each task, run gate checks (see docs/standards/validation-and-gates.md).
Update the plan file: check off completed tasks, log decisions.
When done, commit all changes and push to branch feat/<slug>.
Then run: gh pr create --title '<title>' --body '<body>'
Finally run: openclaw system event --text 'Done: <summary>' --mode now
\"" Enter
```

### Step 3: Agent Self-Review

Before opening the PR, Codex performs self-review:

1. Run all gate checks (fmt, clippy, test, lint, build)
2. `git diff origin/main` — review every changed line
3. Verify only relevant files changed (no scope creep)
4. Check that all plan tasks are completed
5. Verify acceptance criteria
6. Update plan status to `completed`

### Step 4: CI Validation

GitHub Actions runs on every PR:

1. **Lint** — `cargo fmt --check` + `cargo clippy` + `npm run lint`
2. **Build** — `cargo check` + `npm run build`
3. **Test** — `cargo test`
4. **Legibility** — `python scripts/check_legibility.py`

### Step 5: Human Review (optional)

Human receives PR link. Can:
- Merge directly if CI passes and changes look good
- Leave review comments → Codex responds and iterates
- Request changes → new Codex run with feedback

## Monitoring

A cron job monitors active Codex sessions:

1. Check tmux pane output for progress/errors
2. If Codex completes → run acceptance verification
3. If Codex errors → report to human
4. If Codex stalls (>30min no output) → alert human

## Plan Lifecycle

```
active → completed     (all tasks done, PR merged)
active → cancelled     (requirements changed, plan abandoned)
```

Plans are versioned in git. Never delete a plan — mark it completed or cancelled.

## Conventions

### Branch naming
```
feat/<slug>          — new feature
fix/<slug>           — bug fix
refactor/<slug>      — code improvement
docs/<slug>          — documentation only
infra/<slug>         — CI, tooling, scripts
```

### Commit messages
```
feat: add OpenAI Whisper STT provider
fix: handle empty audio buffer in pipeline
refactor: extract settings into tabbed components
docs: update architecture diagram
infra: add legibility CI workflow
```

### PR body template
```markdown
## What
<one sentence summary>

## Why
<motivation / linked plan>

## How
<implementation approach>

## Plan
Closes docs/plans/YYYY-MM-DD-<slug>.md

## Checklist
- [ ] Gate checks pass locally
- [ ] Plan tasks all completed
- [ ] Acceptance criteria met
- [ ] i18n updated (if UI changed)
- [ ] Screenshots attached (if UI changed)
```

## Golden Principles

These are enforced mechanically and apply to all agent output:

1. **Validate at boundaries** — parse and validate data at API/IPC edges
2. **Traits over concrete types** — every provider behind a trait
3. **Config-driven** — behavior controlled by `~/.vokey/config.toml`, not hardcoded
4. **Test what matters** — unit tests for logic, integration tests for pipelines
5. **Structured logging** — `log::info!()` with context, no `println!()`
6. **i18n everything** — all user-visible strings through `t()` function
7. **Boring tech** — prefer stable, well-documented, composable dependencies
8. **Small PRs** — one concern per PR, easy to review and revert
