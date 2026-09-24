# PRD: Add the shared-stash and hook-bypass rules to the worker brief

Status: DRAFT

Issue: [#1162](https://github.com/mifunedev/agro/issues/1162)

## User Stories

### US-001: State the shared-stash and hook-bypass rules in the worker brief

**Description:** As an advisor, I want the worker brief to name the shared stash and the routes around a hook so that workers obey both.

**Acceptance Criteria:**

- [ ] Before the skill change, `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 1 and names each new brief fragment. The evidence records the command and the exit status.
- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief forbids a bare `git stash` and `git stash pop`, and states that the stash stack is shared.
- [ ] § Worker brief states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass, and that the worker reports `BLOCKED` instead.
- [ ] After the skill change, `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1162, and the entry is at most 250 characters.

## Summary

`.agro/skills/delegate/SKILL.md` § Worker brief lists six rules. The last rule reads "Never bypass a hook. Report a blocked action as `BLOCKED`." The brief names neither the shared stash stack nor a script file or a heredoc as a bypass route.

Verified evidence (#1156, PR #1157): the US-004 worker ran a bare `git stash` and `git stash pop`. The US-005 worker reran a blocked `rm -rf` through a script file. The harness warns the active session about the shared stash, but a worker receives only its brief.

`.agro/evals/probes/delegate-worker-boundary.sh` line 51 pins the brief fragments `never write \`prd.json\``, `never push`, and `never bypass a hook`. The story adds two fragments to that list.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/skills/delegate/SKILL.md` | § Worker brief | Two rules. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | the `need "/delegate"` fragment list | Pins the two rules. |
| `CHANGELOG.md` | `[Unreleased]` `### Fixed` | One entry. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| `/delegate` worker brief | text | Every worker brief carries the two rules. |

## Storage

N/A. The change is text in a skill and a probe.

## Architectural Decisions

- The rules live in `/delegate` § Worker brief, the one source for worker rules.
- The existing probe pins the rules. The task adds no probe file.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/delegate-worker-boundary.sh` | two new fragments | The brief states both rules. |
| `bash .claude/skills/eval/run.sh` | all probes | No new red. |

The story adds the fragments to the probe first and records the probe exit 1. Then the story changes the skill.

## Design Principles

- One source of truth: `/delegate` § Worker brief.
- Add the fewest words that close the two gaps.

## Out of Scope

- A hook that enforces the stash rule.
- Changes to the active-session harness warnings.

## Open Questions

None.

## Acceptance Criteria

- [ ] `/delegate` § Worker brief forbids a bare `git stash` and `git stash pop`.
- [ ] `/delegate` § Worker brief names a script file, a heredoc, or another tool as a bypass route, and requires `BLOCKED`.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red.

## Lessons

None. The story passed on its first commit, and the worker brief for this story already carried both rules.
