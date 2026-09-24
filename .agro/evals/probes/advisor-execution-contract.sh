#!/usr/bin/env bash
# tier: A
# source: issue #988 / ADR #989
# desc: prose check of the advisor/worker execution contract in /delegate over prd.json: a worker
#       report is not acceptance, the advisor reruns verification on the integrated task branch
#       before it writes passes, commit, and notes (each criterion executed or reasoned), repairs
#       return to the same worker, dependents of a failed story wait, resume reads prd.json with no
#       separate ledger, the close writes ## Lessons, planning alone is not a trigger, --dry-run
#       writes and dispatches nothing, and no sentence fixes the advisor to a model or terminal,
#       mandates a handoff, lets the advisor implement directly, or launches a coding-agent process.
#       This probe inspects instruction text; it does not verify runtime delegation, recovery, or
#       model settings.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DELEGATE="$ROOT/.agro/skills/delegate/SKILL.md"

if [[ ! -f "$DELEGATE" ]]; then
  echo "SKIPPED: required file absent: $DELEGATE" >&2
  exit 2
fi

negation='\b([Nn]o|[Nn]ot|[Nn]ever|[Nn]either)\b'
flatten() { tr -s '[:space:]' ' ' <"$1"; }
delegate_flat="$(flatten "$DELEGATE")"
sentences="$(printf '%s\n' "$delegate_flat" | sed 's/[.!?] /&\n/g')"

problems=()
need() {
  local label="$1" text="$2"; shift 2
  local fragment
  for fragment in "$@"; do
    grep -qiF -- "$fragment" <<<"$text" || problems+=("$label lacks '$fragment'")
  done
}

need delegate/SKILL.md "$delegate_flat" \
  'A worker report is not acceptance' \
  'rerun the verification on the integrated task branch' \
  'write `passes: true`, `commit`, and `notes`' \
  'each criterion executed or reasoned' \
  'returns to the same worker with a bounded repair' \
  'the advisor does not repair' \
  'Dependents of a failed story wait' \
  'tick the story in the PR `## Stories` checklist' \
  're-verify the stories it builds on' \
  'No separate ledger' \
  '## Lessons' \
  'claim, evidence, and exactly one outcome' \
  'Write nothing' \
  'dispatches nothing' \
  'is not a trigger' \
  'authorizes no dispatch'

delegate_frontmatter="$(awk 'NR==1 && $0=="---"{f=1; next} f && /^---$/{exit} f{print}' "$DELEGATE")"
delegate_desc="$(awk '/^description: \|$/{f=1; next} f && /^[a-z][a-z-]*:/{exit} f{print}' <<<"$delegate_frontmatter" | tr -s '[:space:]' ' ')"
for key in name description argument-hint; do
  grep -qE "^${key}:" <<<"$delegate_frontmatter" || problems+=("/delegate frontmatter lacks '${key}:'")
done
negation_word='\b(not|never|no|neither|nor|without)\b'

unnegated_hits() {
  local text="$1" token="$2"
  printf '%s\n' "$text" \
    | sed -E 's/([.!?]) /\1\n/g' \
    | sed -E 's/\b(but|however|whereas|yet|though|although|while)\b/\n&/gI' \
    | grep -iE -- "${token}" \
    | grep -viE -- "(${negation_word}.{0,80}${token}|${token}.{0,80}${negation_word})" || true
}

if [[ -z "${delegate_desc//[[:space:]]/}" ]]; then
  problems+=("/delegate frontmatter has no description block scalar")
else
  planning_command='(^|[[:space:]("`])/(prd|plan|imagine)\b'
  planning_event='(plan creation|plan is (created|written|finished)|after (writing|creating|finishing) a plan)'
  cmd_hits="$(unnegated_hits "$delegate_desc" "$planning_command")"
  [[ -z "$cmd_hits" ]] || problems+=("/delegate names a planning command as a trigger, so planning alone would authorize dispatch: $cmd_hits")
  event_hits="$(unnegated_hits "$delegate_desc" "$planning_event")"
  [[ -z "$event_hits" ]] || problems+=("/delegate triggers on plan creation, so finishing a plan would authorize dispatch: $event_hits")
fi

fixed="$(grep -iE 'advisor[^.|]{0,80}\b(is|are|runs on|runs in|lives in|uses|requires|must use|means|=)\b[^.|]{0,60}\b(Fable|Opus|Sonnet|Haiku|Luna|Astra|GPT|tmux|Herdr|pane|tab|persistent identity|named agent)\b|(owner|advisor)[^.|]{0,40}(requires|needs|must use) (a |the )?(particular|specific|fixed) (model|identity|terminal)' <<<"$sentences" | grep -vE "$negation|operator preference" || true)"
[[ -z "$fixed" ]] || problems+=("the advisor is defined by a fixed model, identity, or terminal: $fixed")

forced="$(grep -iE '(hand ?off|handoff prompt|transfer)[^.]{0,60}\b(is )?(required|mandatory)\b|(must|always|should) (hand ?off|transfer|provide a hand ?off|include a hand ?off)|requires? (a )?(hand ?off|transfer|second session|fresh session)' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$forced" ]] || problems+=("a handoff or transfer is made mandatory: $forced")

concurrent="$(grep -iE '(both|two|each|either|every) (advisors?|owners?|sessions?)[^.]{0,80}(continue|keep|may|can|resume)[^.]{0,40}dispatch|(continue|keep|may|can|resume)[^.]{0,20}dispatch[^.]{0,60}after (the |an? )?(authorized )?(transfer|handoff)' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$concurrent" ]] || problems+=("more than one advisor may dispatch after a transfer: $concurrent")

direct="$(grep -iE 'implements? (the )?(stories|story|it|them|the plan) (directly|yourself|itself)|(owner|advisor|session) (implements|writes|edits) (the )?(stories|code|implementation) (directly|itself)' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$direct" ]] || problems+=("the owner implements directly instead of assigning workers: $direct")

permit_verb='(may|can|should|is allowed to|is permitted to|is free to) (write|edit|make|perform|implement|author)'
permitted="$(grep -iE "\\b(owner|advisor|active session|parent)\\b.{0,40}\\b${permit_verb}\\b.{0,50}\\b(tracked|implementation|edits?|stories|story|code|patch)\\b" <<<"$sentences" \
  | grep -viE "\\b(never|not|no|neither|without|unless)\\b.{0,30}\\b${permit_verb}\\b" || true)"
[[ -z "$permitted" ]] || problems+=("the owner is permitted to write implementation edits without an operator exception: $permitted")

stale="$(grep -iE '(completed status|completion summary|worker'"'"'?s? (summary|report|status)|status of `?completed`?)[^.]{0,60}\b(counts as|is|constitutes|serves as|satisfies|equals|means|proves)\b[^.]{0,40}(acceptance|accepted|verified|passing|passes)|(set|flip|mark)s?[^.]{0,40}`?passes`?[^.]{0,40}(when|after|once|because)[^.]{0,40}(worker|summary|status) (reports|says|claims|returns|completes)' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$stale" ]] || problems+=("a worker's completed status or summary counts as acceptance: $stale")

launches="$(grep -iE '(launch|spawn|start)(es|s)? (a |the |another )?(coding[- ]agent|agent) (process|session)[^.]{0,60}(to|for) (do|perform|run|implement)' <<<"$sentences" | grep -vE "$negation" || true)"
[[ -z "$launches" ]] || problems+=("/delegate launches a coding-agent process: $launches")

if (( ${#problems[@]} > 0 )); then
  echo "REGRESSION: advisor-first execution contract is broken; issues:" >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

echo "PASS: /delegate accepts only after the advisor reruns verification, records executed/reasoned notes in prd.json, resumes from prd.json alone, closes with ## Lessons, keeps --dry-run read-only, fixes the advisor to no model or terminal, and launches no coding-agent process (prose check only; runtime behavior unverified)" >&2
exit 0
