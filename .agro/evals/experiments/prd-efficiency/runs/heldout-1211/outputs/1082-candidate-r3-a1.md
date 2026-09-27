# PRD: Retire the CLAUDE.md provider-compatibility symlinks

Status: BLOCKED

## User Stories

### US-001: Remove the symlinks and guard the new invariant

**Description:** As the maintainer, I want `AGENTS.md` to be the only tracked instruction file. Then Claude Code reads the native `AGENTS.md` path, and no harness needs a mirror.

**Acceptance Criteria:**

- [ ] A new probe `.agro/evals/probes/agents-md-sole-bootloader.sh` exists with the `tier`, `source`, and `desc` header lines.
- [ ] Before the symlinks are deleted, `bash .agro/evals/probes/agents-md-sole-bootloader.sh` exits 1 and names a tracked `CLAUDE.md`.
- [ ] The new probe exits 1 when `git ls-files` lists any path that ends in `CLAUDE.md`.
- [ ] The new probe exits 1 when `.gitignore` or `.dockerignore` holds a `!` line that ends in `CLAUDE.md`.
- [ ] The new probe exits 1 when any tracked `AGENTS.md` holds the string `provider-compatibility symlink`.
- [ ] `git ls-files -s | awk '$1=="120000"{print $4}' | grep 'CLAUDE.md$'` prints nothing.
- [ ] `.gitignore` and `.dockerignore` hold no line that matches `CLAUDE.md`.
- [ ] `.github/workflows/ci-harness.yml` holds no `"CLAUDE.md"` path-filter entry in the `push` block or the `pull_request` block.
- [ ] `crons-directory-guide.sh` exits 1 when `crons/CLAUDE.md` exists, and exits 0 on the new tree.
- [ ] `worktrees-layout.sh` expects exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md` from `git ls-files .worktrees projects`, and exits 0.
- [ ] `escalate-contract.sh` fails when `.agro/logs/CLAUDE.md` exists, checks only the `!.agro/logs/AGENTS.md` negation, and exits 0.
- [ ] `bash .agro/evals/probes/agents-md-sole-bootloader.sh` exits 0 on the new tree.
- [ ] `bash .agro/evals/probes/oh-update-bootstrap.sh` exits with the same code as on the base branch.

### US-002: Replace the alias wording in guides, docs, and skills

**Description:** As an agent that reads the repository, I want every guide to name `AGENTS.md` as the instruction file. Then no text points at a deleted file.

**Acceptance Criteria:**

- [ ] `git grep -n 'provider-compatibility symlink' -- '*AGENTS.md'` prints nothing.
- [ ] Each of the five `AGENTS.md` files that held the notice now tells the reader to edit `AGENTS.md` without a reference to `CLAUDE.md`.
- [ ] `docs/glossary.md` lines for **orchestrator** and **rule** no longer say that `CLAUDE.md` aliases `AGENTS.md`.
- [ ] `.agro/scripts/README.md:60` cites `AGENTS.md` in place of `CLAUDE.md`.
- [ ] `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/harness-context/SKILL.md`, `.agro/skills/render-html/SKILL.md`, and `.agro/skills/rlm/SKILL.md` name `AGENTS.md` as this repository's bootloader.
- [ ] The generic target-repository guidance in `.agro/skills/blog/SKILL.md`, `.agro/skills/blog/references/loom-to-blog.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, and `.agro/skills/plan/SKILL.md` stays unchanged.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file that exited 0 on the base branch.

### US-003: Document the version floor and the escape hatch

**Description:** As an operator on Bedrock, Vertex, or Foundry, I want the version floor and the escape hatch in the docs. Then I can restore project instructions in my checkout.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` states that AGRO requires Claude Code `2.1.277` or newer for `AGENTS.md` project instructions.
- [ ] `docs/harnesses/claude-code.md` lists Amazon Bedrock, Vertex, Foundry, and sessions with telemetry disabled as sessions that do not read `AGENTS.md`.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that holds `@AGENTS.md`, plus one per nested guide that the operator needs.
- [ ] `docs/harnesses/claude-code.md` states that the `/config` "Project instructions" setting must keep the default `claude-md-or-agents-md` value.
- [ ] `CHANGELOG.md` `[Unreleased]` holds one `Removed` entry for the symlinks and one `Added` entry for the new probe, each with the issue link for `#1082`.

## Summary

Claude Code 2.1.277 reads `AGENTS.md` natively when a project has no `CLAUDE.md` (issue #1082). A `CLAUDE.md` in the working directory or in any ancestor directory disables that path. The five tracked symlinks therefore suppress the native behavior.

Verified current state:

- `git ls-files -s` lists five mode-`120000` symlinks: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- `.gitignore:19`, `.gitignore:22`, `.gitignore:29`, and `.gitignore:34` negate `CLAUDE.md` paths. `.dockerignore:8` and `.dockerignore:11` negate `CLAUDE.md` paths.
- `.gitignore:29` negates `.oh/logs/CLAUDE.md`. No tracked file matches that path.
- `.github/workflows/ci-harness.yml:32` and `.github/workflows/ci-harness.yml:57` list `"CLAUDE.md"` as a path filter.
- Five `AGENTS.md` files hold the notice: root line 8, `.worktrees/AGENTS.md:7`, `projects/AGENTS.md:11`, `crons/AGENTS.md:9`, and `.agro/logs/AGENTS.md:3`.
- Three probes assert the symlinks: `crons-directory-guide.sh:24-31`, `worktrees-layout.sh:33-49`, and `escalate-contract.sh:18-23`.
- `oh-update-bootstrap.sh:56` asserts that `oh update` writes no `CLAUDE.md`. That probe needs no change.
- No file under `.agro/cli`, `.agro/scripts`, `.agro/install`, or `.devcontainer` creates a `CLAUDE.md` symlink.
- Five skill files name `CLAUDE.md` as this repository's bootloader. The issue says four.

Selected approach: delete the symlinks and all tracked references to them in one change. Add one probe for the new invariant. Document the floor and the escape hatch in the Claude Code harness page.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md` | symlinks to `AGENTS.md` | Files to delete |
| `.gitignore` | lines 19, 22, 29, 34 | `CLAUDE.md` negations to delete |
| `.dockerignore` | lines 8, 11 | `CLAUDE.md` negations to delete |
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths` | `"CLAUDE.md"` filters to delete |
| `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, `.agro/logs/AGENTS.md` | alias notice line | Notice to replace |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` check, PASS message | Probe to invert |
| `.agro/evals/probes/worktrees-layout.sh` | `desc`, `expected`, alias loop | Probe to invert |
| `.agro/evals/probes/escalate-contract.sh` | symlink check, `keep` loop | Probe to invert |
| `.agro/evals/probes/agents-md-sole-bootloader.sh` | new probe | New invariant guard |
| `docs/glossary.md` | lines 87, 109 | Alias wording to replace |
| `.agro/scripts/README.md` | line 60 | Bootloader citation to replace |
| `.agro/skills/audit/references/context.md` | line 9 | Bootloader row to replace |
| `.agro/skills/audit/references/harness.md` | line 120 | Bootloader citation to replace |
| `.agro/skills/harness-context/SKILL.md` | lines 19, 44 | Bootloader citations to replace |
| `.agro/skills/render-html/SKILL.md` | line 38 | Identity-source citation to replace |
| `.agro/skills/rlm/SKILL.md` | line 65 | Orchestrator-boundary citation to replace |
| `docs/harnesses/claude-code.md` | Claude Code harness page | Version floor and escape hatch |
| `CHANGELOG.md` | `[Unreleased]` | Release notes |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior change | Claude Code reads `AGENTS.md` natively. It no longer reads a symlinked `CLAUDE.md`. |
| Supported Claude Code version | Compatibility floor | AGRO requires Claude Code `2.1.277` or newer. |
| Bedrock, Vertex, Foundry sessions | Compatibility loss | These sessions get no project instructions until the operator adds the escape hatch. |
| CI path filter | Configuration | `ci-harness.yml` stops triggering on `CLAUDE.md`. |
| Probe suite | Test | Three probes invert. One probe is new. |

## Storage

N/A. The change deletes tracked symlinks and edits text. The change adds no persistent state.

## Architectural Decisions

- `AGENTS.md` is the single source of truth for project instructions for every coding harness. This decision applies non-negotiable 2.
- The repository ships no provider mirror for instruction files. An operator who needs a `CLAUDE.md` adds the file in the operator's checkout.
- The new probe owns the invariant. The three inverted probes keep their original scope and assert only the absence of their local alias.
- Generic guidance about an arbitrary target repository keeps the `AGENTS.md`/`CLAUDE.md` pair, because target repositories can ship either file.
- The root orchestrator makes this change. The change touches harness infrastructure and no application code.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/agents-md-sole-bootloader.sh` | Red on base tree; green after deletion; red on a tracked `CLAUDE.md`, a `CLAUDE.md` negation, or the notice string | New invariant |
| `.agro/evals/probes/crons-directory-guide.sh` | Red when `crons/CLAUDE.md` exists; green on new tree | Inverted alias check |
| `.agro/evals/probes/worktrees-layout.sh` | Green with only the two `AGENTS.md` files tracked | Inverted tracked set |
| `.agro/evals/probes/escalate-contract.sh` | Red when `.agro/logs/CLAUDE.md` exists; green on new tree | Inverted log alias check |
| `.agro/evals/probes/oh-update-bootstrap.sh` | Exit code matches base branch | No regression in bootstrap |
| `.github/workflows/ci-harness.yml` | CI run on the pull request passes | Path filter and probe suite in CI |

Fault injection: the implementer runs each changed probe once against a temporary `ln -s AGENTS.md <dir>/CLAUDE.md`, records exit 1, then deletes the link.

## Design Principles

- Keep one source of truth for each policy. `AGENTS.md` owns instructions.
- Delete obsolete paths instead of leaving dormant alternatives.
- Change the canonical `.agro/` source. Patch no mirror.
- Keep the change to the surfaces that name the retired alias.
- Surfaces: host and sandbox applied (host git change); lifecycle door not applicable; canonical and provider surfaces applied; root and scaffold applied to root only; interactive and headless processes not applicable; local and remote operation not applicable; parallel operation not applicable; public documentation applied as an open question; verification applied.

## Out of Scope

- A version check in `agro harness install claude-code` or at session start.
- Changes to generic target-repository guidance that names `AGENTS.md`/`CLAUDE.md`.
- Historical text in `CHANGELOG.md`, `docs/rfcs/`, and archived task folders.
- Changes to `.claude/skills` and `.claude/hooks` symlinks.
- Changes in `mifunedev/agro-web`, unless the operator answers question 3 with B.

## Open Questions

1. Does the maintainer accept the Claude Code `2.1.277` floor and the loss of instructions on Bedrock, Vertex, Foundry, and telemetry-disabled sessions?
   A. Accept. Build as planned.
   B. Reject. Close issue #1082.
   C. Defer until Claude Code supports `AGENTS.md` on those providers.
2. The issue names four skill references. The grounding found five: `audit/references/context.md`, `audit/references/harness.md`, `harness-context/SKILL.md`, `render-html/SKILL.md`, and `rlm/SKILL.md`. Which set is in scope?
   A. All five.
   B. Only four: `<list the four>`.
3. Does `mifunedev/agro-web` name the `CLAUDE.md` alias or need the version floor?
   A. No change in `agro-web`.
   B. Open a matching change in `agro-web`: `<page path>`.
4. `.gitignore:29` negates the untracked path `.oh/logs/CLAUDE.md`. Does this task delete the `.oh/logs/CLAUDE.md` negation?
   A. Yes, delete the negation with the others.
   B. No, leave the legacy `.oh/` block to its own retirement task.

## Acceptance Criteria

- [ ] The maintainer answers open question 1 with A before the build starts.
- [ ] `git ls-files | grep 'CLAUDE.md$'` prints nothing.
- [ ] `bash .agro/evals/probes/agents-md-sole-bootloader.sh`, `crons-directory-guide.sh`, `worktrees-layout.sh`, and `escalate-contract.sh` each exit 0.
- [ ] Each changed probe exits 1 during its fault-injection run.
- [ ] `git grep -n 'provider-compatibility symlink' -- '*AGENTS.md' docs .agro/skills` prints nothing.
- [ ] `docs/harnesses/claude-code.md` holds the version floor and the escape hatch.
- [ ] The `ci-harness.yml` run on the pull request passes.

## Lessons

Filled by the advisor before undraft.
