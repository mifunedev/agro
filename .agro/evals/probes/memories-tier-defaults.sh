#!/usr/bin/env bash
# tier: A
# source: issue #1084 — .agro/memories/ ships defaults, not one operator's memories; repaired by issue #1116
#         — the probe asserted on the live files the tier's own guide tells a session to
#         edit, so following the guide turned the suite red
# desc: .agro/memories/ ships a tracked contract and three tracked templates, and ships
#       nobody's actual memories. The live SOUL/USER/MEMORY instances are operator state:
#       they must never be tracked, because a tracked live file both publishes one
#       operator's identity and makes the guide's own "edit in place" instruction turn
#       the suite red. Every assertion here reads a TEMPLATE or the CONTRACT, never a
#       live instance.
#
#       Session-start-mandate strictness: the contract must scope reading to demand.
#       A bare search for "session start" is wrong in both directions — the contract
#       legitimately writes "There is no `SessionStart` hook", and a reworded mandate
#       would dodge a fixed-string search for "Read all three at session start". This
#       probe therefore scans sentence by sentence and flags a sentence that pairs a
#       read directive with a universal trigger (session start / every session / at
#       startup / on boot) and carries no negation. It also requires the positive
#       on-demand scoping to survive, so deleting the scope is a regression too.
#
#       Deployment modes rest on two INDEPENDENT facts, never conflated:
#         has_index      — `git rev-parse --git-dir`. Gates every `git ls-files` claim.
#         source_checkout — `git ls-files --error-unmatch docs/lifecycle-commands.md`,
#                          the sentinel .agro/evals/probes/agents-md-fallback.sh uses.
#                          Gates only claims about repository-only files.
#       An installed project that an operator has `git init`-ed has an index but no
#       sentinel, and it is the MOST likely place for a tracked live instance in the
#       wild: the operator seeds the live files, then runs `git add -A`. So the
#       live-instance guard is a has_index assertion and runs there. The tracked-set
#       EQUALITY check is source-checkout only, because an installed payload may
#       legitimately be tracked, untracked, or partly staged.
#       Content assertions are universal — the contract and templates are in the
#       manifest payload. Absence of the subject is a REGRESSION, never a SKIP.
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

# --- universal: the subject must be present as real files -------------------
for path in "$CONTRACT" "$TEMPLATES_DIR/SOUL.md" "$TEMPLATES_DIR/USER.md" \
  "$TEMPLATES_DIR/MEMORY.md"; do
  [[ -f "$path" && ! -L "$path" ]] \
    || fail "$path must be a real file: the manifest ships the contract and the templates"
done

# --- wherever a git index exists: the core regression guard -----------------
# This holds in a source checkout AND in an operator's git-tracked installed
# project, which is where a seeded live file is most likely to be committed.
if ((has_index)); then
  tracked="$(git ls-files -- "$MEM")"
  live_tracked="$(grep -E '^\.agro/memories/(SOUL|USER|MEMORY)\.md$' <<<"$tracked" || true)"
  if [[ -n "$live_tracked" ]]; then
    fail "a live memory instance is tracked — it publishes operator state and makes the guide's 'edit a live file in place' instruction fail this suite: $(tr '\n' ' ' <<<"$live_tracked")"
  fi
fi

# --- source checkout only: the exact tracked set ----------------------------
# Equality cannot hold in an installed project: the payload may be tracked,
# untracked, or partly staged depending on what the operator committed.
if ((source_checkout)); then
  expected=$'.agro/memories/AGENTS.md\n.agro/memories/templates/MEMORY.md\n.agro/memories/templates/SOUL.md\n.agro/memories/templates/USER.md'
  if [[ "$tracked" != "$expected" ]]; then
    fail "$MEM must track exactly the contract and the three templates; got: $(tr '\n' ' ' <<<"$tracked")"
  fi
fi

# --- the template set that every content assertion runs over ----------------
if ((source_checkout)); then
  mapfile -t templates < <(git ls-files -- "$TEMPLATES_DIR")
else
  mapfile -t templates < <(find "$TEMPLATES_DIR" -maxdepth 1 -type f -name '*.md' | sort)
fi
((${#templates[@]} == 3)) \
  || fail "$TEMPLATES_DIR must hold exactly the three canonical templates; got ${#templates[@]}"

# --- universal: no real identity anywhere in the shipped tier ---------------
EMAIL_RE='[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
for t in "${templates[@]}" "$CONTRACT"; do
  [[ -f "$t" ]] || continue
  if hits="$(grep -nE "$EMAIL_RE" "$t")"; then
    fail "an email address in $t publishes a real operator identity: $(tr '\n' ' ' <<<"$hits")"
  fi
done

USER_T="$TEMPLATES_DIR/USER.md"
if [[ -f "$USER_T" ]]; then
  # The owner fields must be present, and every one of them must be empty.
  for field in 'Name' 'GitHub' 'Git identity'; do
    grep -qE "^- \*\*${field}\*\*:" "$USER_T" \
      || fail "the USER template lost its '$field' owner field — the template must keep the field and ship it blank"
  done
  if hits="$(grep -nE '^- \*\*(Name|GitHub|Git identity)\*\*: +[^ ]' "$USER_T")"; then
    fail "the USER template carries a filled owner field — the shipped default is blank: $(tr '\n' ' ' <<<"$hits")"
  fi
fi

MEM_T="$TEMPLATES_DIR/MEMORY.md"
if [[ -f "$MEM_T" ]]; then
  # A real dated entry has four digits. The documented placeholder
  # "- **<short title>** (YYYY-MM-DD): ..." has none, so it does not match.
  if hits="$(grep -nE '^- \*\*.*\(20[0-9]{2}-' "$MEM_T")"; then
    fail "the MEMORY template carries a real dated entry — one session's memory would ship to every checkout: $(tr '\n' ' ' <<<"$hits")"
  fi
  grep -Fq '(YYYY-MM-DD)' "$MEM_T" \
    || fail "the MEMORY template lost the documented entry format placeholder"
fi

SOUL_T="$TEMPLATES_DIR/SOUL.md"
if [[ -f "$SOUL_T" ]]; then
  for heading in '## Voice' '## Values' '## Guardrails'; do
    grep -Fq "$heading" "$SOUL_T" \
      || fail "the SOUL template lost '$heading' — the shipped default must stay usable"
  done
fi

# --- universal: the contract scopes reading to demand, not to session start --
READ_RE='read|reads|reading'
TRIGGER_RE='session[ -]?start|sessionstart|every session|each session|start of (a|each|every|the) session|at startup|on boot'
NEGATION_RE='\bno\b|\bnot\b|never|removed|retired|no longer|installs no|there is no'

scan_mandate() {
  local file="$1" label="$2" line
  [[ -f "$file" ]] || return 0
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    grep -qiE "$READ_RE" <<<"$line" || continue
    grep -qiE "$TRIGGER_RE" <<<"$line" || continue
    grep -qiE "$NEGATION_RE" <<<"$line" && continue
    fail "$label states a universal session-start read mandate; reading this tier is on demand: ${line# }"
  done < <(tr '\n' ' ' <"$file" | sed 's/\([.!?]\)  */\1\n/g')
}

scan_mandate "$CONTRACT" "the memories contract"
if [[ -f "$CONTRACT" ]]; then
  grep -qiE 'on demand' "$CONTRACT" \
    || fail "the memories contract lost its on-demand scoping — that scoping is what keeps the mandate retired"
fi

# The root AGENTS.md is not in the manifest payload, so it is source-checkout only.
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
