# prd-grounding screen

Decision: `no-headroom`. Do not freeze D1 for a `/prd` experiment. Screen the PR-body and commit conventions of `/git` next.

The screen pass rate is 0.80. The rule of issue #1188 freezes D1 only when the pass rate is below 0.75.

## Setup

- Model: `claude-opus-5-5`, effort `medium`, Claude Code 2.1.280, native `claude -p`.
- Prompt: `/prd work/issue-<id>.md`. The file holds the issue body from `corpus/issues/<id>.md`.
- Corpus: 10 closed issues from `corpus/manifest.json`. The manifest records the selection rule, the full candidate pool, and the `sha256` digest of each body.
- Revision: the parent of the merge commit that closed the issue.
- Skill overlay: each episode replaces `.agro/skills/prd/` with the tree at `d5987a56`. Before `93b009d0`, `/prd` is a different skill with no template headings and no `/ste` step. Five of the 10 revisions predate `93b009d0`.
- Leak guard: each episode deletes `.agro/evals/experiments/` and the task folder of the issue. No task folder existed at a pinned revision.
- Verifier: `verify-prd.sh`. The `--help` text states each rule. `tests/verify-prd.sh` exits 0.

## Result

| Issue | Revision | Area | Pass | Failed check | Cost (USD) | Turns | Elapsed (s) |
|---|---|---|---|---|---|---|---|
| #1181 | `7219977d` | `.agro/skills` | yes | none | 0.84 | 13 | 96 |
| #1086 | `cf35b316` | `.agro/cli` | yes | none | 1.05 | 19 | 129 |
| #1150 | `90707bd2` | `.agro/hooks` | yes | none | 0.90 | 18 | 131 |
| #1042 | `f94c1ad5` | `.agro/cli` | yes | none | 1.19 | 22 | 163 |
| #1080 | `f14840b9` | `.agro/cli` | yes | none | 0.89 | 15 | 119 |
| #1155 | `27edb569` | `.agro/hooks` | yes | none | 0.94 | 19 | 159 |
| #1149 | `93b009d0` | `.agro/skills` | yes | none | 0.85 | 18 | 120 |
| #1076 | `1317f352` | `.agro/skills` | no | `g2_trackable` | 0.87 | 18 | 110 |
| #1054 | `d341ebc3` | `docs` | no | `g2_trackable` | 0.63 | 11 | 90 |
| #1143 | `76d594e4` | `.agro/scripts` | yes | none | 0.82 | 13 | 104 |

- Pass rate: 8 of 10, 0.80.
- Check rates: `g1_paths` 1.00, `g2_trackable` 0.80, `g3_commands` 1.00, `g4_structure` 1.00.
- Total cost: $9.00 for 10 attempts. Mean turns: 16.6. Mean elapsed time: 122 s.
- Each episode ran `ste-check.sh`. No episode changed a file outside its task folder.

## Failure classes

One class caused both failures: a plan stores a tracked artifact in the task folder, and `.gitignore` ignores that path. This class is the storage defect of #1171.

- #1076: "`.agro/tasks/council-skill/evidence.md` lists five positive trigger prompts and five negative trigger prompts, each with the routed skill." The pattern `.agro/tasks/*` ignores the path at `1317f352`.
- #1054: "`.agro/tasks/retire-pi-dynamic-workflows/evidence.md` records the image disposition." The pattern `.agro/tasks/*` ignores the path at `d341ebc3`.

Both revisions predate the rule that tracks only `prd.md` and `prd.json`. At both revisions the maintainers force-added task files. The merge commits of #1076 and #1054 track an `evidence.md` in the task folder. Under that convention both plans are correct, and the pass rate is 1.00. The current `.gitignore` also ignores both paths. The decision is the same under both readings.

## Verifier fixes

Two fixes came from live episodes. Neither fix changed an episode. `summarize.sh screen --rescore` scores the stored outputs with the pinned verifier.

- Fix A, from #1181: the checklist rule declared a path new when any word such as "holds" was on the line. The plan line "a bridge config that holds `.slack.botToken`" then declared `.devcontainer/.env` new, and `g2` failed. Now the path must open the checklist line.
- Fix B, from #1076: `g2` exited 17 when the plan named a file path and then a directory path under it. The episode record shows `infra_failure`. The rescore scores the stored plan. The episode did not run again.

## Limits

- One repeat per issue. The standard error of a 0.80 pass rate on 10 attempts is about 0.13.
- The "declared new" rules are lexical. A plan that names a wrong path on a line with "add" or "new" passes `g1`.
- `g3` checks only `agro` verbs that `docs/lifecycle-commands.md` names, and script paths that start at a top-level entry. A script name with no directory is not checked.
- Real plans on the same corpus are not a baseline. The real plans had operator review and later edits.

## Evidence

- `runs/screen/episodes.jsonl`: one line for each attempt.
- `runs/screen/outputs/<id>.md`: each plan.
- `runs/screen/summary.json`: the rescored summary.
- Traces: `${XDG_STATE_HOME:-$HOME/.local/state}/agro/prd-screen/traces/`. Git does not track the traces.
