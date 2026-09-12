---
name: supervisor
description: |
  Own an advisor session that runs in another Herdr pane, without writing code
  and without reviewing code. Start the advisor at the harness root, brief the
  advisor with a pointer to the contract, monitor progress from artifacts, own
  the advisor's context budget, and carry a blocker to the operator.
  TRIGGER when: asked to supervise, babysit, watch, or drive an agent in
  another pane; asked to "run this build in a second pane and keep it on
  track"; asked to own a long build to its Definition of Done from outside the
  implementing session; an advisor session needs a brief, a compaction
  decision, or an escalation route; asked "what is the advisor doing" or "is
  the advisor still on the contract".
  Do NOT trigger when the active session implements the work itself, when the
  request asks for a code review, when the request asks to dispatch bounded
  workers inside one session (use /delegate), or when the request asks to run
  a single `herdr` command (use /herdr).
allowed-tools: Bash, Read, Grep
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

Three actors carry three jobs. Keep the three apart.

| Actor | Owns | Never does |
|---|---|---|
| Supervisor | The brief, the monitoring loop, the context budget, the escalation | Implementation, code review |
| Advisor | One contract, judgment, verification, acceptance | Silent scope change |
| Worker | One bounded implementation assignment from its advisor | Judgment, acceptance |

`/delegate` owns the worker boundary and the fan-out policy. Read `/delegate`
for worker limits and model policy. Restate neither here.

`/spec` owns the build loop the advisor runs. `/prd` and `/plan` own the
contract documents. `/herdr` owns the full pane command catalog. `/escalate`
owns the operator channel. `/ste` owns the prose of every artifact.

## Duty 1 — start an advisor session

Start the advisor at the harness root. A tab that opens in a project clone puts
the advisor below the sandbox boundary, where the advisor edits application
code outside its worktree.

Read the supervisor's own pane id first.

```bash
herdr pane current | jq -r '.result.pane.pane_id'
```

Start the advisor with the harness root and the supervisor pane in its
environment.

```bash
herdr agent start advisor-1 \
  --cwd /home/sandbox/harness \
  --env AGRO_SUPERVISOR_PANE=w6:p5 \
  --no-focus -- claude
```

`AGRO_SUPERVISOR_PANE` names the supervisor's own pane. `/escalate` reads that
variable, so the advisor resolves its supervisor without a flag.

A tab carries the same two options when the advisor needs its own tab.

```bash
herdr tab create --cwd /home/sandbox/harness \
  --env AGRO_SUPERVISOR_PANE=w6:p5 --label advisor-1 --no-focus
```

Confirm the resolved working directory after creation.

```bash
herdr pane get w6:p7 | jq -r '.result.pane.cwd, .result.pane.foreground_cwd'
```

The creation payload reports the requested `--cwd`. The creation payload proves
no resolved working directory. Only `herdr pane get <pane>` reports the pane
state the shell resolved. Read `/herdr` for every other pane command.

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

### The verb selects the role

A brief that says "implement" produces an implementer. A first brief that said
"implement, gates green, commit" named no orchestration, so the advisor wrote
every file itself through two stories. Write step 7 in these words instead:

```text
You are the advisor. Assign every tracked edit to a bounded worker through
/delegate. Keep goal interpretation, verification, and acceptance. Run each
gate command yourself.
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

## Duty 3 — monitor

Read the pane. Never attach. `herdr agent attach` takes over the operator's
client.

```bash
herdr agent list | jq -r '.result.agents[] | "\(.pane_id)\t\(.agent_status)"'
herdr pane read w6:p7 --source recent --lines 120
herdr agent wait w6:p7 --status idle --timeout 900000
```

`herdr pane read` returns plain text. Every other group returns one JSON line.

Read three signals in one look:

1. `agent_status` from `herdr agent list`.
2. The context percentage in the status line.
3. The last screen from `herdr pane read`.

The status line carries the percentage in this shape:

```text
[<model>] 15% context | <branch>
```

Judge role fidelity from artifacts, not from the pane's claims. Read three
artifacts:

- the commit log, which shows who wrote each tracked edit;
- the `passes` flags in `prd.json`, which record criterion completion;
- `progress.txt`, which records the advisor's own narrative.

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
five items:

- the contract path;
- the current story and its criteria;
- the invariants;
- the decisions since the last compaction;
- the open deviations.

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

An advisor escalation arrives at the supervisor first. The supervisor holds the
contract and the run history, so the supervisor answers most advisor questions
without a person. When the operator reads the supervisor's own session, ask the
operator there and skip the channel.

`/escalate` delivers to the supervisor pane first and sends the Slack
notification second. The Slack notification no-ops when no channel exists. On a
no-op the operator returns to the session to decide, so record the blocker in
`evidence.md`. Read `/escalate` for the flags, the exit codes, and the
destination contract. Repeat no gateway detail here.

## Supervise more than one advisor

Each advisor owns one branch and one worktree. Two advisors never share one
checkout, because a branch switch in a shared checkout destroys the other
advisor's uncommitted work. `/worktrees` owns the worktree layout.

Cap one supervisor at **three advisors**. One poll cycle costs the supervisor a
120-line pane read plus three artifact reads per advisor. At four advisors the
supervisor fills its own context before the slowest advisor reaches its first
seam, and a supervisor that compacts mid-run loses the run history the
escalations rest on.

Poll in this order, and stop at the first advisor that ranks:

1. Any advisor with `agent_status` of `blocked`.
2. Any advisor above 85% context.
3. Any advisor idle at a story boundary.
4. Any advisor above 70% context.
5. The advisor with the oldest last read.

A supervisor supervises no supervisor. The chain ends at the operator.

## Failure modes

Five failures came out of the first supervised run. Each entry names the
symptom, the cause, and the correction.

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
