# PRD: Supervisor observes through MonitorCreate

Status: DRAFT

## User Stories

### US-001: Rewrite supervisor observation around MonitorCreate

**Description:** As a supervisor, I want monitor callbacks for observation so that no advisor messages me back.

**Acceptance Criteria:**

- [ ] `.agro/skills/supervisor/SKILL.md` requires MonitorCreate for each observation wait and each readiness wait in Duty 1 and Duty 3.
- [ ] Each MonitorCreate example in `.agro/skills/supervisor/SKILL.md` runs a bounded command with a stated timeout.
- [ ] Each MonitorCreate example states the completion callback and the recovery rule for a timeout or a failed command.
- [ ] `.agro/skills/supervisor/SKILL.md` prohibits LoopCreate for supervision.
- [ ] `.agro/skills/supervisor/SKILL.md` prohibits a Herdr message from an advisor or a worker to the supervisor pane.
- [ ] The tab-creation example in Duty 1 clears `AGRO_SUPERVISOR_PANE` for the advisor tab and sets no supervisor pane id.
- [ ] Duty 5 states that the advisor reports progress and blockers through pane output and task artifacts, and that the supervisor alone runs /escalate to the operator.
- [ ] The guarded downward send in Duty 2 and failure mode 8 keeps the `Message @` check unchanged.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0.

### US-002: Guard the supervisor contract with a probe

**Description:** As an operator, I want a probe on the supervisor contract so that a regression fails the eval suite.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/supervisor-monitor-contract.sh` exists and follows the PASS, REGRESSION, and SKIPPED states of the other probes.
- [ ] The probe fails when `.agro/skills/supervisor/SKILL.md` omits MonitorCreate, omits the LoopCreate prohibition, or sets `AGRO_SUPERVISOR_PANE` to a pane id.
- [ ] The probe exits with the REGRESSION state against the base commit and with PASS after US-001.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` and `bash .agro/evals/probes/escalate-destination-fan-out.sh` pass.
- [ ] The provider link check in `.agro/scripts/link-providers.sh` reports no broken link.

## Summary

The supervisor skill tells the supervisor to block on `herdr agent wait` in Duty 1 and Duty 3. Duty 1 also sets `AGRO_SUPERVISOR_PANE` on the advisor tab. `/escalate` reads that variable, so an advisor and each inherited worker can send a Herdr message back into the supervisor pane. Duty 5 describes that reverse route as normal.

This task makes MonitorCreate the only observation and readiness mechanism. Each monitor runs a bounded command, fires a completion callback, and has a recovery rule. The skill prohibits LoopCreate and each reverse Herdr message. The advisor tab clears the supervisor destination. The advisor reports through pane output, `progress.txt`, and `prd.json`. The supervisor keeps the guarded downward send and owns the operator escalation.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Duty 1, lines 60-95 | Tab creation with `AGRO_SUPERVISOR_PANE` and the readiness wait |
| `.agro/skills/supervisor/SKILL.md` | Duty 3, lines 189-222 | Observation through `herdr agent wait` |
| `.agro/skills/supervisor/SKILL.md` | Duty 5, lines 258-279 | Advisor escalation to the supervisor pane |
| `.agro/skills/escalate/SKILL.md` | Line 73 | Guidance that sets `AGRO_SUPERVISOR_PANE` at agent start |
| `.agro/skills/escalate/scripts/escalate.sh` | `AGRO_SUPERVISOR_PANE` fallback, line 67 | Resolves the supervisor destination; stays unchanged |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Line 76 | Requires the `AGRO_SUPERVISOR_PANE` default in the script |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| /supervisor skill | Modify | MonitorCreate observation, LoopCreate prohibition, cleared destination |
| /escalate skill prose | Modify | Line 73 stops the advice to set a supervisor pane on an advisor |
| Probe suite | Add | New file `.agro/evals/probes/supervisor-monitor-contract.sh` |

## Storage

N/A. The change edits skill prose and adds one probe. No state persists.

## Architectural Decisions

- The supervisor skill owns the observation contract. /herdr keeps the command catalog.
- Information flows downward only. The supervisor reads the advisor pane and the task artifacts. The advisor never writes to the supervisor pane.
- The supervisor owns the operator channel through /escalate.
- `escalate.sh` keeps the `AGRO_SUPERVISOR_PANE` fallback, because the supervisor pane can still receive a flag-directed delivery.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| New file `.agro/evals/probes/supervisor-monitor-contract.sh` | MonitorCreate present; LoopCreate prohibited; no pane id on `AGRO_SUPERVISOR_PANE` | US-001 contract |
| `.agro/evals/probes/escalate-contract.sh` | Existing cases | The /escalate contract stays intact |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Existing cases | The script fallback stays intact |
| `.agro/evals/probes/ste-checker-contract.sh` | Existing cases | The STE checker stays intact |

## Design Principles

- Keep one source of truth for each rule. Point at /herdr and /escalate instead of restating them.
- Add no comments to tracked code.
- Make every wait bounded and restartable from another machine.

## Out of Scope

- The unrelated concurrent failure-mode addition to `.agro/skills/supervisor/SKILL.md`.
- A change to the `escalate.sh` delivery order or exit codes.
- A change to /delegate worker dispatch.
- Public documentation in mifunedev/agro-web.

## Open Questions

1. Does `herdr tab create --env AGRO_SUPERVISOR_PANE=` clear the variable, or does the example need another form? The implementer confirms the form in the sandbox.
2. Which command runs the provider link check? Use `<provider link check command>` until the operator names the flag for `.agro/scripts/link-providers.sh`.
3. The issue names "command checks". Which command runs them? Use `<command check>` until the operator names it.
4. Does `.agro/evals/probes/escalate-contract.sh` require the line 73 text in `.agro/skills/escalate/SKILL.md`? If yes, the implementer updates the probe with the prose.

## Acceptance Criteria

- [ ] Each US-001 and US-002 criterion passes.
- [ ] `git diff` on the task branch shows no change to `.agro/skills/escalate/scripts/escalate.sh`.
- [ ] `git diff` on the task branch adds no new failure-mode entry to `.agro/skills/supervisor/SKILL.md`.
- [ ] `<command check>` exits 0.

## Lessons

Filled by the advisor before undraft.
