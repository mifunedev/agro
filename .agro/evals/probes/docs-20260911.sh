#!/usr/bin/env bash
# tier: A
# source: retro lesson 2026-09-11 — issue #1043 renamed a CLI flag in the CLI and in docs/ while tracked README.md files kept teaching the old spelling as the current one; issue #1046 found docs/intro.md naming the deprecated `oh` binary as the one host CLI
# desc: no tracked README presents a docs-declared deprecated flag as the canonical spelling, and no tracked doc presents a docs-declared deprecated binary as the canonical CLI outside compatibility, legacy, or path prose
set -euo pipefail

ROOT="${DOCS_CANONICAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
DOCS="$ROOT/docs"
READMES=("README.md" ".agro/README.md" ".agro/cli/README.md")

# shellcheck disable=SC2016 # literal Markdown backticks in an ERE
DECL='`--[a-z0-9][a-z0-9-]*`[^|]{0,60} remains? (a )?supported alias(es)? for `--[a-z0-9][a-z0-9-]*`'
MARKER='alias|aliases|deprecated|legacy|superseded'
# shellcheck disable=SC2016 # literal Markdown backticks in an ERE
BIN_DECL='`[a-z][a-z0-9-]*( <verb>)?`( verb)? is also available as `[a-z][a-z0-9-]*( <verb>)?`'

if [[ ! -d "$DOCS" ]]; then
  echo "SKIPPED: no docs/ under $ROOT — the source of truth for which spelling is canonical is absent" >&2
  exit 2
fi

docs_files=()
mapfile -t docs_files < <(find "$DOCS" -type f -name '*.md' | sort)

pairs=""
bin_pairs=""
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
  bin_matches=()
  mapfile -t bin_matches < <(grep -oE -- "$BIN_DECL" <<<"$norm" || true)
  for decl in ${bin_matches[@]+"${bin_matches[@]}"}; do
    [[ -n "$decl" ]] || continue
    names=()
    mapfile -t names < <(grep -oE -- '`[a-z][a-z0-9-]*' <<<"$decl" | tr -d '`' || true)
    ((${#names[@]} >= 2)) || continue
    canonical="${names[0]}"
    deprecated="${names[${#names[@]} - 1]}"
    [[ "$deprecated" != "$canonical" ]] || continue
    bin_pairs+="$deprecated $canonical"$'\n'
  done
done
pairs="$(printf '%s' "$pairs" | sed '/^$/d' | sort -u)"
bin_pairs="$(printf '%s' "$bin_pairs" | sed '/^$/d' | sort -u)"

if [[ -z "$pairs" && -z "$bin_pairs" ]]; then
  echo "SKIPPED: docs/ declares neither a '\`--x\` remains a supported alias for \`--y\`' flag pair nor an '\`x\` is also available as \`y\`' binary pair — the probe has no canonical spelling to check against" >&2
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

if [[ -n "$pairs" ]]; then
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
fi

sweep=()
if [[ -n "$bin_pairs" ]]; then
  mapfile -t sweep < <(
    { find "$DOCS" -type f -name '*.md'
      find "$ROOT" -maxdepth 1 -type f -name '*.md'
    } | sort -u
  )
fi

bin_docs=0
while read -r deprecated canonical; do
  [[ -n "$deprecated" ]] || continue
  upper="$(tr '[:lower:]' '[:upper:]' <<<"$deprecated")"
  contract="compatib|alias|legacy|deprecat|supersed|retire|formerly|renamed|remain|entry point|historical"
  paths="get-${deprecated}[.]sh|get-${canonical}[.]sh|~/[.]${deprecated}|[.]${deprecated}/|/opt/${deprecated}|${deprecated}[.]json|${deprecated}[.]js|share/${deprecated}|packages/${deprecated}|bin/${deprecated}|${deprecated}[.]mifune[.]dev|@mifune/|npm install|npx "
  strict="SLA|${upper}_[A-Z]"
  section="compatib|alias|legacy|deprecat|entry point"
  adjacent='`'"${canonical}"'[` ]'
  # shellcheck disable=SC2016 # literal Markdown backticks in an ERE
  claim='`'"${deprecated}"'` cli|cli, `'"${deprecated}"'`|cli `'"${deprecated}"'`'
  for file in ${sweep[@]+"${sweep[@]}"}; do
    [[ "$(basename "$file")" == "CHANGELOG.md" ]] && continue
    [[ -L "$file" ]] && continue
    bin_docs=$((bin_docs + 1))
    rel="${file#"$ROOT"/}"
    hits=()
    mapfile -t hits < <(
      awk -v tok='`'"$deprecated"'`' -v ct="$contract" -v pa="$paths" -v st="$strict" \
          -v se="$section" -v adj="$adjacent" -v cl="$claim" '
        function win(ctx, at, tl, w,   s) { s = at - w; if (s < 1) s = 1; return substr(ctx, s, (at - s) + tl + w) }
        { line[NR] = $0; if ($0 ~ /^#+ /) head = $0; hd[NR] = head }
        END {
          tl = length(tok)
          for (i = 1; i <= NR; i++) {
            if (index(line[i], tok) == 0) continue
            prefix = line[i - 1] " "
            ctx = prefix line[i] " " line[i + 1]
            b = length(prefix)
            from = 1
            while ((p = index(substr(line[i], from), tok)) > 0) {
              at = b + from + p - 1
              excused = (tolower(hd[i]) ~ se)
              if (tolower(win(ctx, at, tl, 20)) ~ cl) {
                near = win(ctx, at, tl, 140)
                if (!excused && tolower(near) !~ ct && near !~ st) { print i; break }
              } else {
                wide = win(ctx, at, tl, 240)
                if (!excused && tolower(wide) !~ ct && tolower(wide) !~ pa && wide !~ st \
                    && win(ctx, at, tl, 64) !~ adj) { print i; break }
              }
              from = from + p + tl - 1
            }
          }
        }
      ' "$file" || true
    )
    for hit in ${hits[@]+"${hits[@]}"}; do
      [[ -n "$hit" ]] || continue
      failures+=("$rel:$hit presents \`$deprecated\` as the canonical CLI; docs/ makes \`$canonical\` canonical and \`$deprecated\` a compatibility alias")
    done
  done
done <<<"$bin_pairs"

if ((${#failures[@]})); then
  printf 'REGRESSION: %s\n' "${failures[@]}" >&2
  exit 1
fi

flag_count=0
if [[ -n "$pairs" ]]; then flag_count="$(wc -l <<<"$pairs" | tr -d ' ')"; fi
bin_count=0
if [[ -n "$bin_pairs" ]]; then bin_count="$(wc -l <<<"$bin_pairs" | tr -d ' ')"; fi
echo "PASS: $flag_count docs-declared flag alias pair(s) checked against ${#present[@]} README(s); $bin_count docs-declared binary alias pair(s) checked against $bin_docs tracked doc(s); none presents a deprecated spelling as canonical" >&2
exit 0
