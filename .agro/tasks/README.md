# `.oh/tasks/`

Spec task workdirs. Each `<slug>/` subfolder is one `/spec execute` task's
three-file contract, created by `/spec plan` (the `/ralph` skill produces the
`prd.json` inside it). The task's single implementation owner — the agent that runs
`/spec execute` — acts as advisor: it assigns the tracked edits to bounded `/delegate`
workers and accepts the result. Ownership is a role, not a terminal session:
a task folder's identity and state never depend on a session, tab, or pane.

A task directory typically contains:

| File               | Purpose                                                  |
| ------------------ | -------------------------------------------------------- |
| `prd.json`         | Ralph-formatted PRD — the owner's authoritative task graph, and the structured completion state (`userStories[].passes`) |
| `prd.md`           | Human-readable PRD that `prd.json` was generated from    |
| `progress.txt`     | The implementation owner's running execution narrative and resume evidence — what was attempted, what landed, and where a resumed session picks up. Carries no completion sentinel |
| `evidence.md`      | The implementation's answer back to the approved plan, written after implementation; required before the PR leaves draft |
| `eval-result.json` | The commit-keyed probe-suite result for the task's HEAD, when a probe suite applies |
| `simplicity-review.json` | Owner-written record of a fresh read-only reviewer's simplicity findings for the head under audit (`file:line`, concrete simpler alternative, blocking, status). The scripted `/audit implementation` gate 5 fails closed without a current one. Add it with `git add -f` |
| `ui-evidence.json` | Owner-written record of verified browser evidence for UI stories (browser-preflight run id, per-criterion PASS/FAIL, screenshot sha256). Gate 4 fails closed without a current one when a story requires browser verification. Add it with `git add -f` |
| `simplify-rounds.json` | The owner's simplify-loop round record (`rounds`, `netAdded`, `lastCommit`, `nonReducing`) |
| `delegate-graph.json` | The `/delegate` dispatch records — every worker's requested and observed settings, scope, and status. Owned by `/delegate`; add it with `git add -f` when the PR carries it |
| `delegate-log.txt` | Append-only `/delegate` run log. Owned by `/delegate`; add it with `git add -f` when the PR carries it |
| `critique.md`      | Optional critic notes from PRD review                    |

## Conventions

- `<taskdesc>` is kebab-case and matches the branch name's `<short-desc>`
  segment when the task corresponds to a harness branch.
- **This whole directory is gitignored** (`.gitignore`: `.oh/tasks/*` with
  `!.oh/tasks/README.md`), so only this guide is tracked by default. Task files a PR
  must carry — `prd.md`, `prd.json`, `progress.txt`, `evidence.md`,
  `eval-result.json` — are added explicitly with **`git add -f`**. A bare
  `git add .oh/tasks/<slug>/` stages nothing and commits silently without them, which
  is the same as never having written them from a reviewer's seat.
- **Do not edit `progress.txt` by hand** — the implementation owner appends to it.

## Lifecycle

- Tasks are created under `.oh/tasks/<taskdesc>/`.
- The weekly `cleanup-tasks` cron (`crons/cleanup-tasks.md`) archives a task
  into `.oh/tasks/archive/<YYYY-MM-DD>/<taskdesc>/` when every user story in
  its `prd.json` has passed — that is, when
  `jq -e 'all(.userStories[]; .passes == true)' .oh/tasks/<slug>/prd.json`
  exits 0. A task folder with no readable `prd.json` is not complete: it stays
  in place and is noted.
- `archive/` contents are gitignored except for archived task files
  themselves (see root `.gitignore`).

See `.oh/skills/spec/references/execute.md` for the implementation workflow.
