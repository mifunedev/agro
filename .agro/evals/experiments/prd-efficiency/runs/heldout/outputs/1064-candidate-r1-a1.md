# PRD: Supervisor monitor observation

Status: DRAFT

## User Stories

### US-001: Require MonitorCreate for supervisor observation

**Description:** As a supervisor, I want bounded monitors for observation so that no recurring loop polls advisors.

**Acceptance Criteria:**

- [ ] Duty 3 in `.agro/skills/supervisor/SKILL.md` requires MonitorCreate for each observation and each readiness wait.
- [ ] Each monitor example in Duty 3 runs a bounded command, such as `herdr agent wait <pane> --status idle --timeout <ms>`, and names the completion callback.
- [ ] Duty 3 states the recovery rule for a timeout and for a nonzero exit: read the pane, then create at most one new monitor, then escalate to the operator.
- [ ] `.agro/skills/supervisor/SKILL.md` prohibits LoopCreate for supervision.
- [ ] Duty 2 keeps the target check that runs before every downward send.

### US-002: Clear inherited supervisor destinations

**Description:** As an operator, I want advisors to send no Herdr messages upward so that the supervisor pane receives no reverse messages.

**Acceptance Criteria:**

- [ ] The Duty 1 tab-create example in `.agro/skills/supervisor/SKILL.md` passes `--env AGRO_SUPERVISOR_PANE=` with an empty value.
- [ ] `.agro/skills/supervisor/SKILL.md` prohibits Herdr messages from an advisor or a worker to the supervisor pane.
- [ ] Duty 5 states that the advisor reports progress and blockers through pane output, `progress.txt`, and `prd.json`.
- [ ] Duty 5 states that the supervisor alone runs /escalate to reach the operator.
- [ ] The Destinations section of `.agro/skills/escalate/SKILL.md` no longer tells a supervisor to start an advisor with `AGRO_SUPERVISOR_PANE=<pane>`.
- [ ] `git grep -n 'AGRO_SUPERVISOR_PANE=w7' -- .agro/skills` prints no line.

### US-003: Guard the contract with a probe

**Description:** As a maintainer, I want a probe for the supervisor contract so that a regression fails the eval suite.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/supervisor-monitor-contract.sh` exits 0 on the updated skill.
- [ ] The probe exits 1 when the MonitorCreate requirement, the LoopCreate prohibition, or the empty `AGRO_SUPERVISOR_PANE` value is removed.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] `bash .agro/evals/probes/skill-paths.sh` exits 0.

## Summary

The supervisor skill tells the supervisor to poll with `herdr agent wait` and `herdr pane read`. The skill names no MonitorCreate requirement and no LoopCreate prohibition. Duty 1 starts each advisor tab with `AGRO_SUPERVISOR_PANE` set to the supervisor pane. Duty 5 routes advisor escalations to the supervisor pane through /escalate. The /escalate Destinations section repeats that launch pattern.

The selected approach edits two skill documents and adds one probe. The supervisor observes through bounded MonitorCreate commands. The advisor tab receives an empty `AGRO_SUPERVISOR_PANE`, so `escalate.sh` skips the supervisor destination at line 67. The advisor reports through output and artifacts. The supervisor keeps downward steering and operator escalation.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Duty 1, Duty 3, Duty 5, poll order | Supervisor contract |
| `.agro/skills/escalate/SKILL.md` | Destinations section | Supervisor destination resolution |
| `.agro/skills/escalate/scripts/escalate.sh` | `supervisor` resolution at line 67 | Skips the supervisor destination on an empty value; no change |
| new file `.agro/evals/probes/supervisor-monitor-contract.sh` | probe body | Regression oracle |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| /supervisor skill | Modified | Monitor requirement, loop prohibition, cleared destination |
| /escalate skill | Modified | Destinations section drops the advisor launch pattern |
| Eval probe suite | Added | One new probe |

## Storage

N/A. The change edits documents and adds one stateless probe.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` owns the observation policy. `.agro/skills/escalate/SKILL.md` refers to that policy and repeats no rule.
- Messages flow downward only. The supervisor sends to the advisor. The advisor writes artifacts that the supervisor reads.
- The supervisor owns operator escalation through /escalate.
- Edit the canonical `.agro/skills/` sources only. Do not edit a provider mirror.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/supervisor-monitor-contract.sh` | MonitorCreate requirement, LoopCreate prohibition, empty `AGRO_SUPERVISOR_PANE`, reverse-message prohibition | US-001, US-002 |
| `.agro/evals/probes/escalate-contract.sh` | existing cases | /escalate contract stays green |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing cases | Supervisor destination stays optional |
| `.agro/evals/probes/skill-paths.sh` | existing cases | Skill paths resolve |
| `.agro/evals/probes/ste-checker-contract.sh` | existing cases | STE checker stays sound |

Write the new probe first. Confirm that the probe exits 1 on the base commit.

## Design Principles

- Apply the smallest change that makes the message direction explicit.
- Keep one source of truth for the supervisor policy.
- Add no explanatory comments to the probe.
- Make every monitor bounded and recoverable after a terminal disconnect.

## Out of Scope

- The unrelated concurrent addition to the Failure modes section of `.agro/skills/supervisor/SKILL.md`.
- Removal of the supervisor destination from `.agro/skills/escalate/scripts/escalate.sh`.
- Changes to Herdr, to the cron runtime, or to the Slack gateway.
- Public documentation in mifunedev/agro-web.

## Open Questions

1. The provider link check command is `<link check command>`. Confirm whether `.agro/scripts/link-providers.sh` accepts a check mode.
2. The "command checks" in the issue name no command. Confirm `<command check>`.
3. Confirm whether the supervisor destination in `.agro/skills/escalate/scripts/escalate.sh` stays, or whether a later task deletes the destination.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `<link check command>` exits 0, and each provider skill symlink resolves.
- [ ] `<command check>` exits 0.
- [ ] The diff adds no new entry to the Failure modes section of `.agro/skills/supervisor/SKILL.md`.

## Lessons

Filled by the advisor before undraft.
