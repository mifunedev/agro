# PRD: Supervisor monitors with MonitorCreate and steers downward only

Status: BLOCKED

## User Stories

### US-001: Add the red regression probe

**Description:** As the operator, I want a deterministic probe for the supervisor observation contract. A later edit that restores loop polling or reverse messages then turns the probe red.

**Acceptance Criteria:**

- [ ] The file `.agro/evals/probes/supervisor-monitor-contract.sh` exists and starts with a `# source: issue #1064` header line, in the shape of `.agro/evals/probes/escalate-destination-fan-out.sh`.
- [ ] The probe fails when `.agro/skills/supervisor/SKILL.md` names no `MonitorCreate` command for observation and no `MonitorCreate` command for the readiness wait.
- [ ] The probe fails when `.agro/skills/supervisor/SKILL.md` names no `LoopCreate` prohibition.
- [ ] The probe fails when the `herdr tab create` example in `.agro/skills/supervisor/SKILL.md` passes a non-empty `AGRO_SUPERVISOR_PANE` value.
- [ ] The probe fails when `.agro/skills/supervisor/SKILL.md` drops the `Message @` send guard or the supervisor-owned `/escalate` rule.
- [ ] The probe fails when `.agro/skills/escalate/SKILL.md` tells a supervisor to start an advisor with `AGRO_SUPERVISOR_PANE=<pane>`.
- [ ] Against the current `.agro/skills/supervisor/SKILL.md` at commit `3e98ddc`, `bash .agro/evals/probes/supervisor-monitor-contract.sh` exits non-zero. Record the output in `evidence.md`.

### US-002: Require MonitorCreate for observation and readiness waits

**Description:** As a supervisor, I want each wait and each observation to run through one bounded `MonitorCreate` command. The supervisor then spends no turns on recurring polls. The supervisor recovers from each timeout by one explicit rule.

**Acceptance Criteria:**

- [ ] Duty 1 of `.agro/skills/supervisor/SKILL.md` runs the readiness wait `herdr agent wait <pane> --status idle --timeout 90000` inside a `MonitorCreate` command with an `onDone` callback.
- [ ] Duty 3 runs the observation wait `herdr agent wait <pane> --status idle --timeout 900000` inside a `MonitorCreate` command with an `onDone` callback.
- [ ] Each `MonitorCreate` example carries an explicit `--timeout` value. No example runs an unbounded `while` or `sleep` loop.
- [ ] Duty 3 states the recovery rule for a monitor that times out or exits non-zero: read the pane one time, then create one new monitor or escalate under Duty 5.
- [ ] Duty 3 prohibits `LoopCreate` for supervisor observation and for readiness waits.
- [ ] The `allowed-tools` frontmatter line of `.agro/skills/supervisor/SKILL.md` names `MonitorCreate`.

### US-003: Keep Herdr messages downward only

**Description:** As a supervisor, I want advisors and workers to send no Herdr message to the supervisor. Progress reaches the supervisor through pane output and artifacts. Only the supervisor steers downward and escalates to the operator.

**Acceptance Criteria:**

- [ ] The Duty 1 `herdr tab create` example passes `--env AGRO_SUPERVISOR_PANE=` with an empty value, so the advisor tab inherits no supervisor destination.
- [ ] Duty 1 no longer states that `/escalate` resolves the supervisor from the advisor tab.
- [ ] The brief template in Duty 2 adds one step: the advisor and its workers send no Herdr message to the supervisor, and the advisor reports progress through its output, `progress.txt`, `evidence.md`, and `prd.json`.
- [ ] Duty 2 keeps the two-step send and the `Message @` check before every downward send.
- [ ] Duty 5 states that the supervisor detects advisor blocks from `herdr agent list`, `herdr pane read`, and the artifacts, and that only the supervisor runs `/escalate` to reach the operator.
- [ ] Lines 69 to 74 of `.agro/skills/escalate/SKILL.md` no longer tell a supervisor to start an advisor with `AGRO_SUPERVISOR_PANE=<pane>`.
- [ ] `bash .agro/evals/probes/supervisor-monitor-contract.sh` exits 0.

## Summary

Issue #1064 (`work/issue-1064.md`) sets the scope. The supervisor must use `MonitorCreate` for observation and readiness waits. Advisors and workers must send no reverse Herdr message. Advisor tabs must inherit no supervisor destination. Downward steering keeps its guard, and operator escalation stays with the supervisor.

Verified current state:

- `.agro/skills/supervisor/SKILL.md:95` runs `herdr agent wait w7:p4 --status idle --timeout 90000` as a direct call. Duty 3 at lines 194 to 198 runs direct `herdr agent list`, `herdr pane read`, and `herdr agent wait` calls. The file names neither `MonitorCreate` nor `LoopCreate`.
- `.agro/skills/supervisor/SKILL.md:69-74` sets `AGRO_SUPERVISOR_PANE=w7:p1` on the advisor tab. The text states that `/escalate` resolves the supervisor from that variable.
- `.agro/skills/supervisor/SKILL.md:270-279` routes an advisor escalation to the supervisor pane first.
- `.agro/skills/escalate/SKILL.md:69-74` tells the supervisor to start an advisor with `--env AGRO_SUPERVISOR_PANE=<pane>`.
- `.agro/skills/escalate/scripts/escalate.sh:67` falls back to `AGRO_SUPERVISOR_PANE`. The probe `.agro/evals/probes/escalate-destination-fan-out.sh` guards that fallback.
- `.agro/skills/fanout/SKILL.md:120-132` already prefers `MonitorCreate` over recurring `LoopCreate` polling. `docs/harnesses/pi.md:79-80` shows the `MonitorCreate` syntax with `onDone`.
- `.claude/skills` is a symlink to `../.agro/skills`. The canonical source is `.agro/skills/supervisor/SKILL.md`.

Selected approach: edit the two canonical skill files and add one probe. Keep the `escalate.sh` supervisor destination unchanged in this task.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `allowed-tools`; Duty 1 readiness wait and `herdr tab create`; Duty 2 brief template; Duty 3 monitor; Duty 5 escalate | Canonical supervisor contract that this task changes |
| `.agro/skills/escalate/SKILL.md` | section "Destinations", lines 69 to 74 | Removes the instruction that sets `AGRO_SUPERVISOR_PANE` on an advisor |
| `.agro/skills/escalate/scripts/escalate.sh` | `supervisor` fallback at line 67 | Stays unchanged; the empty variable makes the fallback resolve no target |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | new probe | Regression oracle for this contract |
| `.agro/skills/escalate/scripts/escalate.sh` | `supervisor` fallback at line 67 | The script stays unchanged. An empty variable resolves no supervisor target |
| `.agro/scripts/link-providers.sh` | `--init` | Provider link repair and check |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` skill text | Modify | Observation and readiness waits move to `MonitorCreate`. The skill prohibits `LoopCreate`. Messages flow downward only |
| `/escalate` skill text | Modify | The supervisor no longer passes its pane to an advisor |
| Advisor tab environment | Modify | `AGRO_SUPERVISOR_PANE` is empty in each advisor tab |
| `/escalate` CLI flags and output | None | The script keeps `--supervisor` and the JSON contract |

## Storage

N/A. The task changes skill text and adds one probe. The task adds no persistent state. Advisor progress stays in the existing `progress.txt`, `evidence.md`, and `prd.json` artifacts.

## Architectural Decisions

- The canonical source is `.agro/skills/supervisor/SKILL.md`. Provider directories reach the file through the `.claude/skills` symlink.
- The supervisor owns every Herdr message. Messages flow from the supervisor to an advisor. No message flows from an advisor or a worker to the supervisor.
- The supervisor reads state. The supervisor reads `herdr agent list`, `herdr pane read`, and the task artifacts. The advisor writes no message to announce state.
- The supervisor alone runs `/escalate` toward the operator.
- Each wait runs as one bounded `MonitorCreate` command. The `onDone` callback returns control to the supervisor. A timeout triggers one pane read, then one new monitor or one escalation.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/supervisor-monitor-contract.sh` | red run at `3e98ddc`; green run after US-003 | US-001, US-002, US-003 text contract |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing cases | The `escalate.sh` supervisor destination still works for an explicit `--supervisor` target |
| `.agro/evals/probes/skill-paths.sh` | existing cases | Skill paths still resolve |
| `.agro/evals/probes/roles-are-skills.sh` | existing cases | The supervisor role stays a skill |
| `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` | STE check | Both edited files exit 0 |
| `bash .agro/scripts/link-providers.sh --init` | provider links | Exit 0, and `test -f .claude/skills/supervisor/SKILL.md` exits 0 |
| `<command check>` | command checks from issue #1064 | Open question 1 |

## Design Principles

- Keep one source of truth. Edit the canonical `.agro/skills/` files. Patch no provider mirror.
- Point at owning skills. `/herdr` owns the pane catalog, and `/escalate` owns the operator channel.
- Bound every wait. Each monitor names a timeout and a recovery rule.
- Read artifacts instead of messages. A file on disk needs no message.
- Add no explanatory comment to tracked code. The probe header keeps only the `source:` line that the probe convention requires.

## Out of Scope

- The unrelated concurrent failure-mode addition to `.agro/skills/supervisor/SKILL.md`. This task adds no failure-mode entry, and the section keeps its current count.
- Removal of the `--supervisor` destination from `.agro/skills/escalate/scripts/escalate.sh`.
- Changes to `.agro/skills/fanout/SKILL.md`, `.agro/skills/builder/references/command.md`, and `docs/harnesses/pi.md`.
- Scheduling that the operator requests explicitly.
- Public documentation in `mifunedev/agro-web`. The change touches internal skill text only.

## Open Questions

1. Issue #1064 names "command checks". Which command runs those checks? The plan writes `<command check>` until the operator names the command.
2. Should a later task delete the `AGRO_SUPERVISOR_PANE` fallback and the `--supervisor` destination from `escalate.sh`? With downward-only messages, no advisor sets the variable. The default in this task keeps the script unchanged.
3. Does `herdr tab create --env AGRO_SUPERVISOR_PANE=` set an empty value, or does Herdr reject an empty value? If Herdr rejects the empty value, the advisor must `unset AGRO_SUPERVISOR_PANE` before the harness launch.
4. The Claude Code harness exposes `Monitor`, and Pi exposes `MonitorCreate`. Should the skill name both names, or name `MonitorCreate` alone as the issue states?

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/supervisor-monitor-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] `bash .agro/evals/probes/skill-paths.sh` and `bash .agro/evals/probes/roles-are-skills.sh` exit 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --init` exits 0, and `test -f .claude/skills/supervisor/SKILL.md` exits 0.
- [ ] `<command check>` exits 0.
- [ ] `git diff --stat development` lists only `.agro/skills/supervisor/SKILL.md`, `.agro/skills/escalate/SKILL.md`, `.agro/evals/probes/supervisor-monitor-contract.sh`, `CHANGELOG.md`, and files under `.agro/tasks/supervisor-monitor-downward-only/`.
- [ ] The failure-mode section of `.agro/skills/supervisor/SKILL.md` holds the same entries as commit `3e98ddc`.

## Lessons

Filled by the advisor before undraft.
