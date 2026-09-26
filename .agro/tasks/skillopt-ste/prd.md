# PRD: Closed-loop SkillOpt experiment on the /ste skill

Status: DRAFT

## User Stories

### US-001: Freeze the rewrite corpus

**Description:** As the advisor, I want a fixed corpus in four families so that both arms see the same inputs.

**Acceptance Criteria:**

- [ ] `.agro/evals/experiments/skillopt-ste/corpus/` holds 60 source documents: 15 documents in each family F1 to F4.
- [ ] `corpus/manifest.json` records the family, the split, the origin, and the `sha256` digest of each source document.
- [ ] `jq -e '[.documents[] | select(.split == "train")] | length == 30' corpus/manifest.json` exits 0.
- [ ] `jq -e '[.documents[] | select(.split == "heldout")] | length == 30' corpus/manifest.json` exits 0.
- [ ] No family has documents in both splits.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh <source>` exits 1 for each of the 60 source documents.
- [ ] No source document comes from `.agro/skills/ste/`.
- [ ] Each family holds exactly 2 seeded-gap documents. Each seeded gap is a number, a duration, or a path that the corpus build removed from the original text. `manifest.json` records each seeded gap.
- [ ] `select.sh` rebuilds `manifest.json` byte for byte from the pinned origins.
- [ ] The surface table in `.agro/evals/README.md` lists `experiments/`.

### US-002: Build the episode verifier

**Description:** As the advisor, I want one deterministic verifier so that both arms get the same pass or fail decision.

**Acceptance Criteria:**

- [ ] `verify.sh <source> <output> <manifest-entry>` prints one JSON object with the fields `p1_literals`, `p2_checker`, `p3_no_invention`, `p4_length`, and `pass`.
- [ ] `pass` is `true` only when P1, P2, P3, and P4 are all `true`.
- [ ] P1 is `true` only when each inline code span, each fenced block, each URL, and each path token of the source occurs unchanged in the output.
- [ ] P2 is `true` only when `ste-check.sh <output>` exits 0.
- [ ] P3 is `true` only when the output holds an angle-bracket placeholder at each seeded gap and holds no numeric token that the source does not hold.
- [ ] P4 is `true` only when the output word count is from 0.5 to 1.5 times the source word count.
- [ ] Six fault fixtures each fail the intended check: a changed code span, a dropped path, a checker finding, an invented number, a filled seeded gap, and a truncated output.
- [ ] `verify.sh` completes in less than 5 seconds on each corpus document.

### US-003: Record the frozen experiment definition

**Description:** As the operator, I want to pin each experiment input before optimization so that the target cannot move after the result.

**Acceptance Criteria:**

- [ ] `experiment.json` records the provider, the model, the effort, the Claude Code version, the root `AGENTS.md` digest, the `.agro/skills/ste/` tree digest, the corpus manifest digest, the `verify.sh` digest, the episode prompt, the budget, and the success threshold.
- [ ] `experiment.json` holds the values from `## Architectural Decisions` without change.
- [ ] A comment on issue #1171 links the commit that adds `experiment.json`.
- [ ] Each later story reads its inputs from `experiment.json` and exits non-zero when a pinned digest does not match.

### US-004: Run one episode through the native harness path

**Description:** As the advisor, I want one command that runs one attempt and writes one episode record so that each attempt leaves reproducible evidence.

**Acceptance Criteria:**

- [ ] `run-episode.sh <revision> <document-id> <repeat>` creates a fresh git worktree at `<revision>`, copies one source document into the worktree, and runs `claude -p` with the pinned model and the pinned prompt.
- [ ] The worktree loads `/ste` through the `.claude/skills` symlink to `.agro/skills/ste/`.
- [ ] `run-episode.sh` appends one line to `runs/<run-id>/episodes.jsonl` for each attempt, including a timeout, an infrastructure failure, and an interruption.
- [ ] Each episode line holds the fields `run_id`, `family`, `document_id`, `split`, `arm`, `skill_revision`, `repo_revision`, `provider`, `model`, `effort`, `harness_version`, `trace`, `verifier`, `usage`, `elapsed_s`, `status`, and `pass`.
- [ ] `run-episode.sh` removes the worktree after the attempt.
- [ ] `run-batch.sh` runs in the named tmux session `skillopt-ste` and resumes from `episodes.jsonl` after a restart.

### US-005: Run the training baseline

**Description:** As the advisor, I want the unchanged skill scored on the training split so that the optimizer starts from measured evidence.

**Acceptance Criteria:**

- [ ] `runs/baseline-train/episodes.jsonl` holds 90 attempts: 30 training documents times 3 repeats.
- [ ] Each attempt uses `skill_revision` equal to the `.agro/skills/ste/` digest in `experiment.json`.
- [ ] `runs/baseline-train/summary.json` records the pass rate, the pass rate for each check, and the total usage.
- [ ] When the training pass rate is 0.90 or more, the advisor records `no-headroom` on #1171 and stops the experiment before US-006.

### US-006: Produce candidates with SkillOpt

**Description:** As the advisor, I want SkillOpt to propose edits to `.agro/skills/ste/SKILL.md` from training evidence so that the experiment tests a real optimizer loop.

**Acceptance Criteria:**

- [ ] `skillopt.md` records the SkillOpt source URL, the pinned revision, and the integration result: `fit` or `blocked`.
- [ ] When the result is `blocked`, `skillopt.md` names the blocker, and the loop uses GEPA at a pinned revision.
- [ ] Each candidate changes only `.agro/skills/ste/SKILL.md`. `git diff --name-only <baseline> <candidate>` prints only that path.
- [ ] The optimizer receives only records with `split == "train"`.
- [ ] The loop stops after 8 candidates or 240 training attempts, whichever comes first.
- [ ] `runs/optimize/candidates.jsonl` records the lineage, the diff, and the training pass rate of each candidate.
- [ ] The advisor freezes one candidate commit before any held-out run starts.
- [ ] `bash .agro/evals/probes/ste-checker-contract.sh` exits 0 on the frozen candidate.

### US-007: Assess the frozen candidate on the held-out split

**Description:** As the operator, I want both arms scored on held-out documents with one verifier so that the verdict does not depend on training data.

**Acceptance Criteria:**

- [ ] `runs/heldout/episodes.jsonl` holds 180 attempts: 30 held-out documents times 3 repeats times 2 arms.
- [ ] The run interleaves the baseline arm and the candidate arm by document.
- [ ] Both arms use the pinned model, the pinned prompt, and the pinned `verify.sh`.
- [ ] `runs/heldout/summary.json` records the pass rate for each arm, the pass rate for each check and arm, the usage for each arm, and the elapsed time for each arm.
- [ ] The advisor reviews 10 blind output pairs for meaning preservation and records each judgment in `runs/heldout/meaning-review.md`. The review does not change the pass rate.

### US-008: Report the verdict and the next decision

**Description:** As the operator, I want one verdict and one next decision so that the epic closes on evidence.

**Acceptance Criteria:**

- [ ] `results.md` records one verdict: `improved`, `unchanged`, `regressed`, or `inconclusive`.
- [ ] `results.md` computes the verdict from `runs/heldout/summary.json` with the rule in `## Architectural Decisions`.
- [ ] `results.md` lists each attempt status count, the total usage, and the total elapsed time.
- [ ] `results.md` records one next decision: expand to more skills, build a general optimizer adapter, start a model-weight RL spike, or stop.
- [ ] A comment on #1171 links `results.md` and marks D1 to D7.

## Summary

Issue #1171 asks for one closed-loop proof: a baseline, episode evidence, one optimized skill, a held-out assessment, and a verdict. This plan selects `/ste` as the target skill.

Verified facts:

- `.agro/skills/ste/scripts/ste-check.sh` is a deterministic checker. It exits 0 for a clean document and exits 1 for one or more findings.
- `.agro/evals/probes/ste-checker-contract.sh` guards the checker.
- The `/ste` skill states two further contracts that a script can check: copy each literal byte for byte, and mark each missing value with a placeholder.
- At revision `3230337b`, 31 `docs/` files and 20 directory `README.md`, scoped `AGENTS.md`, and `SKILL.md` files hold 80 to 1500 words and fail `ste-check.sh`.
- `CHANGELOG.md` sections pass `ste-check.sh`. The corpus does not use `CHANGELOG.md`.
- More than 200 merged pull requests and 243 issues predate the STE adoption on 2026-08-13 (#750).
- Claude Code 2.1.280 is installed in the sandbox.

Selected approach: rewrite one source document for each episode, then score the output with a frozen verifier. Keep the experiment scripts in the task folder. Promote a script to `.agro/evals/` only when US-008 selects expansion.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/ste/SKILL.md` | whole file | The only file that the optimizer changes |
| `.agro/skills/ste/scripts/ste-check.sh` | CLI, exit codes 0, 1, 2 | Check P2 of the verifier; frozen |
| `.agro/skills/ste/references/` | `rules.md`, `dictionary.md`, `examples.md` | Skill references; frozen |
| `.agro/evals/probes/ste-checker-contract.sh` | probe | Regression floor for the frozen candidate |
| `.claude/skills` | symlink to `.agro/skills` | Native load path for each episode |
| `.agro/evals/experiments/skillopt-ste/` | `corpus/`, `verify.sh`, `run-episode.sh`, `run-batch.sh`, `runs/`, `experiment.json`, `results.md` | Experiment inputs, scripts, and evidence |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Issue #1171 | comment | Link the frozen definition after US-003. Link the results after US-008. |
| tmux session `skillopt-ste` | new, temporary | Runs `run-batch.sh` without an attached terminal |
| `mifunedev/agro-web` | N/A | The experiment changes no user-facing behavior |

## Storage

Git tracks each experiment file under `.agro/evals/experiments/skillopt-ste/`. The task folder `.agro/tasks/skillopt-ste/` holds only `prd.md` and `prd.json`, as `.gitignore` requires.

- `runs/<run-id>/episodes.jsonl` holds one JSON line for each attempt. `run-batch.sh` appends lines and never rewrites them.
- `runs/<run-id>/outputs/<document-id>-<arm>-<repeat>.md` holds each rewrite output.
- Git does not track the transcripts. `run-episode.sh` writes each `claude -p --output-format stream-json` transcript to `${XDG_STATE_HOME:-$HOME/.local/state}/agro/skillopt-ste/traces/<episode-id>.jsonl.gz`. The `trace` field of each episode line records that path and the `sha256` digest of the transcript.

## Architectural Decisions

These values go into `experiment.json` in US-003. The operator approves them with this plan.

| Item | Value |
|---|---|
| Target skill | `.agro/skills/ste/SKILL.md`; references and checker frozen |
| Provider | Anthropic, through Claude Code |
| Model | `claude-opus-5-5`, for episodes and for the SkillOpt proposer |
| Effort | `medium` |
| Harness | Claude Code 2.1.280, headless `claude -p` |
| Episode prompt | `/ste Rewrite <path> in place. Follow rewrite mode.` |
| Episode timeout | 600 seconds |
| Repeats | 3 for each document and arm |
| Training families | Repository files: F1 `docs/` guides and runbooks; F2 directory `README.md` files outside `docs/`, scoped `AGENTS.md` files except the root file, and `SKILL.md` files, excluding `.agro/skills/ste/` |
| Held-out families | GitHub bodies: F3 issue bodies created before 2026-08-13; F4 merged PR bodies created before 2026-08-13 |
| Eligibility | 80 to 1500 words for each document |
| Document selection | For each family, sort the eligible documents by `sha256` of the origin identifier, then take the first 15 that fail `ste-check.sh` |
| Budget | 540 attempts: 90 baseline training, 240 optimization, 180 held-out, and 30 retries |
| Success threshold | The candidate held-out pass rate is at least 0.15 above the baseline held-out pass rate |

Amendments before optimization:

- 2026-09-26: the operator selected `claude-opus-5-5` in place of `claude-sonnet-5`. The Sonnet runs move to `archive/claude-sonnet-5/` and do not count toward the budget. US-005 runs again on Opus.
- 2026-09-26: `verify.sh` fixes A to F remove six false-positive classes. Each fix is render-equivalent. `experiment.json` pins the fixed digest.

Verdict rule for US-008:

- `improved`: the threshold holds, P1 failures do not increase, and `ste-checker-contract.sh` exits 0.
- `regressed`: the candidate held-out pass rate is below the baseline held-out pass rate by more than 0.05, or P1 failures increase.
- `inconclusive`: infrastructure failures exceed 10% of held-out attempts, or the budget ends before US-007 completes.
- `unchanged`: each other result.

Ownership:

- AGRO owns execution, the verifier, the episode records, the promotion decision, and the merge decision.
- SkillOpt owns only candidate proposal.
- The advisor accepts or rejects each story. A worker never accepts its own result.

Execution location: each command runs in the sandbox. Each episode runs in its own git worktree under `.worktrees/`. Batches run in the named tmux session `skillopt-ste`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/experiments/skillopt-ste/tests/verify-faults.sh` | six fault fixtures from US-002 | Each check fails on its intended fault |
| `.agro/evals/experiments/skillopt-ste/tests/verify-faults.sh` | one clean fixture | `pass` is `true` on a correct rewrite |
| `.agro/evals/experiments/skillopt-ste/tests/select-reproducible.sh` | rebuild `manifest.json` twice | The corpus build is deterministic |
| `.agro/evals/experiments/skillopt-ste/tests/pin-check.sh` | change one pinned file digest | Each runner exits non-zero on a digest mismatch |
| `.agro/evals/probes/ste-checker-contract.sh` | existing probe | The frozen candidate keeps the checker contract |

## Design Principles

- Prove learning before building learning infrastructure.
- Freeze each input before the first optimization attempt.
- Record each attempt, including each failure.
- Keep one verifier for the baseline and the candidate.
- Keep the scripts in the task folder until evidence justifies promotion.
- Treat a valid `unchanged` verdict as a successful experiment.
- Add no explanatory comments to tracked code.

## Out of Scope

- Changes to `ste-check.sh`, `references/`, root `AGENTS.md`, or any other skill.
- A second model or a second provider.
- A comparison between optimizers.
- Model-weight training.
- A general episode or telemetry platform.
- Changes to `.agro/evals/datasets/` or `.agro/evals/capability/`.
- Automatic merge of a candidate. The operator decides the merge after US-008.

## Open Questions

None. The operator approved the plan on 2026-09-25 with these resolutions:

1. The 540-attempt budget is the only cap. The plan records USD usage as a diagnostic.
2. P1 to P4 do not measure meaning preservation. The first experiment accepts this limit. The blind review in US-007 reports meaning loss but does not change the pass rate.

## Acceptance Criteria

- [ ] `experiment.json` exists in a commit that is older than each file under `runs/optimize/`.
- [ ] Each attempt in `runs/` has one line in an `episodes.jsonl` file.
- [ ] Each candidate diff changes only `.agro/skills/ste/SKILL.md`.
- [ ] `results.md` records one verdict and one next decision.
- [ ] Issue #1171 links `experiment.json` and `results.md`.

## Lessons

Filled by the advisor before undraft.
