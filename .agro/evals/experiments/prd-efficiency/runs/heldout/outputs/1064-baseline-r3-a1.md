# PRD: supervisor monitor-only observation

Status: BLOCKED

Issue: `work/issue-1064.md` (issue #1064)

## User Stories

### US-001: Observe advisors through bounded monitors

**Description:** As a supervisor, I want each observation and readiness wait inside a bounded `MonitorCreate` command so that no poll loop drives supervision.

**Acceptance Criteria:**

- [ ] `.agro/skills/supervisor/SKILL.md` Duty 1 wraps the readiness wait `herdr agent wait <pane> --status idle --timeout 90000` in a `MonitorCreate` call that carries `onDone`.
- [ ] `.agro/skills/supervisor/SKILL.md` Duty 3 wraps the observation wait `herdr agent wait <pane> --status idle --timeout 900000` in a `MonitorCreate` call that carries `onDone`.
- [ ] Each `MonitorCreate` example in `.agro/skills/supervisor/SKILL.md` runs a command with an explicit `--timeout` value.
- [ ] `.agro/skills/supervisor/SKILL.md` states a recovery rule for each of three monitor outcomes: the wait times out, the monitor command exits non-zero, and the pane no longer exists.
- [ ] `.agro/skills/supervisor/SKILL.md` prohibits `LoopCreate` for supervision.
- [ ] `grep -c 'LoopCreate' .agro/skills/supervisor/SKILL.md` prints a count of 1 or more, and each match sits in a prohibition sentence.
- [ ] `grep -nE 'while .*sleep|sleep [0-9]' .agro/skills/supervisor/SKILL.md` prints no line.

### US-002: Report advisor progress through output and artifacts

**Description:** As a supervisor, I want advisors to report progress through pane output and task artifacts so that no process messages the supervisor pane.

**Acceptance Criteria:**

- [ ] `.agro/skills/supervisor/SKILL.md` names the progress channels: the pane output read with `herdr pane read`, the commit log, the `passes` flags in `prd.json`, `progress.txt`, and `evidence.md`.
- [ ] `.agro/skills/supervisor/SKILL.md` prohibits an advisor and a worker from sending any Herdr message to the supervisor pane.
- [ ] `.agro/skills/supervisor/SKILL.md` Duty 5 states that an advisor records a blocker in `evidence.md` and stops, and that the supervisor reads the blocker through the monitor `onDone` result.
- [ ] Brief template step 4 in `.agro/skills/supervisor/SKILL.md` tells the advisor to record each escalation trigger in `evidence.md`, not to send a message.
- [ ] `.agro/skills/supervisor/SKILL.md` keeps the guarded downward send: the `Message @` check before every `herdr agent send` stays in Duty 2.
- [ ] `.agro/skills/supervisor/SKILL.md` keeps the supervisor as the only caller of `/escalate` for an advisor blocker that needs the operator.

### US-003: Clear inherited supervisor destinations

**Description:** As a supervisor, I want each advisor tab to start with no supervisor destination so that no advisor or worker inherits a route back.

**Acceptance Criteria:**

- [ ] The `herdr tab create` example in `.agro/skills/supervisor/SKILL.md` Duty 1 passes `--env AGRO_SUPERVISOR_PANE=` with an empty value.
- [ ] `grep -nE 'AGRO_SUPERVISOR_PANE=[^ ]' .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` prints no line.
- [ ] `.agro/skills/escalate/scripts/escalate.sh` resolves the supervisor target from `--supervisor` alone and reads no `AGRO_SUPERVISOR_PANE` value.
- [ ] With `AGRO_SUPERVISOR_PANE=w1:p1` in the environment and no `--supervisor` flag, `escalate.sh` stdout carries no `destinations.supervisor` entry.
- [ ] `.agro/skills/escalate/SKILL.md` removes the `herdr agent start ... --env AGRO_SUPERVISOR_PANE=<pane>` block and states that only a supervisor passes `--supervisor`.
- [ ] `.agro/evals/probes/escalate-destination-fan-out.sh` asserts the case in the fourth criterion and no longer requires the string `AGRO_SUPERVISOR_PANE` in `escalate.sh`.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.

## Summary

Verified current state:

- `.agro/skills/supervisor/SKILL.md:69-71` creates the advisor tab with `--env AGRO_SUPERVISOR_PANE=w7:p1`. `.agro/skills/supervisor/SKILL.md:73-74` states that `/escalate` reads that variable. Every process in the advisor tab inherits the variable, and each worker inherits it too.
- `.agro/skills/escalate/scripts/escalate.sh:67` falls back to `AGRO_SUPERVISOR_PANE` when `--supervisor` is empty. `.agro/skills/escalate/scripts/escalate.sh:134-136` then runs `herdr agent send` and `herdr pane send-keys` against the supervisor pane. This path is the reverse Herdr message that issue #1064 prohibits.
- `.agro/skills/supervisor/SKILL.md:95` and `.agro/skills/supervisor/SKILL.md:197` run `herdr agent wait` directly in the supervisor shell. No `MonitorCreate` wraps either wait.
- `.agro/skills/supervisor/SKILL.md:270-279` routes an advisor escalation to the supervisor pane first.
- `.agro/skills/fanout/SKILL.md:119-138` already prefers `MonitorCreate` over recurring `LoopCreate` polling. `docs/harnesses/pi.md:74-92` documents both tools from `@trevonistrevon/pi-loop`.
- `.agro/evals/probes/escalate-destination-fan-out.sh:76` requires the string `AGRO_SUPERVISOR_PANE` in `escalate.sh`.

Selected approach:

1. Rewrite Duty 1 and Duty 3 of the supervisor skill. Each wait runs as a bounded `MonitorCreate` command with an `onDone` callback. The skill states one recovery rule per monitor outcome.
2. Make information flow one way. The supervisor steers down through the guarded two-step send. The advisor reports up only through pane output and task artifacts. The supervisor alone calls `/escalate` for the operator.
3. Start each advisor tab with an empty `AGRO_SUPERVISOR_PANE`. Remove the environment fallback from `escalate.sh`, so that an inherited value opens no reverse route.

Recovery rules to write into Duty 3:

| Monitor outcome | Supervisor action |
|---|---|
| The wait times out | Read the pane once with `herdr pane read <pane> --source recent --lines 120`. Read the three artifacts. Start one new monitor with the same timeout. After a second consecutive timeout on the same story, escalate to the operator. |
| The monitor command exits non-zero | Run `herdr agent list`. If the Herdr server answers, start one new monitor. If the Herdr server does not answer, escalate to the operator. |
| The pane no longer exists | Record the loss in `evidence.md`. Escalate to the operator. Do not restart the advisor without the operator. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Duty 1, Duty 2 brief template step 4, Duty 3, Duty 5, role table | Canonical supervision procedure. Receives the monitor rule, the one-way flow, and the cleared environment. |
| `.agro/skills/escalate/scripts/escalate.sh` | line 67 supervisor fallback, `usage()` `--supervisor` text | Removes the `AGRO_SUPERVISOR_PANE` fallback. |
| `.agro/skills/escalate/SKILL.md` | Destinations table, `herdr agent start` block, Resolution list | Documents `--supervisor` as the only supervisor-target source. |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | line 76 grep, new environment case | Guards the removed fallback. |
| `CHANGELOG.md` | Unreleased entry | Records the contract change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `escalate.sh` environment | Removal | `AGRO_SUPERVISOR_PANE` no longer selects a supervisor destination. |
| `escalate.sh --supervisor` | Unchanged | The flag still selects the supervisor destination. |
| `/supervisor` procedure | Behavior change | Waits run inside `MonitorCreate`. The skill prohibits `LoopCreate`. Advisors send no upward Herdr message. |
| Provider mirrors under `.claude/skills` | Unchanged | `.claude/skills` is a symlink to `../.agro/skills`. The edit lands in the canonical source only. |

## Storage

N/A. The task adds no persistent state. The advisor reuses the existing artifacts: `prd.json`, `progress.txt`, `evidence.md`, and the commit log.

## Architectural Decisions

- **Source of truth:** `.agro/skills/supervisor/SKILL.md` owns supervision behavior. `.agro/skills/escalate/SKILL.md` and `escalate.sh` own the delivery contract. `/herdr` keeps the pane command catalog.
- **Direction of flow:** The supervisor sends down. The advisor writes artifacts. No process below the supervisor sends a Herdr message up.
- **Scoping:** An advisor inherits no supervisor pane id. Only a caller that passes `--supervisor` explicitly reaches a pane through `/escalate`.
- **Operator channel:** The supervisor owns the call to `/escalate` for the operator. The Slack destination in `escalate.sh` stays unchanged.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-destination-fan-out.sh` | `AGRO_SUPERVISOR_PANE=probe:nosuchpane` set, no `--supervisor`: stdout has no `destinations.supervisor` entry | US-003 fallback removal. Write the environment case first. The environment case fails against the current `escalate.sh:67`. |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing cases with explicit `--supervisor` | `--supervisor` still delivers the per-destination outcome. |
| `.agro/evals/probes/escalate-contract.sh` | existing cases | The Slack no-op contract stays unchanged. |
| `.agro/skills/ste/scripts/ste-check.sh` | `.agro/skills/supervisor/SKILL.md`, `.agro/skills/escalate/SKILL.md` | Prose passes STE. |
| `.agro/scripts/link-providers.sh --check` | full run | Provider links resolve. |
| `<command-check command>` | each `herdr` and `MonitorCreate` invocation in the changed skills | Each cited command and flag exists. |

## Design Principles

- Keep one source of truth per policy. Point at `/herdr`, `/escalate`, and `/delegate`. Restate none of them.
- Bound every wait with an explicit timeout and an explicit recovery rule.
- Keep persistent observation off the attached shell. A monitor callback survives the supervisor turn.
- Make the flow direction obvious: steering goes down, evidence goes to files.
- Change the canonical `.agro/` source only. Patch no provider mirror.
- Add no comment to tracked code.

## Out of Scope

- The unrelated concurrent failure-mode addition to `.agro/skills/supervisor/SKILL.md`. This task adds no new entry to the Failure modes list.
- Changes to `.agro/skills/fanout/SKILL.md` and `.agro/skills/builder/references/command.md`.
- Changes to the Slack destination, the quiet window, or the log format in `escalate.sh`.
- Changes to the `@trevonistrevon/pi-loop` package or its pin in `.pi/settings.json`.
- Public documentation in `mifunedev/agro-web`. The supervisor skill has no public page. Open question 3 confirms this.

## Open Questions

1. The Claude Code harness exposes a `Monitor` tool, not `MonitorCreate`. Does the supervisor skill name `Monitor` as the Claude Code equivalent, or does the skill require a Pi supervisor? This plan assumes the skill names both tools.
2. What is the exact command for "command checks"? The plan uses the placeholder `<command-check command>`.
3. Does `mifunedev/agro-web` document `AGRO_SUPERVISOR_PANE` or the `/escalate` supervisor destination? If a page does, the task needs a matching change.
4. The acceptance text excludes "the unrelated concurrent failure-mode addition". The current working tree holds no uncommitted change to `.agro/skills/supervisor/SKILL.md`. Which branch or pull request carries that addition, so the implementation owner can avoid a merge conflict with it?
5. Does US-003 keep the `--supervisor` flag in `escalate.sh`? This plan keeps the flag for a supervisor that escalates to another supervisor-owned pane. The alternative removes the supervisor destination entirely.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `<command-check command>` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/ste-checker-contract.sh` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] The diff adds no entry to the Failure modes list in `.agro/skills/supervisor/SKILL.md`.
- [ ] `CHANGELOG.md` carries one entry for the change.

## Lessons

Filled by the advisor before undraft.
