#!/usr/bin/env python3
"""Deterministic legibility checks for Vokey standards and architecture."""

from __future__ import annotations

import datetime as dt
import re
import sys
from pathlib import Path

ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REQUIRED_STANDARDS_KEYS = ("owner", "last_reviewed", "source_of_truth")
ALLOWED_PLAN_STATUS = {"active", "completed", "cancelled"}
FRESHNESS_DAYS = 60


def parse_frontmatter(text: str) -> dict[str, str]:
    lines = text.splitlines()
    if len(lines) < 3 or lines[0].strip() != "---":
        return {}
    fields: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip()
    return fields


def parse_expected_paths(text: str) -> list[str]:
    lines = text.splitlines()
    in_section = False
    paths: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped == "expected_paths:":
            in_section = True
            continue
        if in_section:
            if not stripped.startswith("- "):
                break
            paths.append(stripped[2:].strip().strip("'\""))
    return paths


def check_standards(repo: Path, today: dt.date) -> list[str]:
    failures: list[str] = []
    standards_dir = repo / "docs" / "standards"
    if not standards_dir.exists():
        return [f"{standards_dir}: directory missing"]

    for f in sorted(standards_dir.glob("*.md")):
        fm = parse_frontmatter(f.read_text(encoding="utf-8"))
        for key in REQUIRED_STANDARDS_KEYS:
            if not fm.get(key):
                failures.append(f"{f.name}: missing frontmatter key '{key}'")

        reviewed = fm.get("last_reviewed", "")
        if ISO_DATE_RE.match(reviewed):
            try:
                age = (today - dt.date.fromisoformat(reviewed)).days
                if age > FRESHNESS_DAYS:
                    failures.append(f"{f.name}: stale ({age}d old, limit {FRESHNESS_DAYS}d)")
            except ValueError:
                failures.append(f"{f.name}: invalid last_reviewed date")

    return failures


def check_architecture(repo: Path) -> list[str]:
    failures: list[str] = []
    arch = repo / "docs" / "standards" / "architecture.md"
    if not arch.exists():
        return ["architecture.md: missing"]

    paths = parse_expected_paths(arch.read_text(encoding="utf-8"))
    for p in paths:
        if not (repo / p).exists():
            failures.append(f"expected path missing: {p}")

    return failures


def check_plans(repo: Path) -> list[str]:
    failures: list[str] = []
    plans_dir = repo / "docs" / "plans"
    if not plans_dir.exists():
        return []  # plans dir is optional early on

    for f in sorted(plans_dir.glob("**/*.md")):
        text = f.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        status = fm.get("status")
        if status and status not in ALLOWED_PLAN_STATUS:
            failures.append(f"{f.name}: status must be one of {sorted(ALLOWED_PLAN_STATUS)}")
        if status == "completed" and "- [ ]" in text:
            failures.append(f"{f.name}: completed plan has unchecked TODOs")

    return failures


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    today = dt.date.today()

    failures: list[str] = []
    failures.extend(check_standards(repo, today))
    failures.extend(check_architecture(repo))
    failures.extend(check_plans(repo))

    for f in failures:
        print(f"ERROR: {f}")

    if failures:
        print(f"\nLegibility check failures: {len(failures)}")
        return 1

    print("Legibility checks passed ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
