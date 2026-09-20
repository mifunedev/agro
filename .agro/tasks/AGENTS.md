# Task ownership and state

Each `.agro/tasks/<slug>/` holds one task's durable three-file contract.
The `/spec execute` implementation owner acts as advisor and accepts bounded worker results.
Task identity and state never depend on a session, tab, or pane.

- Follow the [spec skill](../skills/spec/SKILL.md) and [execute procedure](../skills/spec/references/execute.md).
- Keep one implementation owner. Only that owner updates `prd.json` and appends to `progress.txt`.
- Workers must not write owner state or acceptance records. Follow the [delegate procedure](../skills/delegate/SKILL.md) for dispatch records and worker boundaries.
- Before resuming, read `prd.md`, `prd.json`, `progress.txt`, and current evidence. Reconcile unfinished workers before another dispatch.
- Transfer ownership only with operator authorization and the acknowledgment required by `/spec execute`.
- Record completion in `userStories[].passes`, never in a prose sentinel.
- Put reviewer evidence in the PR body. The canonical execute procedure owns the evidence and readiness gates.

## Artifact orientation

| Artifact | Purpose |
| --- | --- |
| `prd.md` | Approved human-readable requirements. |
| `prd.json` | Authoritative task graph and structured completion state. |
| `progress.txt` | Owner-appended execution narrative and resume evidence. |
| `delegate-graph.json`, `delegate-log.txt` | Delegate-owned dispatch state and append-only run log. |
| `eval-result.json`, `simplicity-review.json`, `ui-evidence.json`, `simplify-rounds.json` | Conditional gate records defined by the canonical procedures. |

Git ignores task contents by default, except this `AGENTS.md`.
Stage required PR artifacts explicitly with `git add -f`.
Do not persist a generated launch prompt as another task artifact.

## Completion

Use the structured check:

```bash
jq -e 'all(.userStories[]; .passes == true)' .agro/tasks/<slug>/prd.json
```

A task with no readable `prd.json` is not complete. Keep it in place and report the gap.
The `cleanup-tasks` cron archives completed tasks under `.agro/tasks/archive/<YYYY-MM-DD>/<slug>/`.
Passing stories does not bypass the PR readiness gates.
