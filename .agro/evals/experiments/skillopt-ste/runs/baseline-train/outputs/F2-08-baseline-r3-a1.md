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

The dispatcher validates usage first. Validation comes before the dispatcher reads any
reference, creates a run identity, or changes state. The dispatcher never guesses a missing
target from prose. The trigger families are:

- audit this task
- audit PR N
- triage the PR queue
- audit the harness
- audit context budget
- audit skills
- lint evals
- check framework drift
- full audit campaign

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

If the target is missing or unknown, the dispatcher prints the exact usage line and this
table, then stops. If a required argument is missing, the dispatcher does the same. The
public targets are exactly these nine:

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

## Lifecycle boundary

For every valid invocation, run the executable lifecycle boundary:
`$AUDIT_ROOT/.agro/skills/audit/scripts/audit-run.sh <target> [target options] -- <route-driver>`.

The route driver is mandatory. The route driver runs the selected target. The route driver is
not a preflight command. The route driver reads the exported `AUDIT_ROUTE`.

Before the boundary creates the lifecycle, the boundary validates all target arguments and
the driver. After validation, the boundary does these actions in order:

1. The boundary resolves and exports the immutable `AUDIT_ROOT` and `AUDIT_RUN_ID`.
2. The boundary maps the target to exactly one route.
3. The boundary supplies the invocation-scoped `AUDIT_TMP_ROOT` and `AUDIT_EVIDENCE_PATH`.
4. The boundary changes the working directory to `AUDIT_ROOT`.
5. The boundary exports `AUDIT_TARGET` and `AUDIT_TARGET_ARGS_JSON`.
6. The boundary invokes the driver with `<target> <validated-target-args...>` verbatim.

While the driver runs, the boundary keeps the lifecycle open. If the boundary receives TERM,
INT, or HUP, the boundary forwards the signal to the complete child process group. The
boundary then waits for termination. After the driver exits, the boundary writes exactly one
locked terminal append to the audit log. The append records `complete`, `failed`, or
`interrupted`. A `failed` or `interrupted` append also records the nonzero exit code.

## Completion evidence

Exit code 0 shows transport success only. Exit code 0 is never completion evidence. Before the
boundary logs `complete`, the boundary requires an atomic schema-v1 evidence file. The
evidence file must bind to these values:

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

A scripted route publishes the evidence with `scripts/audit-evidence.sh complete <NATIVE-VERDICT>`.
The route runs this command only after the route checks finish.

## Production driver

The shipped production driver is a script. Use this script. Do not substitute a preflight
callback:

```bash
ROOT=$(git rev-parse --show-toplevel)
"$ROOT/.agro/skills/audit/scripts/audit-run.sh" \
  implementation <slug> --pr <N> --repo <owner/name> -- \
  "$ROOT/.agro/skills/audit/scripts/route-driver.sh"
```

For the `implementation` and `pr` targets, the driver runs the deterministic gates itself.
The driver prints the gate report. The last line of the report is
`AUDIT-EVIDENCE: <NATIVE-VERDICT>`. The driver then publishes the correlated evidence
atomically. The driver launches no nested inference CLI.

These routes are report-only: `prs`, `harness`, `context`, `skills`, `eval-quality`,
`drift`, and `full`. The active session reads each report-only route directly. A report-only
route never gated a merge. For a report-only route, the driver exits with code 64 and
publishes no evidence.

**The boundary requires target-correlated schema-v1 evidence. The boundary does not require a
particular process shape.** The shipped driver is one way to produce the evidence. Any
protocol satisfies the contract equally if the protocol publishes evidence bound to three
values: the exact run ID, the target, and the validated argument array. If a protocol cannot
publish the evidence, the protocol fails closed.

Do not run the boundary only to get the environment JSON. Do not run route work outside the
boundary.

## Run ID

An inherited run ID identifies child mode. The boundary never replaces an inherited run ID.
The boundary never logs an inherited run ID independently. A generated run ID matches
`audit-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9._-]+`.

## Routes and children

Read exactly the route that the boundary returns. The supporting scripts and references are
private. A supporting script or reference is never a target.

Each child audit inherits all roots and the run ID. Each child returns structured
observations. Each child suppresses its own memory append. The dispatcher preserves each
native verdict and does not normalize the verdict.

## Side effects

By default, each route is report-only. Each route may change only this disclosed local state:

- the `/eval` scoreboard
- remote-ref fetches
- invocation-scoped temporary and recovery files
- the single audit log

No route can mark a PR ready or merge a PR. Four writes need a gate: a GitHub comment, a
label, a close, and an external issue write. Before a route performs one of the four writes, the route
requires four conditions:

1. The target's explicit action.
2. An exact preview.
3. A confirmation.
4. Dry-run support in the target.
