# PRD: Delegate worker brief states the stash rule and the hook-bypass rule

Status: DRAFT

## User Stories

### US-001: Pin the two rules in the delegate probe

**Description:** As the advisor, I want the delegate probe to pin both new rules so that a later edit cannot drop a rule silently.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/delegate-worker-boundary.sh` reads the `## Worker brief` section through the existing `section` function.
- [ ] The probe requires these fragments in that section: ``bare `git stash` ``, `` `git stash pop` ``, `script file`, `heredoc`, `another tool`, `is a bypass`, and `` `BLOCKED` ``.
- [ ] The `# source:` header names issue #1162.
- [ ] Red test: on the current `.agro/skills/delegate/SKILL.md`, `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 1 and names each missing fragment on stderr.
- [ ] The advisor drives the REGRESSION branch against a disposable copy of the repository, per `.agro/evals/AGENTS.md` § Fault injection, and records the stderr line.

### US-002: Add the two rules to the worker brief

**Description:** As the advisor, I want the `/delegate` worker brief to state both rules so that each worker gets the active-session rules.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief contains a rule that forbids a bare `git stash` and a bare `git stash pop`, and states that every worktree and session shares one stash stack.
- [ ] § Worker brief states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass, and that the worker reports `BLOCKED` instead.
- [ ] The existing line `Never bypass a hook. Report a blocked action as` `BLOCKED` stays in § Worker brief.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `diff .agro/skills/delegate/SKILL.md .claude/skills/delegate/SKILL.md` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` reports no finding on the new lines.

## Summary

Issue #1162 reports two gaps in `.agro/skills/delegate/SKILL.md` § Worker brief (lines 81 to 92). The section lists six rules. The last rule reads "Never bypass a hook. Report a blocked action as `BLOCKED`." No rule names the shared stash stack. No rule names the rerun of a blocked command through a script file.

Both gaps occurred during #1156 (PR #1157). The US-004 worker ran a bare `git stash` and `git stash pop`. The US-005 worker reran a blocked `rm -rf` through a script file. Neither action lost data.

The probe `.agro/evals/probes/delegate-worker-boundary.sh` pins `never bypass a hook` in the flattened skill text. The probe pins no stash fragment and no script-file fragment.

The selected approach adds two bullets to § Worker brief and pins both bullets in the existing probe. The proposed text follows:

```markdown
- Never run a bare `git stash` or `git stash pop`. Every worktree and session shares one stash stack.
- A rerun of a blocked command through a script file, a heredoc, or another tool is a bypass. Report `BLOCKED` instead.
```

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/SKILL.md` | `## Worker brief` | Canonical source of the worker rules. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | `section`, `need`, `# source:` header | Prose probe that pins the `/delegate` contract. |
| `.claude/skills/delegate/SKILL.md`, `.agents/skills/delegate/SKILL.md` | provider mirrors | Resolve through a symlinked parent directory. No edit applies. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/delegate` worker brief | Prose addition | Two new rules reach each dispatched worker. |
| `delegate-worker-boundary.sh` | Probe assertion | Seven new required fragments in § Worker brief. |

## Storage

N/A. The change edits prose and a probe. The change adds no persistent state.

## Architectural Decisions

- `.agro/skills/delegate/SKILL.md` stays the one source of the worker rules. The provider mirrors follow through the symlink.
- The existing probe owns the new assertions. The task adds no new probe file.
- The probe scopes the new fragments to § Worker brief, so that text elsewhere in the skill cannot satisfy the assertion.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/delegate-worker-boundary.sh` | Current skill text | Exit 1. Stderr names each missing § Worker brief fragment. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Skill text after US-002 | Exit 0. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Disposable copy with the stash bullet removed | Exit 1. Stderr names the stash fragment. |
| `.agro/skills/ste/scripts/ste-check.sh` | `.agro/skills/delegate/SKILL.md` | No finding on the new lines. |

## Design Principles

- Keep one source of truth for each policy. Edit the canonical `.agro/` file only.
- Add no comment to tracked code.
- Pin short, unique fragments, per `.agro/evals/AGENTS.md` § Pinning contract text.
- Apply YAGNI. Add two bullets and one assertion group. Add no new hook and no new probe.

## Out of Scope

- A hook that blocks `git stash` or a script-file rerun at runtime.
- A change to the active-session harness rules.
- Public documentation in `mifunedev/agro-web`. The worker brief is internal agent instruction text.

## Open Questions

1. Does the stash rule name an alternative for the worker?
   - A. No. Forbid the bare stash only. This plan uses option A.
   - B. Yes. Add "Commit work in progress on the worker branch instead."

## Acceptance Criteria

- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief forbids a bare `git stash` and `git stash pop`.
- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass, and that the worker reports `BLOCKED` instead.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] The probe exits 1 when either new rule is absent from § Worker brief.

## Lessons

Filled by the advisor before undraft.
