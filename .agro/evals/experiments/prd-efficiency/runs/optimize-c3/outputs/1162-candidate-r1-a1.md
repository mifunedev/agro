# PRD: Delegate worker brief stash and hook-bypass rules

Status: DRAFT

## User Stories

### US-001: State the stash and hook-bypass rules in the worker brief

**Description:** As an advisor, I want the worker brief to name two unsafe routes so that workers avoid them.

**Acceptance Criteria:**

- [ ] The `## Worker brief` section of `.agro/skills/delegate/SKILL.md` forbids a bare `git stash` and a bare `git stash pop`.
- [ ] The same section states the reason: every worktree and every session shares one stash stack.
- [ ] The same section states that a rerun of a hook-blocked command through a script file, a heredoc, or another tool is a hook bypass.
- [ ] The same section states that the worker reports `BLOCKED` instead of that rerun.
- [ ] The existing rule "Never bypass a hook. Report a blocked action as `BLOCKED`." stays in the section, or one merged rule carries both statements.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.

### US-002: Guard the two rules in the delegate probe

**Description:** As a maintainer, I want the probe to guard both rules so that a later edit cannot drop them.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/delegate-worker-boundary.sh` reads the `## Worker brief` section through its `section` function.
- [ ] The probe requires fragments for the bare stash ban and for the script-file, heredoc, and other-tool bypass route.
- [ ] The probe `# source:` header names issue #1162.
- [ ] With either new rule removed from a scratch copy of `.agro/skills/delegate/SKILL.md`, the probe exits 1 and prints `REGRESSION`.
- [ ] With the US-001 text in place, `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.

## Summary

The worker brief at lines 81 to 92 of `.agro/skills/delegate/SKILL.md` lists six rules. The last rule reads "Never bypass a hook. Report a blocked action as `BLOCKED`." The brief does not mention `git stash`. The brief does not name a rerun through a script file, a heredoc, or another tool as a bypass. Both gaps caused incidents in #1156, PR #1157. Neither incident lost data.

The approach adds two bullets to the worker brief. The approach then extends `.agro/evals/probes/delegate-worker-boundary.sh` so that the probe fails when a later edit removes either bullet. The probe already checks `never bypass a hook` against the whole file. The new checks read only the worker brief section.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/SKILL.md` | `## Worker brief`, lines 81 to 92 | Canonical worker rules. Receives the two new bullets. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | `section`, `need`, the `# source:` header | Prose probe for /delegate. Receives the new fragment checks. |
| `.agro/evals/AGENTS.md` | probe contract | Requires the implementer to drive the REGRESSION branch before landing a changed probe. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| /delegate worker brief | Prose addition | Two new rules that each worker receives at dispatch. |
| Probe suite | Assertion addition | The delegate probe checks two new fragments. |

## Storage

N/A. The change edits prose and a text probe. The change stores no state.

## Architectural Decisions

- `.agro/skills/delegate/SKILL.md` stays the one source of truth for worker rules. Do not edit a provider mirror under `.claude/`.
- The probe checks the worker brief section, not the whole file. A stash mention elsewhere in the file then cannot satisfy the check.
- The rule text uses the words "script file", "heredoc", and "another tool" from the issue. The probe fragments match that text.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/delegate-worker-boundary.sh` | Red: add the fragment checks first. The probe exits 1 on the current `.agro/skills/delegate/SKILL.md`. | The new checks detect the gap that the issue reports. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Green: add the US-001 bullets. The probe exits 0. | The brief states both rules. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Regression drive: remove each new bullet in a scratch copy. The probe exits 1 for each removal. | Each check guards exactly one rule. |

## Design Principles

- Keep the change to the smallest realistic edit: two bullets and a few probe fragments.
- Write the new bullets to /ste rules: one idea for each sentence, active voice, a named actor.
- Add no explanatory comments to tracked code. The probe `# source:` header and `# desc:` header are machine-read data.

## Out of Scope

- A hook that blocks `git stash` or that detects a rerun through a script file.
- Changes to the active-session harness rules or to other skills.
- Changes to the dispatch record, the acceptance procedure, or the integration procedure.

## Open Questions

None.

## Acceptance Criteria

- [ ] The `## Worker brief` section of `.agro/skills/delegate/SKILL.md` forbids a bare `git stash` and a bare `git stash pop`.
- [ ] The same section names a rerun of a blocked command through a script file, a heredoc, or another tool as a bypass, and requires a `BLOCKED` report.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] The probe exits 1 when either new rule is absent from the worker brief.

## Lessons

Filled by the advisor before undraft.
