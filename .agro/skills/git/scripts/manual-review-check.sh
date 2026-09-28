#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -r "$1" ]]; then
  echo "usage: manual-review-check.sh <body-file>" >&2
  exit 2
fi

awk '
  function flush() {
    if (step != "" && shot && !callouts) {
      printf "manual-review-check: step has a screenshot and no Callouts: line: %s\n", step
      bad = 1
    }
    step = ""; shot = 0; callouts = 0
  }
  {
    line = $0
    while (match(line, /github\.com\/[^\/[:space:]]+\/[^\/[:space:]]+\/blob\/[^?[:space:]]+/)) {
      ref = substr(line, RSTART, RLENGTH)
      sub(/.*\/blob\//, "", ref)
      if (ref !~ /^[0-9a-f]{40}\//) {
        printf "manual-review-check: line %d: ref \"%s\" does not start with a 40-character SHA: %s\n", NR, ref, $0
        bad = 1
      }
      line = substr(line, RSTART + RLENGTH)
    }
  }
  /^## / { flush(); section = ($0 == "## Manual review"); next }
  !section { next }
  /^#+ / || /^\*\*.*\*\*[[:space:]]*$/ { flush(); next }
  /^ {0,3}[0-9]+\. / { flush(); step = $0; next }
  /<details><summary>Screenshot<\/summary>/ { shot = 1 }
  /^[[:space:]]*Callouts:/ { callouts = 1 }
  END { flush(); exit bad }
' "$1"
