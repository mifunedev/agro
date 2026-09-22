#!/usr/bin/env bash
# tier: A
# source: pattern-scripts-sibling-dependency-standalone-copies (issue #940) — docker-compose.sh sources paths.sh, so a fixture that copies the wrapper alone cannot run it
# desc: every test or probe that copies .agro/scripts/docker-compose.sh into a fixture also copies .agro/scripts/paths.sh, and the wrapper still refuses to run without its sibling
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WRAPPER="$ROOT/.agro/scripts/docker-compose.sh"
COMPAT="$ROOT/.agro/scripts/paths.sh"

[[ -f "$WRAPPER" && -f "$COMPAT" ]] || { echo "SKIPPED: wrapper or paths.sh absent" >&2; exit 2; }
grep -Fq 'paths.sh' "$WRAPPER" || { echo "SKIPPED: the wrapper does not source paths.sh on this branch" >&2; exit 2; }

fails=()

while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  grep -Fq 'paths.sh' "$file" \
    || fails+=("${file#"$ROOT"/} copies docker-compose.sh into a fixture without its paths.sh sibling")
done < <(grep -rlE "copyFileSync\(SCRIPT|cp \"\$WRAPPER\"" "$ROOT/.agro/scripts/__tests__" "$ROOT/.agro/evals/probes" 2>/dev/null | grep -v "$(basename "${BASH_SOURCE[0]}")" || true)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/.agro/scripts" "$tmp/.devcontainer"
printf 'services: {}\n' > "$tmp/.devcontainer/docker-compose.yml"
cp "$WRAPPER" "$tmp/.agro/scripts/docker-compose.sh"
if bash "$tmp/.agro/scripts/docker-compose.sh" --repo-dir "$tmp" --print-argv config >/dev/null 2>"$tmp/err"; then
  fails+=("docker-compose.sh ran without paths.sh beside it — it must refuse instead of guessing a generation")
elif ! grep -Fq 'paths.sh is missing' "$tmp/err"; then
  fails+=("docker-compose.sh failed without paths.sh but did not name the missing sibling")
fi

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: compose wrapper sibling contract broken:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: every fixture that copies docker-compose.sh also copies paths.sh, and the wrapper refuses to run without its sibling by name" >&2
exit 0
