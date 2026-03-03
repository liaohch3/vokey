---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# Validation Gates

## Pre-commit Checks

Before every commit, run:

```bash
# Rust
cargo fmt --check
cargo clippy -- -D warnings
cargo test

# Frontend
cd frontend && npm run lint && npm run build
```

All checks must pass. If formatting fails, run `cargo fmt` and re-check.

## Pre-work Checklist

Before any code change:

```bash
git diff --stat            # Check for uncommitted changes
git log --oneline -10      # Understand recent history
git fetch origin           # Get latest remote state
git rebase origin/main     # Stay up to date
```

## Pre-PR Checklist

Before opening a PR:

```bash
# Ensure clean state
git rebase origin/main

# Run all gates
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cd frontend && npm run lint && npm run build

# Review your own changes
git diff origin/main --stat
git diff origin/main           # Read every changed line

# Verify scope: only relevant files modified
```

## Verification Levels

| Level | What | When |
|-------|------|------|
| **L0 — Unit** | `cargo test` + `npm run build` | Every commit |
| **L1 — Lint** | `cargo clippy` + `npm run lint` + legibility checks | Every commit |
| **L2 — E2E** | Build app with `cargo tauri dev`, test full voice loop | Milestone features |
| **L3 — Release** | Full suite + E2E + binary test on clean install | Every release |

## CI Pipeline

```
lint (fmt + clippy + eslint) → build (cargo check + vite build) → test (cargo test) → legibility
```
