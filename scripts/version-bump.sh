#!/usr/bin/env bash
# Bump version across Cargo.toml, frontend/package.json, and tauri.conf.json.
# Usage: ./scripts/version-bump.sh <new-version>
# Example: ./scripts/version-bump.sh 0.2.0

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <new-version>"
  echo "Example: $0 0.2.0"
  exit 1
fi

NEW_VERSION="$1"

# Validate semver format (loose check)
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: version must be semver (e.g. 1.2.3 or 1.2.3-beta.1)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Cargo.toml ---
CARGO="$ROOT/src-tauri/Cargo.toml"
if [ ! -f "$CARGO" ]; then
  echo "Error: $CARGO not found"
  exit 1
fi
# Replace only the first version = "..." line (the [package] version)
sed -i.bak '0,/^version = ".*"/s//version = "'"$NEW_VERSION"'"/' "$CARGO"
rm -f "$CARGO.bak"
echo "Updated $CARGO -> $NEW_VERSION"

# --- tauri.conf.json ---
TAURI_CONF="$ROOT/src-tauri/tauri.conf.json"
if [ ! -f "$TAURI_CONF" ]; then
  echo "Error: $TAURI_CONF not found"
  exit 1
fi
# Use node for reliable JSON editing
node -e "
  const fs = require('fs');
  const path = '$TAURI_CONF';
  const conf = JSON.parse(fs.readFileSync(path, 'utf8'));
  conf.version = '$NEW_VERSION';
  fs.writeFileSync(path, JSON.stringify(conf, null, 2) + '\n');
"
echo "Updated $TAURI_CONF -> $NEW_VERSION"

# --- frontend/package.json ---
PKG="$ROOT/frontend/package.json"
if [ ! -f "$PKG" ]; then
  echo "Error: $PKG not found"
  exit 1
fi
node -e "
  const fs = require('fs');
  const path = '$PKG';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"
echo "Updated $PKG -> $NEW_VERSION"

echo ""
echo "All files bumped to $NEW_VERSION"
echo "Next steps:"
echo "  git add -A && git commit -m 'chore: bump version to $NEW_VERSION'"
echo "  git tag v$NEW_VERSION"
echo "  git push origin main --tags"
