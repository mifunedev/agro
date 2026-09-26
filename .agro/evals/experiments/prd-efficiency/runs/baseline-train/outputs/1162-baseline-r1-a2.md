# PRD: Delegate worker brief rules

Status: DRAFT

## User Stories

### US-001: State the stash rule and the hook-bypass rule in the worker brief

**Description:** As an advisor, I want the worker brief to state the stash and bypass rules so that workers keep stashes and hooks intact.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief has a rule that forbids a bare `git stash` and a bare `git stash pop`.
- [ ] The stash rule states the reason: every worktree and every session shares one stash stack.
- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief states that a rerun of a hook-blocked command through a script file, a heredoc, or another tool is a hook bypass.
- [ ] The same rule tells the worker to report `BLOCKED` instead of the rerun.
- [ ] The existing rule text `Never bypass a hook` stays in § Worker brief.
- [ ] `CHANGELOG.md` `## [Unreleased]` has one entry that cites issue [#1162](https://github.com/mifunedev/agro/issues/1162).
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` exits 0.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/advisor-execution-contract.sh` exits 0.

### US-002: Pin both rules in the worker-boundary probe

**Description:** As an advisor, I want `delegate-worker-boundary.sh` to fail when either rule leaves the worker brief so that a later edit cannot drop the rules silently.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/delegate-worker-boundary.sh` extracts § Worker brief with its `section` function and pins one short fragment for the stash rule and one short fragment for the script-file bypass rule.
- [ ] The probe `# source:` header cites issue #1162.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0 on the US-001 text.
- [ ] Fault injection: on a disposable copy of the repository with the stash rule removed, the probe exits 1 and names the stash fragment on stderr.
- [ ] Fault injection: on a disposable copy of the repository with the bypass rule removed, the probe exits 1 and names the bypass fragment on stderr.

## Summary

Verified current state:

- `.agro/skills/delegate/SKILL.md` lines 81 to 92 hold § Worker brief. The brief has six rules. The last rule is `Never bypass a hook. Report a blocked action as `BLOCKED`.`
- No rule in the brief names the shared stash stack. No rule names a rerun through a script file, a heredoc, or another tool.
- The active session gets both rules from the harness. A worker gets only the brief. During #1156 (PR #1157), the US-004 worker ran a bare `git stash` and `git stash pop`. The US-005 worker reran a blocked `rm -rf` through a script file.
- `.agro/evals/probes/delegate-worker-boundary.sh` exits 0 today. The probe pins `never bypass a hook` across the whole file. The probe pins no stash text and no script-file text. The issue criterion "the probe exits 0" is therefore true before and after the change.

Selected approach:

1. Add two bullets to § Worker brief. Keep the existing hook bullet. Place the bypass bullet directly after the hook bullet.
2. Extend the existing probe with two fragments scoped to § Worker brief. Do not add a new probe.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/SKILL.md` | § Worker brief | Canonical worker rules. The advisor copies these rules into each worker dispatch. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | `section`, `need`, `problems` | Tier-A prose probe that guards the `/delegate` worker boundary. |
| `.agro/evals/probes/advisor-execution-contract.sh` | `need delegate/SKILL.md` | Second prose probe over `/delegate`. The change must keep this probe green. |
| `CHANGELOG.md` | `## [Unreleased]` | Change record under `/git` § Changelog. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/delegate` worker brief | Additive rule text | Two new bullets in § Worker brief. |
| `.claude/skills/delegate/SKILL.md` | None | `.claude/skills` is a symlink to `../.agro/skills`. The mirror follows the canonical file. |
| Eval probe output | Additive check | `delegate-worker-boundary.sh` reports a missing stash or bypass fragment as `REGRESSION`. |

## Storage

N/A. The change edits prose and a stateless probe. No persistent state changes.

## Architectural Decisions

- Source of truth: `.agro/skills/delegate/SKILL.md` § Worker brief owns worker rules. Do not copy the rules into `AGENTS.md`, `.agro/tasks/AGENTS.md`, or a provider mirror.
- Scope of the probe check: match the fragments inside § Worker brief only. A match elsewhere in the file does not prove that the worker receives the rule.
- Fragment choice: pin short fragments, for example `git stash` and `script file`, per `.agro/evals/AGENTS.md` § Pinning contract text. The US-001 wording sets the final fragments.
- Surface review:
  - Host and sandbox: applied. All edits are tracked files in the sandbox checkout.
  - Lifecycle door: not applicable. No `agro` verb changes.
  - Canonical and provider surfaces: applied. The edit lands in `.agro/skills/`. The `.claude/skills` symlink still resolves.
  - Root and scaffold: applied. The skill ships to the orchestrator and to scaffolded projects through `.agro/skills/`.
  - Interactive and headless processes: not applicable. No process changes.
  - Local and remote operation: not applicable. No runtime behavior changes.
  - Parallel operation: applied. The stash rule protects parallel sessions that share one stash stack.
  - Public documentation: see Open Questions.
  - Verification: applied. See Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/delegate-worker-boundary.sh` | Stash fragment absent from § Worker brief gives exit 1 | The probe guards the stash rule. Write the stash check first. The stash check fails on the current text. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Bypass fragment absent from § Worker brief gives exit 1 | The probe guards the script-file bypass rule. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | US-001 text present gives exit 0 | Issue acceptance criterion 3. |
| `.agro/evals/probes/advisor-execution-contract.sh` | Current assertions give exit 0 | The edit breaks no other `/delegate` contract. |
| `.agro/skills/ste/scripts/ste-check.sh` | `.agro/skills/delegate/SKILL.md` gives exit 0 | The new bullets follow `/ste`. |

## Design Principles

- Keep one source of truth. The worker brief owns worker rules.
- Make the smallest change. Add two bullets and two probe fragments. Add no new file.
- Write the rule text in `/ste` style: one idea per sentence, the actor named, the condition ahead of the action.
- Add no explanatory comments to the probe. The `# source:` and `# desc:` headers are machine-read and stay.

## Out of Scope

- A hook that blocks `git stash` at runtime.
- Changes to the harness system prompt or to `.agro/hooks/`.
- The `/git` skill stash guidance at `.agro/skills/git/SKILL.md` line 164.
- Retroactive changes to the #1156 task records.

## Open Questions

1. Does this `/delegate` edit need a `PROPOSED` record in `.agro/evals/decisions/skill-impact.md`? The ledger header says `/builder` appends a record when a skill edit lands. The header still cites retired `.oh/` paths, so the current rule is unclear.
2. Does `mifunedev/agro-web` document the worker brief rules? If the site documents the rules, the site needs a matching change.
3. US-002 goes beyond the issue criteria. The issue asks only for an exit-0 probe. Confirm that the operator wants the probe to pin both rules.

## Acceptance Criteria

- [ ] `/delegate` § Worker brief forbids a bare `git stash` and `git stash pop`.
- [ ] `/delegate` § Worker brief states that a rerun of a blocked command through a script file, a heredoc, or another tool is a bypass, and that the worker reports `BLOCKED` instead.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 1 when either new rule is absent from § Worker brief.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/delegate-worker-brief-rules/prd.md` exits 0.

## Lessons

Filled by the advisor before undraft.
