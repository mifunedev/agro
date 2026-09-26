# PRD: optimize /prd efficiency with SkillOpt

Status: DRAFT

Approved by the operator on 2026-09-26.

Issue: #1197. Branch: `task/1197-prd-efficiency`.

## User Stories

### US-001: Select the corpus and the split

**Description:** As the advisor, I want a reproducible corpus of 32 closed issues in two splits so that the held-out split measures generalization.

**Acceptance Criteria:**

- [ ] `select.sh` writes `corpus/manifest.json` with the selection rule, the full candidate pool, each excluded candidate with its reason, and the `sha256` digest of each issue body.
- [ ] The manifest holds 32 cases: 20 train cases and 12 held-out cases. Each area with 2 or more cases has at least 1 case in each split.
- [ ] No held-out case is one of the 10 cases of the #1188 screen.
- [ ] `tests/select-reproducible.sh` runs `select.sh` twice and exits 0 when the two manifests are equal.

### US-002: Run isolated episodes with an arm and repeats

**Description:** As the advisor, I want an isolated episode runner for each arm so that no episode can read a later answer or reach GitHub.

**Acceptance Criteria:**

- [ ] `run-episode.sh <case-id> --run-id <id> --arm <baseline|candidate> --repeat <n>` builds the episode repository with `git-conventions/make-episode-repo.sh` and runs `claude` inside `git-conventions/no-egress.sh` with `--disallowedTools WebFetch WebSearch`.
- [ ] The baseline arm overlays `.agro/skills/prd/` from the base revision. The candidate arm also replaces `SKILL.md` with the file at `--arm-rev candidate=<rev>`. The runner marks each overlay file skip-worktree.
- [ ] Each record holds `usage.total_cost_usd`, `usage.num_turns`, `elapsed_s`, the verifier result, and `substance`: the `g1` checked-path count and the acceptance-criterion count of the plan.
- [ ] `run-batch.sh` refuses to start an episode when the recorded cost of the run plus $1.50 exceeds the phase cap in `experiment.json`, and it runs at most 3 episodes in parallel.
- [ ] `tests/run-episode.sh` runs the runner with a fake `claude` for each arm and exits 0. A fault injection with a shared-ref worktree makes the test exit 1.

### US-003: Summarize cost, guard, and noise

**Description:** As the advisor, I want one summary tool for the decision metrics so that each verdict is reproducible without new spend.

**Acceptance Criteria:**

- [ ] `summarize.sh <run-id>` writes `summary.json` with the mean cost, turns, and elapsed time for each arm, the pass rate and check rates for each arm, and the median substance for each arm.
- [ ] `summarize.sh <run-id> --paired` writes the paired mean cost ratio of the candidate to the baseline and its 95% bootstrap interval with a fixed seed.
- [ ] `summarize.sh <run-id> --noise` writes the within-issue standard deviation of the log cost and the minimum detectable cost ratio for each repeat count from 1 to 4, at a two-sided 0.05 level and a power of 0.80.
- [ ] `tests/summarize.sh` exits 0 on fixture records with known means, a known ratio, and a known interval.

### US-004: Run the noise screen

**Description:** As the advisor, I want a baseline-against-baseline measurement before the freeze so that the success threshold is larger than the run-to-run noise.

**Acceptance Criteria:**

- [ ] The first episode costs $3.00 or less before any other episode starts.
- [ ] `runs/noise/` holds 15 records: 5 train cases, 3 repeats each, baseline arm.
- [ ] `noise.md` reports the within-issue standard deviation of the log cost and the minimum detectable cost ratio for 12 held-out cases at 1 to 4 repeats.
- [ ] `noise.md` names the held-out repeat count: the smallest count with a minimum detectable ratio of 0.80 or more. If no count from 1 to 4 meets that bound, the story stops the experiment and asks the operator.

### US-005: Freeze D1

**Description:** As the operator, I want every experiment value pinned before the baseline run so that no value changes after the model sees the data.

**Acceptance Criteria:**

- [ ] `experiment.json` records the model, the effort, the claude arguments, the prompt, the splits, the repeats, the phase caps, the hard cap, and the decision rule of issue #1197.
- [ ] `check-pins.sh` exits 0 and pins the digests of `prd-grounding/verify-prd.sh`, `git-conventions/make-episode-repo.sh`, `git-conventions/no-egress.sh`, `lib/episode.sh`, the `/prd` skill tree, and `corpus/manifest.json`.
- [ ] The operator approved the D1 values in a comment on issue #1197.

### US-006: Adapt SkillOpt to an efficiency score

**Description:** As the advisor, I want the SkillOpt adapter of #1171 to score efficiency under the guard so that the optimizer cuts cost safely.

**Acceptance Criteria:**

- [ ] For each train case, `hard` is 1 only when the latest episode passes `verify-prd.sh` and its cost is 0.80 or less of the baseline-train median cost of that case.
- [ ] Each row for the proposer holds the plan, the verifier result, the cost, the turns, and a condensed tool trace: one line for each tool call with the tool name, the first 120 characters of the input, and the turn number.
- [ ] The proposer receives train records only. `tests/optimize.sh` exits 0 and fails when a held-out case id enters a proposer prompt.
- [ ] `optimize/run.sh --dry-run` completes with a fake `claude` for the episodes and for the proposer.

### US-007: Run the train baseline

**Description:** As the advisor, I want a baseline on the train split so that the adapter has a per-case cost reference.

**Acceptance Criteria:**

- [ ] `runs/baseline-train/` holds 40 scored records: 20 train cases, 2 repeats each.
- [ ] `summary.json` reports the pass rate, the mean cost, the mean turns, and the median cost for each case.
- [ ] The run cost is within its phase cap.

### US-008: Smoke the real proposer

**Description:** As the advisor, I want one real proposer call on `claude-opus-5-5` before the loop so that the proposer path is proven outside the fake `claude`.

**Acceptance Criteria:**

- [ ] One proposer call through `optimize/proposer-claude` on 3 train rows returns exit 0 and a patch that SkillOpt parses.
- [ ] The call costs $2.00 or less, and `proposer-usage.jsonl` records the cost.
- [ ] The proposer process has no tools and runs from an empty directory, per its recorded command line.

### US-009: Run the optimization loop

**Description:** As the advisor, I want the SkillOpt loop on the train split so that the loop freezes one candidate.

**Acceptance Criteria:**

- [ ] The loop stops at 6 candidates or 140 episodes, whichever comes first.
- [ ] `runs/optimize/candidates.jsonl` holds each candidate with its train `hard` rate, its mean cost, its diff size, and its status.
- [ ] `runs/optimize/frozen.json` names the candidate with the highest train `hard` rate. A tie goes to the smaller diff.

### US-010: Evaluate on the held-out split

**Description:** As the operator, I want a paired held-out comparison so that the verdict follows the decision rule of issue #1197.

**Acceptance Criteria:**

- [ ] `runs/heldout/` holds scored records for 12 held-out cases, for both arms, at the repeat count from `noise.md`.
- [ ] The baseline arm and the candidate arm of each case and repeat run in the same batch, in alternating order.
- [ ] `summarize.sh heldout --paired` reports each condition of the decision rule as true or false.

### US-011: Report the result

**Description:** As the operator, I want a results file and an issue comment so that the next focus follows from evidence.

**Acceptance Criteria:**

- [ ] `results.md` states the verdict, the held-out metrics for each arm, the paired ratio and its interval, the guard results, the total cost, and the candidate diff.
- [ ] `git diff --stat origin/development -- .agro/evals/experiments/skillopt-ste .agro/evals/experiments/prd-grounding .agro/evals/experiments/git-conventions` prints nothing.
- [ ] A comment on issue #1197 reports the verdict and the total cost.

## Summary

Three screens found no pass-rate headroom: `/ste` 0.911, `/prd` 0.80, `/git` 1.00. This experiment keeps correctness constant and optimizes cost.

Verified current state:

- The #1188 screen ran `/prd` on 10 issues: mean 16.6 turns, 122 s, and $0.90 for each plan. Each trace has one tool call in each turn. Cost follows turns: 11 turns cost $0.63, and 22 turns cost $1.19.
- The #1188 episodes ran in worktrees of this repository. The #1143 episode read `origin/experiment/minimal-core` and ran `git ls-remote`. The #1188 numbers are therefore evidence of headroom, not a baseline. This experiment runs a fresh baseline in the isolated repository of #1190.
- The #1188 pool held 28 issues with a plan in the task folder. Only 24 of these issues pass the exclusions. A wider rule is necessary for 32 cases.
- 68 pull requests merged into `development` after `f94c1ad5`, the commit that introduced the `.agro/` layout. 55 of these pull requests close an issue, have `ste-check.sh` at the parent, do not change `.agro/skills/prd/`, and are not an experiment issue or an archive branch.
- The SkillOpt adapter scores `hard` as a pass rate and reflects on failures only (`failure_only: true`). The adapter was tested with a fake `claude` only.

Selected approach: a new experiment folder `.agro/evals/experiments/prd-efficiency/`. The folder reuses the frozen scripts by path with digest pins. The primary metric is the held-out paired mean cost ratio. The adapter turns efficiency into the binary `hard` score of SkillOpt, so the existing gate and failure reflection work without a change to SkillOpt.

Budget estimate at $0.90 for each episode:

| Phase | Episodes | Cap (USD) |
|---|---|---|
| Noise screen | 15 | 15 |
| Train baseline | 40 | 40 |
| Proposer smoke | 1 proposer call | 2 |
| Optimization loop | 140 at most, with proposer calls | 150 |
| Held-out evaluation | 72 at 3 repeats | 70 |
| Retries | at most 10% of each phase | 23 |
| Hard cap | | 300 |

The first episode of each phase has a $3.00 gate. The advisor reports the cost after each phase before the next phase starts.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/prd/SKILL.md` | the whole file | The optimization target. The experiment never changes this file on `development`. |
| `.agro/evals/experiments/prd-grounding/verify-prd.sh` | `g1_paths`, `g2_trackable`, `g3_commands`, `g4_structure` | The guard verifier, used by path and pinned by digest. |
| `.agro/evals/experiments/prd-grounding/select.sh` | the selection rule | The source of the area rule, the order rule, and the body rule. |
| `.agro/evals/experiments/prd-grounding/run-episode.sh` | overlay, leak guard, `record_line` | The pattern for the new runner. |
| `.agro/evals/experiments/git-conventions/make-episode-repo.sh` | the whole script | The isolated single-commit repository, used by path. |
| `.agro/evals/experiments/git-conventions/no-egress.sh` | the whole script | The egress block, used by path. |
| `.agro/evals/experiments/lib/episode.sh` | `ep_usage_json`, `ep_finalize_trace`, `ep_append_line` | Shared record helpers. |
| `.agro/evals/experiments/skillopt-ste/optimize/adapter.py` | `AgroSteAdapter.rows`, `rollout`, `evaluate_candidate` | The adapter pattern for the new `hard` score. |
| `.agro/evals/experiments/skillopt-ste/optimize/proposer-claude` | the whole script | The proposer shim pattern. |
| `.agro/evals/experiments/skillopt-ste/optimize/run.sh` | `--dry-run`, `--detach` | The launcher pattern. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `.agro/evals/experiments/prd-efficiency/` | new | The experiment folder: `select.sh`, `run-episode.sh`, `run-batch.sh`, `summarize.sh`, `check-pins.sh`, `experiment.json`, `optimize/`, `tests/`, `corpus/`, `runs/`, `noise.md`, `results.md`. |
| Issue #1197 | comments | The D1 approval and the final verdict. |
| `.agro/skills/prd/SKILL.md` | none | A winning candidate lands only through a separate `/builder` issue after the verdict. |

## Storage

The new folder `.agro/evals/experiments/prd-efficiency/` holds each tracked artifact, as in #1188 and #1190. Git tracks `runs/<run-id>/episodes.jsonl`, `summary.json`, and `outputs/`. Traces go to `${XDG_STATE_HOME:-$HOME/.local/state}/agro/prd-efficiency/traces/`. Episode repositories go under `${XDG_STATE_HOME:-$HOME/.local/state}/agro/prd-efficiency/repos/`. The runner deletes each episode repository after the verifier runs. The virtual environment `optimize/.venv/` matches the ignore pattern `**/.venv/`. The task folder holds only `prd.md` and `prd.json`.

## Architectural Decisions

1. **Primary metric:** the paired mean cost ratio on the held-out split. For each case, the ratio compares the mean candidate cost with the mean baseline cost over the repeats. The pairing removes the variation between issues. Turns and elapsed time are secondary and do not decide.
2. **Success threshold:** a ratio of 0.80 or less with a 95% bootstrap upper bound less than 1.00. The noise screen must show a minimum detectable ratio of 0.80 or more at the chosen repeats.
3. **Guard:** the candidate held-out pass rate is not more than 0.05 below the baseline. The candidate has no `g1_paths` or `g2_trackable` failure class that the baseline does not have. The median substance of the candidate is at least 0.70 of the baseline. The substance guard stops a plan that passes because it names fewer paths.
4. **Corpus rule:** the #1188 rule with one change. A case needs a merged pull request into `development` that closes the issue. A plan in the task folder is not required, because the metric does not compare the output with the original plan. The pool starts at `f94c1ad5`. The rule excludes #1171, #1188, #1190, #1197, archive branches, and each pull request that changes `.agro/skills/prd/`.
5. **Split:** stratified by area, with 12 held-out cases. The held-out split takes no #1188 screen case, because those plans were seen during that screen.
6. **Isolation:** each episode runs in a single-commit repository with no remote and no other ref, inside `no-egress.sh`. The runner deletes `.agro/evals/experiments/` and the task folder of the issue.
7. **Reuse:** the new folder uses the frozen scripts by path and pins their digests. The new folder copies and adapts `optimize/`, because the adapter is specific to the scored skill. No file in `skillopt-ste`, `prd-grounding`, or `git-conventions` changes. `lib/episode.sh` gets no change unless two experiments need the same new function.
8. **Efficiency score:** `hard` is 1 when the episode passes the verifier and costs 0.80 or less of the per-case baseline-train median. The existing SkillOpt gate on `hard` then selects for efficiency under the guard.
9. **Models:** `claude-opus-5-5` with effort `medium` for the episodes and for the proposer.
10. **Operator decisions (2026-09-26):**
    - The corpus uses the wider rule. A plan in the task folder is not required.
    - The split is stratified by area.
    - The hard cap is $300.
    - The substance floor is 0.70 of the baseline median. The advisor reviews the value after the noise screen.
    - The advisor decides the adoption of a winning candidate after the verdict. A change to `SKILL.md` on `development` goes through `/builder`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/experiments/prd-efficiency/tests/select-reproducible.sh` | two runs of `select.sh` | The manifest is deterministic. |
| `.agro/evals/experiments/prd-efficiency/tests/run-episode.sh` | fake `claude` for each arm; a shared-ref fault injection | The runner records each field, applies the arm overlay, and refuses a leaky repository. |
| `.agro/evals/experiments/prd-efficiency/tests/summarize.sh` | fixture records with known values | The means, the paired ratio, the interval, and the noise estimate. |
| `.agro/evals/experiments/prd-efficiency/tests/optimize.sh` | the dry run; a held-out id in a prompt | The adapter score and the train-only boundary. |
| `.agro/evals/experiments/prd-grounding/tests/verify-prd.sh` | the 12 existing fixtures | The pinned guard verifier still passes. |
| `.agro/evals/experiments/git-conventions/tests/episode-repo.sh` | the existing cases | The isolated repository still holds one commit. |

## Design Principles

- Measure before optimization: the noise screen comes before the freeze.
- Freeze every value before the model sees the train data.
- The proposer sees train records only. The held-out split runs once.
- A valid no-improvement verdict is a successful result.
- Reuse the frozen machinery. Do not change the frozen experiments.
- No explanatory comments in code. STE for all tracked prose.

## Out of Scope

- A change to `.agro/skills/prd/SKILL.md` on `development`. A winning candidate goes to a separate issue.
- Optimization of pass rates, or of any skill other than `/prd`.
- A change to `verify-prd.sh`. A verifier defect found during the run goes to a new issue, unless the defect blocks the run.
- Follow-ups #1186 and #1187.

## Open Questions

None. The operator decided each question on 2026-09-26. Architectural decision 10 records the answers.

## Acceptance Criteria

- [ ] Each story has `passes: true` in `prd.json`.
- [ ] `results.md` states a verdict under the decision rule of issue #1197.
- [ ] The total spend is $300 or less.
- [ ] The three frozen experiment folders have no change.
- [ ] Each test file in the Test Plan exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each new Markdown file.

## Lessons

Filled by the advisor before undraft.
