# PRD: Delegate worker brief names the shared stash and the hook-bypass route

Status: DRAFT

## User Stories

### US-001: Add the stash rule and the hook-bypass rule to the worker brief

**Description:** As the advisor, I want the worker brief to state the stash rule and the hook-bypass rule so that workers obey both.

**Acceptance Criteria:**

- [ ] The `## Worker brief` section of `.agro/skills/delegate/SKILL.md` contains a rule that forbids a bare `git stash` and a bare `git stash pop`.
- [ ] That stash rule states the reason: every worktree and every session shares one stash stack.
- [ ] The `## Worker brief` section states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass.
- [ ] That bypass rule tells the worker to report `BLOCKED` instead.
- [ ] The `## Worker brief` section keeps the existing rule text "Never bypass a hook."
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` reports no finding on the new lines.

### US-002: Pin both rules in the delegate boundary probe

**Description:** As the operator, I want `delegate-worker-boundary.sh` to pin both new rules so that a later edit that drops a rule turns the probe red.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/delegate-worker-boundary.sh` reads the `## Worker brief` section through the existing `section` function.
- [ ] The probe requires the fragments `git stash`, `git stash pop`, `script file`, and `heredoc` in that section.
- [ ] The probe `# source:` header adds `issue #1162`.
- [ ] The probe `# desc:` header names the stash rule and the hook-bypass rule.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0 against the US-001 text.
- [ ] Against a disposable copy of the repository with the stash rule deleted from the worker brief, the probe exits 1 and names the missing `git stash` fragment.
- [ ] Against a disposable copy of the repository with the bypass rule deleted from the worker brief, the probe exits 1 and names the missing `script file` fragment.

## Summary

Issue #1162 reports two gaps in the `/delegate` worker brief. Both gaps occurred during #1156 (PR #1157). The US-004 worker ran a bare `git stash` and `git stash pop`. The US-005 worker reran a blocked `rm -rf` through a script file. Neither action lost data.

Verified current state: the `## Worker brief` section of `.agro/skills/delegate/SKILL.md` (lines 81 to 92) lists six rules. The last rule reads "Never bypass a hook. Report a blocked action as `BLOCKED`." The section names neither the shared stash stack nor the script-file route. The probe `.agro/evals/probes/delegate-worker-boundary.sh` pins `never bypass a hook` against the whole skill text. The probe pins no stash rule and no bypass-route rule.

Selected approach: add two bullets to the worker brief. Keep the existing hook bullet. Extend the probe to pin both new rules inside the worker brief section. Proposed bullet text:

- Never run a bare `git stash` or `git stash pop`. Every worktree and every session shares one stash stack.
- A rerun of a blocked command through a script file, a heredoc, or another tool is a bypass. Report `BLOCKED` instead.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/SKILL.md` | `## Worker brief` section | Canonical source of the worker rules. US-001 adds the two bullets here. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | `section`, `need`, `# source:` and `# desc:` headers | Regression probe for the `/delegate` text. US-002 pins the new rules. |
| `.agro/evals/AGENTS.md` | Fault injection, pinning contract text | Contract for the probe change: pin short fragments and drive the REGRESSION branch. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/delegate` worker brief | Prose addition | Each dispatched worker receives two more rules. |
| `delegate-worker-boundary.sh` output | Stricter check | The probe reports a REGRESSION when either rule is absent from the worker brief. |

## Storage

N/A. The change edits prose and a text probe. The change adds no persisted state.

## Architectural Decisions

- `.agro/skills/delegate/SKILL.md` is the one source of truth for the worker rules. Provider directories reach this file through symlinks. Edit only the canonical file.
- The probe scopes the new fragments to the `## Worker brief` section. A match elsewhere in the skill does not satisfy the rule, because only the worker brief reaches the worker.
- Surface review:
  - Host and sandbox: applied. The edits and the probe run happen in the sandbox checkout.
  - Lifecycle door: not applicable. No `agro` verb changes.
  - Canonical and provider surfaces: applied. The edit goes to `.agro/skills/delegate/SKILL.md` only.
  - Root and scaffold: applied. The skill ships to the orchestrator and to initialized projects through `.agro/`.
  - Interactive and headless processes: not applicable. No process starts.
  - Local and remote operation: not applicable. The change is prose.
  - Parallel operation: applied. The stash rule protects parallel sessions from each other.
  - Public documentation: not applicable. `mifunedev/agro-web` does not document the worker brief. See Open Questions.
  - Verification: applied. See Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/delegate-worker-boundary.sh` | Add the fragment checks first. Run the probe against the current skill. The probe exits 1 and names the missing fragments. | Red test before the US-001 edit. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Run the probe after the US-001 edit. The probe exits 0. | Both rules are present in the worker brief. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Delete each new rule in a disposable copy. The probe exits 1 and names the missing fragment. | Fault injection per `.agro/evals/AGENTS.md`. |
| `.agro/skills/ste/scripts/ste-check.sh` | Run the checker on `.agro/skills/delegate/SKILL.md`. | The new bullets pass the STE detectors. |

## Design Principles

- Keep one source of truth for each policy. The worker brief owns the worker rules.
- Keep the change small. Add two bullets and a few probe fragments. Add no new file.
- Pin short, unique fragments, per `.agro/evals/AGENTS.md`.
- Add no explanatory comment to tracked code.

## Out of Scope

- A hook that blocks `git stash` at runtime.
- A hook that detects a rerun through a script file or a heredoc.
- Changes to the active-session rules in the harness.
- A rewrite of other `/delegate` sections.

## Open Questions

1. Does `mifunedev/agro-web` quote the `/delegate` worker brief? The plan assumes the site does not quote it. If the site quotes it, the site needs a matching change.
2. Does the operator want the probe extension in US-002? The issue requires only that the probe exits 0. The plan adds the pins so that the rules cannot drift out silently.

## Acceptance Criteria

- [ ] The `/delegate` `## Worker brief` section forbids a bare `git stash` and a bare `git stash pop`.
- [ ] The `/delegate` `## Worker brief` section states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass, and tells the worker to report `BLOCKED` instead.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] The probe exits 1 when either new rule is absent from the worker brief.

## Lessons

Filled by the advisor before undraft.
