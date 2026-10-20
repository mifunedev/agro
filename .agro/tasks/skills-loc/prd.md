# PRD: rsi run on skill prose size

Status: DRAFT

## User Stories

### US-001: Add the word metric and the prose gates

**Description:** As the operator, I want a word metric and two prose gates for the skill Markdown. A kept loop then removes real prose and keeps the STE standard and every link.

**Acceptance Criteria:**

- [ ] `.agro/tasks/skills-loc/scope.txt` lists each path that `git ls-files '.agro/skills/*.md' | grep -v -E '^\.agro/skills/(ste|rsi)/|/scripts/'` prints at the plan commit, one path for each line.
- [ ] `node .agro/tasks/skills-loc/measure-words.mjs` prints one whole number and exits 0. The number is the count of words in the files of `scope.txt`, without YAML frontmatter, fenced code blocks, inline code spans, and HTML comments.
- [ ] Two runs of `node .agro/tasks/skills-loc/measure-words.mjs` print the same number.
- [ ] `.agro/tasks/skills-loc/ste-floor.tsv` holds one row for each path in `scope.txt`: the path, a tab, and the finding count that `bash .agro/skills/ste/scripts/ste-check.sh <path>` reports at the plan commit.
- [ ] `node .agro/tasks/skills-loc/ste-excess.mjs` prints `0` at the plan commit and exits 0. The number is the sum, over the files of `scope.txt`, of the finding count above the floor in `ste-floor.tsv`.
- [ ] `node .agro/tasks/skills-loc/broken-links.mjs` prints one whole number and exits 0. The number is the count of relative Markdown links in the tracked `.md` files of the repository whose target path does not exist.
- [ ] In a temporary worktree, a change of only line breaks in one scope file leaves the word count unchanged.
- [ ] In a temporary worktree, the deletion of one fenced code block in one scope file leaves the word count unchanged.
- [ ] In a temporary worktree, the deletion of one prose paragraph in one scope file lowers the word count.
- [ ] In a temporary worktree, the addition of the word `usually` to a prose sentence in one scope file raises the output of `ste-excess.mjs` above `0`.
- [ ] In a temporary worktree, a change of one relative link target to a missing path raises the output of `broken-links.mjs` by 1.
- [ ] The advisor removes each temporary worktree with `bash .agro/scripts/git-maintenance.sh worktree-remove <path>`.

### US-002: Run 5 loops on the skill prose size

**Description:** As the operator, I want a `/rsi` run on the skill Markdown. The skills then get shorter with no lost test, no new STE finding, and no broken link.

**Acceptance Criteria:**

- [ ] Before preflight, the advisor runs the test suite and `broken-links.mjs` at the start commit. The advisor writes the passed-test count and the broken-link count into the holdout command in place of `<P0>` and `<L0>`.
- [ ] The advisor runs `/rsi` on `task/<N>-skills-loc` with `--loops 5` and `--slug skills-loc-rsi`, with the scope, metric, holdout, and direction in the Summary.
- [ ] `.agro/tasks/skills-loc-rsi/rsi.tsv` holds 2 baseline rows and 5 loop rows. Each row has 7 columns.
- [ ] `git diff --quiet <start-commit> -- <evaluator-paths>` exits 0 on the task branch.
- [ ] `git diff --name-only <start-commit> HEAD` lists only paths in `.agro/tasks/skills-loc/scope.txt` and `.agro/tasks/skills-loc-rsi/rsi.tsv`.
- [ ] `git diff --diff-filter=D --name-only <start-commit> HEAD` prints nothing.
- [ ] After loop 5, the advisor runs the holdout on the task branch. The holdout prints `0`.
- [ ] After loop 5, the advisor runs the metric on the task branch. If the ledger holds a `keep` row, the metric is lower than the first baseline metric.
- [ ] The run report prints one `REVIEW` line for each `keep` row.

### US-003: Record manual review evidence

**Description:** As a reviewer, I want the run transcript, the size totals, the gate totals, and the review checks in one file.

**Acceptance Criteria:**

- [ ] `.agro/tasks/skills-loc/evidence/manual-review.md` holds the US-001 checks, the preflight output, the baseline readings, each loop evaluation, the run report, and the deletion of each worker worktree and branch.
- [ ] The evidence file holds the word count and the `wc -l` line count of the scope files at the start commit and at the task branch head.
- [ ] The evidence file holds the total STE finding count of the scope files and the broken-link count at the start commit and at the task branch head.
- [ ] For each `keep` row, the evidence file holds the result of the review checklist: removed step, condition, warning, or rule; changed command, path, flag, or literal; changed frontmatter `name` or `description`; and compressed fragment or abbreviation.
- [ ] The PR `## Manual review` section lists each `REVIEW` line and one failure path with its observed exit status.
- [ ] The operator confirms each `REVIEW` line before the merge. The advisor reverts each kept edit that fails the review, and records the revert in `## Lessons`.
- [ ] `bash .agro/skills/git/scripts/manual-review-check.sh <pr-body-file>` exits 0.

## Summary

Phase 1 ran two `/rsi` runs on the CLI source (PR #1483 and PR #1485). Phase 2 runs one `/rsi` run on the Markdown of the skills. The operator selected the scope "prose and references" and the metric "words with an STE gate".

Verified current state at `2d52895a`:

- `.agro/skills/` holds 76 tracked `.md` files. The scope excludes 8 of them: the 5 files of `.agro/skills/ste/` and `.agro/skills/rsi/`, and the 3 test fixtures under `.agro/skills/git/scripts/tests/fixtures/`. The scope holds 68 files with 10783 lines.
- `.agro/skills/ste/` holds the checker `ste-check.sh` and the standard that the gate applies. `/rsi` preflight refuses a scope that overlaps `.agro/skills/rsi/`.
- `ste-check.sh` reports 260 findings in the 71 files of `.agro/skills/` outside `ste/` and `rsi/`. 31 of those files have no finding. The gate therefore compares each file with its own floor, so a worker cannot trade a fixed finding in one file for a new finding in another file.
- 48 tracked `.md` files hold 201 relative links to `.md` files.
- 7 test files under `.agro/scripts/__tests__/` read skill Markdown, for example `standard-skills-link.test.ts` and `behavioral-training-docs.test.ts`. The test suite guards the content that those tests read.
- `.claude/skills` is a symlink to `../.agro/skills`, so each provider mirror follows the canonical files with no change.

The run inputs:

| Input | Value |
|---|---|
| Scope | Each path in `.agro/tasks/skills-loc/scope.txt` |
| `--metric` | `node .agro/tasks/skills-loc/measure-words.mjs` |
| `--holdout` | `f=$(mktemp); pnpm exec vitest run --reporter=json --outputFile=$f >/dev/null 2>&1; s=$(node .agro/tasks/skills-loc/ste-excess.mjs); l=$(node .agro/tasks/skills-loc/broken-links.mjs); jq -n --argjson s $s --argjson l $l --slurpfile r $f '$r[0] as $r \| ([0, <P0> - $r.numPassedTests] \| max) + $r.numFailedTests + $s + ([0, $l - <L0>] \| max)'` |
| `--direction` | `min` |
| `--loops` | `5` |
| `--slug` | `skills-loc-rsi` |
| Evaluator paths | `.agro/tasks/skills-loc/measure-words.mjs .agro/tasks/skills-loc/scope.txt .agro/tasks/skills-loc/ste-floor.tsv .agro/tasks/skills-loc/ste-excess.mjs .agro/tasks/skills-loc/broken-links.mjs .agro/skills/ste/ .agro/skills/rsi/ .agro/skills/git/scripts/ .agro/skills/agent-browser/scripts/ vitest.config.ts package.json pnpm-lock.yaml .agro/cli/src/__tests__/ .agro/cli/src/commands/__tests__/ .agro/cli/src/lib/__tests__/ .agro/cli/src/lib/tracing/__tests__/ .agro/scripts/__tests__/ .pi/extensions/__tests__/ .pi/bridge-recovery/__tests__/ .github/workflows/` |

In the table, `\|` is a literal `|` in the command.

The holdout prints `0` at the start commit. Each lost pass, each failed test, each new STE finding in a scope file, and each new broken link add to the value.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/rsi/SKILL.md` | section 6 PR path, preflight, keep rule | The run procedure |
| `.agro/skills/ste/scripts/ste-check.sh` | the finding report | The prose gate of the holdout |
| `.agro/tasks/skills-loc/measure-words.mjs` | the metric script | New evaluator: the word count |
| `.agro/tasks/skills-loc/ste-excess.mjs` and `ste-floor.tsv` | the STE gate | New evaluator: new findings above the floor of each file |
| `.agro/tasks/skills-loc/broken-links.mjs` | the link gate | New evaluator: relative links with a missing target |
| `.agro/scripts/__tests__/standard-skills-link.test.ts` | skill link and content checks | Evaluator: a test that reads skill Markdown |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Skill Markdown in `scope.txt` | Modify | Kept edits remove prose and keep each step, condition, warning, rule, command, path, and literal. |
| Skill triggers in frontmatter | None | A kept edit changes no frontmatter `name` and no frontmatter `description`. The review checklist checks each kept edit. |
| Skill scripts, the STE skill, the rsi skill, hooks, and tests | None | No change. |

## Storage

The run ledger is `.agro/tasks/skills-loc-rsi/rsi.tsv`, in the `/rsi` version 2 format with 7 columns. The metric script, the gate scripts, the floor file, `scope.txt`, and the evidence file are in `.agro/tasks/skills-loc/`. The root `.gitignore` ignores those files, so the advisor stages each file with `git add -f`.

## Architectural Decisions

- The metric counts words outside frontmatter, fenced code blocks, inline code spans, and HTML comments. The deletion of a command, a path, or a trigger description therefore does not lower the metric.
- The metric is deterministic. The baseline noise margin is `0`, so a tie rejects and each lower count is a gain.
- The STE gate compares each scope file with its own floor. A new finding in one file adds 1, even when another file loses a finding.
- The link gate counts the broken relative links of all tracked `.md` files. A deleted or renamed heading target in a scope file is outside the gate, so the review checklist covers it.
- A worker does not delete a scope file. The criterion `--diff-filter=D` checks that rule.
- The holdout does not run coverage, because the scope holds no code.
- The run slug `skills-loc-rsi` differs from the task slug `skills-loc`, so the gate scripts do not overlap the run folder.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/tasks/skills-loc/measure-words.mjs` in a temporary worktree | line-break change, code-block deletion, paragraph deletion | The metric ignores layout and code, and it falls when prose goes away |
| `.agro/tasks/skills-loc/ste-excess.mjs` in a temporary worktree | the added word `usually` | The STE gate reports a new finding |
| `.agro/tasks/skills-loc/broken-links.mjs` in a temporary worktree | one link target changed to a missing path | The link gate reports a new broken link |
| all files in `vitest.config.ts` `test.include` | the full suite, through the holdout | Passes, including the tests that read skill Markdown |

## Design Principles

- Apply the smallest truthful model under the root `AGENTS.md`.
- A kept edit keeps each instruction that a skill gives. Fewer words never justify a lost step or an ambiguous sentence.
- STE technical correctness and unambiguous meaning come before concision.
- A person confirms intent. The holdout confirms only the counts.

## Out of Scope

- The files of `.agro/skills/ste/` and `.agro/skills/rsi/`.
- Skill scripts, test fixtures, hooks, and the `.agro/cli/` source.
- New skill files, deleted skill files, and renamed skill files.
- Changes to tests, `vitest.config.ts`, `package.json`, and CI workflows.
- A `CHANGELOG.md` entry. The run changes no runtime behavior.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each US-001, US-002, and US-003 criterion passes on the task branch.
- [ ] `git diff --name-only <base>...HEAD` lists only paths in `.agro/tasks/skills-loc/scope.txt`, files under `.agro/tasks/skills-loc/`, and `.agro/tasks/skills-loc-rsi/rsi.tsv`.
- [ ] CI passes on the pushed task branch.

## Lessons

Filled by the advisor before undraft.
