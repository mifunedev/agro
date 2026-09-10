#!/usr/bin/env bash
# tier: A
# source: issue #988 / ADR #989
# desc: prose check of the advisor-first execution contract in /spec execute, its task prompt, and
#       the /spec skill: bounded workers implement before the owner accepts, a direct owner edit
#       needs a recorded operator exception, the task stays in the same session by default,
#       transfer happens only on operator request with the originating advisor stopping dispatch
#       and the receiver acknowledging ownership, a plan without a handoff prompt is valid, the
#       advisor has no fixed identity, /spec launches no coding-agent process, a worker's completed
#       status is a report rather than acceptance, and the human merge gate stays. Extended by
#       issue #1003 for /delegate: acceptance is recorded before a dependent is released, resume
#       reconciles `running` tasks and stale completion evidence, every procedure reference
#       resolves (no Memory Protocol), planning alone is not a trigger, and the diagram branches
#       on --dry-run before the run-ledger write (asserted as graph edges, not text order).
#       Issue #1004 requires blocked and pending tasks to satisfy every dependency, prerequisite,
#       control, and provenance condition before dispatch. This probe inspects instruction text;
#       it does not verify runtime delegation, recovery, eligibility decisions, or model settings.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EXEC="$ROOT/.agro/skills/spec/references/execute.md"
PROMPT="$ROOT/.agro/skills/spec/templates/task-prompt.md"
SPEC="$ROOT/.agro/skills/spec/SKILL.md"
DELEGATE="$ROOT/.agro/skills/delegate/SKILL.md"

for file in "$EXEC" "$PROMPT" "$SPEC" "$DELEGATE"; do
  if [[ ! -f "$file" ]]; then
    echo "SKIPPED: required file absent: $file" >&2
    exit 2
  fi
done

negation='\b([Nn]o|[Nn]ot|[Nn]ever|[Nn]either)\b'
flatten() { tr -s '[:space:]' ' ' <"$1"; }
exec_flat="$(flatten "$EXEC")"
prompt_flat="$(flatten "$PROMPT")"
spec_flat="$(flatten "$SPEC")"
delegate_flat="$(flatten "$DELEGATE")"
delegate_portable="$(awk '/^#+ .*[Pp]reference/{skip=1; next} skip && /^## /{skip=0} !skip{print}' "$DELEGATE" | tr -s '[:space:]' ' ')"
sentences="$(printf '%s\n%s\n%s\n%s\n' "$exec_flat" "$prompt_flat" "$spec_flat" "$delegate_portable" | sed 's/[.!?] /&\n/g')"

problems=()
need() {
  local label="$1" text="$2"; shift 2
  local fragment
  for fragment in "$@"; do
    grep -qiF -- "$fragment" <<<"$text" || problems+=("$label lacks '$fragment'")
  done
}

need execute.md "$exec_flat" \
  'workers perform the tracked implementation edits' \
  'before the owner performs acceptance' \
  'operator exception recorded in `progress.txt` before the edit' \
  'Same session by default' \
  'needs no particular model and no handoff' \
  'Ownership transfers only when the operator requests another session' \
  'originating advisor stops dispatching work' \
  'acknowledges ownership' \
  'Worker delegation never transfers ownership' \
  'This node launches nothing' \
  'never creates the agent that executes it' \
  'human merge gate' \
  'Merge is the human'
need task-prompt.md "$prompt_flat" \
  'perform every tracked implementation edit' \
  'before you perform acceptance' \
  'record the explicit operator exception in `progress.txt` before the edit' \
  'Continue in this session by default' \
  'the task needs no handoff' \
  'Transfer ownership only when the operator requests another session' \
  'stop dispatching work for this task' \
  'acknowledges ownership before it dispatches a worker' \
  'Worker delegation never transfers task ownership' \
  'do not launch another coding-agent process' \
  'Ownership is a role, not a terminal topology' \
  'Never merge the PR'
need spec/SKILL.md "$spec_flat" \
  'before the owner performs acceptance' \
  'operator exception recorded in `progress.txt` before the edit' \
  'Same session by default' \
  'needs no particular model and no handoff' \
  'only when the operator requests another session' \
  'originating advisor stops dispatching work' \
  'acknowledges ownership before it dispatches a worker' \
  'A plan without a handoff prompt is complete' \
  'never launches another coding-agent process' \
  'human merge gate'
need delegate/SKILL.md "$delegate_flat" \
  'completed status is a report, not acceptance' \
  'acceptance decision, never a worker' \
  'the accepted state that step 5d reads' \
  'Release a dependent only on accepted artifacts' \
  'is a separate, still-required check' \
  'inspect the persisted native worker reference and the current artifacts' \
  'never spawn a duplicate for it' \
  'retry only the incomplete scope' \
  'Re-read the artifact references against the current tree' \
  'returns to `running` for reconciliation' \
  'its dependents wait' \
  'blocks every write to the affected paths' \
  'never authorizes a second writer' \
  'it never truncates it' \
  'write neither file' \
  'dispatch no worker, create no execution state' \
  'is not a trigger' \
  'authorizes no dispatch and creates no execution state' \
  '- `FAIL`: read the failed task' \
  'Accepted prior-wave artifact references and summaries, not full output' \
  'Dispatch eligibility applies to initial and resumed runs' \
  'It remains `BLOCKED` while any condition is unmet' \
  'becomes eligible only after every condition holds' \
  'Re-evaluate a `BLOCKED` dependent against all dependencies' \
  'release it only when every condition holds'

if grep -qiF 'Memory Protocol' "$DELEGATE"; then
  problems+=("/delegate still calls the undefined Memory Protocol")
fi
if grep -qF 'Pass completed task summaries as context to the next wave' <<<"$delegate_flat"; then
  problems+=("step 5d still releases a dependent on a worker report instead of on accepted artifacts")
fi
if grep -qF 'treat `completed` tasks as done' <<<"$delegate_flat"; then
  problems+=("resume still trusts a saved completed label without re-checking its evidence")
fi
if grep -qF 'Re-run only tasks whose status is `pending`, `FAIL`, or `BLOCKED`' <<<"$delegate_flat"; then
  problems+=("resume still skips running tasks instead of reconciling them")
fi
if grep -qF -- '- `pending`, `BLOCKED`: re-run the task under its dispatch record.' "$DELEGATE"; then
  problems+=("resume still dispatches pending and blocked tasks without re-evaluating dependencies and controls")
fi

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
  planning_command='/(prd|plan|imagine|spec)\b'
  planning_event='(plan creation|plan is (created|written|finished)|after (writing|creating|finishing) a plan)'
  cmd_hits="$(unnegated_hits "$delegate_desc" "$planning_command")"
  [[ -z "$cmd_hits" ]] || problems+=("/delegate names a planning command as a trigger, so planning alone would authorize dispatch: $cmd_hits")
  event_hits="$(unnegated_hits "$delegate_desc" "$planning_event")"
  [[ -z "$event_hits" ]] || problems+=("/delegate triggers on plan creation, so finishing a plan would authorize dispatch: $event_hits")
fi

delegate_mermaid="$(awk '/^```mermaid$/{f=1; next} f && /^```$/{f=0} f{print}' "$DELEGATE")"
if [[ -z "${delegate_mermaid//[[:space:]]/}" ]]; then
  problems+=("/delegate has no Decision Flow mermaid diagram")
else
  grep -qF 'D --> F{--dry-run?}' <<<"$delegate_mermaid" \
    || problems+=("the Decision Flow diagram is missing the dependency-graph edge to --dry-run")
  grep -qF 'F -->|No| E["Step 4: Write run ledger' <<<"$delegate_mermaid" \
    || problems+=("the Decision Flow diagram is missing the --dry-run false edge to the run-ledger write")
  if grep -qiE 'MEM_|Memory Protocol' <<<"$delegate_mermaid"; then
    problems+=("the Decision Flow diagram still routes to the undefined Memory Protocol")
  fi
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
[[ -z "$launches" ]] || problems+=("/spec launches a coding-agent process: $launches")

if (( ${#problems[@]} > 0 )); then
  echo "REGRESSION: advisor-first execution contract is broken; issues:" >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

echo "PASS: /spec keeps one advisor deciding and accepting, workers implementing first, same-session execution by default, operator-only transfer, no fixed advisor identity, no launched agent, and the human merge gate; /delegate releases only tasks whose full eligibility and accepted-evidence checks hold, reconciles interrupted work, resolves every procedure reference, and keeps --dry-run read-only (prose check only; runtime behavior unverified)" >&2
exit 0
