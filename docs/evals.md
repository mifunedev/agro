# Regression evals

The deterministic probe suite checks real repository and runtime state.
The [capability benchmark](capability-benchmark.md) measures end-to-end progress instead.
Trajectory examples live in [the dataset catalogue](../.agro/evals/datasets/README.md).

## Probe oracle

Each `.agro/evals/probes/<id>.sh` returns an exit code and a one-line stderr reason.
The [local contract](../.agro/evals/AGENTS.md) defines author obligations.

| Exit | Status | Meaning |
| --- | --- | --- |
| `0` | `PASS` | The probe verified the desired condition. |
| `1` | `REGRESSION` | The probe detected the bad condition. |
| `2` | `SKIPPED` | The environment does not support this check. |
| `124` | `TIMEOUT` | The probe exceeded the runner's 30-second limit. |
| Other | `ERROR` | The probe exited outside the oracle. |

`SKIPPED` is not a pass. A missing required artifact is not an inapplicable environment.

### Metadata and root resolution

The runner reads the first exact `# tier:` and `# source:` header lines.
The `# desc:` line describes the check for readers and tooling.
For a probe directly under `.agro/evals/probes/`, resolve the repository root with three parent steps:

```bash
#!/usr/bin/env bash
# tier: A
# source: issue or lesson reference
# desc: the observable invariant
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
```

## Runner

Run the [canonical eval runner](../.agro/skills/eval/run.sh) from the checkout:

```bash
bash .agro/skills/eval/run.sh
bash .agro/skills/eval/run.sh --probe wiki-readme-index
bash .agro/skills/eval/run.sh --tier A
```

The runner discovers `.agro/evals/probes/*.sh` from its script location.
`AUDIT_ROOT` can select an explicit repository root.
The runner invokes each selected probe through `timeout 30` and compares its status with the prior scoreboard row.

Aggregate exit `1` means a prior `PASS` changed to `REGRESSION`, `TIMEOUT`, or `ERROR`.
Aggregate exit `0` means no such transition occurred.
A new failure, unchanged failure, or `PASS → SKIPPED` transition does not fail this gate.
The runner prints persistent failures separately as `PERSISTENT RED`.
On a first observation, it reports `new-pass` or `new-fail` without claiming a regression.

The runner writes `.agro/evals/RESULTS.md` through a temporary sibling and atomic rename.
It takes carry-forward rows from a pre-write snapshot, so filtered runs preserve untouched rows.
Atomic replacement prevents partial files but does not serialize concurrent runs or combine their updates.

### Scoreboard schema

| Column | Value |
| --- | --- |
| `probe` | Probe filename without `.sh`. |
| `tier` | Header tier, or `?` when absent. |
| `last-run (UTC)` | Most recent run timestamp. |
| `status` | `PASS`, `REGRESSION`, `SKIPPED`, `TIMEOUT`, or `ERROR`. |
| `source` | Header source, or `?` when absent. |

An undispatched probe without a prior row appears as `(not run)`.
The runner overwrites current rows; git history supplies the time series.
The scoreboard's pass-rate comment names `PASS / (PASS + REGRESSION + TIMEOUT)` and excludes `SKIPPED`.
The runner does not calculate that rate, and the comment omits `ERROR`; inspect statuses directly.

## CI and runtime limits

The `eval-probes` job in [ci-harness.yml](../.github/workflows/ci-harness.yml) invokes the unfiltered runner.
Pushes to `development` or `main` and pull requests use the workflow's path filters.
Manual dispatch is also available. CI gates on the runner's exit code and does not commit scoreboard changes.
A cold runner can skip live-state probes without failing CI.
Keep the baseline current and inspect skipped coverage; a green job does not prove every condition ran.
The weekly cron uses its own stdout-based reporting; see [eval-weekly.md](../crons/eval-weekly.md).

Boot-path changes also need the [sandbox boot guard](../.github/workflows/sandbox-boot-guard.yml).
That workflow builds and boots a real Linux container through `.agro/scripts/sandbox-boot-smoke.sh`.
A static text check or local Docker Desktop boot cannot prove Linux AppArmor behavior.
Neither path establishes SELinux coverage.

## Correction-surface triage

Route lessons to the cheapest reliable correction surface:

| Surface | Use | Artifact |
| --- | --- | --- |
| Harden | Enforce a guardrail. | Hook and unit-test probe. |
| Proceduralize | Apply a repeatable technique. | Skill step and contract check. |
| Behavioral eval | Assess judgment that deterministic checks cannot capture. | Tier-B evaluation; deferred, not a hard gate. |

A contract-text probe proves the document states a rule, not that an executor obeys it.
