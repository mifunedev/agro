# PRD: Retire the CLAUDE.md symlinks

Status: BLOCKED

## User Stories

### US-001: Delete the symlinks and guard the new invariant

**Description:** As the maintainer, I want the repository to track no `CLAUDE.md` file so that Claude Code reads `AGENTS.md` natively, like Codex and Pi.

**Acceptance Criteria:**

- [ ] `git ls-files | grep -E '(^|/)CLAUDE\.md$'` prints nothing and exits 1.
- [ ] `grep -n 'CLAUDE.md' .gitignore .dockerignore` prints nothing and exits 1.
- [ ] `grep -n '"CLAUDE.md"' .github/workflows/ci-harness.yml` prints nothing and exits 1.
- [ ] `.agro/evals/probes/agents-md-single-source.sh` exists, carries the `tier`, `source`, and `desc` header lines, and exits 0.
- [ ] `agents-md-single-source.sh` exits 1 when a `CLAUDE.md` symlink is added to the index of a temporary copy of the repository.
- [ ] `worktrees-layout.sh` expects exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md` from `git ls-files .worktrees projects`, and exits 0.
- [ ] `escalate-contract.sh` checks `!.agro/logs/AGENTS.md` only, contains no `.agro/logs/CLAUDE.md` string, and exits 0.
- [ ] `crons-directory-guide.sh` contains no symlink check for `crons/CLAUDE.md`, and exits 0.
- [ ] `bash .claude/skills/eval/run.sh --tier A` exits 0.

### US-002: Rewrite the repository prose that names CLAUDE.md as the bootloader

**Description:** As a harness agent, I want each guide to name only `AGENTS.md` so that no guide describes a missing file.

**Acceptance Criteria:**

- [ ] `grep -rn 'provider-compatibility symlink' AGENTS.md .worktrees/AGENTS.md projects/AGENTS.md crons/AGENTS.md .agro/logs/AGENTS.md` prints nothing.
- [ ] `docs/glossary.md` contains no `aliased` reference to `CLAUDE.md` in the **orchestrator** and **rule** entries.
- [ ] `.agro/scripts/README.md`, `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/harness-context/SKILL.md`, and `.agro/skills/rlm/SKILL.md` name `AGENTS.md` where each file names this repository's bootloader.
- [ ] Generic guidance for arbitrary target repositories stays unchanged in `.agro/skills/blog/SKILL.md`, `.agro/skills/blog/references/loom-to-blog.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, `.agro/skills/plan/SKILL.md`, `.agro/skills/render-html/SKILL.md`, and `.pi/APPEND_SYSTEM.md`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file that exited 0 before the change.

### US-003: Document the version floor and the escape hatch

**Description:** As a Bedrock, Vertex, or Foundry operator, I want the floor and escape hatch documented so that I can restore project instructions locally.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` states the floor `Claude Code >= 2.1.277` for native `AGENTS.md` support.
- [ ] `docs/harnesses/claude-code.md` lists the sessions that do not read `AGENTS.md`: Amazon Bedrock, Vertex, and Foundry.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that contains `@AGENTS.md`, plus one per nested guide that the operator needs.
- [ ] `CHANGELOG.md` `## [Unreleased]` carries a `### Removed` entry for the five symlinks, with a link to issue #1082.

## Summary

Issue #1082 asks to retire the five tracked `CLAUDE.md -> AGENTS.md` symlinks. Claude Code 2.1.277 reads `AGENTS.md` natively when no `CLAUDE.md` exists. A `CLAUDE.md` in the working directory or in an ancestor directory disables that native path. The symlinks therefore suppress the native behavior. The issue is the source for these Claude Code claims. This plan did not verify the claims against Anthropic documentation. The sandbox runs Claude Code `2.1.280`.

Verified current state at base commit `81e66e6`:

- `git ls-files -s` lists five mode-`120000` entries that point at `AGENTS.md`: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- `.gitignore:19`, `.gitignore:22`, and `.gitignore:34` negate the ignore for three of the symlinks. `.gitignore:29` negates the ignore for the legacy path `.oh/logs/CLAUDE.md`.
- `.dockerignore:8` and `.dockerignore:11` negate the ignore for `.worktrees/CLAUDE.md` and `projects/CLAUDE.md`.
- `.github/workflows/ci-harness.yml:32` and `.github/workflows/ci-harness.yml:57` list `"CLAUDE.md"` as path filters.
- Three probes assert the symlinks: `escalate-contract.sh:18-23`, `worktrees-layout.sh:33-48`, and `crons-directory-guide.sh:24-32`.
- `oh-update-bootstrap.sh:56` asserts that `oh update` writes no `CLAUDE.md`. That assertion stays valid and stays unchanged.
- `.agro/scripts/link-providers.sh` does not create or check any `CLAUDE.md`. No script, CLI source, or entrypoint creates a `CLAUDE.md`.
- Each of the five `AGENTS.md` files carries the line "`CLAUDE.md` is a provider-compatibility symlink to this file."

Selected approach: delete the symlinks, remove every reference that exists to support them, invert the three probes, and add one probe for the new invariant. The change is deletion plus prose. The change adds no runtime machinery.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md` | tracked symlinks | Delete |
| `.gitignore` | `!.worktrees/CLAUDE.md`, `!projects/CLAUDE.md`, `!.agro/logs/CLAUDE.md` | Remove negations |
| `.dockerignore` | `!.worktrees/CLAUDE.md`, `!projects/CLAUDE.md` | Remove negations |
| `.github/workflows/ci-harness.yml` | `push.paths`, `pull_request.paths` | Remove `"CLAUDE.md"` entries |
| `.agro/evals/probes/worktrees-layout.sh` | `expected`, alias loop, `desc` header | Expect `AGENTS.md` only |
| `.agro/evals/probes/escalate-contract.sh` | symlink check, `keep` loop | Drop the `CLAUDE.md` checks |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` block, PASS message | Drop the symlink checks |
| `.agro/evals/probes/agents-md-single-source.sh` | new probe | Guard the invariant |
| `.agro/evals/RESULTS.md` | probe rows | Add the new probe row through the runner |
| `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, `.agro/logs/AGENTS.md` | symlink notice line | Replace the notice |
| `docs/glossary.md` | **orchestrator**, **rule** | Remove the alias text |
| `.agro/scripts/README.md` | line 60 | Name `AGENTS.md` |
| `.agro/skills/audit/references/context.md` | line 9 bootloader row | Name `AGENTS.md` only |
| `.agro/skills/audit/references/harness.md` | line 120 | Name `AGENTS.md` |
| `.agro/skills/harness-context/SKILL.md` | lines 19 and 44 | Name `AGENTS.md` |
| `.agro/skills/rlm/SKILL.md` | line 65 | Name `AGENTS.md` |
| `docs/harnesses/claude-code.md` | new section | Floor and escape hatch |
| `CHANGELOG.md` | `## [Unreleased]` | Removed entry |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior change | Claude Code reads `AGENTS.md` natively. Claude Code earlier than 2.1.277 reads no project instructions. |
| Amazon Bedrock, Vertex, Foundry sessions | Behavior change | These sessions read no project instructions until the operator adds a local `CLAUDE.md`. |
| Codex, Pi | None | Both harnesses read `AGENTS.md` today. |
| Probe suite | Changed and added probes | Three probes change. One probe is new. |
| CI path filters | Removed entries | A root `CLAUDE.md` change no longer triggers `ci-harness.yml`. |
| Public documentation `mifunedev/agro-web` | Follow-up | The version floor and the escape hatch need a matching page. See Open Questions. |

## Storage

N/A. The change deletes tracked files and edits prose. The change adds no persistent state.

## Architectural Decisions

- `AGENTS.md` is the single source of project instructions for every coding harness. No provider mirror remains.
- The new probe owns the invariant "no tracked `CLAUDE.md`". The three existing probes stop asserting the symlinks and keep their other checks.
- The escape hatch lives in the operator's checkout, not in the repository. The repository ships no `CLAUDE.md`.
- The change does not enforce the version floor in `agro harness install claude-code`. The floor is documentation only.

Affected surfaces:

- **Host and sandbox:** applied. The implementation owner edits and tests inside a sandbox worktree. The host needs no change.
- **Lifecycle door:** not applicable. No `agro` verb creates or checks `CLAUDE.md`.
- **Canonical and provider surfaces:** applied. The change removes a provider mirror. `bash .agro/scripts/link-providers.sh --check` must still exit 0.
- **Root and scaffold:** applied to the root. Initialized projects are not affected, because `oh update` ships only `.agro/` and `crons/`, and `crons/CLAUDE.md` leaves the payload.
- **Interactive and headless processes:** not applicable. No process changes.
- **Local and remote operation:** not applicable. No process changes.
- **Parallel operation:** applied. One writer works in one worktree.
- **Public documentation:** applied as an open question for `mifunedev/agro-web`.
- **Verification:** applied. The probe suite, `pnpm test`, and the `ci-harness.yml` run on the PR.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/agents-md-single-source.sh` | Exits 1 while the five symlinks exist. Exits 0 after deletion. | The invariant, written first |
| `.agro/evals/probes/agents-md-single-source.sh` | Exits 1 when `.gitignore`, `.dockerignore`, or `ci-harness.yml` names `CLAUDE.md`. | No support entry remains |
| `.agro/evals/probes/agents-md-single-source.sh` | Exits 1 when an `AGENTS.md` contains `provider-compatibility symlink`. | No stale notice remains |
| `.agro/evals/probes/worktrees-layout.sh` | Tracked set equals the two `AGENTS.md` files. | Inverted layout check |
| `.agro/evals/probes/escalate-contract.sh` | Existing escalation cases pass without the symlink check. | Inverted log check |
| `.agro/evals/probes/crons-directory-guide.sh` | Existing guide cases pass without the symlink check. | Inverted cron check |
| `.agro/evals/probes/oh-update-bootstrap.sh` | Unchanged. Exits 0. | Bootstrap still writes no `CLAUDE.md` |
| `vitest` suite through `pnpm test` | Unchanged. Exits 0. | No script test depends on the symlinks |

## Design Principles

- Code is the source of truth. Keep one instructions file per directory.
- Delete obsolete paths instead of leaving dormant alternatives.
- Coding-harness choice does not change the workspace. All harnesses read `AGENTS.md`.
- Change only prose that names this repository's bootloader. Keep generic guidance for arbitrary repositories.
- Add no install-time version check. State the floor in documentation.

## Out of Scope

- A version check or a warning in `agro harness install claude-code`.
- Edits to historical text: `.agro/knowledge/raw/`, `.agro/evals/decisions/skill-impact.md`, `docs/rfcs/preserved-changelog-rationale.md`, archived tasks, and existing `CHANGELOG.md` entries.
- The `CLAUDE.md` entry in `oh-update-bootstrap.sh:56`.
- The `mifunedev/agro-web` page itself. This repository's PR does not change another repository.
- The `.claude/skills` and `.claude/hooks` provider symlinks.

## Open Questions

1. The maintainer must accept the compatibility cost before implementation. The floor becomes Claude Code >= 2.1.277. Amazon Bedrock, Vertex, and Foundry sessions lose project instructions.
   A. Accept the cost and retire all five symlinks.
   B. Reject the cost and close issue #1082.
   C. Other: <specify>
2. The issue also names "sessions with telemetry disabled" as affected. This plan could not verify the telemetry claim.
   A. Document the claim as stated in the issue.
   B. Omit the claim until a source confirms it.
3. An operator who uses the escape hatch creates an untracked root `CLAUDE.md`. `git status` then shows the file.
   A. Add `/CLAUDE.md` and `**/CLAUDE.md` to `.gitignore`. The new probe then checks the index only.
   B. Leave `.gitignore` unchanged. The operator adds the file to `.git/info/exclude`.
4. `.gitignore:29` negates the ignore for the legacy path `.oh/logs/CLAUDE.md`. The issue does not name the legacy path.
   A. Remove the `.oh/logs/CLAUDE.md` negation together with the others.
   B. Keep the negation until the `.oh/` retirement task removes it.
5. `mifunedev/agro-web` needs a page for the floor and the escape hatch. Name the owner and the target page: `<agro-web page path>`.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .claude/skills/eval/run.sh` exits 0 and `.agro/evals/RESULTS.md` lists `agents-md-single-source` as PASS.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] The `ci-harness.yml` run on the PR head reports success.
- [ ] A fresh Claude Code session at the repository root, version 2.1.277 or later, loads the root `AGENTS.md` as project instructions.

## Lessons

Filled by the advisor before undraft.
