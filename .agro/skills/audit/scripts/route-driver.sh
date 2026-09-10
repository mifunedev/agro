#!/usr/bin/env bash
set -euo pipefail
: "${AUDIT_ROOT:?AUDIT_ROOT is required}"
: "${AUDIT_RUN_ID:?AUDIT_RUN_ID is required}"
: "${AUDIT_TARGET:?AUDIT_TARGET is required}"
: "${AUDIT_TARGET_ARGS_JSON:?AUDIT_TARGET_ARGS_JSON is required}"
[[ ${1:-} == "$AUDIT_TARGET" ]] || { echo 'audit-route-driver: forwarded target mismatch' >&2; exit 64; }
shift
forwarded=$(jq -cn --args '$ARGS.positional' -- "$@")
[[ $forwarded == "$AUDIT_TARGET_ARGS_JSON" ]] || { echo 'audit-route-driver: forwarded argument mismatch' >&2; exit 64; }
scripts="$AUDIT_ROOT/.agro/skills/audit/scripts"
gates="$scripts/implementation-gates.sh"
head=$(git -C "$AUDIT_ROOT" rev-parse HEAD)
pr='' repo='' base='' branch=''

publish(){
  printf 'AUDIT-EVIDENCE: %s\n' "$1"
  "$scripts/audit-evidence.sh" complete "$1"
  exit 0
}
fail(){ printf '%s\n' "$1"; publish AUDIT-FAIL; }
resolve_repo(){
  [[ -n $repo ]] && return 0
  repo=$(cd "$AUDIT_ROOT" && gh repo view --json nameWithOwner -q .nameWithOwner)
  [[ $repo =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]]
}
read_options(){
  while (($#)); do
    case $1 in
      --pr) pr=$2; shift 2;;
      --repo) repo=$2; shift 2;;
      --base) base=$2; shift 2;;
      --branch) branch=$2; shift 2;;
      *) shift;;
    esac
  done
}

gate1(){
  local slug=$1 out rc=0
  out=$("$gates" gate1 "$slug" 2>&1) || rc=$?
  [[ -z $out ]] || printf '%s\n' "$out"
  ((rc == 0)) || fail 'gate1: FAIL'
  printf 'gate1: PASS\n'
}
record_for_head(){
  local label=$1 record=$2 head=$3 task_rel commit changed
  [[ -f $record && ! -L $record ]] || return 1
  task_rel=${record%/*}; task_rel=${task_rel#"$AUDIT_ROOT/"}
  commit=$(jq -r '.commit // empty' "$record" 2>/dev/null) || return 1
  if [[ $commit == "$head" ]]; then printf '%s %s equals HEAD\n' "$label" "$commit"; return 0; fi
  [[ $commit =~ ^[0-9a-f]{40}$ ]] && git -C "$AUDIT_ROOT" merge-base --is-ancestor "$commit" "$head" 2>/dev/null || return 1
  changed=$(git -C "$AUDIT_ROOT" diff --name-only "$commit" "$head")
  [[ -n $changed ]] || return 1
  [[ -z $(git -C "$AUDIT_ROOT" diff --name-only "$commit" "$head" -- . ":!$task_rel" ":!.agro/evals/RESULTS.md") ]] || return 1
  printf '%s %s is the content head; only task records changed since\n' "$label" "$commit"
}
gate2(){
  local slug=$1 result="$AUDIT_ROOT/.agro/tasks/$1/eval-result.json" rc=0
  if record_for_head 'gate2: eval-result commit' "$result" "$head"; then
    rc=$(jq -r '.runnerExit' "$result")
    printf 'gate2: reused eval-result.json for HEAD %s (runnerExit=%s)\n' "$head" "$rc"
  else
    bash "$AUDIT_ROOT/.agro/skills/eval/run.sh" || rc=$?
    printf 'gate2: ran eval suite for %s (exit=%s)\n' "$head" "$rc"
  fi
  [[ $rc == 0 ]] || fail 'gate2: FAIL'
  printf 'gate2: PASS\n'
}
gate3_pr(){
  local json rc=0 reason
  json=$("$gates" classify-pr "$repo" "$pr" "${base:-development}") || rc=$?
  [[ -z $json ]] || printf '%s\n' "$json"
  ((rc == 0)) && jq -e 'type=="object"' <<<"$json" >/dev/null 2>&1 \
    || fail "gate3: FAIL (classification exited $rc)"
  jq -e '.evidenceComplete==true and .promotable==true' <<<"$json" >/dev/null && return 0
  reason=$(jq -r 'if .error then .error
    elif .evidenceComplete != true then "evidence incomplete"
    elif .primaryState then "not promotable, primaryState=\(.primaryState)"
    else "not promotable" end' <<<"$json")
  fail "gate3: FAIL ($reason)"
}
gate3_branch(){
  local runs rc=0
  branch=${branch:-$(git -C "$AUDIT_ROOT" rev-parse --abbrev-ref HEAD)}
  runs=$(cd "$AUDIT_ROOT" && gh run list --repo "$repo" --branch "$branch" --json headSha,status,conclusion --limit 30) || rc=$?
  ((rc == 0)) || fail "gate3: FAIL (gh run list exited $rc)"
  printf 'gate3: ci runs for %s@%s: %s\n' "$branch" "$head" "$runs"
  jq -e --arg sha "$head" '[.[] | select(.headSha==$sha)]
    | length > 0 and all(.status=="completed" and .conclusion=="success")' <<<"$runs" >/dev/null 2>&1 \
    || fail 'gate3: FAIL (no green CI run for HEAD)'
}
gate3(){
  resolve_repo || fail 'gate3: FAIL (repository could not be resolved)'
  if [[ -n $pr ]]; then gate3_pr; else gate3_branch; fi
  printf 'gate3: PASS\n'
}
gate4(){
  local slug=$1 record="$AUDIT_ROOT/.agro/tasks/$1/ui-evidence.json" rc=0 n failed
  "$gates" browser-required "$slug" || rc=$?
  case $rc in
    0) ;;
    1) printf 'gate4: not applicable\n'; return 0;;
    *) fail "gate4: FAIL (browser-required exited $rc)";;
  esac
  record_for_head 'gate4: ui evidence commit' "$record" "$head" || fail "gate4: FAIL (no ui evidence for HEAD $head)"
  jq -e '.schemaVersion==1 and (.reviewer|type)=="string" and (.reviewer|length>0)
    and (.preflight.runId|type)=="string" and (.preflight.runId|test("^audit-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9._-]+$"))
    and (.preflight.exit|type)=="number" and (.criteria|type)=="array"
    and all(.criteria[]; type=="object" and (.story|type)=="string" and (.criterion|type)=="string"
      and (.result=="PASS" or .result=="FAIL") and (.screenshotSha256|type)=="string"
      and (.screenshotSha256|test("^[0-9a-f]{64}$")) and (.note|type)=="string")' "$record" >/dev/null 2>&1 \
    || fail 'gate4: FAIL (malformed ui-evidence.json)'
  [[ $(jq -r '.preflight.exit' "$record") == 0 ]] \
    || fail "gate4: FAIL (browser-preflight run $(jq -r '.preflight.runId' "$record") exited $(jq -r '.preflight.exit' "$record"))"
  n=$(jq '.criteria|length' "$record")
  ((n > 0)) || fail 'gate4: FAIL (no criteria verified)'
  failed=$(jq -r '.criteria[] | select(.result=="FAIL") | "gate4: FAIL criterion \(.story) \(.criterion) — \(.note)"' "$record")
  [[ -z $failed ]] || { printf '%s\n' "$failed"; fail "gate4: FAIL ($(wc -l <<<"$failed") criteria FAIL)"; }
  printf 'gate4: PASS (%s criteria verified by %s at %s)\n' "$n" "$(jq -r .reviewer "$record")" "$head"
}
gate5(){
  local slug=$1 task="$AUDIT_ROOT/.agro/tasks/$1" review rounds metrics rc=0 open total terminated=false rounds_n=0
  review="$task/simplicity-review.json"; rounds="$task/simplify-rounds.json"
  metrics=$("$gates" slop-metrics "${base:-development}") || rc=$?
  ((rc == 0)) || fail "gate5: FAIL (slop-metrics exited $rc)"
  printf 'gate5: metrics %s\n' "$(jq -c . <<<"$metrics")"
  if jq -e '(.tool|startswith("lizard")) and (.tsOverCcn|length>0)' <<<"$metrics" >/dev/null; then
    printf 'gate5: SIMPLICITY-RESIDUAL disclosed\n'
  fi
  record_for_head 'gate5: review commit' "$review" "$head" && jq -e '.schemaVersion==1 and (.reviewer|type)=="string" and (.reviewer|length>0)
    and (.findings|type)=="array"
    and all(.findings[]; type=="object" and (.file|type)=="string" and (.line|type)=="number"
      and (.simplerAlternative|type)=="string" and (.simplerAlternative|length>0) and (.removesLines|type)=="number"
      and (.blocking|type)=="boolean" and (.status=="open" or .status=="resolved"))' "$review" >/dev/null 2>&1 \
    || fail "gate5: FAIL (no simplicity review for HEAD $head)"
  if [[ -f $rounds && ! -L $rounds ]]; then
    jq -e '(.rounds|type)=="number"' "$rounds" >/dev/null 2>&1 || fail 'gate5: FAIL (malformed simplify-rounds.json)'
    terminated=$(jq -r '(.rounds >= 3) or (.nonReducing == true)' "$rounds")
    rounds_n=$(jq -r '.rounds' "$rounds")
    printf 'gate5: rounds %s\n' "$(jq -c . "$rounds")"
  fi
  jq -r '.findings[] | select(.status=="open") | "gate5: open \(.file):\(.line) — \(.simplerAlternative)"' "$review"
  open=$(jq '[.findings[] | select(.blocking==true and .status=="open")] | length' "$review")
  total=$(jq '.findings|length' "$review")
  if ((open > 0)); then
    [[ $terminated == true ]] || fail "gate5: FAIL ($open blocking simplicity finding(s) open)"
    printf 'gate5: PASS with SIMPLICITY-RESIDUAL (%s open finding(s) after %s round(s))\n' "$open" "$rounds_n"
  else
    printf 'gate5: PASS (review %s at %s, %s finding(s), none blocking open)\n' "$(jq -r .reviewer "$review")" "$head" "$total"
  fi
}
implementation(){
  local slug=$1; shift
  read_options "$@"
  gate1 "$slug"
  gate2 "$slug"
  gate3
  gate4 "$slug"
  gate5 "$slug"
  publish AUDIT-PASS
}
pr_route(){
  local number=$1 json rc=0 verdict; shift
  read_options "$@"
  resolve_repo || { printf 'repository could not be resolved\n'; publish PR-AUDIT-UNKNOWN; }
  json=$("$gates" classify-pr "$repo" "$number" "${base:-development}") || rc=$?
  [[ -z $json ]] || printf '%s\n' "$json"
  ((rc == 0)) || { printf 'acquisition or classification exited %s\n' "$rc"; publish PR-AUDIT-UNKNOWN; }
  verdict=$(jq -r 'if .evidenceComplete==true and .promotable==true then "PR-AUDIT-PROMOTABLE"
    elif .evidenceComplete==true and .promotable==false then "PR-AUDIT-BLOCKED"
    else "PR-AUDIT-UNKNOWN" end' <<<"$json" 2>/dev/null) || verdict=PR-AUDIT-UNKNOWN
  publish "$verdict"
}

case $AUDIT_TARGET in
  implementation) implementation "$@";;
  pr) pr_route "$@";;
  *)
    printf 'route-driver: target %s is a report-only route read by the active session; the scripted driver certifies only implementation and pr\n' "$AUDIT_TARGET" >&2
    exit 64;;
esac
