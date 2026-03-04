---
status: completed
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
- [x] Create feature branch `feat/settings-tab-layout`
- [x] Refactor `frontend/src/pages/Settings.tsx` into 5 state-driven tabs: General, STT, LLM, Dictionary, About
- [x] Keep existing STT/LLM config editing behavior and save flow intact
- [x] Add tab content containers with vertical scrolling (`overflow-y: auto`) and proper flex/min-height constraints
- [x] Update i18n strings in `frontend/src/i18n/en.ts` and `frontend/src/i18n/zh-CN.ts` for new tab labels/text
- [x] Update `frontend/src/App.css` to match current Settings card visual style while supporting tab UI
- [x] Run gate checks:
  - [x] `cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test`
  - [x] `cd frontend && npm run lint && npm run build`
- [x] Capture screenshots via `python3 scripts/screenshot-headless.py --out docs/screenshots/`
- [x] Commit, push branch, and create PR with required body sections, embedded screenshots, and closing keywords

## Acceptance Criteria
- [x] All 5 tabs render and switch correctly without route changes
- [x] Existing STT/LLM settings can still be edited and saved successfully
- [x] Settings content area is scrollable and bottom fields are reachable
- [x] Home and History pages are unaffected
- [x] Gate checks pass locally
- [x] PR includes screenshots and references `Closes #5, Closes #31`

## Decision Log
- 2026-03-04: Use in-page state tabs (not routing) to match issue scope and minimize surface area.
- 2026-03-04: Keep STT/LLM forms and mutation logic in place, and only reorganize rendering structure to reduce regression risk.
- 2026-03-04: Add `min-height: 0` + `overflow-y: auto` at the Settings panel level to fix clipping reliably without affecting Home/History containers.
- 2026-03-04: Add tab-related i18n keys in all locale files to keep `Translations` type safety intact.

## Result
- PR: https://github.com/liaohch3/vokey/pull/32
- Branch: `feat/settings-tab-layout`

## Retrospective
- **Time**: ~2.5h actual vs M estimate.
- **Effect**: Settings now uses a 5-tab layout and all lower fields in LLM tab are reachable by scrolling at default window size.
- **Went well**: Existing STT/LLM config logic was reused, so behavior remained stable while structure changed.
- **Could improve**: General tab currently keeps minimal controls; additional settings items can be added in follow-up issues with backend config support.
- **Captured in**: This plan file (`docs/plans/2026-03-04-settings-tab-layout.md`).
