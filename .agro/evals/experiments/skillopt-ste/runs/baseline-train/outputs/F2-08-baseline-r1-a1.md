---
name: audit
description: >-
  Explicit nine-target audit dispatcher for implementation promotability, one PR,
  the open PR queue, harness health, context budget, skill integrity, eval quality,
  drift, and correlated full campaigns. TRIGGER when: audit this task; verify this
  implementation; is this the simplest approach; audit PR N; classify this pull request; audit open PRs; triage
  the PR queue; audit the harness; find harness improvements; audit context budget;
  audit skills; find stale or broken skills; lint evals;
  find Goodharted probes; check framework drift; cron staleness; run a full audit
  campaign; audit everything; cross-target next actions.
argument-hint: "<implementation|pr|prs|harness|context|skills|eval-quality|drift|full> [target options]"
---

# Audit — explicit target dispatcher

The dispatcher validates usage first. Validation finishes before the dispatcher reads any
reference, creates a run identity, or changes state. The dispatcher never guesses a missing
target from prose. The trigger families are:
audit this task; audit PR N; triage the PR queue; audit the harness; audit context budget;
audit skills; lint evals; check framework drift; and full audit campaign.

## Canonical usage

```text
usage: /audit <implementation|pr|prs|harness|context|skills|eval-quality|drift|full> [target options]
```

| Target | Invocation | Native result |
|---|---|---|
| `implementation` | `/audit implementation <slug> [--pr N --repo O/N] [--base B] [--branch B]` | `AUDIT-PASS` / `AUDIT-FAIL` / `AUDIT-TOOLING-BLOCKED` |
| `pr` | `/audit pr <N> [--repo O/N] [--base B] [--deep] [--proof] [--dry-run]` | `PR-AUDIT-PROMOTABLE` / `PR-AUDIT-BLOCKED` / `PR-AUDIT-UNKNOWN` / `PR-AUDIT-TOOLING-BLOCKED` |
| `prs` | `/audit prs [--repo O/N] [filters/actions]` | buckets + `PRS-AUDIT-COMPLETE` / `PRS-AUDIT-PARTIAL` |
| `harness` | `/audit harness [--focus area] [--external URL|path] [actions]` | Tier 1/2/3 + Recommended Next 3 Actions |
| `context` | `/audit context [all|--baseline]` | `KEEP` / `TRIM` / `DEMOTE` / `CUT` |
| `skills` | `/audit skills [all|root|name]` | `CURRENT` / `STALE` / `BROKEN` / `DELETE` |
| `eval-quality` | `/audit eval-quality [all|probes|capability|id]` | `KEEP` / `GROOM` / `CUT` |
| `drift` | `/audit drift` | per-class `OK` / aggregate `DRIFT:` |
| `full` | `/audit full [--repo O/N] [--focus area] [--health-target target]` | `AUDIT-CAMPAIGN-COMPLETE` / `AUDIT-CAMPAIGN-PARTIAL` |

If the target is missing or unknown, or a required argument is missing, the dispatcher prints
the exact usage line and this table. Then the dispatcher stops. The public targets are exactly
these nine:

| Target | Authoritative route |
|---|---|
| implementation | `references/implementation.md` |
| pr | `references/pr.md` |
| prs | `references/prs.md` |
| harness | `references/harness.md` |
| context | `references/context.md` |
| skills | `references/skills.md` |
| eval-quality | `references/eval-quality.md` |
| drift | `references/drift.md` |
| full | `references/full.md` |

## The lifecycle boundary

Run every valid invocation through the executable lifecycle boundary:
`$AUDIT_ROOT/.agro/skills/audit/scripts/audit-run.sh <target> [target options] -- <route-driver>`.

The route driver is mandatory. The route driver is the actual execution of the selected
target, not a preflight command. The route driver reads the exported `AUDIT_ROUTE`.

The boundary runs these steps in order:

1. The boundary validates all target arguments and the route driver. This validation
   finishes before the boundary creates the lifecycle.
2. The boundary resolves and exports the immutable `AUDIT_ROOT` and `AUDIT_RUN_ID`.
3. The boundary maps the target to exactly one route.
4. The boundary supplies the invocation-scoped `AUDIT_TMP_ROOT` and `AUDIT_EVIDENCE_PATH`.
5. The boundary changes the working directory to `AUDIT_ROOT`.
6. The boundary exports `AUDIT_TARGET` and `AUDIT_TARGET_ARGS_JSON`.
7. The boundary invokes the route driver with `<target> <validated-target-args...>`
   verbatim.
8. The boundary keeps the lifecycle open while the route driver runs.
9. If the boundary receives TERM, INT, or HUP, the boundary forwards the signal to the
   complete child process group. The boundary then waits for termination.
10. After the route driver exits, the boundary performs exactly one locked terminal append.
    The append records `complete`, `failed`, or `interrupted`. A `failed` or `interrupted`
    append records the nonzero exit code.

## Completion evidence

Exit code 0 proves transport success only. Exit code 0 never proves completion.

Before the boundary logs `complete`, the boundary requires an atomic schema-v1 evidence
file. The evidence file must bind these values:

- the exact `AUDIT_RUN_ID`
- the target
- the validated target-argument array
- the terminal `state: complete`
- the native machine verdict

The boundary fails closed on each of these inputs:

- a no-op driver such as `-- true`
- stale evidence
- a symlink
- a mismatched target

A scripted route publishes the evidence file with
`scripts/audit-evidence.sh complete <NATIVE-VERDICT>`. The scripted route runs this command
only after the route checks finish.

## The shipped route driver

The shipped production route driver is a script. Use this script. Do not substitute a
preflight callback:

```bash
ROOT=$(git rev-parse --show-toplevel)
"$ROOT/.agro/skills/audit/scripts/audit-run.sh" \
  implementation <slug> --pr <N> --repo <owner/name> -- \
  "$ROOT/.agro/skills/audit/scripts/route-driver.sh"
```

For the `implementation` and `pr` targets, the route driver runs these steps:

1. The route driver runs the deterministic gates itself.
2. The route driver prints the gate report. The final line of the report is
   `AUDIT-EVIDENCE: <NATIVE-VERDICT>`.
3. The route driver atomically publishes the correlated evidence.

The route driver launches no nested inference CLI.

The report-only routes are `prs`, `harness`, `context`, `skills`, `eval-quality`, `drift`,
and `full`. The active session reads each report-only route directly. The report-only routes
never gated a merge. For a report-only route, the route driver exits with code 64 and
publishes no evidence.

**The boundary requires target-correlated schema-v1 evidence, not a particular process
shape.** The shipped route driver is one way to produce the evidence. Any protocol satisfies
the contract equally if the protocol publishes evidence bound to the exact run ID, the target,
and the validated argument array. If a protocol cannot publish this evidence, the protocol
fails closed.

Do not run the boundary only to get the environment JSON. Do not run route work outside the
boundary.

An inherited `AUDIT_RUN_ID` identifies child mode. The boundary never replaces an inherited
ID and never logs an inherited ID independently. A generated ID matches
`audit-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9._-]+`.

## Route rules

The active session reads exactly the route that the boundary returns. Supporting scripts and
references are private. A supporting script or reference is never a target.

Each child invocation follows these rules:

- The child inherits all roots and the run ID.
- The child returns structured observations.
- The child suppresses its own memory append.

The dispatcher keeps each native verdict unchanged. The dispatcher does not normalize native
verdicts.

## Write scope

By default, every route reports only. A route writes only this disclosed local state:

- the `/eval` scoreboard
- remote-ref fetches
- invocation-scoped temporary and recovery files
- the single audit log at `<audit-log-path>`

No route may mark a PR ready or merge a PR.

A route writes a GitHub comment, a label, a close, or an external issue only if all four
conditions hold:

1. The operator selects the explicit action of the target.
2. The route shows the exact preview.
3. The operator confirms the action.
4. The action supports a dry-run.
