# PRD: Retire the CLAUDE.md provider-compatibility symlinks

Status: DRAFT

## User Stories

### US-001: Delete the symlinks and their tracking surfaces

**Description:** As an operator, I want the five aliases gone so that Claude Code reads `AGENTS.md` natively.

**Acceptance Criteria:**

- [ ] `git ls-files -s | grep -c '^120000.*CLAUDE.md'` prints `0`.
- [ ] `grep -n 'CLAUDE.md' .gitignore .dockerignore .github/workflows/ci-harness.yml` prints no line.
- [ ] Each of `AGENTS.md`, `crons/AGENTS.md`, `projects/AGENTS.md`, `.worktrees/AGENTS.md`, and `.agro/logs/AGENTS.md` has no "provider-compatibility symlink" notice.
- [ ] Each notice line is replaced by one sentence that names `AGENTS.md` as the single instruction file for every coding harness.

### US-002: Invert the symlink probes and guard the new invariant

**Description:** As a maintainer, I want probes to fail on a returned alias so that the single source stays enforced.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/crons-directory-guide.sh` reports REGRESSION when `crons/CLAUDE.md` exists, and no longer requires the symlink.
- [ ] `.agro/evals/probes/escalate-contract.sh` no longer requires `.agro/logs/CLAUDE.md` or its `.gitignore` negation.
- [ ] `.agro/evals/probes/worktrees-layout.sh` expects exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md` as tracked files.
- [ ] The new file `.agro/evals/probes/agents-md-native.sh` reports REGRESSION when git tracks any file named `CLAUDE.md`.
- [ ] Red test: each changed probe reports REGRESSION when the implementer restores one symlink in a scratch worktree, and passes after removal.
- [ ] All four probes pass on the branch.

### US-003: Update references and document the version floor

**Description:** As an operator, I want the docs to state the floor so that I can restore instructions on older providers.

**Acceptance Criteria:**

- [ ] `docs/glossary.md` lines 87 and 109 no longer describe a `CLAUDE.md` alias.
- [ ] `.agro/scripts/README.md` line 60 cites `AGENTS.md` instead of `CLAUDE.md`.
- [ ] `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/harness-context/SKILL.md`, `.agro/skills/render-html/SKILL.md`, and `.agro/skills/rlm/SKILL.md` cite `AGENTS.md` where each file names this repository's bootloader.
- [ ] The generic target-repository guidance in `.agro/skills/blog/SKILL.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, and `.agro/skills/plan/SKILL.md` stays unchanged.
- [ ] `docs/harnesses/claude-code.md` states the Claude Code 2.1.277 floor.
- [ ] `docs/harnesses/claude-code.md` names Bedrock, Vertex, Foundry, and telemetry-disabled sessions as unsupported for `AGENTS.md`.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that holds `@AGENTS.md`, plus one per nested guide.

## Summary

Git tracks five `CLAUDE.md` symlinks to sibling `AGENTS.md` files: root, `crons`, `projects`, `.worktrees`, and `.agro/logs`. Claude Code 2.1.277 reads `AGENTS.md` when no `CLAUDE.md` exists in the working directory or above it. The symlinks therefore suppress native behavior. `.gitignore` and `.dockerignore` negate the ignore rules for the aliases. `.github/workflows/ci-harness.yml` lists `CLAUDE.md` in two path filters. Three probes assert the symlinks. The approach deletes the aliases and their surfaces, inverts the probes, adds one guard probe, and documents the floor and escape hatch.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md` | symlink | Delete. |
| `crons/CLAUDE.md` | symlink | Delete. |
| `projects/CLAUDE.md` | symlink | Delete. |
| `.worktrees/CLAUDE.md` | symlink | Delete. |
| `.agro/logs/CLAUDE.md` | symlink | Delete. |
| `.gitignore` | lines 19, 22, 29, 34 | Remove the `CLAUDE.md` negations, including the legacy .oh/logs line. |
| `.dockerignore` | lines 8, 11 | Remove the `CLAUDE.md` negations. |
| `.github/workflows/ci-harness.yml` | lines 32, 57 | Remove the `CLAUDE.md` path-filter entries. |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` check, lines 24 to 30 | Invert the assertion. |
| `.agro/evals/probes/escalate-contract.sh` | lines 18 to 21 | Drop the symlink and negation assertions. |
| `.agro/evals/probes/worktrees-layout.sh` | `expected`, line 33 | Drop the `CLAUDE.md` entries. |
| `docs/harnesses/claude-code.md` | new section | Hold the floor and the escape hatch. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior | Claude Code reads `AGENTS.md` natively under the `claude-md-or-agents-md` setting. |
| Supported Claude Code version | Floor raise | AGRO requires Claude Code 2.1.277 or newer. |
| Bedrock, Vertex, Foundry sessions | Removal | These sessions lose project instructions unless the operator adds the escape hatch. |

## Storage

N/A. The change touches tracked files and git symlink entries only.

## Architectural Decisions

- `AGENTS.md` is the single source of truth for every coding harness. No per-provider mirror remains.
- `.agro/evals/probes/oh-update-bootstrap.sh` line 56 lists `CLAUDE.md` as an unwanted payload file. Keep that line, because the deletion keeps the rule true.
- The maintainer owns the compatibility decision. The operator must approve the floor before the build starts.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/crons-directory-guide.sh` | alias present fails; alias absent passes | `crons` has no alias. |
| `.agro/evals/probes/escalate-contract.sh` | runs without the symlink | The escalate contract holds without the alias. |
| `.agro/evals/probes/worktrees-layout.sh` | tracked set equals the two `AGENTS.md` files | Layout matches the new invariant. |
| new file `.agro/evals/probes/agents-md-native.sh` | any tracked `CLAUDE.md` fails; none passes | Repository-wide invariant. |

Run the probe suite with /eval after the change. Every probe must report PASS or SKIPPED.

## Design Principles

- Keep one source of truth for each policy.
- Delete obsolete paths instead of leaving dormant alternatives.
- Add no explanatory comments to tracked code.
- Keep generic guidance for arbitrary target repositories unchanged.

## Out of Scope

- The `CLAUDE.md` mentions in generic target-repository guidance.
- Scaffolded projects that other repositories already initialized.
- Automatic creation of the escape-hatch file for Bedrock, Vertex, or Foundry operators.

## Open Questions

1. The issue names four skill references, but five files cite `CLAUDE.md` as this repository's bootloader. Does the operator confirm all five?
2. Does the orchestrator scaffold write a `CLAUDE.md` symlink into initialized projects? The implementer must check the scaffold path and report the result.
3. Does mifunedev/agro-web need a matching change for the version floor?
4. Does the operator approve the Claude Code 2.1.277 floor and the loss of instructions on Bedrock, Vertex, and Foundry?

## Acceptance Criteria
- [ ] `git ls-files | grep -c 'CLAUDE.md$'` prints `0`.
- [ ] The probes `crons-directory-guide.sh`, `escalate-contract.sh`, `worktrees-layout.sh`, and `agents-md-native.sh` exit 0 on the branch.
- [ ] `docs/harnesses/claude-code.md` holds the version floor and the escape hatch.
- [ ] The operator records approval of the floor before the pull request leaves draft.

## Lessons

Filled by the advisor before undraft.
