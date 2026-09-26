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

The dispatcher validates usage before it reads any reference, creates a run identity, or changes
state. The dispatcher never guesses a missing target from prose. Trigger families include:
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

If the target is missing or unknown, or a required argument is missing, the dispatcher prints the exact usage line and this table, then stops. Exactly these nine cases are public:

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

For every valid invocation, use the executable lifecycle boundary
`$AUDIT_ROOT/.agro/skills/audit/scripts/audit-run.sh <target> [target options] -- <route-driver>`.
The route driver is mandatory. The route driver performs the actual selected-target execution.
The route driver is not a preflight command. The route driver reads the exported `AUDIT_ROUTE`.

Before lifecycle creation, the boundary validates all target arguments and the driver. The
boundary then, in order:

1. resolves and exports the immutable `AUDIT_ROOT` and `AUDIT_RUN_ID`
2. maps the target to exactly one route
3. supplies the invocation-scoped `AUDIT_TMP_ROOT` and `AUDIT_EVIDENCE_PATH`
4. changes the working directory to `AUDIT_ROOT`
5. invokes the driver with `<target> <validated-target-args...>` verbatim, and exports
   `AUDIT_TARGET` and `AUDIT_TARGET_ARGS_JSON`

While the driver runs, the boundary keeps the lifecycle open. The boundary forwards the `TERM`,
`INT`, and `HUP` signals to the complete child process group. The boundary waits for the driver
process to stop. After the driver exits, the boundary performs exactly one locked terminal
append: `complete`, `failed`, or `interrupted`, with the nonzero exit code.

An exit code of `0` means transport success. An exit code of `0` is never completion evidence.
Before logging `complete`, the boundary requires an atomic schema-v1 evidence file bound to the
exact `AUDIT_RUN_ID`, target, validated target-argument array, terminal `state: complete`, and
native machine verdict. A no-op such as `-- true`, stale evidence, a symlink, or a mismatched
target fails closed. After a scripted route's checks finish, the route publishes the evidence
with `scripts/audit-evidence.sh complete <NATIVE-VERDICT>`.

The shipped production driver is a script. Use it rather than substituting a preflight
callback:

```bash
ROOT=$(git rev-parse --show-toplevel)
"$ROOT/.agro/skills/audit/scripts/audit-run.sh" \
  implementation <slug> --pr <N> --repo <owner/name> -- \
  "$ROOT/.agro/skills/audit/scripts/route-driver.sh"
```

For the `implementation` and `pr` targets, the driver runs the deterministic gates itself.
The driver prints the gate report, ending with a final `AUDIT-EVIDENCE: <NATIVE-VERDICT>` line.
The driver atomically publishes the correlated evidence. The driver launches no nested inference
CLI. The active session reads the report-only routes directly: `prs`, `harness`, `context`,
`skills`, `eval-quality`, `drift`, and `full`. These routes never gate a merge. For these
routes, the driver exits with code `64` and publishes no evidence.

**The boundary requires target-correlated schema-v1 evidence. The boundary does not require a
particular process shape.** This driver is the shipped way to produce that evidence. Any
protocol that publishes evidence bound to the exact run ID, target, and validated argument
array satisfies the contract equally. A protocol that cannot publish that evidence fails closed.
Do not run the boundary only to obtain environment JSON.
Do not execute route work outside the boundary. An inherited ID identifies child mode. The
boundary never replaces or independently logs an inherited ID. The generated ID matches the pattern
`audit-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9._-]+`.

Read exactly the route that the boundary returns. Supporting scripts and references are
private; they are never targets. Child processes inherit all roots and the ID. Child processes
return structured observations. Child processes suppress their own memory append. The boundary
preserves native verdicts; the dispatcher does not normalize them.

By default, the dispatcher is report-only, except for this disclosed local state: the `/eval`
scoreboard, remote-ref fetches, invocation-scoped temp and recovery files, and the single audit
log. No route may ready or merge a PR. A GitHub comment, label, close, or external issue write
requires the target's explicit action, exact preview, confirmation, and dry-run support.
