#!/bin/sh
# Install git hooks for Vokey development.
# Run once: bash scripts/install-hooks.sh

set -eu

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
mkdir -p "$HOOK_DIR"

# pre-commit: run frontend lint + Rust fmt check
cat > "$HOOK_DIR/pre-commit" << 'HOOK'
#!/bin/sh
set -eu

# Only check staged files in relevant directories
staged_rs=$(git diff --cached --name-only --diff-filter=ACM | grep '\.rs$' || true)
staged_ts=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|css)$' || true)

if [ -n "$staged_rs" ]; then
  echo "🦀 Checking Rust formatting..."
  (cd src-tauri && cargo fmt --check) || {
    echo "❌ cargo fmt failed. Run 'cargo fmt' in src-tauri/ and re-stage."
    exit 1
  }
fi

if [ -n "$staged_ts" ]; then
  echo "📦 Checking frontend lint..."
  (cd frontend && npm run lint --silent) || {
    echo "❌ npm lint failed. Fix lint errors and re-stage."
    exit 1
  }
fi

echo "✅ Pre-commit checks passed"
HOOK
chmod +x "$HOOK_DIR/pre-commit"

# prepare-commit-msg: warn about commit message format
cat > "$HOOK_DIR/prepare-commit-msg" << 'HOOK'
#!/bin/sh
# Remind about conventional commit format
MSG_FILE="$1"
first_line=$(head -1 "$MSG_FILE")
if ! echo "$first_line" | grep -qE '^(feat|fix|refactor|docs|infra|perf|test|ci|chore)(\(.+\))?: .+'; then
  echo "⚠️  Commit message should follow: <type>: <description>"
  echo "   Types: feat|fix|refactor|docs|infra|perf|test|ci|chore"
fi
HOOK
chmod +x "$HOOK_DIR/prepare-commit-msg"

# pre-push: validate PR body if pushing a non-main branch with an open PR
cat > "$HOOK_DIR/pre-push" << 'HOOK'
#!/bin/sh
set -eu

branch=$(git symbolic-ref --short HEAD 2>/dev/null || true)

# Skip for main branch
if [ "$branch" = "main" ] || [ -z "$branch" ]; then
  exit 0
fi

# Check if gh CLI is available
if ! command -v gh >/dev/null 2>&1; then
  exit 0
fi

# Check if there's an open PR for this branch
pr_body=$(gh pr view "$branch" --json body -q ".body" 2>/dev/null || true)

if [ -z "$pr_body" ]; then
  # No PR yet — skip (will be checked when PR is created)
  exit 0
fi

echo "🔍 Checking PR body quality for branch '$branch'..."

# Write body to temp file and validate
tmpfile=$(mktemp)
echo "$pr_body" > "$tmpfile"
python3 scripts/check_pr_body.py --file "$tmpfile"
result=$?
rm -f "$tmpfile"

if [ $result -ne 0 ]; then
  echo ""
  echo "💡 Fix the PR body on GitHub, then push again."
  echo "   Required sections: ## 做了什么 / ## 为什么 / ## 改动详情 / ## 检查清单"
  exit 1
fi
HOOK
chmod +x "$HOOK_DIR/pre-push"

echo "✅ Git hooks installed:"
echo "   - pre-commit (lint check)"
echo "   - prepare-commit-msg (format reminder)"
echo "   - pre-push (PR body quality check)"
