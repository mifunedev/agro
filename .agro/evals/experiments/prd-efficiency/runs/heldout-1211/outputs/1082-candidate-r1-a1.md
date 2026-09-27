# PRD: Retire the CLAUDE.md provider-compatibility symlinks

Status: DRAFT

## User Stories

### US-001: Guard the AGENTS.md-only invariant with probes

**Description:** As the maintainer, I want the probes to assert that no tracked `CLAUDE.md` exists so that a reintroduced alias turns the eval suite red.

**Acceptance Criteria:**

- [ ] The new probe `.agro/evals/probes/agents-md-single-source.sh` exits non-zero while any of the five symlinks is tracked.
- [ ] The new probe fails when `git ls-files -- 'CLAUDE.md' '*/CLAUDE.md'` prints a path.
- [ ] The new probe fails when `.gitignore` or `.dockerignore` contains a line that ends in `/CLAUDE.md` and starts with `!`.
- [ ] The new probe fails when `.github/workflows/ci-harness.yml` contains the string `"CLAUDE.md"`.
- [ ] The new probe fails when a tracked `AGENTS.md` contains the string `provider-compatibility symlink`.
- [ ] `.agro/evals/probes/crons-directory-guide.sh` asserts that `crons/CLAUDE.md` does not exist, and its PASS line no longer names a `CLAUDE.md` symlink.
- [ ] `.agro/evals/probes/escalate-contract.sh` asserts that `.agro/logs/CLAUDE.md` does not exist and that `.gitignore` has no `!.agro/logs/CLAUDE.md` line.
- [ ] `.agro/evals/probes/worktrees-layout.sh` expects `git ls-files .worktrees projects` to print exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md`.
- [ ] Before US-002 lands, each of the four probes above exits non-zero on the current tree.

### US-002: Delete the symlinks and their ignore and CI entries

**Description:** As an operator, I want the repository to ship no `CLAUDE.md` file so that Claude Code reads `AGENTS.md` natively.

**Acceptance Criteria:**

- [ ] `git ls-files -s | awk '$1=="120000"' | grep CLAUDE.md` prints nothing.
- [ ] The files `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md` do not exist.
- [ ] `grep -n 'CLAUDE.md' .gitignore .dockerignore` prints nothing. This includes the legacy `!.oh/logs/CLAUDE.md` line.
- [ ] `grep -n '"CLAUDE.md"' .github/workflows/ci-harness.yml` prints nothing. The `"AGENTS.md"` entries stay in both path lists.
- [ ] `.agro/evals/probes/agents-md-single-source.sh`, `crons-directory-guide.sh`, `escalate-contract.sh`, and `worktrees-layout.sh` each exit 0.

### US-003: Replace the alias notice in each AGENTS.md

**Description:** As a coding agent, I want each `AGENTS.md` to name itself the single instruction file so that no guide cites a missing file.

**Acceptance Criteria:**

- [ ] `git grep -n 'provider-compatibility symlink' -- '*AGENTS.md'` prints nothing.
- [ ] `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, and `.agro/logs/AGENTS.md` each state that every coding harness reads the file directly.
- [ ] The root `AGENTS.md` names the Claude Code version floor `2.1.277` and links to the escape-hatch section that US-005 adds.

### US-004: Update the docs and skill references that name CLAUDE.md as this repository's bootloader

**Description:** As a harness reader, I want each citation of this repository's instruction file to name `AGENTS.md` so that the docs match the tree.

**Acceptance Criteria:**

- [ ] `docs/glossary.md` lines 87 and 109 no longer describe a `CLAUDE.md` alias.
- [ ] `.agro/scripts/README.md` line 60 cites `AGENTS.md`.
- [ ] `.agro/skills/audit/references/context.md` line 9 lists `AGENTS.md` as the bootloader with no symlink note.
- [ ] `.agro/skills/audit/references/harness.md` line 120, `.agro/skills/harness-context/SKILL.md` lines 19 and 44, `.agro/skills/render-html/SKILL.md` line 38, and `.agro/skills/rlm/SKILL.md` line 65 cite `AGENTS.md`.
- [ ] The generic target-repository guidance in `.agro/skills/blog/SKILL.md`, `.agro/skills/blog/references/loom-to-blog.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, and `.agro/skills/plan/SKILL.md` stays unchanged.
- [ ] `.agro/evals/decisions/skill-impact.md` and the historical `CHANGELOG.md` entries stay unchanged.

### US-005: Document the version floor and the escape hatch

**Description:** As an operator on Bedrock, Vertex, Foundry, or old Claude Code, I want a documented escape hatch so that my sessions keep project instructions.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` states the floor Claude Code `>= 2.1.277`.
- [ ] `docs/harnesses/claude-code.md` lists Amazon Bedrock, Vertex, Foundry, and sessions with telemetry disabled as sessions that do not read `AGENTS.md`.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that contains `@AGENTS.md`, plus one per nested guide the operator needs.
- [ ] `docs/harnesses/claude-code.md` states that a `CLAUDE.md` in the working directory or in an ancestor directory disables the native `AGENTS.md` path.
- [ ] `CHANGELOG.md` has one entry under the unreleased section that names the removal, the version floor, and the escape hatch.

## Summary

Claude Code 2.1.277 reads `AGENTS.md` natively when a project has no `CLAUDE.md` (issue 1082). A `CLAUDE.md` in the working directory or in an ancestor directory disables that path. The five tracked symlinks therefore suppress the native behavior.

Verified current state:

- `git ls-files -s` lists five `CLAUDE.md` symlinks with mode `120000`: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- `.gitignore` lines 19, 22, 29, and 34 and `.dockerignore` lines 8 and 11 negate `CLAUDE.md` paths.
- `.github/workflows/ci-harness.yml` lines 32 and 57 list `"CLAUDE.md"` as a path filter.
- Five `AGENTS.md` files carry the line "`CLAUDE.md` is a provider-compatibility symlink to this file."
- Three probes assert the symlinks: `crons-directory-guide.sh` lines 24-30, `escalate-contract.sh` lines 18-23, and `worktrees-layout.sh` lines 33-40.
- `git grep` over `packages/` finds no code that creates a `CLAUDE.md` file. `agro init` needs no change.
- `oh-update-bootstrap.sh` line 56 lists `CLAUDE.md` as a file that the update payload must not write. That assertion stays valid.

The selected approach follows the issue: write the red probes first, delete the symlinks, then fix every text surface.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md` | symlinks to `AGENTS.md` | The five aliases to delete |
| `.gitignore` | lines 19, 22, 29, 34 | Negations to delete |
| `.dockerignore` | lines 8, 11 | Negations to delete |
| `.github/workflows/ci-harness.yml` | `push.paths`, `pull_request.paths` | Path-filter entries to delete |
| `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, `.agro/logs/AGENTS.md` | alias notice line | Notice to replace |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` check | Probe to invert |
| `.agro/evals/probes/escalate-contract.sh` | `.agro/logs/CLAUDE.md` check, `keep` loop | Probe to invert |
| `.agro/evals/probes/worktrees-layout.sh` | `expected`, `alias` loop | Probe to invert |
| `.agro/evals/probes/agents-md-single-source.sh` | new file | Guard for the new invariant |
| `docs/glossary.md` | `orchestrator`, `rule` entries | Alias wording to delete |
| `.agro/scripts/README.md` | line 60 | Bootloader citation |
| `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/harness-context/SKILL.md`, `.agro/skills/render-html/SKILL.md`, `.agro/skills/rlm/SKILL.md` | `CLAUDE.md` citations | Bootloader citations |
| `docs/harnesses/claude-code.md` | new section | Version floor and escape hatch |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code session start | Behavior | Claude Code reads the root `AGENTS.md` natively instead of through the `CLAUDE.md` symlink. |
| Claude Code nested guides | Behavior | Claude Code reads a nested `AGENTS.md` when the Read tool opens a file in that directory. |
| Supported Claude Code versions | Breaking | The floor rises to `2.1.277`. Bedrock, Vertex, and Foundry sessions lose project instructions unless the operator adds the escape hatch. |
| Harness CI triggers | Config | A change to a `CLAUDE.md` path no longer triggers `ci-harness.yml`. |

## Storage

N/A. The change deletes tracked files and edits text. The change adds no persistent state.

## Architectural Decisions

- `AGENTS.md` is the single source of truth for project instructions for every coding harness. This decision supports non-negotiable 2.
- The repository ships no provider mirror for instructions. An operator who needs a mirror adds the mirror in their own checkout.
- The new probe owns the invariant. The three inverted probes keep their directory-specific contracts and assert absence only for their own directory.
- Approval of this plan records the maintainer's acceptance of the Claude Code `2.1.277` floor. The issue names this decision as the maintainer's call.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/agents-md-single-source.sh` | tracked `CLAUDE.md`; ignore negation; CI path entry; alias notice | The repository-wide invariant |
| `.agro/evals/probes/crons-directory-guide.sh` | `crons/CLAUDE.md` absent | The crons guide has no alias |
| `.agro/evals/probes/escalate-contract.sh` | `.agro/logs/CLAUDE.md` absent; no `.gitignore` negation | The log guide has no alias |
| `.agro/evals/probes/worktrees-layout.sh` | tracked set equals the two `AGENTS.md` files | The worktrees and projects guides have no alias |
| `.agro/evals/probes/oh-update-bootstrap.sh` | unchanged | The update payload still writes no `CLAUDE.md` |
| full suite through `/eval` | every probe | No other probe regresses |

Run each probe with `bash .agro/evals/probes/<probe>.sh` from the repository root. Run the full suite with `/eval`.

## Design Principles

- Keep one source of truth for each policy. `AGENTS.md` owns project instructions.
- Delete obsolete paths. Do not leave a dormant alias.
- Add no explanatory comments to tracked code. The probe failure messages carry the intent.
- Keep generic target-repository guidance that names `AGENTS.md`/`CLAUDE.md`. That guidance applies to arbitrary repositories.
- Change the canonical `.agro/skills/` sources. Do not edit the `.claude/skills` mirror.

## Out of Scope

- The `.claude/skills` and `.claude/hooks` symlinks. These symlinks expose primitives, not instructions.
- A `.claude/AGENTS.md` file.
- Rewrites of historical `CHANGELOG.md` entries and of the append-only `.agro/evals/decisions/skill-impact.md`.
- A pin or an upgrade of the Claude Code version that the sandbox image installs.
- The public documentation in `mifunedev/agro-web`. Open question 3 covers it.

## Open Questions

1. The issue names "four skill references". The grounding finds five skill files that cite this repository's `CLAUDE.md`. Confirm that US-004 updates all five files.
2. The grounding finds no place where the sandbox pins the Claude Code version. Does the floor `2.1.277` need an enforced check, or is documentation enough?
3. Does `mifunedev/agro-web` describe the `CLAUDE.md` alias? If yes, open a matching change there.
4. The target is `docs/harnesses/claude-code.md` for the floor and the escape hatch. Confirm this location, or name `<doc path>`.

## Acceptance Criteria

- [ ] `git ls-files -- 'CLAUDE.md' '*/CLAUDE.md'` prints nothing.
- [ ] `bash .agro/evals/probes/agents-md-single-source.sh` exits 0.
- [ ] `bash .agro/evals/probes/crons-directory-guide.sh`, `escalate-contract.sh`, `worktrees-layout.sh`, and `oh-update-bootstrap.sh` each exit 0.
- [ ] `/eval` reports no `REGRESSION` line.
- [ ] `git grep -n 'provider-compatibility symlink'` prints nothing outside `CHANGELOG.md`.
- [ ] `docs/harnesses/claude-code.md` documents the `2.1.277` floor and the `@AGENTS.md` escape hatch.
- [ ] `ci-harness.yml` passes on the pull request.

## Lessons

Filled by the advisor before undraft.
