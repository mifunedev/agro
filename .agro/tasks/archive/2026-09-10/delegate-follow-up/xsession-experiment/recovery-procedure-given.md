**Resume rather than restart.** If `delegate-graph.json` already exists in the resolved
directory, read it first and reconcile every task against real state before any
dispatch.

- `pending`, `BLOCKED`: re-run the task under its dispatch record.
- `FAIL`: read the failed task's current artifacts before any retry, then retry only
  the incomplete scope under its dispatch record. Never replay work that is already
  correct.
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
