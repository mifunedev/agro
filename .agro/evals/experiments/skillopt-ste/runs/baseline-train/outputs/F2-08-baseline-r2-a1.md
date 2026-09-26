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

The dispatcher validates the usage first. Validation comes before the dispatcher
reads any reference, creates a run identity, or changes state. The dispatcher
never guesses a missing target from prose. The trigger families include these:

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

If the target is missing or unknown, or if a required argument is missing, do
these steps:

1. Print the exact usage line.
2. Print the table above.
3. Stop.

Exactly nine targets are public. Each target has one authoritative route:

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

The route driver is mandatory. The route driver is the actual execution of the
selected target. The route driver is not a preflight command. The route driver
reads the exported `AUDIT_ROUTE`.

The boundary does these steps:

1. The boundary validates all target arguments and the driver. Validation comes
   before the boundary creates the lifecycle.
2. The boundary resolves the immutable `AUDIT_ROOT` and `AUDIT_RUN_ID`.
3. The boundary exports `AUDIT_ROOT` and `AUDIT_RUN_ID`.
4. The boundary maps the target to exactly one route.
5. The boundary supplies `AUDIT_TMP_ROOT` and `AUDIT_EVIDENCE_PATH`. Both
   values belong to one invocation only.
6. The boundary changes the working directory to `AUDIT_ROOT`.
7. The boundary exports `AUDIT_TARGET` and `AUDIT_TARGET_ARGS_JSON`.
8. The boundary invokes the driver with `<target> <validated-target-args...>`
   verbatim.

While the driver runs, the boundary keeps the lifecycle open. If the boundary
receives TERM, INT, or HUP, the boundary forwards the signal to the complete
child process group. The boundary then waits for the process group to
stop.

After the driver exits, the boundary performs exactly one locked terminal
append. The append records one state: `complete`, `failed`, or `interrupted`.
Each `failed` or `interrupted` append also records the nonzero exit code.

## Completion evidence

Exit code 0 proves transport success only. Exit code 0 is never completion
evidence. Before the boundary logs `complete`, the boundary requires an atomic
schema-v1 evidence file. The evidence file must bind to all of these values:

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

After the route checks finish, each scripted route publishes the evidence file
with `scripts/audit-evidence.sh complete <NATIVE-VERDICT>`.

## The production driver

The shipped production driver is a script. Use the script. Do not substitute a
preflight callback:

```bash
ROOT=$(git rev-parse --show-toplevel)
"$ROOT/.agro/skills/audit/scripts/audit-run.sh" \
  implementation <slug> --pr <N> --repo <owner/name> -- \
  "$ROOT/.agro/skills/audit/scripts/route-driver.sh"
```

For the `implementation` and `pr` targets, the driver runs the deterministic
gates itself. The driver prints the gate report. The gate report ends with a
final `AUDIT-EVIDENCE: <NATIVE-VERDICT>` line. The driver also publishes the
correlated evidence atomically. The driver launches no nested inference CLI.

The report-only routes are `prs`, `harness`, `context`, `skills`,
`eval-quality`, `drift`, and `full`. The active session reads each report-only
route directly. A report-only route never gates a merge. For a report-only
route, the driver exits 64 and publishes no evidence.

**The boundary requires target-correlated schema-v1 evidence. The boundary does
not require a particular process shape.** The shipped driver is one way to
produce the evidence. If a protocol publishes evidence bound to the exact run
ID, the target, and the validated argument array, the protocol satisfies the
contract equally. If a protocol cannot publish that evidence, the protocol
fails closed.

Run route work inside the boundary. Never use the boundary only as a source of
environment JSON for route work that runs outside the boundary.

An inherited ID identifies child mode. The boundary never replaces an inherited
ID. The boundary never logs an inherited ID separately. The generated ID
matches `audit-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9._-]+`.

## Routes and child invocations

Read exactly the route that the boundary returns. Each supporting script and
each supporting reference is private. A supporting script or reference is never
a target.

Each child invocation inherits all roots and the ID. Each child invocation
returns structured observations. Each child invocation suppresses the child's
own memory append.

The dispatcher keeps each native verdict unchanged. The dispatcher does not
normalize native verdicts.

## Side effects

By default, every route is report-only. The default permits only these
disclosed local state changes:

- the `/eval` scoreboard
- remote-ref fetches
- temp files and recovery files that belong to one invocation
- the single audit log

No route may mark a PR ready. No route may merge a PR.

A GitHub comment, a label, a close, or an external issue write requires all of
these:

1. an explicit action for the target
2. an exact preview
3. a confirmation
4. dry-run support
