# PRD: Retire the CLAUDE.md compatibility symlinks

Status: BLOCKED

## User Stories

### US-001: Delete the symlinks and their ignore and CI entries

**Description:** As an operator, I want `AGENTS.md` as the only instruction file so that every harness reads one source.

**Acceptance Criteria:**

- [ ] `git ls-files -s | grep -E '^120000.*CLAUDE\.md$'` prints no line.
- [ ] `grep -n 'CLAUDE' .gitignore .dockerignore` prints no line.
- [ ] `grep -n '"CLAUDE.md"' .github/workflows/ci-harness.yml` prints no line.
- [ ] `git grep -n 'provider-compatibility symlink' -- '*AGENTS.md'` prints no line.
- [ ] Each of the five `AGENTS.md` files that carried the notice states that `AGENTS.md` is the instruction file for every harness.

### US-002: Invert the symlink probes and guard the new invariant

**Description:** As a maintainer, I want probes that reject a `CLAUDE.md` alias so that the symlinks cannot return silently.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/escalate-contract.sh` reports REGRESSION if `.agro/logs/CLAUDE.md` exists, and does not require a CLAUDE.md negation in `.gitignore`.
- [ ] `.agro/evals/probes/worktrees-layout.sh` expects exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md` as the tracked files.
- [ ] `.agro/evals/probes/crons-directory-guide.sh` reports REGRESSION if `crons/CLAUDE.md` exists.
- [ ] The new file `.agro/evals/probes/agents-md-only.sh` reports REGRESSION when git tracks any file named `CLAUDE.md`.
- [ ] Red test: each of the four probes exits with REGRESSION on the base commit, before US-001 lands.
- [ ] Each of the four probes exits 0 with PASS after US-001 lands.

### US-003: Update references and document the version floor

**Description:** As an operator, I want accurate documentation so that I know the version floor and the escape hatch.

**Acceptance Criteria:**

- [ ] `docs/glossary.md` names no `CLAUDE.md` alias on line 87 or line 109.
- [ ] `.agro/scripts/README.md`, `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/harness-context/SKILL.md`, `.agro/skills/render-html/SKILL.md`, and `.agro/skills/rlm/SKILL.md` cite `AGENTS.md` where they cite `CLAUDE.md` as this repository's bootloader.
- [ ] Generic guidance that reads a target repository's `AGENTS.md` or `CLAUDE.md` stays unchanged in `.agro/skills/blog/SKILL.md`, `.agro/skills/builder/SKILL.md`, and `.agro/skills/plan/SKILL.md`.
- [ ] `docs/harnesses/claude-code.md` states the floor of Claude Code 2.1.277 or later.
- [ ] `docs/harnesses/claude-code.md` states that Bedrock, Vertex, and Foundry sessions do not read `AGENTS.md`.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that contains `@AGENTS.md`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/claude-code.md` exits 0.

## Summary

Git tracks five symlinks: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`. Each symlink points at the sibling `AGENTS.md`. Claude Code 2.1.277 reads `AGENTS.md` natively when no `CLAUDE.md` exists. A `CLAUDE.md` in the working directory or in a parent directory disables that native path. The symlinks therefore suppress the native behavior.

The approach deletes the symlinks and their `.gitignore`, `.dockerignore`, and `.github/workflows/ci-harness.yml` entries. The approach inverts three probes and adds one probe. The approach updates the bootloader references and documents the version floor. The issue states that the compatibility cost is the maintainer's decision. The status stays BLOCKED until the maintainer accepts that cost.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.gitignore` | lines 19, 22, 29, 34 | CLAUDE.md negations to delete, including the legacy .oh/logs entry |
| `.dockerignore` | lines 8, 11 | CLAUDE.md negations to delete |
| `.github/workflows/ci-harness.yml` | path filters at lines 32 and 57 | "CLAUDE.md" entries to delete |
| `AGENTS.md` | line 8 notice | Notice to replace |
| `.worktrees/AGENTS.md` | line 7 notice | Notice to replace |
| `projects/AGENTS.md` | line 11 notice | Notice to replace |
| `crons/AGENTS.md` | line 9 notice | Notice to replace |
| `.agro/logs/AGENTS.md` | line 3 notice | Notice to replace |
| `.agro/evals/probes/escalate-contract.sh` | lines 18-21 | Symlink assertion to invert |
| `.agro/evals/probes/worktrees-layout.sh` | `expected`, alias loop at lines 33-40 | Tracked-file set to shrink |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` at lines 24-30, PASS line 51 | Symlink assertion to invert |
| `.agro/evals/probes/oh-update-bootstrap.sh` | `unwanted` list at line 56 | Keep unchanged; the list already rejects `CLAUDE.md` |
| `docs/harnesses/claude-code.md` | new section | Version floor and escape hatch |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Repository layout | Removal | Five `CLAUDE.md` symlinks leave the tree |
| Claude Code minimum version | Breaking | The floor becomes Claude Code 2.1.277 |
| Public documentation | Update | The mifunedev/agro-web site describes the alias; see Open Questions |

## Storage

N/A. The change touches tracked files only and adds no persistent state.

## Architectural Decisions

- `AGENTS.md` is the single source of truth for every harness.
- The repository ships no per-provider instruction mirror.
- An operator on Bedrock, Vertex, or Foundry restores instructions in the operator's own checkout.
- Surfaces: host and sandbox applied (repository files only); lifecycle door not applicable; canonical and provider surfaces applied; root applied; scaffold not applicable, because no file under `.agro/install` or `.agro/cli` creates a `CLAUDE.md`; interactive and headless processes not applicable; local and remote operation not applicable; parallel operation not applicable; public documentation applied; verification applied.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/escalate-contract.sh` | `.agro/logs/CLAUDE.md` is absent | US-002 |
| `.agro/evals/probes/worktrees-layout.sh` | tracked set equals the two `AGENTS.md` guides | US-002 |
| `.agro/evals/probes/crons-directory-guide.sh` | `crons/CLAUDE.md` is absent | US-002 |
| new file `.agro/evals/probes/agents-md-only.sh` | `git ls-files` lists no `CLAUDE.md` at any depth | US-001, US-002 |
| `.agro/skills/ste/scripts/ste-check.sh` | changed prose passes | US-003 |

Run the full suite with /eval after each story.

## Design Principles

- Keep one source of truth for each policy.
- Delete obsolete paths instead of leaving dormant alternatives.
- Add no explanatory comments to tracked code.
- Leave generic guidance about arbitrary target repositories unchanged.

## Out of Scope

- Changes to `.agro/skills/blog/SKILL.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, and `.agro/skills/plan/SKILL.md`.
- Changes to `.agro/evals/decisions/skill-impact.md`, archived plans, and task traces.
- A runtime check of the Claude Code version.
- Edits to the mifunedev/agro-web repository.

## Open Questions

1. Does the maintainer accept the Claude Code 2.1.277 floor and the loss of instructions on Bedrock, Vertex, Foundry, and telemetry-disabled sessions? This decision blocks the plan.
2. Does the escape hatch need a per-directory `CLAUDE.md` for each nested guide, or only the root file?
3. Which page in mifunedev/agro-web describes the alias, and who owns that edit?

## Acceptance Criteria

- [ ] `git ls-files | grep -c 'CLAUDE\.md$'` prints `0`.
- [ ] Every probe under `.agro/evals/probes` exits without REGRESSION when /eval runs.
- [ ] The CI harness workflow passes on the pull request.
- [ ] The maintainer records acceptance of the version floor in the pull request.

## Lessons

Filled by the advisor before undraft.
