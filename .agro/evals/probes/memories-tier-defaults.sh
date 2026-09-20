#!/usr/bin/env bash
# tier: A
# source: issue #1084 — .agro/memories/ ships defaults, not one operator's memories; repaired by issue #1116
#         — the probe asserted on the live files the tier's own guide tells a session to
#         edit, so following the guide turned the suite red
# desc: .agro/memories/ ships a tracked contract and three tracked templates, and ships
#       nobody's actual memories. No live SOUL/USER/MEMORY instance may be tracked, no
#       shipped file may carry a real identity or a dated entry, and the contract must
#       keep reading this tier on demand rather than mandating it at session start.
#       Every assertion reads a template or the contract, never a live instance.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

MEM=".agro/memories"
CONTRACT="$MEM/AGENTS.md"
TEMPLATES_DIR="$MEM/templates"

failures=()
fail() { failures+=("$*"); }

has_index=0
source_checkout=0
if git rev-parse --git-dir >/dev/null 2>&1; then
  has_index=1
  git ls-files --error-unmatch docs/lifecycle-commands.md >/dev/null 2>&1 && source_checkout=1
fi

# --- the shipped subject ----------------------------------------------------
for path in "$CONTRACT" "$TEMPLATES_DIR/SOUL.md" "$TEMPLATES_DIR/USER.md" \
  "$TEMPLATES_DIR/MEMORY.md"; do
  [[ -f "$path" && ! -L "$path" ]] \
    || fail "$path must be a real file: the manifest ships the contract and the templates"
done

# --- what git tracks --------------------------------------------------------
if ((has_index)); then
  tracked="$(git ls-files -- "$MEM")"
  live_tracked="$(grep -E '^\.agro/memories/(SOUL|USER|MEMORY)\.md$' <<<"$tracked" || true)"
  if [[ -n "$live_tracked" ]]; then
    fail "a live memory instance is tracked — it publishes operator state and makes the guide's 'edit a live file in place' instruction fail this suite: $(tr '\n' ' ' <<<"$live_tracked")"
  fi
fi

if ((source_checkout)); then
  expected=$'.agro/memories/AGENTS.md\n.agro/memories/templates/MEMORY.md\n.agro/memories/templates/SOUL.md\n.agro/memories/templates/USER.md'
  if [[ "$tracked" != "$expected" ]]; then
    fail "$MEM must track exactly the contract and the three templates; got: $(tr '\n' ' ' <<<"$tracked")"
  fi
fi

if ((source_checkout)); then
  mapfile -t templates < <(git ls-files -- "$TEMPLATES_DIR")
else
  mapfile -t templates < <(find "$TEMPLATES_DIR" -maxdepth 1 -type f -name '*.md' | sort)
fi
((${#templates[@]} == 3)) \
  || fail "$TEMPLATES_DIR must hold exactly the three canonical templates; got ${#templates[@]}"

# --- no real identity in anything shipped -----------------------------------
EMAIL_RE='[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
for t in "${templates[@]}" "$CONTRACT"; do
  if hits="$(grep -nE "$EMAIL_RE" "$t" 2>/dev/null)"; then
    fail "an email address in $t publishes a real operator identity: $(tr '\n' ' ' <<<"$hits")"
  fi
done

USER_T="$TEMPLATES_DIR/USER.md"
for field in 'Name' 'GitHub' 'Git identity'; do
  grep -qE "^- \*\*${field}\*\*:" "$USER_T" 2>/dev/null \
    || fail "the USER template lost its '$field' owner field — the template must keep the field and ship it blank"
done
if hits="$(grep -nE '^- \*\*(Name|GitHub|Git identity)\*\*: +[^ ]' "$USER_T" 2>/dev/null)"; then
  fail "the USER template carries a filled owner field — the shipped default is blank: $(tr '\n' ' ' <<<"$hits")"
fi

MEM_T="$TEMPLATES_DIR/MEMORY.md"
if hits="$(grep -nE '^- \*\*.*\(20[0-9]{2}-' "$MEM_T" 2>/dev/null)"; then
  fail "the MEMORY template carries a real dated entry — one session's memory would ship to every checkout: $(tr '\n' ' ' <<<"$hits")"
fi
grep -Fq '(YYYY-MM-DD)' "$MEM_T" 2>/dev/null \
  || fail "the MEMORY template lost the documented entry format placeholder"

SOUL_T="$TEMPLATES_DIR/SOUL.md"
for heading in '## Voice' '## Values' '## Guardrails'; do
  grep -Fq "$heading" "$SOUL_T" 2>/dev/null \
    || fail "the SOUL template lost '$heading' — the shipped default must stay usable"
done

# --- reading this tier is on demand, never a session-start mandate -----------
READ_RE='read|reads|reading'
TRIGGER_RE='session[ -]?start|sessionstart|every session|each session|start of (a|each|every|the) session|at startup|on boot'
MECHANISM_DENIAL_RE='\bno\b[^.]{0,40}\b(hook|loader|daemon|mandate|mechanism|reader|requirement)\b|does not read|need not read|never reads|no longer reads'

scan_mandate() {
  local file="$1" label="$2" line
  [[ -f "$file" ]] || return 0
  while IFS= read -r line; do
    grep -qiE "$READ_RE" <<<"$line" || continue
    grep -qiE "$TRIGGER_RE" <<<"$line" || continue
    grep -qiE "$MECHANISM_DENIAL_RE" <<<"$line" && continue
    fail "$label states a universal session-start read mandate; reading this tier is on demand: ${line# }"
  done < <(tr '\n' ' ' <"$file" | sed 's/\([.!?]\)  */\1\n/g')
}

scan_mandate "$CONTRACT" "the memories contract"
grep -qiE 'on demand' "$CONTRACT" 2>/dev/null \
  || fail "the memories contract lost its on-demand scoping — that scoping is what keeps the mandate retired"

if ((source_checkout)) && grep -qF "$MEM" AGENTS.md 2>/dev/null; then
  scan_mandate AGENTS.md "the root AGENTS.md"
fi

if ((${#failures[@]})); then
  printf 'REGRESSION: %s\n' "${failures[@]}" >&2
  exit 1
fi

if ((source_checkout)); then
  echo "PASS: source-checkout mode (git index + repository sentinel) — $MEM tracks exactly the contract and the three templates, no live instance is tracked, the templates carry no identity and no dated entry, and the contract keeps reading on demand" >&2
elif ((has_index)); then
  echo "PASS: installed-project mode, git index present (no repository sentinel) — no live memory instance is tracked; the shipped contract and templates carry no identity, no dated entry, the SOUL sections, and no session-start mandate" >&2
else
  echo "PASS: installed-project mode, no git index — tracking assertions are not applicable; the shipped contract and templates carry no identity, no dated entry, the SOUL sections, and no session-start mandate" >&2
fi
exit 0
