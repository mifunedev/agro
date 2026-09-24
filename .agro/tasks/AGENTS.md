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

## Completion

Use the structured check:

```bash
jq -e 'all(.userStories[]; .passes == true)' .agro/tasks/<slug>/prd.json
```

A task with no readable `prd.json` is not complete. Keep it in place and report the gap.
The `cleanup-tasks` cron archives completed tasks under `.agro/tasks/archive/<YYYY-MM-DD>/<slug>/`.
Passing stories does not bypass the PR readiness gates.
