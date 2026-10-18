# PRD: rsi skill for fixed-loop, measured improvement

Status: DRAFT

## User Stories

### US-001: Write the canonical rsi skill

**Description:** As an operator, I want one `/rsi` command that runs a fixed number of measured improvement loops on a scope. Each run gives a retained gain or an honest "no improvement" result.

**Acceptance Criteria:**

- [ ] `.agro/skills/rsi/SKILL.md` exists, and `.claude/skills/rsi/SKILL.md` resolves to the same file.
- [ ] The frontmatter `name` is `rsi`, and the `description` holds a `TRIGGER when:` clause and a `Do NOT trigger` clause in less than 1,536 characters.
- [ ] The `argument-hint` names `<scope-paths>`, `--loops <N>`, `--metric "<cmd>"`, `--holdout "<cmd>"`, and `--direction <min|max>`.
- [ ] `wc -l < .agro/skills/rsi/SKILL.md` prints a number less than 500.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/rsi/SKILL.md` exits 0.
- [ ] The skill stops with `BLOCKED` before loop 1 in each of these conditions: a command prints no single number, a scope path overlaps an evaluator path, or a scope path or an evaluator path overlaps `.agro/tasks/<slug>/`.
- [ ] The skill writes two baseline rows with loop `0` to `.agro/tasks/<slug>/rsi.tsv` before loop 1. The first baseline row holds the verbatim invocation in the `reason` field.
- [ ] The skill names the `rsi.tsv` columns in this order: `loop`, `commit`, `metric`, `holdout`, `decision`, `reason`.
- [ ] The skill states the keep rule: the metric beats the current best by more than the noise margin, and the holdout does not get worse. A tie rejects.
- [ ] The skill checks the evaluator with `git diff --quiet <start-commit> -- <evaluator-paths>` in each loop and stops with `BLOCKED` on a nonzero exit.
- [ ] The skill makes one commit for each loop. A `keep` commit holds the worker edit and the row. A `reject` commit holds the row alone.
- [ ] The skill stages the ledger with `git add -f .agro/tasks/<slug>/rsi.tsv`. The root `.gitignore` ignores each task file except `prd.md` and `prd.json`.
- [ ] The skill deletes each worker branch with `bash .agro/scripts/git-maintenance.sh branch-delete <branch>`.
- [ ] The skill gives a resume procedure that reads only the committed `rsi.tsv` and git.
- [ ] The worker brief forbids reads of `.agro/tasks/<slug>/`. The skill states that this rule is a prompt-level rule and that no runtime enforces the rule.
- [ ] The skill describes the local path on `rsi/<slug>` and the PR path on `task/<N>-<slug>`. The skill states that a local run without `prd.json` stays "not complete".
- [ ] The skill never writes `prd.json` for a local run, never pushes, never opens a PR, and never creates an issue.
- [ ] `CHANGELOG.md` holds one `### Added` entry under `## [Unreleased]` for `/rsi`.

### US-002: Record manual review evidence for a real run

**Description:** As an operator, I want a transcript of one real `/rsi` run with one interrupt. The transcript lets me check the loop, the ledger, and the resume.

**Acceptance Criteria:**

- [ ] The run uses a fixture scope in a temporary worktree with `--loops 3`. The operator approves the fixture, the metric, and the holdout before the run.
- [ ] `.agro/tasks/rsi-skill/evidence/manual-review.md` holds the invocation, each `rsi.tsv` row, and the final result line.
- [ ] The advisor commits `.agro/tasks/rsi-skill/evidence/manual-review.md` with `git add -f`, as `.agro/skills/git/references/manual-review.md` requires for an ignored path.
- [ ] The transcript shows one session interrupt between two loops. The transcript shows a new session that continues at the next loop without a second dispatch of a finished loop.
- [ ] `git log --oneline` on the run branch shows one commit for each loop after the baseline commit.
- [ ] The transcript shows the deletion of the temporary worktree and of each run branch.

## Summary

The council in `.agro/tasks/council-rsi-skill/` selected a thin `/rsi` skill. The decision records are `intent.md`, `recommendation-r2.md`, and `run-record.json`.

The skill improves one operator-named scope over a fixed number of loops. The skill keeps an edit only when a fixed external metric beats the current best by more than the noise margin. The holdout must not get worse.

No current skill covers this behavior. `/delegate` runs fixed stories with binary checks. `/behavioral-training` compares one bounded change on Langfuse replays.

The `rsi.tsv` ledger lands at the top of the task folder. The task folder already holds plans, progress, and evidence under the root `AGENTS.md`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/rsi/SKILL.md` | new skill | Canonical procedure. |
| `.claude/skills` | symlink to `../.agro/skills` | Claude Code discovery. No change. |
| `.codex/skills` | symlink to `../.agro/skills` | Codex discovery. No change. |
| `.agro/skills/delegate/SKILL.md` | Worker brief | `/rsi` reuses the worker rules only. |
| `.agro/skills/worktrees/SKILL.md` | create, remove | Worker isolation for each loop. |
| `.agro/skills/git/SKILL.md` | Draft PR for a task, Changelog | PR path and the changelog entry. |
| `.agro/scripts/git-maintenance.sh` | `branch-delete` | Deletion of worker branches under the hook guard. |
| `.agro/tasks/AGENTS.md` | completion rule | A run without `prd.json` stays "not complete". |
| `CHANGELOG.md` | `## [Unreleased]` | User-visible entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/rsi` slash command | new | `/rsi <scope-paths> --loops <N> --metric "<cmd>" --holdout "<cmd>" --direction <min|max>` |
| `.agro/tasks/<slug>/rsi.tsv` | new file format | Append-only ledger with six tab-separated columns. |

## Storage

The run state is `.agro/tasks/<slug>/rsi.tsv`. Git tracks the file on the run branch. The skill commits one row with each loop. The root `.gitignore` ignores the file, so the skill stages the file with `git add -f`.

The ledger holds two baseline rows with loop `0`, then rows `1` to `<N>`. The difference between the two baseline metric values sets the noise margin.

No `run.json` file exists. Git checks the evaluator through `git diff --quiet <start-commit> -- <evaluator-paths>`. The baseline rows record `<start-commit>`.

## Architectural Decisions

- The advisor runs the loop, measures each worker commit, and writes each row. A worker never accepts the worker's own edit.
- One worker makes one bounded edit for each loop in an isolated worktree. The loops run in sequence.
- The ledger is the only run state. No fact appears in both `rsi.tsv` and `prd.json`.
- The loop order is: measure, append the row, commit, delete the worker branch.
- On resume, the last committed row names the last finished loop. If a worker branch exists for the next loop, the session measures that branch and dispatches no new worker.
- Version 1 keeps the procedure and the evaluator fixed. The skill never edits `.agro/skills/rsi/`.
- The PR path starts with `/prd` and one story for the whole run. That story bends the one-session story size in `.agro/skills/prd/references/tracker.md`. The ledger bends "There is no separate ledger" in `.agro/skills/delegate/SKILL.md`. The skill states both bends.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A | No automated test | The skill holds procedure prose and no code. The council skill uses the same pattern. |
| `.agro/skills/ste/scripts/ste-check.sh` | the new `SKILL.md` | Prose rules. |
| `.agro/tasks/rsi-skill/evidence/manual-review.md` | one real run with one interrupt | Loop, ledger, keep rule, resume. |

## Design Principles

- Apply the smallest truthful model under the root `AGENTS.md`.
- Use one source of truth for the run state.
- Score each loop with an external command, never with the opinion of the editing agent.
- Report "no improvement" as a valid result.
- Write no explanatory comments in tracked code.

## Out of Scope

- Improvement of the improver, which the README of awesome-rsi calls improver gain.
- Archives, populations, and parallel loops.
- Model weight training.
- Bundled scripts or helpers.
- Automatic archive of local runs.
- A page in `docs/`. The current `docs/` pages list no skills.

## Open Questions

1. Resolved: the US-002 scope is one Markdown fixture with known STE findings. The metric is the count of `ste-check.sh` findings. The holdout is the count of `ste-check.sh --max-words 20` findings.
2. Resolved: US-002 needs no issue before the run. US-002 uses only a local worktree and pushes nothing.

## Acceptance Criteria

- [ ] Each US-001 criterion and each US-002 criterion passes on the task branch.
- [ ] `git diff --name-only <base>...HEAD` lists only `.agro/skills/rsi/SKILL.md`, `CHANGELOG.md`, and files under `.agro/tasks/rsi-skill/`.

## Lessons

1. **A failed metric command read as a perfect score.** Evidence: `ste-check.sh` exited 2 on a missing file, and `grep -c` still printed `0`. Under `--direction min`, a worker that deleted the scope earned `keep`. Outcome: fixed in this PR, commit `07ce717e`. The skill runs each command under `pipefail` and accepts a reading only on exit 0.
2. **Resume left state behind after an interrupt.** Evidence: advisor review found a staged worker edit that survived resume. Advisor review also found a loop branch that no step deleted. The fresh resume session found a loop branch with no worktree. Outcome: fixed in this PR, commits `bff0cce7` and `07ce717e`.
3. **The root `.gitignore` ignored the ledger and the evidence.** Evidence: `.gitignore` tracks only `prd.md` and `prd.json` in a task folder. Outcome: fixed in this PR. The skill and the evidence story stage both files with `git add -f`.
4. **`/rsi` and `/claude-api hillclimb` overlapped on Claude API apps.** Evidence: the hillclimb guide in `anthropics/skills` runs the same keep-or-revert loop on prompts, tools, and model settings. Outcome: fixed in this PR. The `/rsi` description routes that case to `/claude-api hillclimb`.
5. **Two baseline readings measured no noise.** Evidence: the noise margin was 0 in both runs on a deterministic checker. The hillclimb guide uses a paired confidence interval over repeated runs. Outcome: dropped. Version 1 targets deterministic metrics, and a noisy metric is outside the observed evidence.
6. **The fixture holdout tracked the metric.** Evidence: the holdout used the same checker with a stricter word cap. Both values moved together in every loop. Outcome: dropped. The operator chooses the holdout for each run, and this choice only affected the fixture.
7. **The run produced no `reject` decision.** Evidence: all three loops met the keep rule in both runs. Outcome: dropped. A forced bad edit gives contrived evidence. The PR lists the reject path as unverified.
8. **One local test failed on a tool version.** Evidence: the sandbox has `cc-safety-net` `1.0.6`, and the repository pins `2.6.8`. With `CC_SAFETY_NET_OFF=1`, the 41 link tests pass, and CI passed on this branch. Outcome: dropped. The failure comes from sandbox drift, not from this change.
