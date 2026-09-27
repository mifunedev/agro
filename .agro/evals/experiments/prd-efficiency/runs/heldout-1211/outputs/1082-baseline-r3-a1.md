# PRD: Retire the CLAUDE.md symlinks

Status: BLOCKED

Source: issue #1082 (`work/issue-1082.md`).

## User Stories

### US-001: Make AGENTS.md the only tracked instruction file

**Description:** As an operator, I want each directory guide to exist only as `AGENTS.md` so that every coding harness reads one source of truth.

**Acceptance Criteria:**

- [ ] `git ls-files | grep -E '(^|/)CLAUDE\.md$'` prints nothing.
- [ ] `grep -n 'CLAUDE.md' .gitignore .dockerignore .github/workflows/ci-harness.yml` prints nothing.
- [ ] `git check-ignore -q .worktrees/CLAUDE.md` exits 0, and `git check-ignore -q projects/CLAUDE.md` exits 0.
- [ ] `git grep -n 'provider-compatibility symlink' -- AGENTS.md .worktrees/AGENTS.md projects/AGENTS.md crons/AGENTS.md .agro/logs/AGENTS.md` prints nothing.
- [ ] Each of the five `AGENTS.md` files states that each supported coding harness reads the file directly.
- [ ] `.agro/evals/probes/crons-directory-guide.sh` exits 0 and fails with exit 1 when `crons/CLAUDE.md` exists.
- [ ] `.agro/evals/probes/escalate-contract.sh` exits 0 and fails with exit 1 when `.agro/logs/CLAUDE.md` exists.
- [ ] `.agro/evals/probes/worktrees-layout.sh` exits 0 and expects the tracked set `.worktrees/AGENTS.md` and `projects/AGENTS.md` only.
- [ ] A new probe `.agro/evals/probes/agents-md-sole-instructions.sh` exits 0 on the changed tree.
- [ ] The new probe exits 1 when a tracked `CLAUDE.md` exists at any path.
- [ ] The new probe exits 1 when `.gitignore`, `.dockerignore`, or `.github/workflows/ci-harness.yml` names `CLAUDE.md`.
- [ ] `bash .agro/evals/probes/context-tier-size-budget.sh` exits 0.
- [ ] `bash .agro/evals/probes/agents-identity-contract.sh` exits 0.

### US-002: Point repository references at AGENTS.md

**Description:** As an agent, I want each reference to this repository's bootloader to name `AGENTS.md` so that no document points at a deleted file.

**Acceptance Criteria:**

- [ ] `docs/glossary.md` names `AGENTS.md` in the **orchestrator** entry and the **rule** entry, and names no `CLAUDE.md` alias.
- [ ] `.agro/scripts/README.md` cites `AGENTS.md` for the orchestrator boundary.
- [ ] `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/harness-context/SKILL.md`, `.agro/skills/rlm/SKILL.md`, and `.agro/skills/render-html/SKILL.md` name `AGENTS.md` where each file names this repository's bootloader.
- [ ] The generic target-repository guidance stays unchanged in `.agro/skills/blog/SKILL.md`, `.agro/skills/blog/references/loom-to-blog.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, `.agro/skills/plan/SKILL.md`, and `.pi/APPEND_SYSTEM.md`.
- [ ] `git grep -n 'CLAUDE.md' -- docs .agro/scripts .agro/skills` prints only the generic target-repository lines from the previous criterion and historical lines in `docs/rfcs/`.

### US-003: Document the version floor and the escape hatch

**Description:** As an affected operator, I want the version floor and the escape hatch documented so that I can restore project instructions.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` states that AGRO requires Claude Code `2.1.277` or newer to read `AGENTS.md`.
- [ ] `docs/harnesses/claude-code.md` states that Amazon Bedrock, Vertex, Foundry, and sessions with telemetry disabled do not read `AGENTS.md`.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that contains `@AGENTS.md`, plus one per nested guide that the operator needs.
- [ ] `docs/harnesses/claude-code.md` states that the `claude-md-or-agents-md` setting under "Project instructions" in `/config` controls the behavior.
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]` that names the removed symlinks, the version floor, and the escape hatch.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/claude-code.md` reports no finding on the new lines.

## Summary

Verified current state:

- Git tracks five `CLAUDE.md -> AGENTS.md` symlinks: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- `.gitignore` negates `!.worktrees/CLAUDE.md`, `!projects/CLAUDE.md`, `!.oh/logs/CLAUDE.md`, and `!.agro/logs/CLAUDE.md`. `.dockerignore` negates `!.worktrees/CLAUDE.md` and `!projects/CLAUDE.md`.
- `.github/workflows/ci-harness.yml` lists `"CLAUDE.md"` in the `push` and `pull_request` path filters (lines 32 and 57).
- Each of the five `AGENTS.md` files carries the line "`CLAUDE.md` is a provider-compatibility symlink to this file. Edit `AGENTS.md`."
- Three probes assert that a symlink exists: `crons-directory-guide.sh`, `escalate-contract.sh`, and `worktrees-layout.sh`.
- `agro harness install claude-code` installs `@anthropic-ai/claude-code` with no version pin (`.agro/cli/src/lib/harnesses/catalog.ts`). A new install gets the latest release.

Claude Code `2.1.277` reads `AGENTS.md` natively when no `CLAUDE.md` exists in the working directory or in any ancestor directory. The tracked symlinks therefore suppress the native behavior. The selected approach deletes the symlinks and every surface that exists only to keep them. The approach then inverts the probes and documents the version floor and the escape hatch.

The issue text says "four skill references". The repository has five skill files that name `CLAUDE.md` as this repository's bootloader. US-002 lists all five.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md` | symlinks | Deleted |
| `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, `.agro/logs/AGENTS.md` | symlink notice line | Replaced |
| `.gitignore` | `CLAUDE.md` negations (lines 19, 22, 29, 34) | Deleted |
| `.dockerignore` | `CLAUDE.md` negations (lines 8, 11) | Deleted |
| `.github/workflows/ci-harness.yml` | `paths` entries `"CLAUDE.md"` | Deleted |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` block, PASS message | Inverted |
| `.agro/evals/probes/escalate-contract.sh` | symlink check, `keep` loop | Inverted |
| `.agro/evals/probes/worktrees-layout.sh` | `expected`, alias loop, header | Inverted |
| `.agro/evals/probes/agents-md-sole-instructions.sh` | new probe | Guards the invariant |
| `.agro/evals/RESULTS.md` | probe rows | Updated by the eval runner |
| `docs/glossary.md` | **orchestrator**, **rule** | Alias wording removed |
| `.agro/scripts/README.md` | line 60 | Reference updated |
| `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/harness-context/SKILL.md`, `.agro/skills/rlm/SKILL.md`, `.agro/skills/render-html/SKILL.md` | bootloader references | Reference updated |
| `docs/harnesses/claude-code.md` | new section | Version floor and escape hatch |
| `CHANGELOG.md` | `## [Unreleased]` | Entry added |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior | Claude Code reads `AGENTS.md` through the native path instead of through a `CLAUDE.md` symlink. |
| Claude Code version floor | Compatibility | Claude Code older than `2.1.277` reads no project instructions in this repository. |
| Bedrock, Vertex, Foundry, telemetry-disabled sessions | Compatibility | These sessions read no project instructions until the operator adds the escape hatch. |
| Public documentation `mifunedev/agro-web` | Documentation | A matching change is `<pending>`. See open question 3. |

## Storage

N/A. The change removes tracked symlinks and edits text files. The change adds no persistent state.

## Architectural Decisions

- `AGENTS.md` is the single source of truth for project instructions in every directory that has a guide. No provider mirror remains.
- The escape hatch lives in the operator's checkout, not in the repository. The repository tracks no `CLAUDE.md`.
- The new probe guards the invariant for the whole tree, so a future directory guide cannot add a `CLAUDE.md` alias silently.
- Affected surfaces:
  - **Host and sandbox:** applied. The change is repository content. The orchestrator edits root files. The change touches no application code.
  - **Lifecycle door:** not applicable. No `agro` verb creates or reads `CLAUDE.md`.
  - **Canonical and provider surfaces:** applied. The five `AGENTS.md` files become the only instruction files.
  - **Root and scaffold:** applied to the root only. `agro update` writes no `AGENTS.md` and no `CLAUDE.md` to an initialized project (`.agro/cli/src/cli.ts:230`).
  - **Interactive and headless processes:** not applicable.
  - **Local and remote operation:** not applicable.
  - **Parallel operation:** applied. A worktree created after the merge has no `CLAUDE.md`. A worktree created before the merge keeps the symlinks until the worktree catches up.
  - **Public documentation:** applied. See open question 3.
  - **Verification:** applied. See the test plan.

## Test Plan (TDD)

Write or invert each probe first. Confirm that each probe exits 1 on the current tree. Then make the change and confirm that each probe exits 0.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/agents-md-sole-instructions.sh` | No tracked `CLAUDE.md`. No `CLAUDE.md` in `.gitignore`, `.dockerignore`, or `ci-harness.yml`. No symlink notice in any `AGENTS.md`. | The new invariant |
| `.agro/evals/probes/crons-directory-guide.sh` | `crons/CLAUDE.md` is absent. | Inverted assertion |
| `.agro/evals/probes/escalate-contract.sh` | `.agro/logs/CLAUDE.md` is absent. `.gitignore` keeps `!.agro/logs/AGENTS.md` only. | Inverted assertion |
| `.agro/evals/probes/worktrees-layout.sh` | Tracked set is `.worktrees/AGENTS.md` and `projects/AGENTS.md`. | Inverted assertion |
| `.agro/evals/probes/context-tier-size-budget.sh` | Root `AGENTS.md` stays under `TIER_BUDGET_BYTES`. | No regrowth |
| `.agro/evals/probes/agents-identity-contract.sh` | Root `AGENTS.md` identity contract. | No regression |
| All probes | `bash .claude/skills/eval/run.sh` | No new regression |

## Design Principles

- Keep one source of truth for each policy. Delete the mirror instead of maintaining it.
- Delete obsolete paths. Leave no dormant `CLAUDE.md` negation or path filter.
- Change only this repository's bootloader references. Keep generic guidance for arbitrary target repositories.
- Add no explanatory comments to tracked code. The probe header lines are machine-read metadata.

## Out of Scope

- A version pin for `@anthropic-ai/claude-code` in `.agro/cli/src/lib/harnesses/catalog.ts`.
- A runtime check that warns when the installed Claude Code is older than `2.1.277`.
- Automatic creation of the escape-hatch `CLAUDE.md` for Bedrock, Vertex, or Foundry operators.
- Edits to historical text in `docs/rfcs/`, `.agro/tasks/`, `.agro/evals/decisions/`, and released `CHANGELOG.md` sections.
- The `.claude/skills` and `.claude/hooks` symlinks. These symlinks expose skills and hooks, not project instructions.

## Open Questions

1. Does the maintainer accept the compatibility cost? The change raises the Claude Code floor to `2.1.277`. Bedrock, Vertex, Foundry, and telemetry-disabled sessions lose project instructions. The issue states that this decision belongs to the maintainer. This question blocks the plan.
   - A. Accept. Ship the change as planned.
   - B. Defer until Claude Code reads `AGENTS.md` on Bedrock, Vertex, and Foundry.
   - C. Other: <specify>
2. Where does the escape hatch live in the documentation? The plan uses `docs/harnesses/claude-code.md`.
   - A. `docs/harnesses/claude-code.md` only.
   - B. `docs/harnesses/claude-code.md` plus a pointer in `docs/installation.md`.
   - C. Other: <specify>
3. Does `mifunedev/agro-web` need a matching change for the version floor and the escape hatch? The owner and the target page are `<agro-web page>`.
4. What exact replacement text goes in the five `AGENTS.md` notices? The plan proposes the text `Claude Code, Codex, and Pi read AGENTS.md directly. Edit AGENTS.md.` The root notice must keep `AGENTS.md` under the `TIER_BUDGET_BYTES` value of `9500`.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .claude/skills/eval/run.sh` reports no probe as REGRESSION.
- [ ] `git ls-files | grep -E '(^|/)CLAUDE\.md$'` prints nothing.
- [ ] The maintainer answers open question 1 with an explicit acceptance before the pull request leaves draft.
- [ ] The CI job defined in `.github/workflows/ci-harness.yml` passes on the pull request.

## Lessons

Filled by the advisor before undraft.
