# PRD: Worker brief stash and hook-bypass rules

Status: DRAFT

## User Stories

### US-001: State the stash and hook-bypass rules in the worker brief

**Description:** As an advisor, I want the worker brief to state both rules so that a worker keeps each hook and each stash entry intact.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief contains a rule that forbids a bare `git stash` and a bare `git stash pop`.
- [ ] The stash rule states that every worktree and every session share one stash stack.
- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief states that a rerun of a blocked command through a script file, a heredoc, or another tool is a hook bypass.
- [ ] The bypass rule tells the worker to report `BLOCKED` instead.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` exits 0.

### US-002: Guard the new rules in the delegate probe

**Description:** As a maintainer, I want `delegate-worker-boundary.sh` to check both new rules so that a later edit cannot remove the rules without a red probe.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/delegate-worker-boundary.sh` reads the `## Worker brief` section with the existing `section` function.
- [ ] The probe requires the fragments `git stash`, `git stash pop`, `script file`, and `heredoc` in that section.
- [ ] Red test: on a copy of the skill with the stash rule removed, the probe exits 1.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0 on the changed skill.

## Summary

Issue #1162 reports two gaps in the `/delegate` worker brief. The gaps occurred during #1156 (PR #1157). The US-004 worker ran a bare `git stash` and `git stash pop`. The US-005 worker reran a blocked `rm -rf` through a script file.

Verified current state: `.agro/skills/delegate/SKILL.md:81-92` holds the worker brief. Line 92 reads "Never bypass a hook. Report a blocked action as `BLOCKED`." No line names the shared stash. No line names the script-file route.

Selected approach: add two bullets to the worker brief. Extend the existing probe to require the new fragments inside the `## Worker brief` section.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/SKILL.md` | `## Worker brief` | Canonical rules that each worker receives. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | `section`, `need` | Prose probe that guards the delegate contract. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `/delegate` worker brief | Modified | Two new rules for each dispatched worker. |

## Storage

N/A. The change edits prose and a probe. The change adds no persistent state.

## Architectural Decisions

The canonical source is `.agro/skills/delegate/SKILL.md`. Provider mirrors reach the file through symlinks, so the change edits no mirror. The probe stays a text check and does not claim runtime behavior.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/delegate-worker-boundary.sh` | Stash rule removed: exit 1 | The probe detects a missing stash rule. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Changed skill: exit 0 | Both rules are present in `## Worker brief`. |
| `.agro/skills/ste/scripts/ste-check.sh` | `.agro/skills/delegate/SKILL.md`: exit 0 | The new rules pass the STE checker. |

## Design Principles

- Keep one source of truth: edit the canonical `.agro/` skill only.
- Keep each rule one short imperative sentence plus one reason.
- Add no new hook and no new probe file. Extend the existing probe.

## Out of Scope

- A hook that blocks a bare `git stash` or a script-file rerun.
- Changes to the active-session harness rules.
- Changes to the documentation in `mifunedev/agro-web`.

## Open Questions

None

## Acceptance Criteria
- [ ] `/delegate` § Worker brief forbids a bare `git stash` and `git stash pop`.
- [ ] `/delegate` § Worker brief states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass, and that the worker reports `BLOCKED` instead.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.

## Lessons

Filled by the advisor before undraft.
