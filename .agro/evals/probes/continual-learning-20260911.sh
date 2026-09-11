#!/usr/bin/env bash
# tier: A
# source: retro lesson 2026-09-11 (issue #1046) — `agro sandbox install docker` ended with `next: oh shell <name>`
# desc: no command module hardcodes an operator-facing `oh`/`agro` invocation instead of the bin resolved from argv
set -euo pipefail

DEFAULT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ROOT="${BINNAME_ROOT:-$DEFAULT_ROOT}"
SRC="$ROOT/.agro/cli/src"
CMDS="$SRC/commands"

if [[ ! -d "$SRC" ]]; then
  echo "SKIPPED: CLI sources absent: .agro/cli/src (root: $ROOT)" >&2
  exit 2
fi
if [[ ! -d "$CMDS" ]]; then
  echo "SKIPPED: command modules absent: .agro/cli/src/commands (root: $ROOT)" >&2
  exit 2
fi

files=()
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  while IFS= read -r -d '' rel; do
    files+=("$ROOT/$rel")
  done < <(git -C "$ROOT" ls-files -z --cached --others --exclude-standard -- '.agro/cli/src/commands/*.ts' || true)
else
  while IFS= read -r -d '' path; do
    files+=("$path")
  done < <(find "$CMDS" -type f -name '*.ts' -print0 || true)
fi

PATTERN='(^|[^A-Za-z0-9_.~$])(oh|agro)[[:space:]]+[a-z]'

hits=()
scanned=0
for file in "${files[@]}"; do
  case "$file" in
  */__tests__/*) continue ;;
  esac
  [[ -f "$file" ]] || continue
  scanned=$((scanned + 1))
  matches="$(grep -nE "$PATTERN" "$file" || true)"
  [[ -n "$matches" ]] || continue
  while IFS= read -r match; do
    [[ -n "$match" ]] || continue
    hits+=("${file#"$ROOT"/}:$match")
  done <<<"$matches"
done

if ((scanned == 0)); then
  echo "SKIPPED: no non-test command modules found under .agro/cli/src/commands (root: $ROOT)" >&2
  exit 2
fi

if ((${#hits[@]})); then
  echo "REGRESSION: ${#hits[@]} hardcoded operator-facing binary literal(s) in .agro/cli/src/commands — the invoked bin must be threaded, not spelled" >&2
  printf '  %s\n' "${hits[@]}" >&2
  exit 1
fi

echo "PASS: all $scanned command module(s) under .agro/cli/src/commands resolve the binary name dynamically" >&2
exit 0
