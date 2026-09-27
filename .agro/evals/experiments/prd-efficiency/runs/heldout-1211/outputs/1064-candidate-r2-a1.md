# PRD: Supervisor observes through MonitorCreate only

Status: DRAFT

## User Stories

### US-001: Red probe for the supervisor monitor contract

**Description:** As the advisor, I want a deterministic probe for the monitor contract so that a later edit cannot restore polling or reverse messages.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/supervisor-monitor-contract.sh` exists with the `# tier: A`, `# source: issue #1064`, and `# desc:` header lines that `.agro/evals/probes/skill-paths.sh` uses.
- [ ] The probe fails when `.agro/skills/supervisor/SKILL.md` names no `MonitorCreate` call with an `onDone` callback.
- [ ] The probe fails when `LoopCreate` appears in `.agro/skills/supervisor/SKILL.md` outside a line that prohibits `LoopCreate`.
- [ ] The probe fails when `.agro/skills/supervisor/SKILL.md` or `.agro/skills/escalate/SKILL.md` shows an `--env AGRO_SUPERVISOR_PANE=<value>` assignment with a non-empty value.
- [ ] The probe fails when the "Failure modes" section of `.agro/skills/supervisor/SKILL.md` holds a number of bold numbered entries other than 8.
- [ ] Against the current `development` tree, `bash .agro/evals/probes/supervisor-monitor-contract.sh` exits 1. The red run is recorded in `evidence.md`.

### US-002: Supervisor observation and readiness waits run in MonitorCreate

**Description:** As a supervisor, I want each readiness wait and each observation wait to run as one bounded `MonitorCreate` command. Then each wait ends with a callback and never polls.

**Acceptance Criteria:**

- [ ] Duty 1 wraps `herdr agent wait <pane> --status idle --timeout 90000` in one `MonitorCreate` call that carries `command`, `description`, and `onDone`.
- [ ] Duty 3 wraps `herdr agent wait <pane> --status idle --timeout 900000` in one `MonitorCreate` call that carries `command`, `description`, and `onDone`.
- [ ] Each monitor command in the skill carries an explicit `--timeout` value.
- [ ] Duty 3 states that the supervisor never uses `LoopCreate`, a `sleep` loop, or a `while` loop to observe an advisor.
- [ ] Duty 3 holds a numbered recovery procedure for a monitor that exits non-zero or reaches its timeout. The procedure reads `herdr agent list` and `herdr pane read <pane> --source recent --lines 120` once. The procedure escalates per Duty 5 on `agent_status` `blocked`. The procedure starts at most one replacement monitor. The procedure escalates after a second timeout with no artifact change.
- [ ] Duty 3 states that the advisor reports progress through its pane output and the existing artifacts: the commit log, `prd.json`, `progress.txt`, and `evidence.md`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0.

### US-003: Advisors send no reverse Herdr message and inherit no supervisor destination

**Description:** As a supervisor, I want each advisor to start with no supervisor destination. Then no advisor or worker sends a Herdr message back into the supervisor pane.

**Acceptance Criteria:**

- [ ] The Duty 1 `herdr tab create` example carries no `--env AGRO_SUPERVISOR_PANE=` argument.
- [ ] The Duty 1 launch command is `herdr pane run <pane> "env -u AGRO_SUPERVISOR_PANE claude --dangerously-skip-permissions"`.
- [ ] The role boundary table lists "Herdr messages to the supervisor" under "Never does" for the advisor row and for the worker row.
- [ ] Duty 5 states that the supervisor detects an advisor blocker from the monitor callback, the pane output, and `evidence.md`.
- [ ] Duty 5 keeps the supervisor-owned operator escalation through `/escalate`.
- [ ] Duty 2 keeps the two-step downward send and the `Message @` check unchanged.
- [ ] The "Failure modes" section keeps exactly the 8 current entries.

### US-004: Escalate documentation matches the cleared destination

**Description:** As an advisor, I want `/escalate` to describe no supervisor-to-advisor environment handoff so that the escalate contract and the supervisor contract agree.

**Acceptance Criteria:**

- [ ] `.agro/skills/escalate/SKILL.md` no longer shows `herdr agent start <name> --cwd <harness root> --env AGRO_SUPERVISOR_PANE=<pane>`.
- [ ] `.agro/skills/escalate/SKILL.md` states that a supervisor launches each advisor with `AGRO_SUPERVISOR_PANE` cleared.
- [ ] `.agro/skills/escalate/scripts/escalate.sh` has no diff.
- [ ] `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.
- [ ] `bash .agro/evals/probes/supervisor-monitor-contract.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` exits 0.

## Summary

Issue `work/issue-1064.md` asks for four changes to supervision. The supervisor observes through `MonitorCreate`. The supervisor never uses `LoopCreate`. Advisors and workers send no reverse Herdr message. Advisors inherit no supervisor destination.

Verified current state:

- `.agro/skills/supervisor/SKILL.md:95` runs a raw `herdr agent wait` for readiness. Line 197 runs a raw `herdr agent wait` for observation. No line names `MonitorCreate` or a recovery rule.
- `.agro/skills/supervisor/SKILL.md:69-74` sets `--env AGRO_SUPERVISOR_PANE=w7:p1` on the advisor tab. Lines 270-279 route advisor escalations into the supervisor pane.
- `.agro/skills/escalate/scripts/escalate.sh:67` falls back to `AGRO_SUPERVISOR_PANE`. Lines 131-140 deliver through `herdr agent send` and `herdr pane send-keys`. That delivery is the reverse message.
- `.agro/skills/escalate/SKILL.md:69-74` documents the environment handoff.
- `.agro/skills/fanout/SKILL.md:119-135` already prefers `MonitorCreate` with `onDone` over `LoopCreate`.

Selected approach: edit the canonical `.agro/skills/supervisor/SKILL.md` and `.agro/skills/escalate/SKILL.md` only. Clear the variable at launch with `env -u`. An empty `AGRO_SUPERVISOR_PANE` makes `escalate.sh:67` skip the supervisor destination, so the script needs no change. A new tier-A probe guards the contract.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Role boundary, Duty 1, Duty 3, Duty 5, Failure modes | Canonical supervisor contract |
| `.agro/skills/escalate/SKILL.md` | Destinations, Resolution, Not this skill | Canonical escalate contract |
| `.agro/skills/escalate/scripts/escalate.sh` | `supervisor="${AGRO_SUPERVISOR_PANE:-}"` at line 67 | Skips the supervisor destination on an empty value; no change |
| `.agro/skills/fanout/SKILL.md` | Section 6 "Monitor without attaching" | Existing `MonitorCreate` wording to match; no change |
| `.agro/scripts/link-providers.sh` | `--check` | Verifies the provider mirrors |
| `.agro/evals/probes/supervisor-monitor-contract.sh` | new probe | Regression guard for this task |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` skill text | Modify | Monitor contract, recovery rules, cleared destination, no reverse messages |
| `/escalate` skill text | Modify | Remove the environment handoff example |
| `.agro/evals/probes/` | Add | One tier-A probe |
| `escalate.sh` CLI | None | Flags and output stay unchanged |

## Storage

N/A. The change edits skill text and adds one probe. The change adds no persisted state.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` stays the single owner of the observation rules. `/escalate` points at the rules and does not restate them.
- Supervision state flows in one direction. The supervisor steers downward through the guarded two-step send. The advisor reports upward only through pane output and artifacts on disk.
- The supervisor owns operator escalation. The supervisor calls `/escalate` for the operator channel.
- The launch command clears `AGRO_SUPERVISOR_PANE` with `env -u`. That clear holds whether the variable came from the tab environment or from the supervisor's own environment.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/supervisor-monitor-contract.sh` | `MonitorCreate` with `onDone`; `LoopCreate` only in a prohibition; no non-empty `AGRO_SUPERVISOR_PANE` assignment; `env -u AGRO_SUPERVISOR_PANE` in the launch; 8 failure modes | US-001 through US-004 |
| `.agro/evals/probes/escalate-contract.sh` | existing cases | `/escalate` contract stays intact |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | existing cases | Script destination behavior stays intact |
| `.agro/evals/probes/ste-checker-contract.sh` | existing cases | Checker fixture stays intact |
| `.agro/evals/probes/skill-paths.sh` | existing cases | No retired path returns |
| `.agro/evals/probes/roles-are-skills.sh` | existing cases | Roles stay skills |
| `bash .agro/scripts/link-providers.sh --check` | provider mirrors | Mirrors resolve to the canonical skills |
| `bash .agro/skills/ste/scripts/ste-check.sh <file>` | both edited `SKILL.md` files and this PRD | STE prose |

## Design Principles

- Edit the canonical `.agro/skills/` sources. Never patch `.claude/skills/` or `.agents/skills/`.
- Keep each rule in one skill. Point at the owner instead of a copy.
- Bound every wait with an explicit timeout and a completion callback.
- Keep the diff to the four scoped behaviors. Add no failure mode.
- Add no explanatory comment to tracked code.

## Out of Scope

- The unrelated concurrent failure-mode addition to `.agro/skills/supervisor/SKILL.md`.
- Any change to `.agro/skills/escalate/scripts/escalate.sh`, its flags, or its output.
- Any change to `.agro/skills/fanout/SKILL.md` or `.agro/skills/herdr/SKILL.md`.
- Removal of the `--supervisor` flag from `/escalate`.
- Public documentation in `mifunedev/agro-web`. The change alters no user-facing verb.

## Open Questions

1. Claude Code exposes `Monitor` and exposes no `MonitorCreate`. Does the skill name `MonitorCreate` alone, or map `MonitorCreate` to the monitor primitive of each harness? Default: name `MonitorCreate` alone, as the issue states.
2. The issue names "command checks" and gives no command. Which command runs that check? Placeholder: `<command check>`. Default: `bash .agro/scripts/link-providers.sh --check` plus the probes in the Test Plan.
3. The `--supervisor` destination in `escalate.sh` serves callers other than advisors. Does that destination stay? Default: keep the destination, per Out of Scope.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] Each probe in the Test Plan exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `git diff --stat development` lists only `.agro/skills/supervisor/SKILL.md`, `.agro/skills/escalate/SKILL.md`, the new probe, and `.agro/tasks/supervisor-monitor-only/`.
- [ ] `<command check>` exits 0.

## Lessons

Filled by the advisor before undraft.
