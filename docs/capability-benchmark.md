# Capability benchmark

The capability benchmark measures end-to-end deliverables: what the harness can do, not how much machinery it contains.
The [regression suite](evals.md) guards known invariants.
The instruments are distinct: a green regression floor does not establish a higher capability ceiling.

## Axes and scoring

Each task specifies its deliverable and rubric in `.agro/evals/capability/tasks/CB-NNN-<slug>.md`.

| Axis | PASS | PARTIAL | FAIL |
| --- | --- | --- | --- |
| `success` | The deliverable meets acceptance criteria. | The deliverable is incomplete or off-spec. | No deliverable exists. |
| `cost-time` | The run meets its budget without retries. | The run exceeds budget or needs retries. | The run thrashes, exhausts its budget, or stops. |
| `unattended` | The run completes without human intervention. | The run needs one human nudge or clarification. | A human takes over. |

```text
PASS = 2   PARTIAL = 1   FAIL = 0
task score = mean(success, cost-time, unattended)
suite score = mean(task scores)
```

Scores range from 0 to 2. The runner prints two decimal places.
The initial baseline dates to 2026-06-15 and came from hand inspection of real repository state and recent task instances.
Task specs can cite dataset instances through an optional `datasets:` array.
The dataset-schema probe checks those references.

## Runner usage

Run commands from the repository checkout:

```bash
bash .agro/evals/capability/run.sh --validate
bash .agro/evals/capability/run.sh --success PASS --cost-time PARTIAL --unattended PARTIAL
bash .agro/evals/capability/run.sh --task CB-001 \
  --success PARTIAL --cost-time PARTIAL --unattended PARTIAL \
  --check 'bash .agro/evals/probes/capability-benchmark-schema.sh' \
  --dry-run
```

`--validate` checks required header tokens and one scoreboard row for each declared task id.
Score preview does not write. Remove `--dry-run` from a task command to replace its existing row.
The runner rejects missing or invalid judgment axes and refuses to append a missing task row.
It writes through a temporary sibling and atomic rename, then updates the suite-score comment.
Git history retains earlier scores.

`--basis <text>` supplies the row's evidence narrative; otherwise the runner retains its prior basis.
`--base <ref>` reads the comparison score from that commit's scoreboard.
Without `--base`, the comparison uses the current scoreboard.
`--check <command>` runs from the repository root and records `PASS`, `SKIPPED`, or `FAIL` as evidence.
A failing check does not abort the row write or change any supplied axis.
Only run a check command whose effects you intend.

The runner classifies positive, negative, and flat deltas as `capability-improved`, `capability-regressed`, and `machinery-added`.
The flat label is a diagnostic signal, not proof that machinery changed; the runner does not inspect a code diff.

## Evidence and limitations

The benchmark combines manual scoring with automated arithmetic.
The runner validates values and computes arithmetic but does not decide judgment axes.
The [capability contract](../.agro/evals/capability/AGENTS.md) requires evidence, held-out tasks, and anti-gaming discipline.
Never tune the harness to a task id or delete difficult tasks to raise the average.
Compare unchanged task sets, and disclose additions rather than presenting their average as a like-for-like delta.

The operator runs the [benchmark skill](../.agro/skills/benchmark/SKILL.md), which consumes the scoreboard for benefit verdicts.
There is no CI job that blocks a merge on the capability-score delta.
The runner alone is not a live gate or an automatic judge.
If the ceiling stays flat while complexity grows, report the need for human redirect.
The runner implements no fixed cycle threshold.
