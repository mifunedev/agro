#!/usr/bin/env bash
# tier: A
# source: ADR #929 — subagents are a bounded execution primitive, not a project-role ontology;
#         supersedes rl-delegation-write-worker (#57), whose read-only-worker lesson is kept here;
#         extended by issue #988 / ADR #989 (judgment stays with the advisor, edits go to workers);
#         extended by issue #1003 (useful bounded sizing replaces the maximize-parallelism slogan);
#         extended by issue #1004 (initial and resumed dispatch share one eligibility gate)
# desc: prose check: /delegate prefers the active session for context-sharing phases and judgment,
#       sends tracked implementation edits to bounded provider-native workers (coupled work to one
#       continuing worker), isolates parallel writers and serializes shared-file work, warns that a
#       read-only worker writes nothing, names no nonexistent project agent roles, sizes a task by
#       complexity/briefing overhead/shared context/verification cost instead of maximizing
#       parallelism or preferring smaller tasks, keeps the max-5-per-wave and recursion caps,
#       makes no unmeasured efficiency claim, and requires every initial or resumed dispatch to
#       satisfy its prerequisites, accepted dependencies, required controls, and provenance checks
#       (issue #1004). This text probe does not establish runtime dispatch behavior.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKILL="$ROOT/.claude/skills/delegate/SKILL.md"

if [[ ! -f "$SKILL" ]]; then
  echo "SKIPPED: delegate skill absent: $SKILL" >&2
  exit 2
fi

fail() { echo "REGRESSION: $*" >&2; exit 1; }

grep -q '^## When a worker is justified$' "$SKILL" || fail "/delegate has no worker-justification section"

boundary="$(awk '/^## When a worker is justified$/{f=1; next} f && /^## /{exit} f{print}' "$SKILL")"
[[ -n "${boundary//[[:space:]]/}" ]] || fail "the worker-justification section is empty"

missing=()
grep -qiF 'self-contained' <<<"$boundary"        || missing+=("the self-contained test")
grep -qiF 'parallelism' <<<"$boundary"           || missing+=("parallelism as a reason")
grep -qiF 'isolated context' <<<"$boundary"      || missing+=("isolated context as a reason")
grep -qiE 'restricted tools|tool .{0,12}restriction' <<<"$boundary" || missing+=("restricted tools as a reason")
grep -qiF 'verbose disposable output' <<<"$boundary" || missing+=("verbose disposable output as a reason")
grep -qiF 'share substantial context' <<<"$boundary"  || missing+=("the keep-it-in-the-active-session rule")
grep -qiF 'iterative refinement' <<<"$boundary"       || missing+=("the iterative-refinement exception")
(( ${#missing[@]} == 0 )) || fail "worker boundary omits: ${missing[*]}"

boundary_flat="$(tr -s '[:space:]' ' ' <<<"$boundary")"
missing=()
grep -qiF 'active session' <<<"$boundary_flat" || missing+=("the active session as the seat of judgment")
grep -qiE 'goal interpretation, architecture, decomposition, verification, (and )?acceptance' <<<"$boundary_flat" \
  || missing+=("goal interpretation, architecture, decomposition, verification, and acceptance named together as judgment kept in the active session")
grep -qiF 'tracked implementation edits' <<<"$boundary_flat" || missing+=("tracked implementation edits assigned to a worker")
grep -qiF 'one continuing worker' <<<"$boundary_flat"       || missing+=("coupled implementation kept with one continuing worker")
(( ${#missing[@]} == 0 )) || fail "worker boundary omits: ${missing[*]}"

negation='\b([Nn]o|[Nn]ot|[Nn]ever|[Nn]either)\b'
skill_flat="$(tr -s '[:space:]' ' ' <"$SKILL")"
skill_sentences="$(printf '%s\n' "$skill_flat" | sed 's/[.!?] /&\n/g')"
grep -qiF 'Parallel writers get isolated worktrees' <<<"$skill_flat" || fail "/delegate no longer gives parallel writers isolated worktrees"
grep -qiF 'Serialize shared-file work' <<<"$skill_flat"             || fail "/delegate no longer serializes shared-file work"
overlap="$(grep -iE 'writers? (may|can|should|must) share|shares? (one|a|the same) (worktree|checkout|branch)|(same|shared|overlapping) files?[^.]{0,40}(in parallel|concurrently|simultaneously|at the same time)' <<<"$skill_sentences" | grep -vE "$negation" || true)"
[[ -z "$overlap" ]] || fail "/delegate lets parallel writers overlap on shared state: $overlap"

worker_block="$(awk '/^Worker configuration:/{f=1} f{print} f && /^[[:space:]]*$/{exit}' "$SKILL")"
keyres_block="$(awk '/^### Key Resources/{f=1; next} f && /^(### |## )/{exit} f{print}' "$SKILL")"
region="$(printf '%s\n%s\n' "$worker_block" "$keyres_block")"
[[ -n "${region//[[:space:]]/}" ]] || fail "neither the Worker configuration block nor Key Resources could be located"

missing=()
grep -qi 'read-only' <<<"$region"        || missing+=("the read-only-worker warning")
grep -qi 'general-purpose' <<<"$region"  || missing+=("the general-purpose recommendation for write workers")
grep -qi 'built-in' <<<"$region"         || missing+=("the provider built-in worker vocabulary")
(( ${#missing[@]} == 0 )) || fail "the worker-configuration region omits: ${missing[*]}"

sizing="$(awk '/^\*\*Decomposition rules:\*\*$/{f=1; next} f && /^#+ /{exit} f{print}' "$SKILL" | tr -s '[:space:]' ' ')"
[[ -n "${sizing//[[:space:]]/}" ]] || fail "the decomposition rules could not be located"

missing=()
grep -qiF 'complexity' <<<"$sizing"        || missing+=("complexity as a sizing factor")
grep -qiF 'briefing overhead' <<<"$sizing" || missing+=("briefing overhead as a sizing factor")
grep -qiF 'shared context' <<<"$sizing"    || missing+=("shared context as a sizing factor")
grep -qiF 'verification cost' <<<"$sizing" || missing+=("verification cost as a sizing factor")
grep -qiF 'one continuing bounded worker is a valid answer' <<<"$sizing" \
  || missing+=("one continuing bounded worker named as a valid answer")
(( ${#missing[@]} == 0 )) || fail "the decomposition rules omit: ${missing[*]}"

grep -qiF 'dependency order is absolute' <<<"$skill_flat" \
  || fail "/delegate no longer states that dependency order is absolute"

maximize="$(grep -niE 'maximi[sz]e[^.]{0,24}parallelism|parallelism[^.]{0,24}maximi[sz]ed|as (much|many) (parallelism|workers|agents|sub-?agents)[^.]{0,24}as possible' "$SKILL" || true)"
[[ -z "$maximize" ]] || fail "/delegate still instructs the advisor to maximize parallelism: $maximize"

smaller="$(grep -niE 'prefer[a-z]*( [a-z]+){0,3} smaller (tasks|units|pieces)|smaller (tasks|units|pieces) over( [a-z]+){0,2} larger' "$SKILL" || true)"
[[ -z "$smaller" ]] || fail "/delegate still prefers smaller tasks by default instead of a useful boundary: $smaller"

unmeasured="$(grep -niE '[0-9]+ ?% ?(faster|fewer|less|cheaper|savings)|saves? [0-9]+ ?(%|x|tokens)|[0-9]+ ?x (faster|speedup)|token savings' "$SKILL" || true)"
[[ -z "$unmeasured" ]] || fail "/delegate makes an unmeasured efficiency or token-savings claim: $unmeasured"

brief="$(awk '/^\| Field \| Description \|$/{f=1} f && /^$/{exit} f{print}' "$SKILL")"
[[ -n "${brief//[[:space:]]/}" ]] || fail "the dispatch-record field table could not be located"

missing=()
grep -qF '| **Read scope** |' <<<"$brief"            || missing+=("Read scope")
grep -qF '| **Selection reason** |' <<<"$brief"      || missing+=("Selection reason")
grep -qF '| **Search / output limits** |' <<<"$brief" || missing+=("Search / output limits")
grep -qF '| **Evidence destinations** |' <<<"$brief" || missing+=("Evidence destinations")
grep -qF '| **Stopping condition** |' <<<"$brief"    || missing+=("Stopping condition")
(( ${#missing[@]} == 0 )) || fail "the dispatch record no longer requires every worker-brief field: ${missing[*]}"

eligibility="$(awk '/^\*\*Dispatch eligibility applies to initial and resumed runs\.\*\*/{f=1} f && /^\*\*Resume rather than restart\.\*\*/{exit} f{print}' "$SKILL" | tr -s '[:space:]' ' ')"
[[ -n "${eligibility//[[:space:]]/}" ]] || fail "the initial-and-resumed dispatch eligibility block could not be located"

missing=()
grep -qiF 'blocking prerequisites' <<<"$eligibility"              || missing+=("blocking prerequisites")
grep -qF '`Depends On`' <<<"$eligibility"                         || missing+=("every dependency")
grep -qF 'recorded `completed`' <<<"$eligibility"                  || missing+=("accepted dependency state")
grep -qiF 'accepted evidence' <<<"$eligibility"                    || missing+=("accepted dependency evidence")
grep -qiF 'required artifact revision' <<<"$eligibility"           || missing+=("current dependency evidence")
grep -qiF 'established provenance' <<<"$eligibility"               || missing+=("established dependency provenance")
grep -qiF 'required model, control, and capability' <<<"$eligibility" || missing+=("required controls")
grep -qiF 'no unresolved native worker status, artifact provenance, or owned-path ambiguity' <<<"$eligibility" \
  || missing+=("unresolved status and provenance must be absent")
grep -qF 'record `running`' <<<"$eligibility"                      || missing+=("running recorded before dispatch")
grep -qF 'record or keep `BLOCKED`' <<<"$eligibility"              || missing+=("unmet conditions stay blocked")
grep -qiF 'dispatch nothing' <<<"$eligibility"                     || missing+=("no dispatch while blocked")
grep -qF '`pending` alone' <<<"$eligibility"                       || missing+=("pending is not automatic eligibility")
grep -qiF 'only some accepted dependencies' <<<"$eligibility"     || missing+=("partial dependency acceptance is insufficient")
(( ${#missing[@]} == 0 )) || fail "dispatch eligibility omits: ${missing[*]}"

unsafe_resume="$(grep -nF -- '- `pending`, `BLOCKED`: re-run the task under its dispatch record.' "$SKILL" || true)"
[[ -z "$unsafe_resume" ]] || fail "/delegate still re-runs pending and blocked tasks without re-evaluating eligibility: $unsafe_resume"

missing=()
grep -qF 'Max 5 concurrent agents per wave' <<<"$skill_flat"   || missing+=("the max-5-per-wave wave cap")
grep -qF 'Max concurrent agents per wave | 5' <<<"$skill_flat" || missing+=("the max-5-per-wave reference row")
grep -qF 'Max depth: N' <<<"$skill_flat"                       || missing+=("the Max depth recursion field")
grep -qF 'Max children per level: M' <<<"$skill_flat"          || missing+=("the Max children per level recursion field")
grep -qF 'Step budget: S' <<<"$skill_flat"                     || missing+=("the Step budget recursion field")
(( ${#missing[@]} == 0 )) || fail "/delegate dropped a concurrency or recursion limit: ${missing[*]}"

stale="$(grep -nE '\.(oh|claude|codex|pi)/agents/[A-Za-z0-9_-]+\.md' "$SKILL" || true)"
[[ -z "$stale" ]] || fail "/delegate still cites project-agent definition files: $stale"

roles="$(grep -nEi 'subagent_type: *(implementer|critic|pm|council)|`(implementer|critic|pm|council)`' "$SKILL" || true)"
[[ -z "$roles" ]] || fail "/delegate still names retired project-agent roles as worker types: $roles"

echo "PASS: /delegate keeps judgment in the active session, sends tracked edits to bounded isolated workers, sizes tasks usefully, checks initial and resumed dispatch eligibility, keeps its concurrency and recursion caps, and names no project agents (prose check only; runtime behavior unverified)" >&2
