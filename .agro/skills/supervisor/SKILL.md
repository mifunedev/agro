---
name: supervisor
description: |
  Supervise advisor sessions from outside them. Require MonitorCreate with onDone for all advisor observation and readiness waits, status checks, and output reads. Require MonitorList and MonitorStop for handle control. Never use LoopCreate or polling. Use inline Herdr commands for launch and guarded downward steering only. Block reverse Herdr messages from advisors and workers. Do not write or review code. Own context budgets and operator escalation.
  TRIGGER when: asked to supervise, babysit, watch, or drive an agent in another pane; asked to "run this build in a second pane and keep it on track"; asked to own a long build to its Definition of Done from outside the implementing session; an advisor needs a brief, a compaction decision, or an escalation route; asked "what is the advisor doing" or "is the advisor still on the contract".
  Do NOT trigger when the active session implements the work; when the request asks for a code review; when the request asks to dispatch bounded workers inside one session (use /delegate); or when the request asks to run a single `herdr` command (use /herdr).
allowed-tools: Bash, Read, Grep, MonitorCreate, MonitorList, MonitorStop
---

# Supervisor

The supervisor owns one or more advisor sessions in other Herdr panes. Each
advisor owns one contract and one Definition of Done. The supervisor stays
accountable for every owned advisor reaching that Definition of Done.

## Role boundary

Read the role boundary before any procedure.

- The supervisor writes no application code.
- The supervisor reviews no code.
- The supervisor changes no file the advisor owns.
- The supervisor stays accountable for the advisor reaching its Definition of
  Done.
- Require `MonitorCreate`, `MonitorList`, and `MonitorStop` before launching or
  claiming supervision. If any tool is unavailable, stop and report the blocker.
- Use `MonitorCreate` with `onDone` for all advisor observation, readiness waits,
  status checks, output reads, and progress or evidence reads.
- Never call `LoopCreate`, including event variants. Never use a recurring
  scheduler, shell polling, sleep loops, or a blocking Bash wait fallback.
- Use inline Herdr commands only for launch and guarded downward steering.
  Short launch, working-directory, and send-target checks can use Bash as action
  prerequisites. These checks are not a monitoring fallback.
  Run all Herdr observation commands through `MonitorCreate`.
- Advisors and workers must not send Herdr messages back to the supervisor.
  This ban includes direct sends, `/escalate --supervisor`, inherited destinations,
  and relays. Workers report to the advisor through native worker output only.
  Advisors report through normal output and own existing progress/evidence files.
- The supervisor owns operator escalation. Advisors and workers must not bypass
  the supervisor through Slack or invoke `/escalate` to notify the supervisor.

Three behaviors carry three jobs. Keep the three apart. Each name below is a
behavior, not an identity, a model, or a terminal.

| Behavior | Owns | Never does |
|---|---|---|
| supervisor | The brief, bounded monitors, the context budget, the escalation | Implementation, code review |
| advisor | One contract, judgment, verification, acceptance | Silent scope change |
| worker | One bounded implementation assignment from its advisor | Judgment, acceptance |

`/delegate` owns the worker boundary and the fan-out policy. Read `/delegate`
for worker limits and model policy. Restate neither here.

`/spec` owns the build loop the advisor runs. `/prd` and `/plan` own the
contract documents. `/herdr` owns the full pane command catalog. `/escalate`
owns the operator channel. `/ste` owns the prose of every artifact.

## Duty 1 — start an advisor session

Start the advisor in a new tab in the supervisor's own workspace, at the harness
root, in bypass permissions mode. Three conditions hold together.

- **A new tab, never a split pane.** A split divides the supervisor's own tab
  and shrinks both. `herdr agent start` splits by default, so create the tab
  first and launch the harness inside it.
- **The harness root.** A tab that opens in a project clone puts the advisor
  below the sandbox boundary, where the advisor edits application code outside
  its worktree.
- **Bypass permissions.** An advisor runs unattended. A manual permission prompt
  blocks the advisor on a person who is not watching, and the run stalls with no
  signal to the supervisor.
- **Tab names.** Prefix every created tab with its purpose. Use an `agent-*` name
  for an agent tab. Use a `dev-*` name for a development environment tab. Put
  the prefix in the tab name or label.

Read the supervisor's own pane id and workspace first.

```bash
herdr pane current | jq -r '.result.pane.pane_id, .result.pane.workspace_id'
```

Create the tab in that workspace.

```bash
herdr tab create --workspace w7 --cwd /home/sandbox/harness \
  --env AGRO_SUPERVISOR_PANE= --label agent-advisor-1 --no-focus
```

Clear the inherited supervisor destination in the tab environment.

Confirm the resolved working directory before you launch the harness.

```bash
herdr pane get w7:p4 | jq -r '.result.pane.cwd, .result.pane.foreground_cwd'
```

The creation payload reports the requested `--cwd`. The creation payload proves
no resolved working directory. Only `herdr pane get <pane>` reports the pane
state the shell resolved.

Launch the coding harness in bypass permissions mode. Use the same sanitized
command on every restart.

```bash
herdr pane run w7:p4 "env -u AGRO_SUPERVISOR_PANE claude --dangerously-skip-permissions"
```

Submit this finite readiness command through `MonitorCreate`, not inline Bash.
Record its handle as Duty 3 requires. Inspect the mode before briefing.

```json
{
  "command": "bash -c 'set +e; herdr agent wait w7:p4 --status idle --timeout 90000; wait_rc=$?; herdr agent list; list_rc=$?; herdr pane read w7:p4 --source recent --lines 5; read_rc=$?; printf \"\\nwait_rc=%s\\nlist_rc=%s\\nread_rc=%s\\n\" \"$wait_rc\" \"$list_rc\" \"$read_rc\"; exit \"$wait_rc\"'",
  "description": "advisor-1 readiness at w7:p4",
  "timeout": 120000,
  "onDone": "Reconcile this monitor ID with advisor-1 at w7:p4. Check wait_rc, list_rc, read_rc, and required status/output under Duty 3. On any snapshot failure or missing required output, do not brief, steer, or re-arm; report a blocker. A timeout remains an inspection checkpoint. Verify root and bypass mode before the first brief. Startup idle is not brief completion. Do not retry or relaunch automatically."
}
```

The status line reports the mode in this shape:

```text
bypass permissions on (shift+tab to cycle)
```

If fresh output does not confirm bypass mode, do not brief the advisor.
If the output confirms manual mode, close the owned tab and start again with
the sanitized launch command. Apply Duty 3 to observation failures.

Name the agent last, so `herdr agent list` reports the advisor by its role.

```bash
herdr agent rename w7:p4 advisor-1
```

Read `/herdr` for every other pane command.

## Duty 2 — brief the advisor

A brief points at the contract. A brief copies no contract. The contract sits
on disk, and a restated PRD spends the context the supervisor exists to
protect.

### The brief template

1. Name the contract file and the exact section. Example: `plan.md`, section
   Definition of Done, D1 through D11.
2. Name the route file and its story range. Example: `prd.md`, US-001 through
   US-016.
3. Define done: the named command ran, the expected result appeared, and the
   output landed in `evidence.md` under its D-ID.
4. Name the escalation triggers from Duty 5.
5. List every criterion the run already meets.
6. State every fact the advisor cannot read from a file. Example: the database
   URI the sandbox needs differs from the default line in `.env.example`.
7. Name the role: the advisor assigns tracked edits to bounded workers, and the
   advisor keeps judgment and acceptance.
8. Include the communication boundary below. Require the advisor to pass this
   boundary to every worker.

### The verb selects the role

A brief that says "implement" produces an implementer. A first brief that said
"implement, gates green, commit" named no orchestration, so the advisor wrote
every file itself through two stories. Write step 7 in these words instead:

```text
You are the advisor. Assign every tracked edit to a bounded worker through
/delegate. Keep goal interpretation, verification, and acceptance. Run each
gate command yourself.

You and your workers must not send Herdr messages back to the supervisor.
Do not use direct sends, /escalate --supervisor, AGRO_SUPERVISOR_PANE,
other inherited destinations, or relays. Do not invoke /escalate to notify
this supervisor. Do not bypass the supervisor through Slack.
Workers report to you through native worker output only. You own the existing
progress/evidence files and report progress, blockers, and decisions there
and in your normal output. Required decisions remain blocked until supervisor
direction. The supervisor owns operator escalation.
```

`/delegate` owns the worker count, the wave policy, and the model policy. Name
none of those numbers in the brief.

### Send the brief in two steps

`herdr agent send` writes literal text into the pane. `herdr agent send`
submits nothing. Send the text, then submit with a separate call.

```bash
herdr agent send w6:p7 "$(cat /tmp/brief.txt)"
herdr pane send-keys w6:p7 Enter
```

`herdr pane run <pane> <command>` sends command text plus Enter. Use
`herdr pane run` against a shell. Use the two-step send against a running
agent. A message that arrives while the advisor works queues and runs on the
advisor's next turn.

### Confirm the prompt targets the advisor before every send

An advisor that dispatches workers can leave its own prompt addressed to a
worker. The prompt then reads `Message @general-purpose…` instead of the
default placeholder, and `herdr agent send` delivers into the worker channel.
The worker receives supervisor text its dispatcher never sent, acts on it, and
reports work the advisor cannot account for.

Check the prompt before every send, not only the first.

```bash
if visible=$(herdr pane read <pane> --source visible) && [[ -n ${visible//[[:space:]]/} ]]; then
  printf '%s\n' "$visible" | grep -c 'Message @'
else
  printf '%s\n' 'Visible-pane read failed or empty; do not send.' >&2
  false
fi
```

Require a successful visible-pane read with the current prompt present.
A failed read, empty output, or missing prompt forbids sending, even if partial
output looks valid. Only then interpret the count: `0` targets the advisor;
a positive count targets a worker. `grep -c` exits `1` for a zero count;
that exit does not prove the read succeeded. For a positive count, press `Left`
to leave the agent selector. Repeat the guarded check before sending.

Never send to an advisor pane without this check. A misrouted brief is
indistinguishable, from the advisor's side, from a worker that invented its own
instructions.

## Duty 3 — monitor

Never attach. `herdr agent attach` takes over the operator's client.
Submit observation commands through `MonitorCreate`; never run observation inline.
Keep one active monitor per advisor, including readiness and artifact reads.
Record the monitor ID, advisor pane ID, contract path, and expected wait state
in the supervisor's run record.

For a working advisor, submit this `MonitorCreate` call. Substitute the owned
pane and contract before submission.

```json
{
  "command": "bash -c 'set +e; herdr agent wait w6:p7 --status idle --timeout 900000; wait_rc=$?; herdr agent list; list_rc=$?; herdr pane read w6:p7 --source recent --lines 120; read_rc=$?; printf \"\\nwait_rc=%s\\nlist_rc=%s\\nread_rc=%s\\n\" \"$wait_rc\" \"$list_rc\" \"$read_rc\"; exit \"$wait_rc\"'",
  "description": "advisor at w6:p7: bounded idle wait",
  "timeout": 930000,
  "onDone": "Reconcile this monitor ID, pane w6:p7, and the recorded contract. Check wait_rc, list_rc, read_rc, and required status/output under Duty 3. On any snapshot failure or missing required output, do not brief, steer, or re-arm; report a blocker. A timeout remains an inspection checkpoint. Review fresh artifacts. Judge completion, context, and blockers. Re-arm only after judgment if unfinished and unblocked; otherwise stop. Never infer Definition of Done from idle or the wait exit."
}
```

The Herdr wait blocks server-side for at most 900000 milliseconds. The monitor
allows 30000 additional milliseconds for snapshots. The command attempts both
snapshots even after a nonzero wait exit and preserves the real wait exit.
Both readiness and working commands print `wait_rc`, `list_rc`, and `read_rc`
after all three commands return. The final exit always equals `wait_rc`, even
when a snapshot exits nonzero. Check all three labels, not just the final exit.
If either snapshot exits nonzero, do not brief, steer, or re-arm. Report a blocker
even if partial output looks valid. Missing labels or required status/output
also block these actions. A monitor timeout can interrupt the command before
labels appear; never treat absent labels as zero.
`herdr pane read` returns plain text. `herdr agent list` returns JSON.
`onDone` can internally schedule a completion wake. Never add a separate
`LoopCreate` call or claim monitor persistence beyond the `MonitorCreate` contract.

### Choose the next observation

1. After the brief or another downward send, first wait for `working` through
   a bounded monitor. Startup `idle` does not mean the brief completed.
2. If the advisor is working, use the bounded `idle` wait above.
3. If the advisor is already idle, inspect output and artifacts once. Decide
   whether to accept, stop, or steer. After steering, wait for `working` first.
   Never repeatedly arm an `idle` wait against an idle advisor.
4. Treat a timeout as an inspection checkpoint. Read fresh output and artifacts
   through a finite monitor. A fast transition can finish before detection;
   never resend the brief automatically because detection missed a transition.
5. On snapshot failure, missing required output, connection errors, malformed
   output, unknown state, or a missing pane, report a blocker.
   Do not brief, steer, or re-arm. Do not relaunch automatically.
6. Re-arm only after judging fresh evidence and finding unfinished, unblocked
   work. Stop monitoring after acceptance, cancellation, or an operator blocker.

An idle state, a successful wait, or a timeout proves no Definition of Done.
Review three signals from monitor output together:

- `agent_status` from `herdr agent list`;
- the context percentage in the status line;
- the last screen from `herdr pane read`.

The status line carries the percentage in this shape:

```text
[<model>] 15% context | <branch>
```

Read existing artifacts through finite monitors, not inline observation tools.
Use read-only commands such as `git log`, `jq`, and `cat` against the advisor's
worktree and recorded contract paths. Inspect the commit log for edit ownership,
`prd.json` for `passes` flags, and `progress.txt` for the advisor's narrative.
Read the contract's existing evidence artifact for criterion results. Judge role
fidelity and completion from these artifacts, not from pane claims. Review no code.

### Reconcile handles and resume

Use `MonitorList` before creating or replacing a monitor. Match each handle to
its recorded pane and contract. Use `MonitorStop` to stop duplicate or obsolete
handles before creating a replacement. Stop remaining handles at terminal states.

On a late callback, compare its monitor ID with the current record. Ignore stale
callbacks for steering and re-arming. After a supervisor restart, reconcile
`MonitorList` with the record. Keep a matching active monitor and review its
output when it completes. Then inspect fresh artifacts through a finite monitor.
If no matching monitor exists, inspect the pane and artifacts through one finite
monitor before deciding the next wait. Never duplicate a launch because a monitor
handle is missing. Herdr session persistence does not prove monitor persistence.

An announcement interrupt costs more than the announcement delivers. A file on
disk needs no message. Point at the file at the next seam.

## Duty 4 — own the context budget

The supervisor decides when the advisor compacts.

| Context | Supervisor action |
|---|---|
| Below 50% | Take no action |
| 50% to 70% | Watch for the next story boundary |
| 70% to 80% | Direct a compaction at the first clean seam |
| Above 85% | Direct a compaction at the next safe stop, and tell the operator |

A clean seam holds four conditions at once:

1. The advisor committed the current story.
2. The gates report green.
3. No half-written edit remains open.
4. No worker still runs.

Direct the compaction with an explicit carry-forward. The carry-forward names
six items:

- the contract path;
- the current story and its criteria;
- the invariants;
- the decisions since the last compaction;
- the open deviations;
- the communication boundary: workers report to advisors through native worker
  output only. Advisors own progress/evidence files and report there and in normal
  output. Both roles must not use reverse Herdr sends, `/escalate --supervisor`,
  inherited destinations, relays, or a Slack bypass. Required decisions remain
  blocked until supervisor direction. The supervisor owns operator escalation.

The compaction drops tool output and file dumps. Re-anchor the advisor
afterward by pointing at the files. A file read costs less than a file dump
that survived the compaction.

Durable state belongs in files. An advisor that appends `progress.txt` and
`evidence.md` once per story loses little to a compaction.

## Duty 5 — escalate

Escalate on three triggers:

1. A blocked prerequisite.
2. A decision outside the contract.
3. A criterion that fails twice.

Quote the pane output the escalation rests on. Never report an agent state
without the `herdr agent list` output or the `herdr pane read` output behind
the claim.

The supervisor reads blockers in advisor output and existing artifacts through
monitors. Prohibit reverse Herdr notifications. Answer within the contract
through guarded downward steering. If the decision needs the operator, keep the
advisor blocked. Ask in the supervisor's own session when the operator reads it.
Otherwise, the supervisor uses the sanitized Slack-only escalation command:

```bash
env -u AGRO_SUPERVISOR_PANE bash .agro/skills/escalate/scripts/escalate.sh \
  --summary "<blocker>" --needs "<operator decision>" \
  --tried "<attempts and results>" --key "<stable-blocker-key>"
```

Do not pass `--supervisor`. Advisors and workers must not send this escalation
or use Slack as a bypass. This restriction belongs to the supervisor workflow;
other callers retain the general `/escalate` contract.

Check actual Slack delivery in `.destinations.slack.ok` and read the reason.
Exit 0 alone proves no delivery. On a no-op or failure, preserve the blocker and
delivery evidence in the supervisor's run record and surface it to the operator.
Keep the advisor blocked until direction arrives. Read `/escalate` for flags,
exit codes, deduplication, and delivery evidence.

## Supervise more than one advisor

Each advisor owns one branch and one worktree. Two advisors never share one
checkout, because a branch switch in a shared checkout destroys the other
advisor's uncommitted work. `/worktrees` owns the worktree layout.

Cap one supervisor at **three advisors**. Keep one active monitor per advisor.
If multiple monitors complete, review their results in this priority order:

1. Any advisor with `agent_status` of `blocked`.
2. Any advisor above 85% context.
3. Any advisor idle at a story boundary.
4. Any advisor above 70% context.
5. The advisor whose evidence has waited longest for review.

A supervisor supervises no supervisor. The chain ends at the operator.

## Failure modes

Each entry names a symptom, a cause, and a correction.

**1. A brief that says "implement" produces an implementer.**
Symptom: the advisor wrote every tracked file itself through two stories.
Cause: the first brief said "implement, gates green, commit" and named no
orchestration. Correction: the brief states that the advisor assigns tracked
edits to bounded workers and keeps judgment and acceptance. The correction cost
one story of discarded work.

**2. A child tab starts below the harness root.**
Symptom: a tab opened in the project clone put the advisor below the sandbox
boundary. Cause: the creation payload reported the requested `--cwd`, and the
shell resolved a different directory. Correction: run `herdr pane get <pane>`
after creation and read the resolved `cwd`.

**3. An interrupt for an announcement costs more than the announcement
delivers.**
Symptom: a mid-turn message queued and displaced the advisor's next action.
Cause: the supervisor announced a file the advisor could read. Correction:
write the file, then point at the file at the next seam.

**4. A task contract without `prd.json` records no completion.**
Symptom: the run reached story four with no machine-readable completion state.
Cause: the task folder carried `prd.md` alone. Correction: generate `prd.json`
with `/ralph` when the PRD lands.

**5. `herdr agent send` types text without submitting.**
Symptom: the brief sat unsent in the advisor's prompt. Cause: `agent send`
writes literal text. Correction: send the text, then send
`herdr pane send-keys <pane> Enter`.

**6. An advisor in manual permission mode blocks with no signal.**
Symptom: the advisor sat at a permission prompt and reported `idle`, so the
supervisor read the status as progress. Cause: the harness launched without
bypass permissions. Correction: launch with
`env -u AGRO_SUPERVISOR_PANE claude --dangerously-skip-permissions`, and read
`bypass permissions on` through the readiness monitor before the brief.

**7. `herdr agent start` splits the supervisor's own tab.**
Symptom: the advisor landed as a pane inside the supervisor's tab and halved
the supervisor's own view. Cause: `herdr agent start` splits by default.
Correction: create the tab with `herdr tab create --workspace <id>`, then launch
the harness in it with `herdr pane run`.

**8. A send to an advisor pane reaches the advisor's worker.**
Symptom: the advisor escalated that a bounded worker had edited a tracked file
on instructions its dispatcher never sent, and suspected the worker of
confabulating an operator reply. Cause: the supervisor ran `herdr agent send`
while the advisor's prompt targeted `@general-purpose`, so Herdr delivered the
supervisor's escalation reply into the worker channel. The worker acted
faithfully on real instructions that reached it through no legitimate route.
Correction: require a successful visible-pane read with the current prompt
before interpreting the `Message @` count. Failed or missing reads forbid sends.
Clear the agent selector with `Left` and repeat the guarded check before sending.
Tell the advisor when the provenance surfaces. If the advisor cannot source an instruction, the advisor
must revert the work and stop.

**9. A reverse message can remain in the supervisor's input.**
Symptom: the supervisor sees no actionable completion notice. Cause: reverse
Herdr text enters an input buffer instead of a monitor completion callback.
Correction: prohibit advisor and worker reverse sends. Read their output and
artifacts through monitors; keep operator escalation with the supervisor.

## What the first run got right

- The advisor repaired a worker's gaps with the same worker, not a fresh one.
- The advisor ran the gate commands itself, and trusted no worker summary.
- The supervisor caught the delegation gap at story two, not at story ten.

## Composition

`/supervisor` composes and forks nothing.

| Skill | Owns |
|---|---|
| `/delegate` | Fan-out policy, worker limits, model policy |
| `/spec` | The build loop the advisor runs |
| `/prd` and `/plan` | The contract documents |
| `/herdr` | The pane command catalog |
| `/escalate` | The operator channel |
| `/worktrees` | The worktree layout |
| `/ste` | The prose of every artifact |

Read the owning skill before restating any rule from the table.
