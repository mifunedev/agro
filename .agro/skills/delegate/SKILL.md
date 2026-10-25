---
name: delegate
description: |
  TRIGGER when: the operator explicitly approves the plan, or asks to
  "delegate this", "run this plan", "execute the stories", or "parallelize"
  the work. Writing or reading a plan is not approval. Runs the stories in .agro/tasks/<slug>/prd.json as
  bounded workers in dependency waves. The active session verifies each result,
  accepts it, and records it in prd.json.
argument-hint: "[<task-slug> | --plan <path>] [--dry-run]"
---

# Delegate

## Task lifecycle

An explicit operator approval of the plan authorizes the full run: the issue,
`prd.json`, the draft PR, all waves, Close, the push, and `gh pr ready`. The
merge stays with the operator. This section is the only copy of the approval
scope.

Run `bash .agro/skills/delegate/scripts/next.sh` to print the current state.
Do the next action of that state, then run the script again. The run stops
only at `done`, `blocked`, or `none`. If an action needs live spend, set
`blocked` in `prd.json` and ask the operator.

| State | Next action | Exit condition | Owner |
|---|---|---|---|
| `story <id>` | Dispatch, verify, and accept the story (§ Waves, § Acceptance) | The story has `passes: true` | Advisor; a worker implements |
| `review` | Get one fresh-context review of the PR diff (§ Reviewer brief) | `review.verdict` is `pass` for the current diff | Advisor; a reviewer reads |
| `close` | Write `## Lessons` and fill the PR evidence sections (§ Close) | `prd.md` has a non-empty `## Lessons` section | Advisor |
| `push` | Push the task branch | The remote task branch head equals local `HEAD` | Advisor |
| `ci` | Wait for CI with `/ci-status` | No PR check is pending | Advisor |
| `ci-red` | Reopen the story that owns the failing path as a bounded repair (§ Acceptance) | The reopened story has `passes: true` | Advisor; the same worker repairs |
| `ready` | Run `gh pr ready` (`/git` § Ready for review) | The PR is not a draft | Advisor |
| `done` | Stop | The run ends | Operator merges |
| `blocked` | Stop. Write the reason in the `blocked` field of `prd.json`. Run `/escalate` one time | The operator clears `blocked` | Operator |
| `none` | Stop. No task is bound to this branch | The run ends | Operator |

## The advisor/worker pattern

The **advisor** is the active session. It decides, assigns bounded stories,
verifies each result, and accepts it. The advisor alone writes `prd.json`:
`passes`, `commit`, and `notes`.

A **worker** is a bounded execution context, not a project role. A worker
implements one assignment inside its owned paths. It reports each criterion as
executed or reasoned. A worker never accepts its own result.

Use a worker when the story is self-contained and gains from parallelism,
isolated context, or restricted tools. Keep the work in the active session when
phases share substantial context or need iterative refinement.

| Assign to a worker | Keep in the active session |
|---|---|
| Tracked implementation edits: code, tests, docs, repair | Goal interpretation, decomposition, verification, acceptance |
| Coupled implementation, in one continuing worker | Reconciliation of results that share substantial context |
| Verbose disposable output: logs, search dumps, test runs | Iterative refinement against operator feedback |
| Disjoint owned paths with no shared mutable state | `prd.json`, `prd.md`, and the PR body |

## Input

Resolve the input from the arguments:

1. `<task-slug>`: read `.agro/tasks/<slug>/prd.json`.
2. `--plan <path>`: read the `prd.json` at `<path>`.
3. A free-text plan with no `prd.json`: run `/prd` first to make the tracker.
   To skip the tracker, dispatch once with no saved state. Tell the operator
   which path you took.
4. No input: print the usage line from `argument-hint`, then stop.

Each story in `userStories` is one task:

- `priority` sets the order. A lower number runs first.
- `dependsOn` is optional. It lists the story IDs that must pass first.
- `acceptanceCriteria` are the checks that the advisor runs.
- `files` are the owned write paths of the worker.

The advisor skips each story with `passes: true`.

## Dispatch record

Write one record for each story before dispatch. Keep only these fields:

| Field | Value |
|---|---|
| Story ID | The `id` from `prd.json` |
| Dependencies | The `dependsOn` IDs, or none |
| Read scope | The files and directories that the worker reads |
| Owned write paths | The `files` of the story; the worker edits nothing else |
| Deliverable | One commit on the worker branch |
| Verification | The commands and checks from `acceptanceCriteria`, with expected results |
| Execution directory | The absolute path of the worktree |
| Model and reason | The requested model, or the provider default, and the reason |

## Waves

1. Put each story in a wave. A story is ready when every `dependsOn` story has
   `passes: true`.
2. Run the ready stories of a wave in parallel, at most 5 workers per wave.
3. Give each parallel writer an isolated worktree. Branch it from the task branch.
   Before dispatch, when a worker worktree has a `package.json`, run
   `pnpm install --frozen-lockfile` in that worktree.
4. Stories with overlapping `files` run in sequence.
5. Workers stay flat. Workers never spawn workers.

A single story can use one worker. Parallelism is not mandatory.

## Worker brief

Give each worker the dispatch record, the exclusions, and these rules:

- Edit only the owned write paths. Obey the exclusions.
- Work only in the execution directory.
- Report each criterion as one of these:
  - **executed**: the command and exit status.
  - **reasoned**: a one-line argument.
- Commit on the worker branch. Never push.
- Never write `prd.json`.
- Use no bare `git stash` or `git stash pop`. The stash stack is shared with
  other sessions.
- Never bypass a hook. A rerun of a blocked command through a script file, a
  heredoc, or another tool is a bypass. Report a blocked action as `BLOCKED`.

## Acceptance

A worker report is not acceptance. For each story, the advisor does these steps:

1. Inspect the worker commit.
2. Bring the commit onto the task branch.
3. Rerun the verification on the integrated task branch.
4. Write `passes: true`, `commit`, and `notes` in `prd.json`. In `notes`,
   mark each criterion executed or reasoned.

### Repair

A failed story check, a red CI check (`ci-red`), or a confirmed blocking review
finding starts a repair. The advisor reopens the story whose `files` hold the
failing path: write `passes: false` and add 1 to `rounds`. The same worker
repairs the story as a bounded repair. The advisor does not repair. Dependents
of a reopened story wait.

The advisor writes `blocked` in `prd.json` and runs `/escalate` one time in
each of these cases:

- `rounds` is greater than 2.
- A round does not decrease the set of failed checks.
- No story owns the failing path.
- `/ci-status` reports `NO-RUN` or `TIMEOUT`.

## Integration

After acceptance, do these steps on the task branch:

1. Commit `prd.json` with the accepted story. Do not push it. `/git` § Draft PR
   for a task names the push rule.
2. Tick the story in the PR `## Stories` checklist.
3. Remove the worker worktree and branch. Use the git maintenance shim that
   `/git` names.

## Resume

There is no separate ledger. `prd.json` holds the state.

1. Read `prd.json`.
2. Take the next story with `passes: false` whose dependencies passed.
3. Re-verify the stories it builds on.
4. Continue from **Waves**.

## Model policy

- Follow explicit operator selections and exclusions of models.
- Otherwise, choose a model for each story. Record the reason in the dispatch
  record.
- Never substitute a model silently.
- A required control that is unavailable blocks the story. Ask the operator.

Provider defaults live in provider settings. For Claude Code, the default is
`CLAUDE_CODE_SUBAGENT_MODEL` in the `env` object of `.claude/settings.json`.
A per-dispatch model overrides the default.

## Close

When every story has `passes: true`, do these steps:

1. Validate the integrated result with the checks of the repository: lint,
   typecheck, test, and build. Record each exit status.
2. Write `## Lessons` at the end of `prd.md`. Give each lesson a claim,
   evidence, and exactly one outcome:
   - fixed in this PR;
   - issue #N; or
   - dropped, with the reason.

   Fold a finding into the PR only when one of these conditions is true:
   its fix is in a file that the PR already changes and the PR caused or
   exposed the finding, or the finding breaks the chain in use. Propose an
   issue only for a correctness or security risk outside the PR, one issue
   for each defect surface. If an open issue already covers the surface,
   propose a comment on that issue. Drop every other finding with its
   reason, including test flakes, tooling friction, judgment and process
   observations, and findings that a test already catches. When the
   repository has 10 or more open issues labeled `follow-up`, propose a
   new issue only with the open follow-up it replaces. List the proposed
   issues in the final report. Do not wait for an answer. Continue Close.
   Create an issue only after the operator approves it. Label each approved
   issue `follow-up`.

   "None" is a valid body.
3. Fill the PR evidence sections from the `notes` in `prd.json`.
4. Fill the PR `## Manual review` section from the evidence of the last story.
   Use the shape of [`.agro/skills/git/references/manual-review.md`](../git/references/manual-review.md).
   Write only the expected results that the evidence observed.
5. Continue with the "Ready for review" step of `/git`.

## Dry run

With `--dry-run`, print the waves and the dispatch records. Write nothing.
The dry run dispatches nothing.
