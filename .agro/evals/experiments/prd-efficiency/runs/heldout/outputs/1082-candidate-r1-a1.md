# PRD: Retire CLAUDE.md symlinks for native AGENTS.md

Status: DRAFT

## User Stories

### US-001: Delete the five symlinks and their ignore and CI entries

**Description:** As an operator, I want no tracked `CLAUDE.md` alias so that Claude Code reads `AGENTS.md` natively.

**Acceptance Criteria:**

- [ ] `git ls-files -s | grep -E '^120000.*CLAUDE\.md$'` prints no line.
- [ ] `git grep -n 'CLAUDE.md' -- .gitignore .dockerignore .github/workflows/ci-harness.yml` prints no line.
- [ ] No `AGENTS.md` file contains the text "provider-compatibility symlink".
- [ ] Each of the five `AGENTS.md` files states that `AGENTS.md` is the project-instructions file for every harness.

### US-002: Invert the symlink probes and guard the new invariant

**Description:** As a maintainer, I want probes that reject a tracked `CLAUDE.md` so that the alias cannot return.

**Acceptance Criteria:**

- [ ] Before the US-001 change, the new probe exits 1 and prints `REGRESSION`.
- [ ] After the US-001 change, `bash .agro/evals/probes/crons-directory-guide.sh` exits 0.
- [ ] After the US-001 change, `bash .agro/evals/probes/escalate-contract.sh` exits 0.
- [ ] After the US-001 change, `bash .agro/evals/probes/worktrees-layout.sh` exits 0.
- [ ] The new file `.agro/evals/probes/agents-md-native.sh` fails when git tracks any path that ends in `CLAUDE.md`.
- [ ] The new probe exits 0 on the US-001 tree.

### US-003: Document the version floor and the escape hatch

**Description:** As an operator, I want the Claude Code version floor documented so that I can restore instructions on unsupported providers.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` states the floor Claude Code 2.1.277 or newer.
- [ ] `docs/harnesses/claude-code.md` names Bedrock, Vertex, Foundry, and telemetry-disabled sessions as unsupported.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that contains `@AGENTS.md`.
- [ ] `docs/glossary.md` lines 87 and 109 no longer describe a `CLAUDE.md` alias.
- [ ] Each skill reference in the Key Integration Points table names `AGENTS.md` as this repository's bootloader.
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]` that states the removal and the version floor.

## Summary

Git tracks five `CLAUDE.md` symlinks to the sibling `AGENTS.md`: at the root, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`. Claude Code 2.1.277 reads `AGENTS.md` natively when no `CLAUDE.md` exists in the working directory or above it. The symlinks therefore suppress the native behavior. Codex and Pi already read `AGENTS.md`.

The change deletes the symlinks, the ignore negations, and the CI path filters. It inverts three probes and adds one probe. It rewrites the notices, the docs, and the skill references that name this repository's `CLAUDE.md`. Generic guidance that reads a target repository's `AGENTS.md` or `CLAUDE.md` stays unchanged. The issue text is the source for the 2.1.277 floor and the provider list.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md` | root symlink | Delete. |
| `.worktrees/CLAUDE.md` | symlink | Delete. |
| `projects/CLAUDE.md` | symlink | Delete. |
| `crons/CLAUDE.md` | symlink | Delete. |
| `.agro/logs/CLAUDE.md` | symlink | Delete. |
| `.gitignore` | lines 19, 22, 29, 34 | Remove the four `CLAUDE.md` negations, including the legacy entry for the old logs directory. |
| `.dockerignore` | lines 8, 11 | Remove the two `CLAUDE.md` negations. |
| `.github/workflows/ci-harness.yml` | paths filters, lines 32 and 57 | Remove the `CLAUDE.md` entries. |
| `AGENTS.md` | line 8 notice | Replace the symlink notice. |
| `.worktrees/AGENTS.md` | line 7 notice | Replace the symlink notice. |
| `projects/AGENTS.md` | line 11 notice | Replace the symlink notice. |
| `crons/AGENTS.md` | line 9 notice | Replace the symlink notice. |
| `.agro/logs/AGENTS.md` | line 3 notice | Replace the symlink notice. |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` check, lines 24-30 and 51 | Require the absence of `crons/CLAUDE.md`. |
| `.agro/evals/probes/escalate-contract.sh` | lines 18-21 | Require the absence of `.agro/logs/CLAUDE.md`. Drop its keep entry. |
| `.agro/evals/probes/worktrees-layout.sh` | `expected` list, lines 6, 33-40 | Expect only the two `AGENTS.md` files. |
| `docs/glossary.md` | lines 87, 109 | Remove the alias wording. |
| `.agro/scripts/README.md` | line 60 | Cite `AGENTS.md`. |
| `.agro/skills/audit/references/context.md` | Bootloader row, line 9 | Cite `AGENTS.md` alone. |
| `.agro/skills/audit/references/harness.md` | line 120 | Cite `AGENTS.md`. |
| `.agro/skills/harness-context/SKILL.md` | lines 19, 44 | Cite `AGENTS.md`. |
| `.agro/skills/rlm/SKILL.md` | line 65 | Cite `AGENTS.md`. |
| `.agro/skills/render-html/SKILL.md` | line 38 | Cite `AGENTS.md`. |
| `docs/harnesses/claude-code.md` | new section | Add the version floor and the escape hatch. |
| `CHANGELOG.md` | `## [Unreleased]` | Add the entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior | Claude Code 2.1.277 or newer loads `AGENTS.md` through the native path. |
| Unsupported providers | Removal | Bedrock, Vertex, Foundry, and telemetry-disabled sessions lose project instructions unless the operator adds the escape hatch. |
| Public docs in mifunedev/agro-web | Docs | Update each page that describes the `CLAUDE.md` alias. |

## Storage

N/A. The change deletes tracked files and edits text. No persistent state changes.

## Architectural Decisions

- `AGENTS.md` is the single source of project instructions for every harness.
- The repository ships no per-provider instruction mirror.
- An operator on an unsupported provider owns the escape hatch in the operator's own checkout.
- Edit the canonical `.agro/skills/` sources. Do not edit the `.claude/skills` mirrors.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/crons-directory-guide.sh` | `crons/CLAUDE.md` is absent | US-002 inversion |
| `.agro/evals/probes/escalate-contract.sh` | `.agro/logs/CLAUDE.md` is absent | US-002 inversion |
| `.agro/evals/probes/worktrees-layout.sh` | git tracks only the two `AGENTS.md` files | US-002 inversion |
| new file `.agro/evals/probes/agents-md-native.sh` | no tracked path ends in `CLAUDE.md` | US-002 invariant |
| `.agro/evals/probes/oh-update-bootstrap.sh` | unchanged, still exits 0 | no regression |

Write each probe change first. Confirm the red result on the base tree. Then apply US-001 and confirm the green result.

## Design Principles

- Keep one source of truth for each policy.
- Delete obsolete paths instead of dormant alternatives.
- Add no explanatory comments to tracked code.
- Change generic guidance for arbitrary repositories only when the guidance names this repository.

## Out of Scope

- Generic "read `AGENTS.md` or `CLAUDE.md` if present" guidance in `.agro/skills/builder/SKILL.md`, `.agro/skills/plan/SKILL.md`, and `.agro/skills/blog/references/loom-to-blog.md`.
- Historic `CHANGELOG.md` entries.
- A version check in the `agro` CLI.
- Edits to the mifunedev/agro-web repository. This task records the follow-up only.

## Open Questions

1. The issue states a compatibility cost. Does plan approval confirm that the maintainer accepts the Claude Code 2.1.277 floor and the loss on Bedrock, Vertex, and Foundry?
2. `CHANGELOG.md` line 341 states that `oh init` creates nested `CLAUDE.md` symlinks for equipped repos. A grep of `.agro/cli` and `.agro/install` found no such code. Does a scaffold path at <scaffold path> still create the symlinks?
3. Does the change need a release note under a breaking-change heading, or is an `### Removed` entry enough?

## Acceptance Criteria

- [ ] Each US-001, US-002, and US-003 criterion passes.
- [ ] Each probe in `.agro/evals/probes` that exited 0 on the base commit exits 0 after the change.
- [ ] `git grep -n 'provider-compatibility symlink'` prints no line outside `CHANGELOG.md`.
- [ ] The PR body names the version floor and the escape hatch.

## Lessons

Filled by the advisor before undraft.
