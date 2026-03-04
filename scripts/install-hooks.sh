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

echo "✅ Git hooks installed:"
echo "   - pre-commit (lint check)"
echo "   - prepare-commit-msg (format reminder)"
