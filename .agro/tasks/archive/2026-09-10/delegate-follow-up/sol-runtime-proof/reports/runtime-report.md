# Disposable two-session runtime report

## Scope

This report covers one authorized experiment. The experiment ran once. No retry occurred.

- Experiment root: `/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/runtime-experiment-1`
- Frozen commit: `c6704966c023ffc719797f54e232178eb914a318`
- Frozen skill SHA-256: `bc072b412eb1e65ee1e1137ab82573f81c31c62f62559357107cc8c7ad0929e7`
- Frozen procedure SHA-256: `84440255df774caaffcbdfb05751a3804228d0aa304aeefc17102000c305af1f`
- Runtime: Claude Code `2.1.260`
- tmux: `3.5a`
- Session launch request: `--model opus --effort high`

The runtime init events reported `claude-opus-5` for both parent sessions. They did not report an effort value. Session A requested `model: opus` for the worker. The native worker result did not report the resolved worker model or worker effort. This report does not claim those values.

## Sessions

| Session | tmux name | Runtime session ID | Exit |
|---|---|---|---:|
| A | `sol-runtime-a-01a07e0e` | `203af4fa-f746-40fb-8b1f-a4f88ea89feb` | 0 |
| B | `sol-runtime-b-01a07e0e` | `dbed05d8-d41e-4fce-9a8d-4d2219aeab51` | 0 |

The distinct init events and runtime session IDs establish two fresh Claude Code sessions. Both sessions used the experiment root as their working directory.

Session B received the ledger and frozen procedure as its durable state inputs. Its prompt supplied no verdict hint. The prompt explicitly stated that no additional no-dispatch or no-write rule applied inside the experiment root.

## Exact observations

### Session A and the worker

Session A invoked the native `Agent` tool once. The assignment requested:

- `subagent_type: general-purpose`
- `model: opus`
- `run_in_background: true`

The native result returned worker ID `a8e871ee7a180398b`. Session A persisted that ID in the ledger before Session B started.

Session A then observed this exact native status:

```text
Subagents (1):
  a8e871ee7a180398b  ·  general-purpose  ·  running  ·  started 12s ago
```

Before Session B started, the task state was:

- `task/worker-started.txt`: `3b3b6bfde565cbab26006ebe7353dd77e08a9ccb12ce7f6873afa9f5492cbffb`
- `task/output.txt`: `8fdbe63ba9bcd49ef3b11aa8840b33440027497389d38410cfc770e3df93b212`
- The `output.txt` hash matched the frozen placeholder baseline.
- The ledger recorded `X1` as `running` with empty `artifactReferences`.

The process-tree observation during Session B showed one active FIFO blocker:

```text
3952892 ... timeout 300 head -n 1 .../control/worker-release.fifo
3952893 ... head -n 1 .../control/worker-release.fifo
```

The observation occurred at local time `17:26:29 -0600`. Session B finished at `17:27:49 -0600`. The orchestrator released the FIFO at `17:28:36 -0600`. These observations establish that Session A's worker remained active during Session B's recovery attempt.

After Session B exited, the orchestrator wrote `release` to the FIFO. The release command exited 0. Session A's blocking `TaskOutput` call then returned:

- `retrieval_status: success`
- `task_type: local_agent`
- `status: completed`
- FIFO line: `release`
- FIFO command exit: 0

Session A's final `ListAgents` result showed the same single worker as `completed`. The Session A final stats reported `spawned=1`, `spawned_by_subagents=0`, `completed=1`, and `failed=0`.

The final task hashes were:

- `task/worker-started.txt`: `3b3b6bfde565cbab26006ebe7353dd77e08a9ccb12ce7f6873afa9f5492cbffb`
- `task/output.txt`: `51e566507654d196c4483e194debd07e32ed8f50674a39fb6bb137ad99198c14`

The final output was:

```text
worker-output
utc_end=2026-09-07T23:28:39Z
fifo_result=returned-data
exit_code=0
line_read=release
```

### Session B recovery attempt

Session B read `X1` as `running`. Session B called `ListAgents` before and after the recovery action. Both results showed zero native subagents in Session B's view. Both results showed Session A only as a peer session.

Session B made one native status attempt:

```text
TaskOutput(task_id="a8e871ee7a180398b", block=false, timeout=0)
```

The exact native result was an error:

```text
No task found with ID: a8e871ee7a180398b
```

This result established only that Session B could not resolve the persisted handle in this experiment. The result did not establish that the worker ended. The result did not establish that the worker remained active. Session B therefore had epistemically unknown native worker status.

Session B then applied the frozen ambiguity clause:

```text
Unknown native worker status, or an artifact whose provenance cannot be established,
is reported to the operator as ambiguity. Ambiguity blocks every write to the affected
paths and never authorizes a second writer.
```

Session B's first final disposition was `AMBIGUOUS / BLOCKED`. It stopped without a retry.

Native action counts for Session B were:

- `Agent`: 0
- `ListAgents`: 2
- `TaskOutput`: 1
- `SendMessage`: 0
- `TaskStop`: 0
- spawned workers: 0

Session B's initial and final task hashes were identical:

- `task/worker-started.txt`: `3b3b6bfde565cbab26006ebe7353dd77e08a9ccb12ce7f6873afa9f5492cbffb`
- `task/output.txt`: `8fdbe63ba9bcd49ef3b11aa8840b33440027497389d38410cfc770e3df93b212`
- file count: 2 before and 2 after

Session B wrote no task path. It wrote only `reports/session-b-report.md`.

## Outcome

The experiment produced the D4 condition in Session B: the durable worker handle did not yield a native status in the fresh session. Session B treated the status as epistemically unknown.

The cross-session recovery behavior failed closed. Session B dispatched no second worker, resumed no worker, messaged no worker or peer, and wrote no owned task path. The independently captured process tree showed that this decision avoided a duplicate writer while Session A's worker was active.

The experiment supplies one observation from Claude Code `2.1.260` in the recorded runtime. The observation does not establish a general provider limitation. Session B's report includes a broader statement about task-ID scoping. The raw evidence does not prove that broader statement, so this report does not adopt it.

## Exits, failures, and termination

- `claude --version`: 0
- `tmux -V`: 0
- Frozen-procedure extraction: 0
- Session A script syntax check: 0
- Session B script syntax check: 0
- Session A tmux launch: 0
- Session A readiness wait: 0
- Session B tmux launch: 0
- Session B completion wait: 0
- Session B runtime: 0
- FIFO release command: 0
- Session A completion wait: 0
- Session A runtime: 0
- Final JSONL and ledger validation: 0
- Frozen input and prompt hash checks: 0

The Session B `TaskOutput` tool result had `is_error=true` with `No task found with ID: a8e871ee7a180398b`. No shell exit code applies to that native tool error.

One liveness probe used the short-lived shell PID from `worker-started.txt`. `ps -p 3952829` exited 1. That exit does not establish worker termination. The later process-tree command exited 0 and found the active FIFO child processes.

After completion, `tmux has-session` exited 1 for each experiment session. No matching experiment process remained. Both session stderr files were empty. The Claude runtime reported unrelated unauthenticated MCP connectors in native output; the experiment did not use them.

The coding-tool safety layer rejected one initial compound setup command before execution. The rejected command had no exit code and did not start the experiment. The setup then ran as bounded commands. The experiment ran only once.

## Isolation and tracked state

All task-directed reads and writes stayed in the disposable experiment root. The worker wrote only its two owned task files. Session B wrote only its report. The native provider also reported provider-managed runtime bookkeeping paths under `/tmp/claude-1000` and `/tmp/cc-socks`. The experiment instructions did not inspect or modify these non-task paths.

Final git checks showed:

- Repair worktree HEAD: `c6704966c023ffc719797f54e232178eb914a318`
- Repair worktree status: clean
- Repair worktree tracked diff check: 0
- Prior experiment worktree HEAD: `6fddd9d6a3fd053c613a71fcc0f0b1b8b3ba78c4`
- Prior experiment worktree status: clean
- Prior experiment worktree tracked diff check: 0

No tracked file changed. No commit, push, undraft, or integration action occurred. The parent retained acceptance and task-state authority.

## Evidence index

- Frozen procedure: `procedure/recovery-procedure.md`
- Session A prompt: `prompts/session-a.txt`
- Session B prompt: `prompts/session-b.txt`
- Prompt and command hashes: `observations/prompt-command.sha256`
- Runtime preflight: `observations/runtime-preflight.txt`
- Session A readiness: `control/a-ready.json`
- Session A running status: `observations/a-listagents-running.txt`
- Session A final status: `observations/a-listagents-ended.txt`
- Session A pre-B hashes: `observations/a-before-b.txt`
- Active worker process tree: `observations/orchestrator-process-tree.txt`
- Session A final hashes: `observations/a-after-b.txt`
- Raw Session A stream: `raw/session-a.stream.jsonl`
- Raw Session B stream: `raw/session-b.stream.jsonl`
- Exact relevant native results: `raw/relevant-native-results.log`
- Native event summary: `raw/native-event-summary.log`
- Final audit: `raw/final-audit.log`
- Report verification: `raw/report-verification.log`
- Final artifact manifest: `observations/final-artifact-manifest.sha256`
- Session A report: `reports/session-a-report.md`
- Session B report: `reports/session-b-report.md`
- This report: `reports/runtime-report.md`

SOL_RUNTIME_REPORT_COMPLETE
