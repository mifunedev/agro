# Task ownership and state

Each `.agro/tasks/<slug>/` holds one task's core contract:

- `prd.md` is the plan. It records intent, decisions, and `## Lessons`.
- `prd.json` holds the ordered stories and their completion state.

Git tracks both files. Commit them with plain `git add`.
Task identity and state never depend on a session, tab, or pane.

## Advisor and workers

- The advisor is the active session. The advisor decides, assigns bounded stories, verifies, and accepts.
- Only the advisor writes `prd.json`: `passes`, `commit`, and `notes`. Workers never write `prd.json`.
- For each accepted story, `notes` records each criterion as executed (command and exit status) or reasoned.
- Follow the [delegate procedure](../skills/delegate/SKILL.md) for dispatch and worker boundaries.
- Follow the [prd skill](../skills/prd/SKILL.md) for planning.
- Record completion in `userStories[].passes`, never in a prose sentinel.

## `/spec` tasks

A `/spec` task also carries `progress.txt` and its gate records.
The [spec skill](../skills/spec/SKILL.md) and [execute procedure](../skills/spec/references/execute.md) define them.

| Artifact | Purpose |
| --- | --- |
| `progress.txt` | Advisor-appended execution narrative and resume evidence. |
| `eval-result.json`, `simplicity-review.json`, `ui-evidence.json`, `simplify-rounds.json` | Conditional gate records. |

Git ignores these records. Stage a required PR artifact explicitly with `git add -f`.
Put reviewer evidence in the PR body.
Do not persist a generated launch prompt as another task artifact.

## Completion

Use the structured check:

```bash
jq -e 'all(.userStories[]; .passes == true)' .agro/tasks/<slug>/prd.json
```

A task with no readable `prd.json` is not complete. Keep it in place and report the gap.
The `cleanup-tasks` cron archives completed tasks under `.agro/tasks/archive/<YYYY-MM-DD>/<slug>/`.
Passing stories does not bypass the PR readiness gates.
