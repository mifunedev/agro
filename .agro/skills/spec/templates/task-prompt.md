# `/spec execute` task — <slug>

> This is a **template**, rendered at execution time by
> `.agro/skills/spec/references/execute.md` step 4 and read by the agent that is already
> running `/spec execute`. It is never written into `.agro/tasks/<slug>/`: a persisted copy
> of a generated file drifts from the template it came from.

You are the single implementation owner for the `<slug>` task, and you act as its advisor.
Read the approved plan in `.agro/tasks/<slug>/prd.md` and the ordered stories in
`.agro/tasks/<slug>/prd.json`.

- Branch: `<branch>` — never push to `development` or `main`.
- Issue: #<issue>.
- Task folder: `.agro/tasks/<slug>/` (`prd.md`, `prd.json`, `progress.txt`; you add
  `evidence.md` and `eval-result.json`).
- Status file: `/tmp/spec-<slug>.state` — keep it current at every phase.

## Ownership

You own this task from implementation through the final PR gate. Do not hand the task to a
second implementation owner or a second supervisory session, and do not launch another
coding-agent process — through tmux, Herdr, a background shell, or any other runner — to do
this work. Ownership is a role, not a terminal topology.

You keep decisions and acceptance; bounded workers write. Use `/delegate` only for bounded
worker tasks: disjoint tasks run in parallel in isolated worktrees, and coupled work stays
with one continuing worker. Those workers perform every tracked implementation edit — code,
tests, documentation, integration fixes, and repair — before you perform acceptance. A small story
can use one worker. If you implement a tracked edit yourself, record the explicit operator
exception in `progress.txt` before the edit. A worker never updates `prd.json` or
`progress.txt`. Reconcile every worker result yourself, validate each story's acceptance
criteria against the repository, and update `prd.json` and `progress.txt`.

## Session continuity

Continue in this session by default; the task needs no handoff. Transfer ownership only when
the operator requests another session. Before an authorized transfer, stop dispatching work
for this task. The receiving advisor reads `prd.md`, `prd.json`, `progress.txt`, and the
current evidence, then acknowledges ownership before it dispatches a worker. Worker
delegation never transfers task ownership.

## Re-ground before you assign work

`prd.md`'s `## Knowledge Context` names the planning base commit and the
authoritative sources the plan was grounded against. Diff that base against
current HEAD, re-read every listed source that moved, and reconcile before
assigning work. Knowledge pages are orientation; code and tests are implementation
truth and canonical docs/RFCs are intended-design truth. Do not load the pattern
set — that is the planner's input.

## Implementation cycle

1. Read the plan, story dependencies, current progress, and relevant repository instructions.
2. Assign the next dependency-ready story to a bounded `/delegate` worker with the complete
   dispatch record that `.agro/skills/delegate/SKILL.md` requires. Keep coupled stories with
   one continuing worker. Give parallel writers isolated worktrees.
3. Run the required quality checks on the worker's result. Route a failure back to that
   worker before you record success.
4. Set that story's `passes` field to `true` only after validation. Add a dated progress entry
   with the files, commit, result, and learnings. Every implementation commit needs a mandatory
   `Submitted-by: <active submitter>` trailer.
5. Continue until every story passes. Do not claim completion when a story is blocked or
   deferred. Completion is structured state, not prose: the task is done when
   `jq -e 'all(.userStories[]; .passes == true)' .agro/tasks/<slug>/prd.json` exits 0.

## Tail

After implementation completes, continue in this same session with the `/spec execute`
procedure, in this order: the implementation-side audit loop; `/eval` once; the Actual
Knowledge Impact gate (`knowledge-impact.sh --changed <actual diff>`, then resolve every
impacted page to UPDATED / REVERIFIED / NOT-AFFECTED); write and commit `evidence.md`;
`/spec retro <slug>`; `/wiki compile`; optional non-gating context compaction; `/benchmark`;
then run a fresh `/audit pr`. Mark the PR ready only when that audit is promotable. Never merge
the PR. Report `READY` or `DRAFT-BLOCKED(<gate>)` and mirror it into the status file.
