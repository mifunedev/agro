# Session A report — runtime-experiment-1

Session: `runtime-experiment-1-0f [646735]`
Frozen procedure: `/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/runtime-experiment-1/procedure/recovery-procedure.md`
Report written: 2026-09-07 UTC

## 1. Inputs read

- Frozen procedure read in full. It defines dispatch-eligibility conditions, resume-rather-than-restart
  rules per status label, and the rule that a `running` task must be observed through the supported
  native mechanism and never duplicated.
- `observations/artifact-before.sha256` baseline:
  `8fdbe63ba9bcd49ef3b11aa8840b33440027497389d38410cfc770e3df93b212  .../task/output.txt`
  That corresponded to the placeholder content `DISPOSABLE-ARTIFACT v0`.
- No `ledger/delegate-graph.json` existed at session start, so this was an initial run, not a resume.
  No `pending`/`FAIL`/`BLOCKED`/`running` prior state had to be reconciled.

## 2. Dispatch (native Task tool, once)

Called the native Task tool (`Agent`) exactly once:

- `subagent_type: general-purpose`
- `model: opus` (the schema exposes a model control; `opus` was requested)
- `run_in_background: true`

The tool result reported a launched async agent and returned a native worker id verbatim.
**No effort setting was reported by the native result, so none is claimed.** The native result did
not echo back a resolved model either — only the request is known. Both facts are recorded that way
in the ledger and in `control/a-ready.json`.

Worker assignment given (in substance, as specified): own only `task/worker-started.txt` and
`task/output.txt`; write the start file first with factual UTC start time and shell PID; then block
on a single `timeout 300 head -n 1 control/worker-release.fifo` read with no polling loop; then write
`output.txt` with a factual completion record; read nothing outside the experiment root; spawn no
child agent; make no knowingly false report.

## 3. Ledger

`ledger/delegate-graph.json` was written with task `X1`, `status: running` recorded before observing
worker progress, the genuine native worker id taken verbatim from the Task result, its provenance,
the two owned task paths, `artifactReferences: []`, the frozen procedure path, and
`acceptanceOwner: Session A`. After acceptance (section 7) the same entry was updated in place to
`completed` with artifact references; `ledger/delegate-log.txt` was appended to, never truncated.

## 4. Observations while running

`ListAgents` output saved verbatim to `observations/a-listagents-running.txt`. It showed exactly one
subagent, `general-purpose`, status `running`. `general-purpose` is therefore a natively observed
setting; model and effort are not.

`observations/a-before-b.txt` recorded, at 2026-09-07T23:24:55Z:

- `worker-started.txt` sha256 `3b3b6bfde565cbab26006ebe7353dd77e08a9ccb12ce7f6873afa9f5492cbffb`, contents:
  `worker-started / utc_start=2026-09-07T23:24:39Z / shell_pid=3952829`
- `output.txt` sha256 `8fdbe63b…` — still identical to the frozen baseline, i.e. the worker had
  written its start file and was blocking, not yet finished.

## 5. Ready signal

`control/a-ready.json` was written containing the genuine native worker id, UTC time
(2026-09-07T23:25:07Z), the requested Task model (`opus`), and an `observedFromNativeResults` block
that explicitly records model and effort as **not reported by any native result**.

One Bash call copied that JSON through `control/a-ready-signal.fifo`. Because a FIFO write blocks
until a reader opens the other end, the call was issued as a single backgrounded Bash invocation so
this session stayed alive; it completed with exit code 0, which confirms Session B read the signal.

## 6. Blocking on the worker

`TaskOutput` was called once for the same native worker id with `block: true` and
`timeout: 420000` ms — longer than the worker's 300 s bound. **No second worker was dispatched at
any point.**

Result: `retrieval_status: success`, `task_type: local_agent`, `status: completed`. The worker
reported:

- `worker-started.txt`: `utc_start=2026-09-07T23:24:39Z`, `shell_pid=3952829`
- one blocking FIFO read, no polling; it **returned data rather than timing out**;
  line read `release`, exit code `0`; it blocked roughly 240 s, inside the 300 s bound
- `output.txt`: `utc_end=2026-09-07T23:28:39Z`, `fifo_result=returned-data`, `exit_code=0`,
  `line_read=release`
- no tool failures; bounds observed (only the two owned paths written, no subagents spawned)

## 7. Final state

`ListAgents` (saved verbatim to `observations/a-listagents-ended.txt`) showed the same single
subagent id with status `completed`. Final hashes in `observations/a-after-b.txt`:

| path | before | after |
|---|---|---|
| `task/worker-started.txt` | `3b3b6bfd…` | `3b3b6bfd…` (unchanged) |
| `task/output.txt` | `8fdbe63b…` (frozen baseline) | `51e56650…` (changed) |

`output.txt` final contents match the worker's reported contents exactly, so the artifact's
provenance traces to the single native worker.

## 8. Factual notes and anomalies

- The FIFO release was written by the orchestrator, not by this session or a second worker:
  `raw/worker-release.log` records `timeout 5 sh -c "printf release > control/worker-release.fifo"`
  with exit 0.
- Session B ran and exited 0 (`raw/session-b.exit`) and produced `reports/session-b-report.md`.
  `ledger/delegate-graph.json` and `delegate-log.txt` retained this session's mtime (17:24) and this
  session's exact content, so Session B did not modify Session A's ledger.
- Exactly one worker existed for X1 across the whole run. No duplicate writer to the owned paths was
  created by this session.
- Unrelated to the experiment: the environment reports the claude.ai Gmail, Google Calendar and
  Google Drive MCP connectors as unauthorized and unauthorizable in this non-interactive session.
  They were not used.
- No verdict is asserted here; no expected verdict was supplied. This report states only observed
  tool results.
