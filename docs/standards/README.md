---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# Standards Metadata

All files in `docs/standards/*.md` must include YAML frontmatter with:

- `owner`: team or maintainer responsible for updates
- `last_reviewed`: ISO date `YYYY-MM-DD` of the last policy review
- `source_of_truth`: canonical policy source reference

## Maintenance

1. Update the affected standards file and refresh `last_reviewed`.
2. Keep `AGENTS.md` as a concise index that links to the updated file.
3. Run `python3 scripts/check_legibility.py` locally to validate.
4. If policy behavior changed, record rationale in PR description.

## Freshness

Standards older than 60 days trigger a warning. This is enforced by the legibility CI check.
