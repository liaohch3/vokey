---
status: active
priority: P0
estimated_effort: M
---

## Goal
Refactor Settings page to a 5-tab layout and fix content scrolling so all settings are accessible at default window size.

## Context
- Related issues: #5 (tabbed Settings), #31 (content area cannot scroll)
- Design source: `docs/design/DESIGN.md` section 4.5
- Current implementation: `frontend/src/pages/Settings.tsx` renders all sections in a single long page
- Current styles: `frontend/src/App.css` has no dedicated tab container/content scroll structure for Settings

## Tasks
- [ ] Create feature branch `feat/settings-tab-layout`
- [ ] Refactor `frontend/src/pages/Settings.tsx` into 5 state-driven tabs: General, STT, LLM, Dictionary, About
- [ ] Keep existing STT/LLM config editing behavior and save flow intact
- [ ] Add tab content containers with vertical scrolling (`overflow-y: auto`) and proper flex/min-height constraints
- [ ] Update i18n strings in `frontend/src/i18n/en.ts` and `frontend/src/i18n/zh-CN.ts` for new tab labels/text
- [ ] Update `frontend/src/App.css` to match current Settings card visual style while supporting tab UI
- [ ] Run gate checks:
  - [ ] `cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test`
  - [ ] `cd frontend && npm run lint && npm run build`
- [ ] Capture screenshots via `python3 scripts/screenshot-headless.py --out docs/screenshots/`
- [ ] Commit, push branch, and create PR with required body sections, embedded screenshots, and closing keywords

## Acceptance Criteria
- [ ] All 5 tabs render and switch correctly without route changes
- [ ] Existing STT/LLM settings can still be edited and saved successfully
- [ ] Settings content area is scrollable and bottom fields are reachable
- [ ] Home and History pages are unaffected
- [ ] Gate checks pass locally
- [ ] PR includes screenshots and references `Closes #5, Closes #31`

## Decision Log
- 2026-03-04: Use in-page state tabs (not routing) to match issue scope and minimize surface area.
