# PRD: Retire the CLAUDE.md compatibility symlinks

Status: DRAFT

## User Stories

### US-001: Guard the new invariant with probes

**Description:** As the operator, I want probes that fail while any `CLAUDE.md` alias exists so that the retirement is proven red before green.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/crons-directory-guide.sh` exits 1 when `crons/CLAUDE.md` exists, and no longer requires the symlink.
- [ ] `.agro/evals/probes/escalate-contract.sh` exits 1 when `.agro/logs/CLAUDE.md` exists or `.gitignore` holds `!.agro/logs/CLAUDE.md`.
- [ ] `.agro/evals/probes/worktrees-layout.sh` expects `git ls-files .worktrees projects` to equal exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md`.
- [ ] A new probe `.agro/evals/probes/agents-md-single-source.sh` carries the `# tier:`, `# source:`, and `# desc:` header lines that `.agro/evals/README.md` requires.
- [ ] The new probe exits 1 when `git ls-files` lists any path that ends in `CLAUDE.md`.
- [ ] The new probe exits 1 when `.gitignore`, `.dockerignore`, or `.github/workflows/ci-harness.yml` names `CLAUDE.md`.
- [ ] Red test: before US-002 lands, each of the four probes exits 1 on the current tree. Record each exit status.

### US-002: Delete the symlinks and their ignore and CI entries

**Description:** As the operator, I want the five aliases gone so that Claude Code reads `AGENTS.md` natively under its default setting.

**Acceptance Criteria:**

- [ ] `git ls-files -s | awk '$1=="120000"' | grep CLAUDE.md` prints nothing.
- [ ] `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md` are absent from the tree.
- [ ] `.gitignore` holds no line that contains `CLAUDE.md`. This includes the legacy `!.oh/logs/CLAUDE.md` line.
- [ ] `.dockerignore` holds no line that contains `CLAUDE.md`.
- [ ] `.github/workflows/ci-harness.yml` holds no `"CLAUDE.md"` path-filter entry under `push` or `pull_request`.
- [ ] The four US-001 probes exit 0.

### US-003: Rewrite the documents that name the alias

**Description:** As an agent that reads this repository, I want every contract to name `AGENTS.md` so that no document points at a deleted file.

**Acceptance Criteria:**

- [ ] The notice line `` `CLAUDE.md` is a provider-compatibility symlink to this file. Edit `AGENTS.md`. `` is replaced in `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, and `.agro/logs/AGENTS.md`.
- [ ] `docs/glossary.md` no longer describes `CLAUDE.md` as an alias in the **orchestrator** and **rule** entries.
- [ ] `.agro/scripts/README.md` cites `AGENTS.md` instead of `CLAUDE.md`.
- [ ] `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/harness-context/SKILL.md`, `.agro/skills/render-html/SKILL.md`, and `.agro/skills/rlm/SKILL.md` name `AGENTS.md` as this repository's bootloader.
- [ ] Generic target-repository guidance stays unchanged in `.agro/skills/blog/`, `.agro/skills/builder/`, `.agro/skills/plan/SKILL.md`, and `.pi/APPEND_SYSTEM.md`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed prose line, or reports no new finding against the base branch.

### US-004: Document the version floor and the escape hatch

**Description:** As an operator on Bedrock, Vertex, or Foundry, I want a documented escape hatch so that my sessions still load project instructions.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` states the minimum Claude Code version `2.1.277`.
- [ ] `docs/harnesses/claude-code.md` names the sessions that cannot read `AGENTS.md`: Amazon Bedrock, Vertex, Foundry, and sessions with telemetry disabled.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that holds `@AGENTS.md`, plus one per nested directory guide that the operator needs.
- [ ] `docs/harnesses/claude-code.md` states that an operator can restore the symlinks in the operator's own checkout.

## Summary

Claude Code 2.1.277 reads `AGENTS.md` when no `CLAUDE.md` exists (issue #1082). The root file and each ancestor file load at session start. A subdirectory file loads when the Read tool opens a file in that directory. The five tracked symlinks emulate this behavior. A `CLAUDE.md` in the working directory or in an ancestor disables the native `AGENTS.md` path. The symlinks therefore suppress the native behavior.

Verified current state:

- `git ls-files -s` lists five mode-`120000` links to `AGENTS.md`: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- `.gitignore:19`, `.gitignore:22`, `.gitignore:29`, and `.gitignore:34` negate `CLAUDE.md` paths. Line 29 names the legacy `.oh/logs/CLAUDE.md` path.
- `.dockerignore:8` and `.dockerignore:11` negate `CLAUDE.md` paths.
- `.github/workflows/ci-harness.yml:32` and `.github/workflows/ci-harness.yml:57` list `"CLAUDE.md"` as a path filter.
- Three probes assert the symlinks: `crons-directory-guide.sh:24-32`, `escalate-contract.sh:18-23`, and `worktrees-layout.sh:33-49`.
- No file under `.agro/cli`, `.agro/install`, `.agro/scripts`, `.devcontainer`, or `packages` creates a `CLAUDE.md`. The scaffold needs no change.

The selected approach follows the issue: delete the aliases, invert the probes, add one guard probe, rewrite the named documents, and document the cost.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md` | symlinks to `AGENTS.md` | Deleted aliases |
| `.gitignore` | lines 19, 22, 29, 34 | Negations to remove |
| `.dockerignore` | lines 8, 11 | Negations to remove |
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths` | Path filters to remove |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` check | Probe to invert |
| `.agro/evals/probes/escalate-contract.sh` | symlink check, `keep` loop | Probe to invert |
| `.agro/evals/probes/worktrees-layout.sh` | `expected`, `alias` loop, `desc` header | Probe to invert |
| `.agro/evals/probes/agents-md-single-source.sh` | new probe | Guard for the new invariant |
| `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, `.agro/logs/AGENTS.md` | notice line | Notice to replace |
| `docs/glossary.md` | lines 87, 109 | Alias wording to remove |
| `.agro/scripts/README.md` | line 60 | Citation to change |
| `.agro/skills/audit/references/context.md` | line 9 | Bootloader row to change |
| `.agro/skills/audit/references/harness.md` | line 120 | Read list to change |
| `.agro/skills/harness-context/SKILL.md` | lines 19, 44 | Citations to change |
| `.agro/skills/render-html/SKILL.md` | line 38 | Source list to change |
| `.agro/skills/rlm/SKILL.md` | line 65 | Citation to change |
| `docs/harnesses/claude-code.md` | Claude Code harness page | Version floor and escape hatch |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior change | Claude Code loads `AGENTS.md` natively under `claude-md-or-agents-md`. |
| Supported Claude Code version | Compatibility change | The floor becomes Claude Code `2.1.277`. |
| Bedrock, Vertex, Foundry, telemetry-disabled sessions | Compatibility change | These sessions load no project instructions without the escape hatch. |
| Codex and Pi | None | Both harnesses read `AGENTS.md` natively today. |
| `agro` lifecycle verbs | None | No verb reads or writes `CLAUDE.md`. |

## Storage

N/A. The change removes tracked symlinks and edits tracked text. The change adds no persistent state.

## Architectural Decisions

- `AGENTS.md` is the single source of project instructions for every harness. This decision serves non-negotiable 2.
- The repository ships no per-provider mirror of `AGENTS.md`. An operator who needs one creates the mirror in the operator's own checkout.
- Operator approval of this plan is the maintainer's compatibility decision. The issue assigns this decision to the maintainer.
- Generic guidance that tells an agent to read a target repository's `AGENTS.md` or `CLAUDE.md` stays. That guidance applies to arbitrary repositories.
- The legacy `!.oh/logs/CLAUDE.md` negation goes with the other negations. No tracked file matches that line.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/crons-directory-guide.sh` | `crons/CLAUDE.md` present: exit 1. Absent: exit 0. | The cron guide has no alias. |
| `.agro/evals/probes/escalate-contract.sh` | `.agro/logs/CLAUDE.md` present or negated: exit 1. | The log guide has no alias. |
| `.agro/evals/probes/worktrees-layout.sh` | Tracked set equals the two `AGENTS.md` files: exit 0. Extra `CLAUDE.md`: exit 1. | The layout tracks only the guides. |
| `.agro/evals/probes/agents-md-single-source.sh` | Tracked `CLAUDE.md`: exit 1. `CLAUDE.md` in `.gitignore`, `.dockerignore`, or `ci-harness.yml`: exit 1. Clean tree: exit 0. | The repository-wide invariant. |
| `.agro/evals/probes/*.sh` | Run the full suite through `/eval`. | No other probe regresses. |

Run each probe from the repository root with `bash .agro/evals/probes/<id>.sh`. Capture the red exit before US-002. Capture the green exit after US-002.

## Design Principles

- Keep one source of truth for each policy. `AGENTS.md` owns project instructions.
- Delete obsolete paths instead of leaving dormant alternatives.
- Add no explanatory comments to tracked code. Probe header lines are machine-read data and stay.
- A probe is not green until the probe has been red.

## Out of Scope

- A `/config` or settings change for the Claude Code "Project instructions" option.
- A `CLAUDE.md` that holds `@AGENTS.md` in this repository.
- Changes to generic target-repository guidance in skills and in `.pi/APPEND_SYSTEM.md`.
- Changes to `.agro/evals/probes/oh-update-bootstrap.sh`. Its `unwanted` list asserts that the update copies no `CLAUDE.md`, and that assertion stays true.
- Edits to historical records in `docs/rfcs/` and `.agro/evals/decisions/`.

## Open Questions

1. The issue names four skill references. This plan found five files that cite this repository's `CLAUDE.md`. Does the operator accept all five in US-003?
2. Does the public site `mifunedev/agro-web` document the `CLAUDE.md` alias or the Claude Code version? If yes, who opens the matching change?
3. Does `README.md` or `docs/lifecycle-commands.md` also need the Claude Code floor next to the host prerequisites? This plan puts the floor in `docs/harnesses/claude-code.md` only.

## Acceptance Criteria

- [ ] `git ls-files | grep -c 'CLAUDE.md$'` prints `0`.
- [ ] `git grep -n 'CLAUDE.md' -- .gitignore .dockerignore .github/workflows/ci-harness.yml` prints nothing.
- [ ] `git grep -n 'provider-compatibility symlink'` prints nothing.
- [ ] Each of the four US-001 probes exited 1 before US-002 and exits 0 after US-002.
- [ ] The full probe suite run through `/eval` reports no `REGRESSION`.
- [ ] The `ci-harness.yml` workflow passes on the pull request.

## Lessons

Filled by the advisor before undraft.
