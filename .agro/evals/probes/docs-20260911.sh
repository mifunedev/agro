#!/usr/bin/env bash
# tier: A
# source: retro lesson 2026-09-11 — issue #1043 renamed a CLI flag in the CLI and in docs/ while tracked README.md files kept teaching the old spelling as the current one
# desc: no tracked README presents a flag that docs/ declares a deprecated alias as if it were the canonical spelling
set -euo pipefail

ROOT="${DOCS_CANONICAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
DOCS="$ROOT/docs"
READMES=("README.md" ".agro/README.md" ".agro/cli/README.md")

# shellcheck disable=SC2016 # literal Markdown backticks in an ERE
DECL='`--[a-z0-9][a-z0-9-]*`[^|]{0,60} remains? (a )?supported alias(es)? for `--[a-z0-9][a-z0-9-]*`'
MARKER='alias|aliases|deprecated|legacy|superseded'

if [[ ! -d "$DOCS" ]]; then
  echo "SKIPPED: no docs/ under $ROOT — the source of truth for which spelling is canonical is absent" >&2
  exit 2
fi

pairs=""
docs_files=()
mapfile -t docs_files < <(find "$DOCS" -type f -name '*.md' | sort)
for doc in ${docs_files[@]+"${docs_files[@]}"}; do
  norm="$(tr '\n' ' ' <"$doc" | tr -s ' ')"
  matches=()
  mapfile -t matches < <(grep -oE -- "$DECL" <<<"$norm" || true)
  for decl in ${matches[@]+"${matches[@]}"}; do
    [[ -n "$decl" ]] || continue
    flags=()
    mapfile -t flags < <(grep -oE -- '--[a-z0-9][a-z0-9-]*' <<<"$decl" || true)
    ((${#flags[@]} >= 2)) || continue
    deprecated="${flags[0]}"
    canonical="${flags[${#flags[@]} - 1]}"
    [[ "$deprecated" != "$canonical" ]] || continue
    pairs+="$deprecated $canonical"$'\n'
  done
done
pairs="$(printf '%s' "$pairs" | sed '/^$/d' | sort -u)"

if [[ -z "$pairs" ]]; then
  echo "SKIPPED: docs/ declares no '\`--x\` remains a supported alias for \`--y\`' pair — the probe has no canonical spelling to check the READMEs against" >&2
  exit 2
fi

failures=()
present=()
for rel in "${READMES[@]}"; do
  if [[ -f "$ROOT/$rel" ]]; then
    present+=("$rel")
  else
    failures+=("$rel is absent — a README this probe must sweep no longer exists")
  fi
done

while read -r deprecated canonical; do
  [[ -n "$deprecated" ]] || continue
  for rel in ${present[@]+"${present[@]}"}; do
    file="$ROOT/$rel"
    hits=()
    mapfile -t hits < <(grep -nE -- "(^|[^a-z0-9-])${deprecated}([^a-z0-9-]|$)" "$file" || true)
    for hit in ${hits[@]+"${hits[@]}"}; do
      [[ -n "$hit" ]] || continue
      lineno="${hit%%:*}"
      first=$((lineno > 1 ? lineno - 1 : 1))
      window="$(sed -n "${first},$((lineno + 1))p" "$file" | tr '\n' ' ')"
      grep -qiE -- "$MARKER" <<<"$window" \
        || failures+=("$rel:$lineno presents \`$deprecated\` as canonical; docs/ makes \`$canonical\` canonical and \`$deprecated\` a deprecated alias")
    done
  done
done <<<"$pairs"

if ((${#failures[@]})); then
  printf 'REGRESSION: %s\n' "${failures[@]}" >&2
  exit 1
fi

echo "PASS: $(wc -l <<<"$pairs" | tr -d ' ') docs-declared alias pair(s) checked against ${#present[@]} README(s); none presents a deprecated spelling as canonical" >&2
exit 0
