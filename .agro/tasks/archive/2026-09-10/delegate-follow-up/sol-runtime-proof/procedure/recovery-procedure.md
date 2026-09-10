**Dispatch eligibility applies to initial and resumed runs.** Before any dispatch,
re-evaluate the task against the current graph, artifacts, and native capabilities. A
task is eligible only when all of these conditions hold:

- all blocking prerequisites in the plan and dispatch record are satisfied;
- every `Depends On` task is recorded `completed`, its accepted evidence still
  describes the required artifact revision, and that evidence has established
  provenance;
- every required model, control, and capability is available; and
- no unresolved native worker status, artifact provenance, or owned-path ambiguity
  remains.

A `pending`, `FAIL`, or `BLOCKED` label does not itself authorize dispatch. If every
condition holds, dispatch only the incomplete authorized scope and record `running`
before the worker starts. If any condition remains unmet, record or keep `BLOCKED`,
log each unmet condition, and dispatch nothing. Never infer eligibility from `pending`
alone or from only some accepted dependencies.

**Resume rather than restart.** If `delegate-graph.json` already exists in the resolved
directory, read it first and reconcile every task against real state before any
dispatch.

- `pending`: apply the dispatch-eligibility conditions. Do not release it from the
  label alone.
- `BLOCKED`: re-evaluate every recorded blocking condition, including all dependencies
  and required controls. It remains `BLOCKED` while any condition is unmet and becomes
  eligible only after every condition holds.
- `FAIL`: read the failed task's current artifacts before any retry, apply the
  dispatch-eligibility conditions, then route only the incomplete scope through the
  existing failure / repair route. Never replay work that is already correct.
- `running`: inspect the persisted native worker reference and the current artifacts
  before any retry. While the worker is still active, reconnect to it or observe it
  through the supported native mechanism, and never spawn a duplicate for it. Once it
  has ended, validate its artifacts first, then decide to accept, resume, or retry only
  the incomplete scope. Never replay work that is already correct.
- `completed`: the saved label holds only while its recorded evidence still describes
  the required artifact revision. Re-read the artifact references against the current
  tree. Evidence that no longer describes that revision is stale, so the task returns
  to `running` for reconciliation and its dependents wait.
- Unknown native worker status, or an artifact whose provenance cannot be established,
  is reported to the operator as ambiguity. Ambiguity blocks every write to the
  affected paths and never authorizes a second writer.

A resumed run appends to `delegate-log.txt`; it never truncates it.
