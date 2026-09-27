# PRD: Supervisor monitor observation

Status: DRAFT

Issue: [#1064](https://github.com/mifunedev/agro/issues/1064)
Source: `work/issue-1064.md`

## User Stories

### US-001: Observe advisors through bounded monitors

**Description:** As a supervisor, I want bounded `MonitorCreate` waits so that I observe an advisor without a loop or a terminal.

**Acceptance Criteria:**

- [ ] Duty 1 of `.agro/skills/supervisor/SKILL.md` runs the readiness wait `herdr agent wait <pane> --status idle --timeout 90000` inside a `MonitorCreate` call with an `onDone` callback.
- [ ] Duty 3 of `.agro/skills/supervisor/SKILL.md` runs the observation wait `herdr agent wait <pane> --status idle --timeout 900000` inside a `MonitorCreate` call with an `onDone` callback.
- [ ] Each `MonitorCreate` example names one pane and one `--timeout` value. No example contains `while`, `sleep`, or `watch`.
- [ ] `.agro/skills/supervisor/SKILL.md` states a recovery rule for each monitor outcome: idle, blocked, timeout, and nonzero exit.
- [ ] `.agro/skills/supervisor/SKILL.md` prohibits `LoopCreate` for the supervisor, the advisor, and the worker. `grep -n 'LoopCreate' .agro/skills/supervisor/SKILL.md` prints only the prohibition lines.

### US-002: Remove reverse Herdr messages and clear inherited destinations

**Description:** As a supervisor, I want advisors and workers to report through output and artifacts so that no Herdr message travels up to my pane.

**Acceptance Criteria:**

- [ ] The Duty 1 `herdr tab create` example sets `--env AGRO_SUPERVISOR_PANE=` with an empty value. No example in the file sets `AGRO_SUPERVISOR_PANE` to a pane id.
- [ ] The Duty 1 harness launch clears the inherited variable: `herdr pane run <pane> "env -u AGRO_SUPERVISOR_PANE claude --dangerously-skip-permissions"`.
- [ ] Step 4 of the Duty 2 brief template tells the advisor to record a blocker in `evidence.md` and `progress.txt`, then stop. Step 4 names no Herdr send and no `/escalate` call.
- [ ] Step 7 of the Duty 2 brief template prohibits `herdr agent send`, `herdr pane run`, and `herdr pane send-keys` toward the supervisor pane by the advisor and by each worker.
- [ ] Duty 3 names the progress sources as the pane output from `herdr pane read`, the commit log, the `passes` flags in `prd.json`, `progress.txt`, and `evidence.md`.
- [ ] Duty 5 states that the supervisor detects an advisor blocker through a monitor callback and an artifact read. Duty 5 no longer states that an advisor escalation arrives at the supervisor pane.
- [ ] The Destinations section of `.agro/skills/escalate/SKILL.md` no longer tells a supervisor to start an advisor with `AGRO_SUPERVISOR_PANE=<pane>`.
- [ ] `bash .agro/evals/probes/escalate-destination-fan-out.sh` exits 0.

### US-003: Preserve guarded downward steering and operator escalation

**Description:** As an operator, I want the supervisor to keep guarded sends and operator escalation so that the change removes only upward traffic.

**Acceptance Criteria:**

- [ ] The Duty 2 section keeps the `grep -c 'Message @'` check before every send, and the two-step send with `herdr agent send` and `herdr pane send-keys <pane> Enter`.
- [ ] Duty 5 tells the supervisor to run `/escalate` with no `--supervisor` flag and with `AGRO_SUPERVISOR_PANE` unset. The escalation then goes to the Slack destination.
- [ ] The Failure modes section keeps exactly eight numbered entries. `grep -c '^\*\*[0-9]\+\. ' .agro/skills/supervisor/SKILL.md` prints `8`.

### US-004: Guard the contract with a regression probe

**Description:** As a maintainer, I want a deterministic probe so that a later edit cannot restore loops or reverse messages unseen.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/supervisor-monitor-observation.sh` exists, is executable, and carries the `# tier:`, `# source:`, and `# desc:` header lines.
- [ ] The probe exits 0 against the updated `.agro/skills/supervisor/SKILL.md`.
- [ ] The probe exits 1 against a fixture copy with `AGRO_SUPERVISOR_PANE=w7:p1` in the tab create example.
- [ ] The probe exits 1 against a fixture copy that recommends `LoopCreate` for observation.
- [ ] The probe exits 1 against a fixture copy that removes the `Message @` check.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

## Summary

Verified current state at commit `3e98ddc`:

- `.agro/skills/supervisor/SKILL.md` Duty 1 creates the advisor tab with `--env AGRO_SUPERVISOR_PANE=w7:p1`. The file states that `/escalate` reads that variable.
- `.agro/skills/escalate/scripts/escalate.sh` sends the escalation to `AGRO_SUPERVISOR_PANE` through `herdr agent send` and `herdr pane send-keys` before the Slack destination. PR #1059 added this destination.
- The advisor's workers inherit the advisor environment. A worker that runs `/escalate` also sends text into the supervisor pane.
- Duty 1 and Duty 3 run `herdr agent wait` in the foreground. Neither duty uses `MonitorCreate`.
- `.agro/skills/fanout/SKILL.md` section 6 already prefers `MonitorCreate` over recurring `LoopCreate` polling for Pi.
- Duty 2 guards each downward send with the `Message @` check. Failure mode 8 records the misroute that the check prevents.

Selected approach: the supervisor observes. The supervisor never receives. Each wait runs as one bounded `MonitorCreate` monitor. The `onDone` callback reads the pane and the artifacts. The advisor tab starts with the supervisor destination cleared, so no advisor and no worker resolves a Herdr target upward. The advisor records a blocker in its artifacts and stops. The supervisor keeps the guarded downward send and keeps `/escalate` to the operator.

Surface review:

| Surface | Mark | Reason |
|---|---|---|
| Host and sandbox | applied | All edits land in `.agro/` inside the sandbox checkout. |
| Lifecycle door | not applicable | No `agro` verb changes. |
| Canonical and provider surfaces | applied | Edits land in `.agro/skills/`. `.claude/skills` and `.agents/skills` are symlinks to `.agro/skills`. |
| Root and scaffold | applied | The skill ships to the orchestrator and to initialized projects through the vendored pack. |
| Interactive and headless processes | applied | Advisors stay in Herdr tabs. Monitors run inside the supervisor harness. |
| Local and remote operation | applied | A monitor runs without an attached terminal. |
| Parallel operation | applied | Each monitor watches one pane. No monitor writes shared state. |
| Public documentation | unverified | This plan did not read `mifunedev/agro-web`. See open question 5. |
| Verification | applied | See the Test Plan. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Duty 1, Duty 2, Duty 3, Duty 5, Failure modes | Canonical supervisor contract. This task changes the contract. |
| `.agro/skills/escalate/SKILL.md` | Destinations section | Removes the instruction that sets `AGRO_SUPERVISOR_PANE` on an advisor. |
| `.agro/skills/escalate/scripts/escalate.sh` | `--supervisor`, `AGRO_SUPERVISOR_PANE` | Reads the cleared variable. An empty value skips the supervisor destination. No change in this task. |
| `.agro/skills/fanout/SKILL.md` | Section 6 | Existing `MonitorCreate` pattern. The supervisor follows the same pattern. |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | whole file | Existing probe. The probe must stay green. |
| `.agro/evals/probes/supervisor-monitor-observation.sh` | new file | New regression probe for this contract. |
| `CHANGELOG.md` | Unreleased section | One entry for this change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` observation procedure | modified | `MonitorCreate` wraps each wait. The skill prohibits `LoopCreate`. |
| `/supervisor` advisor tab environment | modified | `AGRO_SUPERVISOR_PANE` is empty in the tab and unset in the harness process. |
| `/supervisor` brief template | modified | The advisor reports through artifacts. The brief prohibits upward Herdr sends. |
| `/escalate` documentation | modified | The change removes the supervisor-start example with `AGRO_SUPERVISOR_PANE=<pane>`. |
| `escalate.sh` command line | unchanged | Flags, exit codes, and the destinations object stay the same. |

## Storage

N/A. The change adds no persistent state. The advisor keeps writing the existing `progress.txt`, `evidence.md`, and `prd.json` files.

## Architectural Decisions

- **Source of truth:** `.agro/skills/supervisor/SKILL.md` owns the observation contract. `/escalate` owns the operator channel. `/herdr` owns the pane command catalog.
- **Direction of traffic:** Herdr messages travel downward only, from the supervisor to the advisor. Progress travels upward through pane output and files.
- **Detection:** A `MonitorCreate` callback wakes the supervisor. The supervisor then reads `herdr agent list`, `herdr pane read`, and the artifacts.
- **Recovery:** Idle leads to an artifact read. Blocked leads to Duty 5. A timeout or a nonzero exit leads to a pane read and one replacement monitor. A second consecutive timeout leads to Duty 5. Open question 2 confirms the count.
- **Scoping:** One monitor watches one advisor pane. The three-advisor cap stays.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/supervisor-monitor-observation.sh` | `MonitorCreate` with `onDone` in Duty 1 and Duty 3 | US-001 |
| `.agro/evals/probes/supervisor-monitor-observation.sh` | `LoopCreate` appears only in a prohibition line | US-001 |
| `.agro/evals/probes/supervisor-monitor-observation.sh` | No `AGRO_SUPERVISOR_PANE=<pane id>` example; empty assignment present; `env -u AGRO_SUPERVISOR_PANE` present | US-002 |
| `.agro/evals/probes/supervisor-monitor-observation.sh` | `Message @` check and `send-keys` two-step present | US-003 |
| `.agro/evals/probes/supervisor-monitor-observation.sh` | Eight failure-mode entries | US-003 |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Existing cases | US-002 |
| `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` | Exit 0 | STE prose |
| `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` | Exit 0 | STE prose |
| `bash .agro/scripts/link-providers.sh --check` | Exit 0 | Provider links |
| `<command check>` | Exit 0 | Command checks. See open question 3. |
| `bash .agro/skills/eval/run.sh` | No REGRESSION | Related regression probes |

Write the probe first. Confirm that the probe exits 1 against the current file. Then edit the skill.

## Design Principles

- Code is the source of truth. The probe proves the contract.
- One source of truth per policy. `/supervisor` states the observation rule. `/fanout` keeps its own Pi guidance.
- Prefer the smallest truthful change. This task leaves `escalate.sh` unchanged.
- Downward steering stays guarded. Upward traffic uses files.
- Every wait is bounded. No procedure polls without a limit.

## Out of Scope

- The unrelated concurrent failure-mode addition. This task adds no failure-mode entry.
- Removal of the supervisor destination from `escalate.sh`. See open question 1.
- Changes to `/fanout`, `/delegate`, or `/herdr`.
- Changes to the Herdr CLI or to the Pi `@trevonistrevon/pi-loop` package.
- Scheduling that the operator requests explicitly.

## Open Questions

1. Does `escalate.sh` keep the `--supervisor` flag and the `AGRO_SUPERVISOR_PANE` default? This plan keeps the flag and the default unchanged. A later issue can remove the flag and the default.
2. How many consecutive monitor timeouts lead to Duty 5? This plan proposes two, to match the "fails twice" trigger in Duty 5.
3. Which command defines "command checks"? The repository holds no command-check script. This plan proposes `bash -n` over each `bash` block in the two changed files, plus `herdr pane get` against a live pane. Replace `<command check>` with the operator's command.
4. Claude Code names its tool `Monitor`, and Pi names its tool `MonitorCreate`. Does the skill name both, or only `MonitorCreate` as the issue states? This plan names `MonitorCreate` and maps the Claude Code `Monitor` tool in one line.
5. Does `mifunedev/agro-web` document the supervisor or the escalate destination? If yes, add a matching docs change.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `<command check>` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] The diff touches no failure-mode entry in `.agro/skills/supervisor/SKILL.md`.
- [ ] `CHANGELOG.md` carries one entry that links issue #1064.

## Lessons

Filled by the advisor before undraft.
