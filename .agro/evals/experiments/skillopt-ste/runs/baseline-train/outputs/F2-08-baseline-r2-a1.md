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

The dispatcher validates usage before it reads any reference, creates a run identity, or
changes state. The dispatcher never guesses a missing target from prose. Trigger families
include: audit this task; audit PR N; triage the PR queue; audit the harness; audit context
budget; audit skills; lint evals; check framework drift; and full audit campaign.

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

If the target is missing or unknown, or a required argument is missing, print the exact usage line and this table. Then stop. Exactly these nine cases are public:

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

For every valid invocation, run the executable lifecycle boundary
`$AUDIT_ROOT/.agro/skills/audit/scripts/audit-run.sh <target> [target options] -- <route-driver>`.

The route driver is mandatory. The route driver performs the actual selected-target execution;
the route driver is not a preflight command. The route driver reads the exported `AUDIT_ROUTE`.

Before the boundary creates the lifecycle, the boundary validates all target arguments and the
driver. The boundary then resolves and exports the immutable `AUDIT_ROOT` and
`AUDIT_RUN_ID`. The boundary maps the target to exactly one route. The boundary supplies the
invocation-scoped `AUDIT_TMP_ROOT` and `AUDIT_EVIDENCE_PATH`. The boundary changes to
`AUDIT_ROOT`. The boundary invokes the driver with `<target> <validated-target-args...>`
verbatim, and also exports `AUDIT_TARGET` and `AUDIT_TARGET_ARGS_JSON`.

The boundary keeps the lifecycle open while the driver runs. The boundary forwards the `TERM`,
`INT`, and `HUP` signals to the complete child process group. The boundary waits for
termination. After the driver exits, the boundary performs exactly one locked terminal append:
`complete`, `failed`, or `interrupted`, with the nonzero exit code.

Exit code zero means transport success only. Exit code zero is never completion evidence.

Before the boundary logs `complete`, the boundary requires an atomic schema-v1 evidence file.
That evidence file must bind to the exact `AUDIT_RUN_ID`, the target, the validated
target-argument array, the terminal `state: complete`, and the native machine verdict.

The boundary fails closed on a no-op such as `-- true`, on stale evidence, on a symlink, or on
a mismatched target. Only after the route's checks finish, a scripted route publishes evidence
with `scripts/audit-evidence.sh complete <NATIVE-VERDICT>`.

Use the shipped production driver, which is a script. Do not substitute a preflight callback
for the driver:

```bash
ROOT=$(git rev-parse --show-toplevel)
"$ROOT/.agro/skills/audit/scripts/audit-run.sh" \
  implementation <slug> --pr <N> --repo <owner/name> -- \
  "$ROOT/.agro/skills/audit/scripts/route-driver.sh"
```

For the `implementation` and `pr` targets, the driver runs the deterministic gates itself. The
driver prints the gate report with a final `AUDIT-EVIDENCE: <NATIVE-VERDICT>` line. The driver
atomically publishes the correlated evidence. The driver launches no nested inference CLI.

For the report-only routes (`prs`, `harness`, `context`, `skills`, `eval-quality`, `drift`,
`full`), the active session reads the route directly. These report-only routes never gate a
merge. For these report-only routes, the driver exits with code 64 and publishes no evidence.

**The boundary requires target-correlated schema-v1 evidence. The boundary does not require a
specific process shape.** This driver is the shipped way to produce that evidence. Any protocol
that publishes evidence bound to the exact run ID, the target, and the validated argument array
satisfies the contract equally. A protocol that cannot publish that evidence fails closed.

Do not run the boundary only to obtain environment JSON. Do not then run route work outside
the boundary. An inherited ID identifies child mode. The boundary never replaces an inherited ID.
The boundary never logs an inherited ID independently. The generated ID matches the pattern
`audit-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9._-]+`.

Read exactly the route that the boundary returns. Supporting scripts and references are
private. Supporting scripts and references are never targets.

A child process inherits all roots and the ID. A child process returns structured
observations. A child process suppresses its own memory append.

The dispatcher preserves native verdicts. The dispatcher does not normalize native verdicts.

By default, the dispatcher is report-only. The dispatcher discloses local state as an
exception: the `/eval` scoreboard, remote-ref fetches, invocation-scoped temp and recovery
files, and the single audit log.

No route may ready or merge a PR.

A GitHub comment, a label change, a close action, or an external issue write requires the
target's explicit action, an exact preview, a confirmation, and dry-run support.
