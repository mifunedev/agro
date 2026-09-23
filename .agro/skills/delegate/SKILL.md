---
name: delegate
description: |
  TRIGGER when: asked to "delegate this", "run this plan", "execute the stories",
  or "parallelize" the work. Writing or reading a plan is not a trigger and
  authorizes no dispatch. Runs the stories in .agro/tasks/<slug>/prd.json as
  bounded workers in dependency waves. The active session verifies each result,
  accepts it, and records it in prd.json.
argument-hint: "[<task-slug> | --plan <path>] [--dry-run]"
---

# Delegate

## Advisor/Worker pattern

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
- Never bypass a hook. Report a blocked action as `BLOCKED`.

## Acceptance

A worker report is not acceptance. For each story, the advisor does these steps:

1. Inspect the worker commit.
2. Bring the commit onto the task branch.
3. Rerun the verification on the integrated task branch.
4. Write `passes: true`, `commit`, and `notes` in `prd.json`. In `notes`,
   mark each criterion executed or reasoned.

If a check fails, the story returns to the same worker with a bounded repair.
The advisor does not repair. Dependents of a failed story wait.

## Integration

After acceptance, do these steps on the task branch:

1. Commit `prd.json` with the accepted story.
2. Push the task branch.
3. Tick the story in the PR `## Stories` checklist.
4. Remove the worker worktree and branch. Use the git maintenance shim that
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
   typecheck, test, and build, or its probe suite. Record each exit status.
2. Write `## Lessons` at the end of `prd.md`. Give each lesson a claim,
   evidence, and exactly one outcome:
   - fixed in this PR;
   - issue #N; or
   - dropped, with the reason.

   "None" is a valid body.
3. Fill the PR evidence sections from the `notes` in `prd.json`.
4. Continue with the "Ready for review" step of `/git`.

## Dry run

With `--dry-run`, print the waves and the dispatch records. Write nothing.
The dry run dispatches nothing.
