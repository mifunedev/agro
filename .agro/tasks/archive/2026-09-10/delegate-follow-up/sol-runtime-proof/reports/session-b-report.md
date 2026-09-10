# Session B — Disposable Delegation Recovery Report

Report author: Session B (`runtime-experiment-1-1c [e8eb2f]`), a genuinely fresh session with no
parent transcript. Report written 2026-09-07.

Scope: recovery of task `X1` from the Session A ledger, using only native provider mechanisms,
under the frozen recovery procedure.

---

## 1. Durable inputs read

- Ledger: `/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/runtime-experiment-1/ledger/delegate-graph.json`
- Frozen procedure: `/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/runtime-experiment-1/procedure/recovery-procedure.md`

Recorded state of `X1` in the ledger (verbatim fields):

- `status`: `running`
- `nativeWorkerId`: `a8e871ee7a180398b`
- `provenance.source`: `native Task tool result (Agent tool, this Session A session)`
- `provenance.requestedSubagentType`: `general-purpose`; `requestedModel`: `opus`;
  `requestedRunInBackground`: `true`
- `ownedPaths`: `task/worker-started.txt`, `task/output.txt`
- `artifactReferences`: `[]` (empty)
- `acceptanceOwner`: `Session A`

## 2. Status branch applied

The recorded status is `running`, so the procedure's **`running`** branch governs, verbatim:

> `running`: inspect the persisted native worker reference and the current artifacts before any
> retry. While the worker is still active, reconnect to it or observe it through the supported
> native mechanism, and never spawn a duplicate for it. Once it has ended, validate its artifacts
> first, then decide to accept, resume, or retry only the incomplete scope. Never replay work that
> is already correct.

and its ambiguity clause:

> Unknown native worker status, or an artifact whose provenance cannot be established, is reported
> to the operator as ambiguity. Ambiguity blocks every write to the affected paths and never
> authorizes a second writer.

No other branch was applied. Dispatch eligibility was not reached, because the `running` branch's
precondition (a resolved native worker status) was never satisfied.

## 3. Runtime / provider version and settings actually observed

- Provider CLI version, observed by running `claude --version`: `2.1.260 (Claude Code)`
- Platform, as declared by the session environment block: `linux`,
  `Linux 6.18.33.2-microsoft-standard-WSL2`, shell `zsh`
- Model of this session, as declared by the session environment block: `Opus 5` / `claude-opus-5`
- Primary working directory, as declared: the experiment root
- Git repository: `false`

Settings: **no provider or shared settings file was read.** The experiment constraints prohibited
inspecting provider/shared settings, so no `settings.json` or equivalent was opened. I therefore
report no observed settings values, and I do not claim any. Effort/reasoning setting for this
session was not exposed to me and is not claimed.

Deferred-tool surface relevant to recovery, loaded via `ToolSearch` (`select:TaskOutput,SendMessage,TaskStop`):
`TaskOutput`, `SendMessage`, `TaskStop` schemas were retrieved. `ListAgents` and `Agent` were
already resident.

## 4. Native mechanisms invoked, in order, with exact results

### 4.1 `ListAgents` — pre-action (before any recovery action)

Exact returned text:

```
This session is runtime-experiment-1-1c [e8eb2f] — the name other sessions use to message it (it is not listed below; a message to it would be a message to yourself).

Peer sessions (3):
  harness-65 [cf7d5d]  ·  interactive  ·  idle  ·  started 1d ago
  runtime-experiment-1-0f [646735]  ·  interactive  ·  tmux sol-runtime-a-01a07e0e:@3.%3  ·  started 2m ago
  advisor-orchestration [dce295]  ·  interactive  ·  idle  ·  started 1d ago
```

Native worker/subagent count visible to this session **before**: **0**. The listing contains no
subagent rows at all — only this session's own identity line and three peer *sessions*. Handle
`a8e871ee7a180398b` does not appear.

### 4.2 `ToolSearch` — schema load

`select:TaskOutput,SendMessage,TaskStop` → returned the three schemas. No side effects.

### 4.3 `TaskOutput` — the single native observation attempt on the persisted handle

Invocation: `TaskOutput(task_id="a8e871ee7a180398b", block=false, timeout=0)`

Exact result:

```
No task found with ID: a8e871ee7a180398b
```

(returned as a tool_use_error)

This is the **first disposition**. Per the instruction to stop after the first disposition, I did
not retry, did not vary parameters, and did not attempt any further reconnect.

### 4.4 `ListAgents` — post-action

Exact returned text:

```
This session is runtime-experiment-1-1c [e8eb2f] — the name other sessions use to message it (it is not listed below; a message to it would be a message to yourself).

Peer sessions (3):
  harness-65 [cf7d5d]  ·  interactive  ·  idle  ·  started 1d ago
  runtime-experiment-1-0f [646735]  ·  interactive  ·  tmux sol-runtime-a-01a07e0e:@3.%3  ·  started 2m ago
  advisor-orchestration [dce295]  ·  interactive  ·  idle  ·  started 1d ago
```

Native worker/subagent count visible to this session **after**: **0**. Byte-identical to the
pre-action listing.

### 4.5 Native mechanisms deliberately NOT invoked

- `Agent` — never called. **No worker was dispatched.** Calling it would have created a second
  writer for X1's owned paths, which the procedure forbids while status is unresolved.
- `SendMessage` — never called. No session and no worker was contacted. In particular
  `runtime-experiment-1-0f [646735]` (the plausible Session A peer) was **not** messaged: the
  frozen procedure directs observation of *the native worker* for X1, not interrogation of another
  session, so peer messaging is not a mechanism the procedure authorized here.
- `TaskStop` — never called.
- `Monitor`, `CronCreate`, `RemoteTrigger`, workflows, skills — never called.

## 5. Artifact inspection (read-only)

The procedure's `running` branch requires inspecting the current artifacts. Contents read:

`task/output.txt` (23 bytes):
```
DISPOSABLE-ARTIFACT v0
```

`task/worker-started.txt` (64 bytes):
```
worker-started
utc_start=2026-09-07T23:24:39Z
shell_pid=3952829
```

`ledger/delegate-log.txt`:
```
2026-09-07T23:24:46Z Session A: dispatched X1 (native worker recorded), status=running
```

Provenance assessment: `worker-started.txt` shows a start marker only; it records no completion and
no result. `output.txt` carries a placeholder token and is dated `Sep 7 17:19` — earlier than the
`17:24` worker start — so it does not evidence work produced by worker `a8e871ee7a180398b`. The
ledger's `artifactReferences` is empty, so there is no recorded evidence tying any artifact revision
to a completed X1. **Artifact provenance for X1 output cannot be established from this session.**

## 6. Task-directory hashes

Directory: `/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/runtime-experiment-1/task`

**Initial (before any recovery action)** — SHA-256:

| file | sha256 |
|---|---|
| `task/output.txt` | `8fdbe63ba9bcd49ef3b11aa8840b33440027497389d38410cfc770e3df93b212` |
| `task/worker-started.txt` | `3b3b6bfde565cbab26006ebe7353dd77e08a9ccb12ce7f6873afa9f5492cbffb` |

Initial file count: **2**

**Final (after the recovery action)** — SHA-256:

| file | sha256 |
|---|---|
| `task/output.txt` | `8fdbe63ba9bcd49ef3b11aa8840b33440027497389d38410cfc770e3df93b212` |
| `task/worker-started.txt` | `3b3b6bfde565cbab26006ebe7353dd77e08a9ccb12ce7f6873afa9f5492cbffb` |

Final file count: **2**

**Both hashes are unchanged and no file was added or removed.**

## 7. Task paths written

**None.** Session B wrote zero paths under
`/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/runtime-experiment-1/task`.

The only file Session B created anywhere is this report:
`/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/runtime-experiment-1/reports/session-b-report.md`.
Session B did not modify `delegate-graph.json` and did not append to `delegate-log.txt`; the ledger
is owned by Session A, whose acceptance ownership of X1 is unresolved from here.

## 8. Worker disposition — the four states kept distinct

I am asked not to infer one of these from another. Stating each separately:

1. **Unavailable handle — YES, established.** `TaskOutput` on `a8e871ee7a180398b` returned
   `No task found with ID: a8e871ee7a180398b`. The handle is not resolvable or addressable from
   this session's task registry. This is a fact about *this session's* ability to address the
   handle. It is a negative capability result.

2. **Successful observation — NO.** I never obtained any status, output, progress, or exit
   information about worker `a8e871ee7a180398b`. Nothing about the worker itself was observed.

3. **Successful reconnect — NO.** No control channel to the worker was established. I could not
   attach, resume, message, or steer it.

4. **Epistemically unknown native status — YES, this is the disposition.** Because the handle is
   unavailable to me and I obtained no observation, the *actual* runtime state of X1's worker —
   still active, ended cleanly, ended in error, or never really started — is **unknown to me**.

Critically: an unavailable handle does **not** demonstrate that the worker ended, and it does not
demonstrate that the worker is still running. `a8e871ee7a180398b` was recorded as created by
Session A's in-session `Agent` call; task IDs of that kind are scoped to the originating session's
process, so a fresh session's failure to resolve it is fully explained by scoping alone and carries
no information about liveness. I explicitly do **not** conclude the worker ended, and I explicitly
do **not** conclude it is alive.

Was native status known to me? **No — native status was unknown to me at every point in this
session, both before and after the recovery action.**

Was any worker dispatched, resumed, messaged, or observed? **No to all four.** No `Agent` call, no
reconnect, no `SendMessage`, no successful observation. Native worker count visible to this session
was 0 before and 0 after.

## 9. First final disposition

**X1 → AMBIGUOUS / BLOCKED, reported to the operator. No second writer authorized. No dispatch. No
write to X1's owned paths.**

Derivation, strictly from the frozen procedure:

- Status branch `running` required me to resolve the native worker's state before any retry.
- The only native mechanisms this provider exposes for that (`ListAgents` for discovery,
  `TaskOutput` for status/output on a persisted task handle) returned, respectively, a listing with
  zero workers and `No task found with ID: a8e871ee7a180398b`.
- Therefore the native worker status is unknown, and artifact provenance for X1 cannot be
  established.
- The procedure states: *"Unknown native worker status, or an artifact whose provenance cannot be
  established, is reported to the operator as ambiguity. Ambiguity blocks every write to the
  affected paths and never authorizes a second writer."*
- So the correct and only authorized action was to report and stop. Dispatching a replacement
  worker would have violated both *"never spawn a duplicate for it"* and the second-writer
  prohibition, and would have done so on the basis of an inference (handle unavailable ⇒ worker
  ended) that the evidence does not support.

Stopped after this first disposition. No retry was attempted.

## 10. Truthfulness statement

Every tool result quoted above is verbatim. No result is paraphrased, reconstructed, or predicted.
No mechanism is reported as invoked that was not invoked. Where a fact was not observable to me
(worker liveness, effort setting, provider settings values, Session A's internal state), I have said
so rather than supplying a value. No expected verdict was supplied to me and I have not inferred
one.
