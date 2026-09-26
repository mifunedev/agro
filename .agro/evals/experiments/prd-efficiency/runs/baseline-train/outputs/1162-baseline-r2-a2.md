# PRD: Delegate worker brief rules

Status: DRAFT

## User Stories

### US-001: State the stash rule and the hook-bypass route in the worker brief

**Description:** As an advisor, I want the worker brief to state the stash rule and the hook-bypass route so that each worker follows both rules.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/delegate-worker-boundary.sh` reads the `## Worker brief` section and requires the fragments `git stash`, `git stash pop`, `script file`, `heredoc`, `another tool`, and `BLOCKED`.
- [ ] The probe `# source:` header names issue #1162.
- [ ] Before the skill edit, `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 1 and names each missing fragment on stderr.
- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief holds a rule that forbids a bare `git stash` and a bare `git stash pop`, and the rule states that every worktree and session shares one stash stack.
- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass, and that the worker reports `BLOCKED` instead.
- [ ] After the skill edit, `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/delegate-worker-brief-rules/prd.md` exits 0.

## Summary

Verified current state on `development` at `9d4f7cc`:

- `.agro/skills/delegate/SKILL.md` § Worker brief lists six rules. The last rule reads "Never bypass a hook. Report a blocked action as `BLOCKED`." No rule names `git stash`. No rule names a script file, a heredoc, or another tool as a route around a hook.
- `.agro/evals/probes/delegate-worker-boundary.sh` exits 0 today. The probe pins `never bypass a hook` against the whole flattened skill, not against the `## Worker brief` section.
- `.claude/skills` is a symlink to `../.agro/skills`. An edit to the canonical `.agro/skills/delegate/SKILL.md` reaches the Claude Code surface with no mirror edit.
- `.agro/skills/git/SKILL.md` and `.agro/skills/worktrees/SKILL.md` already tell the active session not to stash. The worker brief does not carry that rule to a worker.
- `docs/security-considerations.md` states that the `cc-safety-net` hook follows `bash -c` and `xargs` wrappers. A script file that the worker writes and then runs is a separate route. The brief must name that route as a bypass.

Selected approach:

1. Extend the probe first. Pin the new fragments against the `## Worker brief` section with the existing `section` helper. Confirm that the probe exits 1.
2. Add one stash rule to § Worker brief. Proposed text: "Never run a bare `git stash` or `git stash pop`. Every worktree and session shares one stash stack. A bare `pop` can take the entry of another session."
3. Extend the hook rule in § Worker brief. Proposed text: "Never bypass a hook. A rerun of a blocked command through a script file, a heredoc, or another tool is a bypass. Report the blocked action as `BLOCKED` instead."
4. Confirm that the probe exits 0 and that the STE checker exits 0.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/SKILL.md` | `## Worker brief` | Canonical worker rules that the advisor passes to each worker |
| `.agro/evals/probes/delegate-worker-boundary.sh` | `section`, `need`, `# source:` header | Tier-A prose probe for the `/delegate` worker boundary |
| `.claude/skills` | symlink to `../.agro/skills` | Provider surface; no edit |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/delegate` worker brief | Prose rule added | Adds the stash rule and names the script-file, heredoc, and other-tool routes around a hook |
| `delegate-worker-boundary` probe | Assertion added | Requires the new fragments inside `## Worker brief` |

## Storage

N/A. The change edits prose and one probe. The change adds no persistent state.

## Architectural Decisions

- `.agro/skills/delegate/SKILL.md` stays the one source of truth for worker rules. The plan adds no copy of the rules to `AGENTS.md`, to `/git`, or to a provider mirror.
- The probe pins the new fragments inside `## Worker brief`, not across the whole skill. A fragment that moves to another section then fails the probe.
- The rules stay prose. The plan adds no new hook that blocks `git stash` for a worker.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/delegate-worker-boundary.sh` | Worker brief lacks the stash rule | Probe exits 1 and names `git stash` on stderr |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Worker brief lacks the script-file route | Probe exits 1 and names `script file` on stderr |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Worker brief holds both rules | Probe exits 0 |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Fault injection on a disposable copy: delete each new rule in turn | Probe exits 1 for each deletion, per `.agro/evals/AGENTS.md` § Fault injection |
| `.agro/skills/ste/scripts/ste-check.sh` | `.agro/skills/delegate/SKILL.md` | New rule prose passes the STE checker |

## Design Principles

- Keep one source of truth for each policy. Edit only the canonical `.agro/` skill.
- Apply YAGNI. Add two rules and their probe fragments. Add no new machinery.
- Pin short, unique fragments, per `.agro/evals/AGENTS.md` § Pinning contract text.
- Add no explanatory comments to tracked code.
- Write every new sentence to `/ste` rules.

## Out of Scope

- A hook that blocks `git stash` or a script-file rerun at runtime.
- Changes to `.agro/skills/git/SKILL.md`, `.agro/skills/worktrees/SKILL.md`, or `AGENTS.md`.
- A regeneration of `.agro/evals/RESULTS.md`. The `/eval` run owns that file.
- Public documentation in `mifunedev/agro-web`. The worker brief is an internal procedure.

## Open Questions

None.

## Acceptance Criteria

- [ ] `/delegate` § Worker brief forbids a bare `git stash` and a bare `git stash pop`.
- [ ] `/delegate` § Worker brief states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass, and that the worker reports `BLOCKED` instead.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] The probe exits 1 when either new rule is absent from § Worker brief.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` exits 0.

## Lessons

Filled by the advisor before undraft.
