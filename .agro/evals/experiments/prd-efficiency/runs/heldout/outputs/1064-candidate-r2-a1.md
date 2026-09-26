# PRD: Supervisor monitor observation

Status: DRAFT

## User Stories

### US-001: Observe advisors with bounded monitors

**Description:** As a supervisor, I want bounded monitors so that I observe advisors without a polling loop.

**Acceptance Criteria:**

- [ ] `.agro/skills/supervisor/SKILL.md` Duty 1 and Duty 3 name `MonitorCreate` as the required tool for the readiness wait and for observation.
- [ ] Each `MonitorCreate` example wraps a `herdr agent wait` command with an explicit `--timeout` value and sets an `onDone` callback.
- [ ] The skill states one recovery rule for a monitor that times out or exits non-zero: read the pane, then create one new monitor or escalate to the operator.
- [ ] The skill prohibits `LoopCreate` for supervisor observation.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0.

### US-002: Remove the reverse message channel

**Description:** As an operator, I want advisors to report through artifacts so that no session messages its supervisor.

**Acceptance Criteria:**

- [ ] The Duty 1 `herdr tab create` example clears `AGRO_SUPERVISOR_PANE` and sets no pane id for the variable.
- [ ] The skill prohibits `herdr agent send` and /escalate delivery from an advisor or a worker to the supervisor pane.
- [ ] Duty 5 states that the advisor reports progress and blockers in its pane output and in `progress.txt`, `prd.json`, and the commit log.
- [ ] Duty 5 states that the supervisor alone runs /escalate to the operator.
- [ ] Duty 2 keeps the two-step downward send and the target check before every send.
- [ ] The `herdr agent start` example in `.agro/skills/escalate/SKILL.md` sets no supervisor pane for an advisor.
- [ ] The "Failure modes" section of `.agro/skills/supervisor/SKILL.md` has no new entry.

### US-003: Guard the contract with a probe

**Description:** As a maintainer, I want a regression probe so that the monitor contract stays enforced.

**Acceptance Criteria:**

- [ ] New file `.agro/evals/probes/supervisor-monitor-contract.sh` exits 0 on the updated skill.
- [ ] The probe exits non-zero when `MonitorCreate` is absent from the skill, when the skill permits `LoopCreate`, or when a tab example sets `AGRO_SUPERVISOR_PANE` to a pane id.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] The advisor runs /eval, and `.agro/evals/RESULTS.md` reports PASS for the new probe.

## Summary

The supervisor skill waits with `herdr agent wait` in the attached session and polls advisors in a cycle. Duty 1 passes `AGRO_SUPERVISOR_PANE` to each advisor tab. /escalate then delivers advisor escalations to the supervisor pane through `herdr agent send`. That path is a reverse Herdr message. This plan makes `MonitorCreate` the observation tool and prohibits `LoopCreate`. The plan clears the inherited supervisor destination, and advisors report through output and artifacts. The supervisor keeps downward steering and owns operator escalation. `.agro/skills/fanout/SKILL.md` already uses the `MonitorCreate` pattern with `onDone`. This plan follows that pattern.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Duty 1, Duty 3, Duty 5, "Supervise more than one advisor" | Canonical supervisor contract |
| `.agro/skills/escalate/SKILL.md` | "Destinations", `herdr agent start` example | Documents the supervisor destination |
| `.agro/skills/escalate/scripts/escalate.sh` | `AGRO_SUPERVISOR_PANE` fallback | Reads the inherited destination; no change planned |
| `.agro/skills/fanout/SKILL.md` | "Monitor without attaching" | Existing `MonitorCreate` pattern |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | supervisor destination checks | Related regression probe |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| /supervisor skill | Modified | Monitor-based observation, no reverse channel |
| /escalate skill | Modified | The advisor launch example sets no supervisor pane |
| Probe suite | Added | New file `.agro/evals/probes/supervisor-monitor-contract.sh` |

## Storage

N/A. The change edits skill text and adds one probe. The change adds no persistent state.

## Architectural Decisions

- Artifacts are the source of truth for advisor progress: `progress.txt`, `prd.json`, and the commit log.
- Messages flow down only. The supervisor steers the advisor. The advisor never messages the supervisor.
- The supervisor owns the operator channel through /escalate.
- Edit the canonical `.agro/skills/` sources. Run the link check for the provider mirrors.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| New file `.agro/evals/probes/supervisor-monitor-contract.sh` | `MonitorCreate` present; `LoopCreate` prohibited; no pane id in `AGRO_SUPERVISOR_PANE` examples | US-001, US-002 |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Existing cases | The script contract stays intact |
| `.agro/skills/ste/scripts/ste-check.sh` | Both edited skill files | STE compliance |
| `.agro/scripts/link-providers.sh` | `--check` mode | Provider links resolve |

## Design Principles

- Keep one source of truth per behavior. The supervisor skill owns the monitor contract.
- Make every wait bounded and every persistent process survive a disconnect.
- Apply YAGNI. Change no script when a text change enforces the contract.

## Out of Scope

- The unrelated concurrent failure-mode addition to the supervisor skill.
- Removal of the supervisor destination from `.agro/skills/escalate/scripts/escalate.sh`.
- Changes to /fanout, /herdr, or /delegate.

## Open Questions

1. Does `herdr tab create` accept an empty value such as `--env AGRO_SUPERVISOR_PANE=` to clear the variable? If not, which command clears the inherited value?
2. Claude Code exposes a Monitor tool, and Pi exposes `MonitorCreate`. Does the skill name one tool per harness?
1. Does `herdr tab create` accept an empty value such as `--env AGRO_SUPERVISOR_PANE=` to clear the variable? If `herdr tab create` rejects an empty value, which command clears the inherited value?
4. Which command runs the "command checks" named in the issue? Record `<command check>` until the operator names the check.

## Acceptance Criteria
- [ ] Every story acceptance criterion passes.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` exits 0.
- [ ] The diff touches no line of the "Failure modes" section in `.agro/skills/supervisor/SKILL.md`.
- [ ] `<command check>` exits 0.

## Lessons

Filled by the advisor before undraft.
