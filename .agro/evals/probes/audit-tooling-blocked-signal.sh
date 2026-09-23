#!/usr/bin/env bash
# tier: A
# source: issue #1088 — no gh before 2.101.0 carries closingIssuesReferences, so
#         pr-acquire.sh could not answer at all and /audit implementation reported
#         "gate3: FAIL (classification exited 1)": a tooling gap that read exactly like a
#         real PR defect, on the operator's own host.
# desc: executable check that "the gate could not run" is distinguishable from "the gate
#       failed". Drive pr-acquire.sh and the scripted route driver against a stub gh that
#       rejects an unsupported JSON field, and require a TOOLING-BLOCKED signal (exit 69
#       from the acquirer, an AUDIT-TOOLING-BLOCKED / PR-AUDIT-TOOLING-BLOCKED verdict
#       from the driver) rather than AUDIT-FAIL. It still fails closed: neither verdict is
#       a pass. A stub gh that fails for an ORDINARY reason must keep failing ordinarily,
#       so the signal cannot be used to launder a genuine error.
set -euo pipefail
unset AUDIT_RUN_ID AUDIT_ROOT AUDIT_TMP_ROOT AUDIT_EVIDENCE_PATH \
      AUDIT_ROUTE AUDIT_TARGET AUDIT_TARGET_ARGS_JSON

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"   # .agro/evals/probes/<id>.sh -> root
for f in .agro/skills/audit/scripts/pr-acquire.sh \
         .agro/skills/audit/scripts/pr-classify.sh \
         .agro/skills/audit/scripts/route-driver.sh \
         .agro/skills/audit/scripts/implementation-gates.sh \
         .agro/skills/audit/scripts/audit-run.sh \
         .agro/skills/audit/scripts/audit-evidence.sh \
         .agro/scripts/locked-append.sh; do
  [ -f "$REPO/$f" ] || { echo "SKIPPED: required script absent: $f" >&2; exit 2; }
done
command -v jq >/dev/null 2>&1 || { echo "SKIPPED: jq is not installed" >&2; exit 2; }
command -v git >/dev/null 2>&1 || { echo "SKIPPED: git is not installed" >&2; exit 2; }

fail(){ echo "REGRESSION: $*" >&2; exit 1; }

tmp=$(mktemp -d); tmpdir=$(mktemp -d); trap 'rm -rf "$tmp" "$tmpdir"' EXIT
export TMPDIR="$tmpdir"

mkdir -p "$tmp/.agro/skills/audit/references" "$tmp/.agro/skills/audit/scripts" \
         "$tmp/.agro/scripts" "$tmp/.agro/tasks/fixture" "$tmp/bin"
for route in implementation pr prs harness context skills eval-quality drift full; do
  printf '# test route %s\n' "$route" >"$tmp/.agro/skills/audit/references/$route.md"
done
cp "$REPO/.agro/scripts/locked-append.sh" "$tmp/.agro/scripts/locked-append.sh"
for s in pr-acquire.sh pr-classify.sh route-driver.sh implementation-gates.sh audit-run.sh audit-evidence.sh; do
  cp "$REPO/.agro/skills/audit/scripts/$s" "$tmp/.agro/skills/audit/scripts/$s"
  chmod +x "$tmp/.agro/skills/audit/scripts/$s"
done
RUN="$tmp/.agro/skills/audit/scripts/audit-run.sh"
DRIVER="$tmp/.agro/skills/audit/scripts/route-driver.sh"
ACQUIRE="$tmp/.agro/skills/audit/scripts/pr-acquire.sh"

printf '{"userStories":[{"id":"US-1","passes":true}]}\n' >"$tmp/.agro/tasks/fixture/prd.json"
git -C "$tmp" init -q
git -C "$tmp" config user.email test@example.invalid
git -C "$tmp" config user.name test
git -C "$tmp" add .
git -C "$tmp" commit -qm init
printf '{"commit":"%s","runnerExit":0}\n' "$(git -C "$tmp" rev-parse HEAD)" \
  >"$tmp/.agro/tasks/fixture/eval-result.json"

# --- stub gh: rejects the unsupported field exactly as a pre-2.101.0 gh does ----
cat >"$tmp/bin/gh" <<'GH'
#!/usr/bin/env bash
case "$1" in
  --version) printf 'gh version 2.63.2 (2026-01-01)\n'; exit 0;;
esac
case "$1 $2" in
  'repo view') printf 'owner/name\n'; exit 0;;
  'pr view'|'pr list')
    if [[ "${GH_FAILURE_MODE:-field}" == field ]]; then
      echo 'unknown JSON field: "closingIssuesReferences"' >&2
      echo 'available fields: number, title, url' >&2
      exit 1
    fi
    echo 'error connecting to api.github.com' >&2
    exit 1
    ;;
esac
exit 9
GH
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH"

# --- 1. the acquirer names the tooling gap and exits 69 ------------------------
set +e
acq_err=$(AUDIT_RUN_ID=audit-20260101T000000Z-fixture bash "$ACQUIRE" pr --repo owner/name --pr 7 2>&1 >/dev/null)
acq_rc=$?
set -e
[ "$acq_rc" -eq 69 ] \
  || fail "pr-acquire.sh exited $acq_rc for an unsupported gh field; a tooling gap must exit 69, not share an exit code with a PR defect"
grep -q 'TOOLING-BLOCKED:' <<<"$acq_err" \
  || fail "pr-acquire.sh emitted no TOOLING-BLOCKED marker for an unsupported gh field: $(tr -d '\n' <<<"$acq_err" | cut -c1-120)"
grep -q 'closingIssuesReferences' <<<"$acq_err" \
  || fail 'the TOOLING-BLOCKED message does not name the field that is missing'

# --- 2. an ORDINARY gh failure stays an ordinary failure -----------------------
set +e
ord_err=$(GH_FAILURE_MODE=network AUDIT_RUN_ID=audit-20260101T000000Z-fixture \
  bash "$ACQUIRE" pr --repo owner/name --pr 7 2>&1 >/dev/null)
ord_rc=$?
set -e
[ "$ord_rc" -ne 69 ] \
  || fail 'a network error from gh was laundered into the tooling-blocked path'
grep -q 'TOOLING-BLOCKED:' <<<"$ord_err" \
  && fail 'a network error from gh emitted the TOOLING-BLOCKED marker'
[ "$ord_rc" -ne 0 ] || fail 'a failing gh produced a successful acquisition'

# --- 3. /audit pr reports the tooling gap, not a PR verdict --------------------
set +e
pr_out=$(bash "$RUN" pr 7 --repo owner/name -- "$DRIVER" 2>&1)
pr_rc=$?
set -e
[ "$pr_rc" -eq 0 ] || fail "the pr route did not complete its run record (exit $pr_rc)"
grep -q 'TOOLING-BLOCKED:' <<<"$pr_out" \
  || fail "the pr route did not surface a tooling-blocked signal: $(tr -d '\n' <<<"$pr_out" | cut -c1-160)"
grep -q 'verdict=PR-AUDIT-TOOLING-BLOCKED' <<<"$pr_out" \
  || fail "the pr route published no distinct tooling-blocked verdict: $(grep -o 'verdict=[A-Z-]*' <<<"$pr_out" | tr '\n' ' ')"
grep -q 'verdict=PR-AUDIT-PROMOTABLE' <<<"$pr_out" \
  && fail 'a tooling gap was reported as promotable; the signal must fail closed'

# --- 4. /audit implementation gate 3 does the same -----------------------------
set +e
impl_out=$(bash "$RUN" implementation fixture --pr 7 --repo owner/name -- "$DRIVER" 2>&1)
impl_rc=$?
set -e
[ "$impl_rc" -eq 0 ] || fail "the implementation route did not complete its run record (exit $impl_rc)"
grep -q '^gate1: PASS' <<<"$impl_out" || fail 'the fixture did not reach gate 3'
grep -qE '^gate3: FAIL' <<<"$impl_out" \
  && fail 'gate 3 still reports an unrunnable classification as a gate FAILURE, which reads as a PR defect'
grep -q 'TOOLING-BLOCKED: gate3' <<<"$impl_out" \
  || fail "gate 3 emitted no tooling-blocked signal: $(tr -d '\n' <<<"$impl_out" | cut -c1-160)"
grep -q 'verdict=AUDIT-TOOLING-BLOCKED' <<<"$impl_out" \
  || fail "the implementation route published no distinct tooling-blocked verdict: $(grep -o 'verdict=[A-Z-]*' <<<"$impl_out" | tr '\n' ' ')"
grep -q 'verdict=AUDIT-PASS' <<<"$impl_out" \
  && fail 'a tooling gap was reported as AUDIT-PASS; the signal must fail closed'

echo 'PASS: an unsupported gh field yields exit 69 and a TOOLING-BLOCKED marker from the acquirer, distinct AUDIT-TOOLING-BLOCKED / PR-AUDIT-TOOLING-BLOCKED verdicts from the driver, and never a gate FAIL or a pass; an ordinary gh error still fails ordinarily' >&2
exit 0
