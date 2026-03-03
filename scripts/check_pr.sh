#!/bin/sh
# PR 合并就绪检查 — 一键判断 PR 是否可以合并
set -eu

usage() {
  cat <<'EOF'
Usage: scripts/check_pr.sh <pr_number> [--repo owner/repo] [--no-tests]

Options:
  --repo OWNER/REPO  指定仓库（默认：当前 gh 仓库）
  --no-tests         跳过本地 gate check
  -h, --help         显示帮助
EOF
}

pr_number=""
repo=""
run_tests=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo) repo="$2"; shift 2 ;;
    --no-tests) run_tests=0; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "error: unknown option: $1" >&2; usage; exit 1 ;;
    *)
      if [ -n "$pr_number" ]; then
        echo "error: unexpected argument: $1" >&2; exit 1
      fi
      pr_number="$1"; shift ;;
  esac
done

[ -z "$pr_number" ] && { echo "error: missing <pr_number>" >&2; usage; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "error: gh not found" >&2; exit 1; }

[ -z "$repo" ] && repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

# 获取 PR 元数据
metadata="$(gh pr view "$pr_number" --repo "$repo" \
  --json title,state,isDraft,mergeStateStatus,headRefName,baseRefName,url \
  --template '{{.title}}{{"\n"}}{{.state}}{{"\n"}}{{.isDraft}}{{"\n"}}{{.mergeStateStatus}}{{"\n"}}{{.headRefName}}{{"\n"}}{{.baseRefName}}{{"\n"}}{{.url}}')"

pr_title=$(printf '%s\n' "$metadata" | sed -n '1p')
pr_state=$(printf '%s\n' "$metadata" | sed -n '2p')
pr_draft=$(printf '%s\n' "$metadata" | sed -n '3p')
pr_merge_status=$(printf '%s\n' "$metadata" | sed -n '4p')
pr_head=$(printf '%s\n' "$metadata" | sed -n '5p')
pr_base=$(printf '%s\n' "$metadata" | sed -n '6p')
pr_url=$(printf '%s\n' "$metadata" | sed -n '7p')

pr_body="$(gh pr view "$pr_number" --repo "$repo" --json body -q .body)"

# CI 检查状态
pass_count=0; fail_count=0; pending_count=0; check_total=0
check_lines=""
if check_lines="$(gh pr checks "$pr_number" --repo "$repo" --json bucket \
  --template '{{range .}}{{.bucket}}{{"\n"}}{{end}}' 2>/dev/null)"; then :
else
  checks_exit=$?
  [ "$checks_exit" -ne 8 ] && { echo "error: gh pr checks failed ($checks_exit)" >&2; exit 1; }
fi

if [ -n "$check_lines" ]; then
  while IFS= read -r bucket; do
    [ -n "$bucket" ] || continue
    check_total=$((check_total + 1))
    case "$bucket" in
      pass|skipping) pass_count=$((pass_count + 1)) ;;
      fail|cancel) fail_count=$((fail_count + 1)) ;;
      *) pending_count=$((pending_count + 1)) ;;
    esac
  done <<EOF
$check_lines
EOF
fi

printf 'PR #%s (%s)\n' "$pr_number" "$repo"
printf 'Title: %s\n' "$pr_title"
printf 'URL: %s\n' "$pr_url"
printf 'State: %s | Draft: %s | Merge: %s\n' "$pr_state" "$pr_draft" "$pr_merge_status"
printf 'Branch: %s -> %s\n' "$pr_head" "$pr_base"
printf 'CI: pass=%s fail=%s pending=%s total=%s\n' "$pass_count" "$fail_count" "$pending_count" "$check_total"

# 本地 gate check
gate_failed=0
if [ "$run_tests" -eq 1 ]; then
  echo 'Local gates:'
  cd src-tauri
  if cargo fmt --check 2>/dev/null; then echo '  PASS cargo fmt'; else gate_failed=1; echo '  FAIL cargo fmt'; fi
  if cargo clippy -- -D warnings 2>/dev/null; then echo '  PASS cargo clippy'; else gate_failed=1; echo '  FAIL cargo clippy'; fi
  if cargo test 2>/dev/null; then echo '  PASS cargo test'; else gate_failed=1; echo '  FAIL cargo test'; fi
  cd ../frontend
  if npm run lint 2>/dev/null; then echo '  PASS npm lint'; else gate_failed=1; echo '  FAIL npm lint'; fi
  if npm run build 2>/dev/null; then echo '  PASS npm build'; else gate_failed=1; echo '  FAIL npm build'; fi
  cd ..
  if python3 scripts/check_legibility.py 2>/dev/null; then echo '  PASS legibility'; else gate_failed=1; echo '  FAIL legibility'; fi
else
  echo 'Local gates: skipped (--no-tests)'
fi

# 截图检查
has_screenshot=0
printf '%s' "$pr_body" | grep -qiE '!\[.*\]\(.*\.(png|jpg|jpeg|gif|webp)' && has_screenshot=1
printf '%s' "$pr_body" | grep -qiE '<img ' && has_screenshot=1
[ "$has_screenshot" -eq 1 ] && echo 'Screenshots: found' || echo 'Screenshots: MISSING'

# 最终判定
ready=1; reasons=""
append() { [ -n "$reasons" ] && reasons="$reasons; $1" || reasons="$1"; }

[ "$pr_state" != "OPEN" ] && { ready=0; append "state=$pr_state"; }
[ "$pr_draft" = "true" ] && { ready=0; append "draft"; }
case "$pr_merge_status" in CLEAN|HAS_HOOKS) ;; *) ready=0; append "merge=$pr_merge_status" ;; esac
[ "$fail_count" -gt 0 ] && { ready=0; append "${fail_count} CI failing"; }
[ "$pending_count" -gt 0 ] && { ready=0; append "${pending_count} CI pending"; }
[ "$gate_failed" -eq 1 ] && { ready=0; append "local gates failed"; }

if [ "$ready" -eq 1 ]; then
  echo "VERDICT: READY ✅"
  exit 0
fi
echo "VERDICT: NOT_READY ❌ — $reasons"
exit 2
