# PRD: Add stash and hook-route rules to the /delegate worker brief

Status: DRAFT

## User Stories

### US-001: Pin the two rules in the boundary probe

**Description:** As an advisor, I want the probe to require both rules so that a later edit cannot drop them.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/delegate-worker-boundary.sh` pins a fragment that forbids a bare `git stash` and `git stash pop`.
- [ ] `.agro/evals/probes/delegate-worker-boundary.sh` pins a fragment that names a script file, a heredoc, or another tool as a route around a hook.
- [ ] The probe reads the two fragments from the `## Worker brief` section through the existing `section` helper, not from the whole file.
- [ ] The `# source:` header of the probe cites issue #1162, and the `# desc:` header names the two rules.
- [ ] Before US-002 lands, `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 1 and names each missing fragment on stderr.

### US-002: State the two rules in the worker brief

**Description:** As an advisor, I want the worker brief to state both rules so that workers follow them.

**Acceptance Criteria:**

- [ ] `## Worker brief` in `.agro/skills/delegate/SKILL.md` forbids a bare `git stash` and `git stash pop`, and gives the reason: every worktree and session shares one stash stack.
- [ ] `## Worker brief` states that a rerun of a blocked command through a script file, a heredoc, or another tool is a hook bypass.
- [ ] `## Worker brief` states that the worker reports `BLOCKED` in place of that rerun.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` reports no finding on the new lines.
- [ ] `CHANGELOG.md` has one `### Fixed` entry under `## [Unreleased]` that cites issue #1162.

## Summary

The `## Worker brief` section of `.agro/skills/delegate/SKILL.md` lists six rules at lines 85 to 92. Line 92 reads "Never bypass a hook. Report a blocked action as `BLOCKED`." The brief does not mention `git stash`. The brief does not name a script file, a heredoc, or another tool as a route around a hook.

Issue #1162 records two worker actions during #1156 (PR #1157). The US-004 worker ran a bare `git stash` and `git stash pop`. The US-005 worker reran a blocked `rm -rf` through a script file. Neither action lost data.

The selected approach adds two bullets to the brief and pins them in the existing probe. The probe changes first, so the probe fails red before the brief changes.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/SKILL.md` | `## Worker brief`, lines 81 to 92 | Canonical source of the worker rules. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | `section`, `need`, the `skill_flat` check | Probe that pins the brief text. |
| `CHANGELOG.md` | `## [Unreleased]`, `### Fixed` | Records the fix per /git § Changelog. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| /delegate worker brief | Prose addition | Two new rules that each worker receives at dispatch. |
| Eval probe output | Assertion addition | Two new fragments in the REGRESSION list when the rules are absent. |

## Storage

N/A. The change edits prose and one probe. The change keeps no state.

## Architectural Decisions

- The canonical source is `.agro/skills/delegate/SKILL.md`. The implementer edits no provider mirror under the `.claude` directory.
- The implementer adds the rules to the existing brief list. The implementer adds no new section and no new hook.
- The probe checks the `## Worker brief` section only. A match elsewhere in the skill does not satisfy the brief requirement.
- The probe pins short fragments, per the "Pinning contract text" rule in `.agro/evals/AGENTS.md`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/delegate-worker-boundary.sh` | Run against the base brief: exit 1 with both new fragments listed. | US-001 red state. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Run against the edited brief: exit 0. | US-002 green state. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Fault injection: on a disposable copy, move one rule out of `## Worker brief`, then run the probe: exit 1. | Section scoping, per the "Fault injection" rule in `.agro/evals/AGENTS.md`. |
| `.agro/evals/probes/changelog-entry-length.sh` | Run after the `CHANGELOG.md` edit. | The new entry fits the length limit. |

## Design Principles

- Keep one source of truth: the brief states each rule once.
- Apply YAGNI: add prose and a probe check, not a new guard.
- Write the new bullets to /ste rules.
- Add no comment to tracked code.

## Out of Scope

- A hook that blocks `git stash` at run time.
- A hook that detects a rerun through a script file or a heredoc.
- Changes to the stash guidance in `.agro/skills/git/SKILL.md` or `.agro/skills/worktrees/SKILL.md`.
- Documentation changes in mifunedev/agro-web. The worker brief is internal to the harness.

## Open Questions

1. Does the stash rule allow a named stash, such as `git stash push -m <name>` with a later pop by that name? The issue forbids only a bare `git stash` and `git stash pop`. This plan forbids those two forms and says nothing about named stashes.

## Acceptance Criteria

- [ ] /delegate § Worker brief forbids a bare `git stash` and `git stash pop`.
- [ ] /delegate § Worker brief states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass, and that the worker reports `BLOCKED` in place of the rerun.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/changelog-entry-length.sh` exits 0.

## Lessons

Filled by the advisor before undraft.
