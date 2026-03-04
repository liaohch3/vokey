#!/usr/bin/env python3
"""Validate PR body meets Vokey quality standards.

Used in CI to block PRs with insufficient descriptions.
Exit 0 = pass, Exit 1 = fail with reasons.
"""

import json
import os
import re
import subprocess
import sys

REQUIRED_SECTIONS = [
    ("做了什么", r"##\s*做了什么"),
    ("为什么", r"##\s*为什么"),
    ("改动详情", r"##\s*改动详情"),
    ("检查清单", r"##\s*检查清单"),
]

MIN_BODY_LENGTH = 200  # characters


def get_pr_body() -> str:
    """Get PR body from env (CI) or gh CLI."""
    # GitHub Actions sets this
    body = os.environ.get("PR_BODY", "")
    if body:
        return body

    # Try gh CLI
    pr_number = os.environ.get("PR_NUMBER", "")
    if pr_number:
        result = subprocess.run(
            ["gh", "pr", "view", pr_number, "--json", "body", "-q", ".body"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return result.stdout.strip()

    return ""


def get_changed_files() -> list[str]:
    """Get list of changed files in the PR."""
    pr_number = os.environ.get("PR_NUMBER", "")
    if pr_number:
        result = subprocess.run(
            ["gh", "pr", "diff", pr_number, "--name-only"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return result.stdout.strip().split("\n")
    return []


def has_ui_changes(files: list[str]) -> bool:
    """Check if PR has frontend/UI changes."""
    ui_patterns = [
        r"frontend/src/.*\.(tsx|css)$",
        r"frontend/src/i18n/",
    ]
    for f in files:
        for pattern in ui_patterns:
            if re.search(pattern, f):
                return True
    return False


def has_screenshots(body: str) -> bool:
    """Check if PR body contains image references."""
    patterns = [
        r"!\[.*?\]\(.*?\.(png|jpg|jpeg|gif|webp)",
        r"<img\s",
        r"https://.*\.(png|jpg|jpeg|gif|webp)",
    ]
    for pattern in patterns:
        if re.search(pattern, body, re.IGNORECASE):
            return True
    return False


def main():
    body = get_pr_body()
    if not body:
        print("❌ Could not retrieve PR body")
        sys.exit(1)

    errors = []
    warnings = []

    # Check minimum length
    if len(body) < MIN_BODY_LENGTH:
        errors.append(
            f"PR body too short ({len(body)} chars, minimum {MIN_BODY_LENGTH})"
        )

    # Check required sections
    for name, pattern in REQUIRED_SECTIONS:
        if not re.search(pattern, body):
            errors.append(f"Missing required section: '## {name}'")

    # Check screenshots for UI changes
    files = get_changed_files()
    if has_ui_changes(files) and not has_screenshots(body):
        errors.append(
            "UI changes detected but no screenshots in PR body (AGENTS.md rule #4)"
        )

    # Check checklist items exist
    checklist_items = re.findall(r"- \[[ x]\]", body)
    if len(checklist_items) < 3:
        warnings.append(
            f"Only {len(checklist_items)} checklist items (recommend >= 3)"
        )

    # Report
    if warnings:
        for w in warnings:
            print(f"⚠️  {w}")

    if errors:
        print("\n❌ PR body check FAILED:")
        for e in errors:
            print(f"  • {e}")
        print(
            "\nSee PR template: .github/pull_request_template.md"
        )
        sys.exit(1)
    else:
        print("✅ PR body check passed")
        sys.exit(0)


if __name__ == "__main__":
    main()
