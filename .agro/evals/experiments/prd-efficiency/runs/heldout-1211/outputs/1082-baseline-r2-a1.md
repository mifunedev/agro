# PRD: Retire the CLAUDE.md symlinks

Status: BLOCKED

Source: `work/issue-1082.md` (issue #1082).

## User Stories

### US-001: Remove the five symlinks and their ignore and CI entries

**Description:** As the operator, I want the repository to ship no `CLAUDE.md` file so that Claude Code reads `AGENTS.md` natively under its default setting.

**Acceptance Criteria:**

- [ ] `git ls-files | grep -E '(^|/)CLAUDE\.md$'` prints no line.
- [ ] `grep -n 'CLAUDE.md' .gitignore .dockerignore` prints no line.
- [ ] `grep -n '"CLAUDE.md"' .github/workflows/ci-harness.yml` prints no line.
- [ ] `.github/workflows/ci-harness.yml` still lists `"AGENTS.md"` under the `push` paths and under the `pull_request` paths.

### US-002: Replace the symlink notice in each AGENTS.md

**Description:** As an agent, I want each `AGENTS.md` to name itself as the only instruction file so that no guide names a missing file.

**Acceptance Criteria:**

- [ ] `grep -rn 'provider-compatibility symlink' AGENTS.md .worktrees/AGENTS.md projects/AGENTS.md crons/AGENTS.md .agro/logs/AGENTS.md` prints no line.
- [ ] Each of the five `AGENTS.md` files keeps the instruction ``Edit `AGENTS.md`.`` or an equivalent sentence that names `AGENTS.md` as the file to edit.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh <file>` exits 0 for each changed `AGENTS.md`, or reports no new finding against the base commit.

### US-003: Update the documents and skills that name CLAUDE.md as this repository's bootloader

**Description:** As a reader, I want each reference to the orchestrator file to name `AGENTS.md` so that each reference resolves to an existing file.

**Acceptance Criteria:**

- [ ] `docs/glossary.md` has no `aliased` phrase for `CLAUDE.md` in the **orchestrator** entry or the **rule** entry.
- [ ] `.agro/scripts/README.md` names `AGENTS.md`, not `CLAUDE.md`, in the orchestrator-scope bullet.
- [ ] `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/harness-context/SKILL.md`, `.agro/skills/rlm/SKILL.md`, and `.agro/skills/render-html/SKILL.md` contain no `CLAUDE.md` reference to this repository's bootloader.
- [ ] The generic target-repository guidance stays unchanged in `.agro/skills/blog/SKILL.md`, `.agro/skills/blog/references/loom-to-blog.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, `.agro/skills/plan/SKILL.md`, and `.pi/APPEND_SYSTEM.md`.
- [ ] `git grep -n 'CLAUDE\.md' -- ':!CHANGELOG.md' ':!.agro/tasks' ':!.agro/knowledge' ':!.agro/evals/decisions' ':!docs/rfcs'` prints only the generic lines in the previous criterion, the escape-hatch text from US-005, and the probe lines from US-004.

### US-004: Invert the three symlink probes and add one invariant probe

**Description:** As the CI job, I want the probes to assert the absence of `CLAUDE.md` so that a reintroduced symlink turns the eval gate red.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/crons-directory-guide.sh` exits 1 when `crons/CLAUDE.md` exists and exits 0 when the file is absent.
- [ ] `.agro/evals/probes/escalate-contract.sh` exits 1 when `.agro/logs/CLAUDE.md` exists or when `.gitignore` carries `!.agro/logs/CLAUDE.md`.
- [ ] `.agro/evals/probes/worktrees-layout.sh` expects `git ls-files .worktrees projects` to print exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md`.
- [ ] A new probe `.agro/evals/probes/<new-probe-id>.sh` exits 1 when any tracked path matches `(^|/)CLAUDE\.md$`, and exits 1 when `.gitignore` or `.dockerignore` carries a `CLAUDE.md` negation.
- [ ] The new probe carries the `# tier:`, `# source:`, and `# desc:` header lines that `.agro/evals/README.md` requires.
- [ ] Each of the four probes exits 1 under a fault injection that restores the matching symlink, and exits 0 after the fault is removed.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

### US-005: Document the Claude Code version floor and the escape hatch

**Description:** As an affected operator, I want a documented floor and escape hatch so that I can restore project instructions in my checkout.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` states the floor `Claude Code >= 2.1.277`.
- [ ] `docs/harnesses/claude-code.md` names the affected sessions: Amazon Bedrock, Vertex, Foundry, and sessions with telemetry disabled.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that contains `@AGENTS.md`, plus one `CLAUDE.md` per nested guide that the operator needs.
- [ ] `CHANGELOG.md` has a `**BREAKING:**` entry under the unreleased section that names the floor and links issue #1082.

## Summary

Claude Code 2.1.277 reads `AGENTS.md` natively when a project has no `CLAUDE.md`. A `CLAUDE.md` in the working directory or in any parent directory disables that path. The repository tracks five `CLAUDE.md -> AGENTS.md` symlinks. The symlinks now suppress the native behavior that they emulate.

Verified current state at commit `81e66e6`:

- `git ls-files -s` shows five mode-`120000` entries: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md`. Each entry points at `AGENTS.md`.
- `.gitignore` lines 19, 22, 29, and 34 negate `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `.oh/logs/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- `.dockerignore` lines 8 and 11 negate `.worktrees/CLAUDE.md` and `projects/CLAUDE.md`.
- `.github/workflows/ci-harness.yml` lines 32 and 57 list `"CLAUDE.md"` as a path filter.
- Each of the five `AGENTS.md` files carries the line `` `CLAUDE.md` is a provider-compatibility symlink to this file. Edit `AGENTS.md`. ``
- Three probes assert a symlink: `crons-directory-guide.sh` (lines 24-31), `escalate-contract.sh` (lines 18-23), and `worktrees-layout.sh` (lines 33-49).
- `.agro/evals/probes/oh-update-bootstrap.sh` line 56 lists `CLAUDE.md` as an unwanted payload file. That check stays correct and needs no change.
- The `agro` CLI writes no `AGENTS.md` and no `CLAUDE.md` into an initialized project (`.agro/cli/README.md` line 145). The change touches only this repository.

Selected approach: delete the symlinks, their ignore negations, and their CI path filters. Rewrite each notice and each bootloader reference. Invert the probes. Document the floor and the escape hatch. Codex and Pi already read `AGENTS.md`, so `AGENTS.md` becomes the one instruction file for every harness.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md` | symlinks to `AGENTS.md` | Deleted |
| `.gitignore` | `!.worktrees/CLAUDE.md`, `!projects/CLAUDE.md`, `!.oh/logs/CLAUDE.md`, `!.agro/logs/CLAUDE.md` | Negations deleted |
| `.dockerignore` | `!.worktrees/CLAUDE.md`, `!projects/CLAUDE.md` | Negations deleted |
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths` | `"CLAUDE.md"` entry deleted |
| `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, `.agro/logs/AGENTS.md` | symlink notice line | Notice replaced |
| `docs/glossary.md` | **orchestrator** entry (line 87), **rule** entry (line 109) | Alias phrase deleted |
| `.agro/scripts/README.md` | orchestrator-scope bullet (line 60) | Reference renamed |
| `.agro/skills/audit/references/context.md` | Bootloader row (line 9) | Reference renamed |
| `.agro/skills/audit/references/harness.md` | onboarding-friction item (line 120) | Reference renamed |
| `.agro/skills/harness-context/SKILL.md` | Steps (line 19), lifecycle answer (line 44) | Reference renamed |
| `.agro/skills/rlm/SKILL.md` | orchestrator boundary (line 65) | Reference renamed |
| `.agro/skills/render-html/SKILL.md` | skip list (line 38) | Reference renamed |
| `.agro/evals/probes/crons-directory-guide.sh`, `escalate-contract.sh`, `worktrees-layout.sh` | symlink assertions | Assertions inverted |
| `.agro/evals/probes/<new-probe-id>.sh` | new probe | Guards the invariant |
| `docs/harnesses/claude-code.md` | new section | Floor and escape hatch |
| `CHANGELOG.md` | unreleased section | BREAKING entry |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior change | Claude Code reads `AGENTS.md` natively. A session on Claude Code below 2.1.277, Bedrock, Vertex, Foundry, or with telemetry disabled loads no project instructions. |
| Claude Code version floor | New requirement | AGRO requires Claude Code >= 2.1.277. |
| CI path filter | Removal | A change to a root `CLAUDE.md` no longer triggers `ci-harness.yml`. |
| Eval probe suite | Inverted assertion | Three probes assert absence. One new probe guards the invariant. |
| Public site `mifunedev/agro-web` | Documentation | Pages that name `CLAUDE.md` as an alias need a matching change. See Open Question 3. |

## Storage

N/A. The change deletes tracked symlinks and edits text files. The change adds no persisted state.

## Architectural Decisions

- `AGENTS.md` is the single source of truth for project instructions in every harness. No provider mirror remains.
- The repository does not ship an `@AGENTS.md` import file. A tracked `CLAUDE.md` of any form disables the native `AGENTS.md` path.
- The escape hatch lives in the operator's own checkout. The operator owns that file, and the repository does not track the file.
- The generic guidance "read the target repository's `AGENTS.md`/`CLAUDE.md` if present" stays unchanged. That guidance applies to arbitrary repositories.
- The change removes the `.oh/logs/CLAUDE.md` negation with the other negations. No tracked file matches that negation.
- The historical records stay unchanged: `CHANGELOG.md` entries before this release, `.agro/evals/decisions/skill-impact.md`, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/tasks/`, and `.agro/knowledge/`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/<new-probe-id>.sh` | Write the probe first. The probe exits 1 on the base commit. The probe exits 0 after US-001. | No tracked `CLAUDE.md`; no ignore negation |
| `.agro/evals/probes/crons-directory-guide.sh` | Invert first. The probe exits 1 on the base commit. The probe exits 0 after US-001. | `crons/CLAUDE.md` is absent |
| `.agro/evals/probes/escalate-contract.sh` | Invert first. The probe exits 1 on the base commit. The probe exits 0 after US-001. | `.agro/logs/CLAUDE.md` and its negation are absent |
| `.agro/evals/probes/worktrees-layout.sh` | Invert first. The probe exits 1 on the base commit. The probe exits 0 after US-001. | `.worktrees/` and `projects/` track only `AGENTS.md` |
| Fault injection, run by hand | Run `ln -s AGENTS.md crons/CLAUDE.md`, run each probe, then delete the symlink. | Each probe turns red on a restored symlink |
| `bash .agro/skills/eval/run.sh` | Full suite | No REGRESSION |
| `bash .agro/skills/ste/scripts/ste-check.sh <file>` | Each changed Markdown file | STE prose rules |

## Design Principles

- Non-negotiable 2: the choice of coding harness does not change the workspace. One instruction file serves Claude Code, Codex, and Pi.
- Keep one source of truth for each policy. Delete the mirror instead of keeping a dormant alternative.
- Change only what the proposal names. Do not rewrite generic guidance for arbitrary repositories.
- Do not add explanatory comments to tracked code. The probe header lines are machine-read data and stay.
- State the compatibility cost in the documentation. Do not hide the floor.

## Out of Scope

- The `.claude/skills`, `.claude/hooks`, `.agents/skills`, `.codex/specs`, and `.codex/screenshots` symlinks. Those symlinks expose skills and hooks, not project instructions.
- A version check in `agro harness install claude-code` or at sandbox boot.
- A tracked `@AGENTS.md` import file.
- Changes to historical records listed under Architectural Decisions.
- The change to `mifunedev/agro-web`. This task only records the need.

## Open Questions

1. **Blocking.** Does the maintainer accept the Claude Code >= 2.1.277 floor and the loss of project instructions on Bedrock, Vertex, Foundry, and telemetry-disabled sessions? The issue states that this decision belongs to the maintainer. The status stays `BLOCKED` until the maintainer answers.
   A. Accept. Ship the change as planned.
   B. Defer until Claude Code supports `AGENTS.md` on Bedrock, Vertex, and Foundry.
   C. Other: <specify>
2. The issue names "four skill references". The search finds five skill files: `audit/references/context.md`, `audit/references/harness.md`, `harness-context/SKILL.md`, `rlm/SKILL.md`, and `render-html/SKILL.md`. This plan updates all five. Confirm or name the file to leave unchanged.
3. Which `mifunedev/agro-web` pages name `CLAUDE.md` as an alias? This repository does not contain that site. The implementation owner must open a matching issue or pull request there: <agro-web page list>.
4. What id does the new probe take? This plan writes `<new-probe-id>`. A candidate is `agents-md-sole-instructions`.
5. Does the escape-hatch text belong only in `docs/harnesses/claude-code.md`, or also in `docs/installation.md`? This plan uses `docs/harnesses/claude-code.md` only.

## Acceptance Criteria

- [ ] `git ls-files | grep -E '(^|/)CLAUDE\.md$'` prints no line.
- [ ] `grep -n 'CLAUDE.md' .gitignore .dockerignore .github/workflows/ci-harness.yml` prints no line.
- [ ] No `AGENTS.md` file contains the phrase `provider-compatibility symlink`.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION, and the new probe reports PASS.
- [ ] Each of the four changed or new probes exits 1 under its fault injection.
- [ ] `docs/harnesses/claude-code.md` documents the floor `>= 2.1.277` and the `@AGENTS.md` escape hatch.
- [ ] `CHANGELOG.md` carries a `**BREAKING:**` entry for issue #1082.
- [ ] The maintainer answers Open Question 1 with an explicit acceptance before the build starts.

## Lessons

Filled by the advisor before undraft.
