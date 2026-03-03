---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# Coding Standards

## Do

| Practice | Why |
|----------|-----|
| Delete dead code | Dead code misleads and rots |
| Fix root cause of test failures | Patching symptoms creates fragile tests |
| Use existing patterns | Consistency beats novelty |
| Modify only relevant files | Minimize blast radius |
| Keep functions focused | One function, one purpose |
| Provider-agnostic interfaces | Every STT/LLM provider behind a trait |
| Parse at the boundary | Validate data shapes at API edges, not deep inside |
| Prefer boring tech | Composable, stable, well-documented > clever |

## Don't

| Anti-pattern | Why |
|--------------|-----|
| Leave commented-out code | Use version control |
| Add speculative abstractions | YAGNI — wait until needed |
| Suppress linter warnings without justification | Fix or document |
| Commit generated files | Regenerate from source |
| Mix refactoring with feature work | One concern per commit |
| Hardcode provider-specific logic in core | Everything through traits |
| Probe data YOLO-style | Validate boundaries, use typed structures |
| Pull heavy dependencies for simple logic | Implement in-house if scope is small |

## Rust Conventions

- Error types: define per-module enums implementing `Display` + `Error`
- Config defaults: use `Default` trait + `serde(default)` for TOML fields
- Blocking HTTP: ok for now (reqwest::blocking), migrate to async when streaming is needed
- Logging: `log` crate, no `println!` in library code

## Frontend Conventions

- State: keep in React `useState` for now, extract to Zustand when component tree grows
- Styling: CSS modules (`.css` files), no CSS-in-JS
- i18n: all user-visible strings go through `t()` function
- No `any` types in TypeScript
