# PRD: Retire the CLAUDE.md provider-compatibility symlinks

Status: BLOCKED

## User Stories

### US-001: Delete the five symlinks and their ignore and CI entries

**Description:** As a maintainer, I want the repository to ship no `CLAUDE.md` alias so that Claude Code reads `AGENTS.md` natively, like Codex and Pi.

**Acceptance Criteria:**

- [ ] `git ls-files -s | awk '$1=="120000" && $4 ~ /(^|\/)CLAUDE\.md$/'` prints nothing.
- [ ] `git ls-files | grep -E '(^|/)CLAUDE\.md$'` prints nothing.
- [ ] `grep -n 'CLAUDE.md' .gitignore .dockerignore` prints nothing.
- [ ] `grep -n '"CLAUDE.md"' .github/workflows/ci-harness.yml` prints nothing.
- [ ] `.github/workflows/ci-harness.yml` still lists `"AGENTS.md"` under the `push` path filter and under the `pull_request` path filter.
- [ ] `git check-ignore -q .worktrees/feat/1-probe` exits 0, and `git check-ignore -q projects/an-owner/a-repo` exits 0.

### US-002: Invert the three symlink probes and add the invariant probe

**Description:** As a maintainer, I want a probe that fails on a restored alias so that the alias cannot return unnoticed.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/escalate-contract.sh` exits 1 when `.agro/logs/CLAUDE.md` exists, and no longer requires `!.agro/logs/CLAUDE.md` in `.gitignore`.
- [ ] `.agro/evals/probes/worktrees-layout.sh` expects `git ls-files .worktrees projects` to equal exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md`.
- [ ] `.agro/evals/probes/crons-directory-guide.sh` exits 1 when `crons/CLAUDE.md` exists.
- [ ] The header comments and the `PASS:` lines of the three probes no longer name a `CLAUDE.md` symlink.
- [ ] A new probe `.agro/evals/probes/<new-probe-id>.sh` carries the `# tier:`, `# source:`, and `# desc:` header lines, with `# source: issue #1082`.
- [ ] The new probe exits 1 when any tracked path matches `(^|/)CLAUDE\.md$`.
- [ ] The new probe exits 1 when `.gitignore` or `.dockerignore` holds a `CLAUDE.md` negation.
- [ ] The new probe exits 1 when `.github/workflows/ci-harness.yml` lists `"CLAUDE.md"`.
- [ ] The new probe exits 1 when a tracked `AGENTS.md` holds the string `provider-compatibility symlink`.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] With a temporary `ln -s AGENTS.md crons/CLAUDE.md`, the new probe and `crons-directory-guide.sh` both exit 1. The temporary link is removed after the check.

### US-003: Update the AGENTS.md notices, the glossary, and the bootloader references

**Description:** As an agent, I want each instruction file to name only `AGENTS.md` so that no text points at a deleted file.

**Acceptance Criteria:**

- [ ] `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, and `.agro/logs/AGENTS.md` do not contain `provider-compatibility symlink`.
- [ ] The root `AGENTS.md` states that each coding harness reads `AGENTS.md` natively and links to the Claude Code version floor and the escape hatch from US-004.
- [ ] `docs/glossary.md` has no "aliased" `CLAUDE.md` text in the **orchestrator** entry or the **rule** entry.
- [ ] `.agro/scripts/README.md` cites `AGENTS.md` in place of `CLAUDE.md`.
- [ ] `.agro/skills/harness-context/SKILL.md`, `.agro/skills/rlm/SKILL.md`, `.agro/skills/audit/references/context.md`, and `.agro/skills/audit/references/harness.md` cite `AGENTS.md` as this repository's bootloader and do not cite `CLAUDE.md` for that role.
- [ ] Generic guidance that reads a target repository's `AGENTS.md` or `CLAUDE.md` stays unchanged in `.agro/skills/blog/SKILL.md`, `.agro/skills/blog/references/loom-to-blog.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, `.agro/skills/plan/SKILL.md`, `.agro/skills/render-html/SKILL.md`, and `.pi/APPEND_SYSTEM.md`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file that exited 0 before the change.

### US-004: Document the version floor, the escape hatch, and the change

**Description:** As an operator on an unsupported provider, I want the documented floor and escape hatch so that I can restore project instructions locally.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` states the floor `Claude Code >= 2.1.277`.
- [ ] `docs/harnesses/claude-code.md` names each unsupported case: Amazon Bedrock, Vertex, Foundry, and sessions with telemetry disabled.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that contains `@AGENTS.md`, plus one per nested guide that the operator needs.
- [ ] `docs/harnesses/claude-code.md` names the `claude-md-or-agents-md` setting under "Project instructions" in `/config`.
- [ ] `CHANGELOG.md` has one `### Removed` entry under `## [Unreleased]` that cites [#1082](https://github.com/mifunedev/agro/issues/1082) and names the version floor.
- [ ] A `mifunedev/agro-web` change is filed or linked if agro-web documents the `CLAUDE.md` alias. The link is `<agro-web issue or PR>`.

## Summary

Claude Code 2.1.277 (2026-09-18) reads `AGENTS.md` natively when the project has no `CLAUDE.md`. The default `claude-md-or-agents-md` setting reads each root or ancestor `AGENTS.md` and `.claude/AGENTS.md` at session start. The setting reads a subdirectory `AGENTS.md` when the Read tool opens a file in that subdirectory. A `CLAUDE.md` in the working directory or in an ancestor directory disables the `AGENTS.md` path. The tracked aliases therefore suppress the native behavior.

Verified current state:

- Git tracks five symlinks with mode `120000` that point at the sibling `AGENTS.md`: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- `.gitignore` negates `.worktrees/CLAUDE.md` (line 19), `projects/CLAUDE.md` (line 22), `.oh/logs/CLAUDE.md` (line 29), and `.agro/logs/CLAUDE.md` (line 34). Git tracks no file under `.oh/logs/`.
- `.dockerignore` negates `.worktrees/CLAUDE.md` (line 8) and `projects/CLAUDE.md` (line 11).
- `.github/workflows/ci-harness.yml` lists `"CLAUDE.md"` in the `push` path filter (line 32) and in the `pull_request` path filter (line 57).
- Three probes assert a symlink: `escalate-contract.sh` (lines 18-23), `worktrees-layout.sh` (lines 6, 33-49), and `crons-directory-guide.sh` (lines 24-32, 51).
- Five `AGENTS.md` files carry the line "`CLAUDE.md` is a provider-compatibility symlink to this file. Edit `AGENTS.md`."
- Four skill files name `CLAUDE.md` as this repository's bootloader: `harness-context/SKILL.md` (lines 19, 44), `rlm/SKILL.md` (line 65), `audit/references/context.md` (line 9), and `audit/references/harness.md` (line 120).
- `oh update` vendors `.agro/**` and `crons/**` per `.agro/manifest.json`. The vendor step skips symlinks (`.agro/cli/src/__tests__/vendor.test.ts:110`). Vendored projects therefore never received the aliases.
- `.agro/evals/probes/oh-update-bootstrap.sh:56` asserts that `oh update` writes no root `CLAUDE.md`. This assertion stays valid.

Selected approach: delete the aliases, remove each surface that names them, invert the three probes, and add one probe for the new invariant. Document the floor and the escape hatch in `docs/harnesses/claude-code.md`. `git pull` deletes the tracked aliases in each existing checkout. The task therefore adds no migration code.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md` | symlinks to `AGENTS.md` | Deleted |
| `.gitignore` | `!…/CLAUDE.md` negations, lines 19, 22, 29, 34 | Removed |
| `.dockerignore` | `!…/CLAUDE.md` negations, lines 8, 11 | Removed |
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths` | `"CLAUDE.md"` entry removed |
| `.agro/evals/probes/escalate-contract.sh` | alias check, `keep` loop | Inverted |
| `.agro/evals/probes/worktrees-layout.sh` | `expected`, alias loop, header | Inverted |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` check, `PASS` line | Inverted |
| `.agro/evals/probes/<new-probe-id>.sh` | new probe | Guards the invariant |
| `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, `.agro/logs/AGENTS.md` | symlink notice line | Replaced or removed |
| `docs/glossary.md` | **orchestrator**, **rule** entries | Alias text removed |
| `.agro/scripts/README.md` | line 60 | Cites `AGENTS.md` |
| `.agro/skills/harness-context/SKILL.md`, `.agro/skills/rlm/SKILL.md`, `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md` | bootloader references | Cite `AGENTS.md` |
| `docs/harnesses/claude-code.md` | new section | Version floor and escape hatch |
| `CHANGELOG.md` | `## [Unreleased]` → `### Removed` | Change entry |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior change | Claude Code reads `AGENTS.md` through the native path, not through a symlink. |
| Supported Claude Code version | Compatibility floor | The floor rises to `2.1.277`. Bedrock, Vertex, Foundry, and telemetry-disabled sessions load no project instructions. |
| Probe suite | New probe, three inverted probes | The suite fails when an alias returns. |
| CI path filter | Removed entry | A `CLAUDE.md` change no longer triggers `ci-harness.yml`. |
| `agro` lifecycle verbs | None | No verb creates or reads `CLAUDE.md`. |
| `mifunedev/agro-web` | Possible documentation change | Open question 3. |

## Storage

N/A. The change deletes tracked files and edits text. The change adds no persistent state.

## Architectural Decisions

- `AGENTS.md` becomes the single source of project instructions for every coding harness. This decision removes the per-provider mirror that non-negotiable 2 ("Coding-harness choice does not change the workspace") discourages.
- The repository ships no fallback file. An affected operator adds a local `CLAUDE.md` that contains `@AGENTS.md`, or restores the symlinks in the operator's own checkout. The escape hatch lives in documentation, not in code.
- The new probe owns the global invariant. The three inverted probes keep their local assertions so that each probe still names its directory.
- The compatibility floor is the maintainer's decision. The issue states this. Open question 1 blocks the plan until the maintainer decides.

Affected surfaces:

- **Host and sandbox:** applied. Edit files and run probes in a sandbox worktree. No host change.
- **Lifecycle door:** not applicable. No `agro` verb names `CLAUDE.md`.
- **Canonical and provider surfaces:** applied. This task removes a provider alias. `.agents/skills`, `.claude/skills`, and `.claude/hooks` symlinks stay unchanged.
- **Root and scaffold:** applied to the root. Vendored projects never received the aliases, because the vendor step skips symlinks.
- **Interactive and headless processes:** not applicable. The task starts no process.
- **Local and remote operation:** applied. The version floor applies to each sandbox, local or remote.
- **Parallel operation:** applied. A worktree created after the merge carries no alias. An existing worktree loses the alias when the worktree merges or rebases onto the change.
- **Public documentation:** applied. See open question 3.
- **Verification:** applied. See the test plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/<new-probe-id>.sh` | Write the probe first. The probe exits 1 on the current tree, then exits 0 after US-001 and US-003. | No tracked alias, no ignore negation, no CI filter entry, no symlink notice |
| `.agro/evals/probes/<new-probe-id>.sh` | Temporary `ln -s AGENTS.md crons/CLAUDE.md` plus `git add -N`: exit 1 | The probe detects a restored alias |
| `.agro/evals/probes/escalate-contract.sh` | Current tree after US-001: exit 0. A temporary `.agro/logs/CLAUDE.md`: exit 1 | Inverted log-directory assertion |
| `.agro/evals/probes/worktrees-layout.sh` | Current tree after US-001: exit 0 | Tracked set equals the two `AGENTS.md` guides |
| `.agro/evals/probes/crons-directory-guide.sh` | Current tree after US-001: exit 0. A temporary `crons/CLAUDE.md`: exit 1 | Inverted crons assertion |
| `.agro/evals/probes/oh-update-bootstrap.sh` | Unchanged: exit 0 or exit 2 | `oh update` still writes no root `CLAUDE.md` |
| `bash .agro/skills/eval/run.sh` | Full suite | No REGRESSION |
| `pnpm test` | Full suite | No test depends on the aliases |
| `bash .agro/skills/ste/scripts/ste-check.sh <changed-md-file>` | Each changed Markdown file | Prose stays in STE style |

## Design Principles

- Keep one source of truth for each policy. `AGENTS.md` is the only instruction file.
- Delete obsolete paths instead of leaving dormant alternatives.
- State the cost plainly. The docs name each unsupported provider and the escape hatch.
- Change only this repository's bootloader references. Generic guidance about an arbitrary target repository stays unchanged.
- Add no explanatory comments to tracked code. The probe `# desc:` header is machine-read data, so the header stays.

## Out of Scope

- Changes to the `.agents/skills`, `.claude/skills`, `.claude/hooks`, `.codex/screenshots`, and `.codex/specs` symlinks.
- A `CLAUDE.md` shim, a generator, or an `agro migrate` step that writes a `CLAUDE.md`.
- Removal of `CLAUDE.md` files from operator projects under `projects/` or from vendored projects.
- Edits to `CHANGELOG.md` history, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/evals/decisions/skill-impact.md`, `.agro/knowledge/raw/`, and `.agro/tasks/archive/`.
- Changes to the `.claude/AGENTS.md` path.

## Open Questions

1. **Blocking.** Does the maintainer accept the floor of Claude Code `>= 2.1.277` and the loss of project instructions on Bedrock, Vertex, Foundry, and telemetry-disabled sessions? The issue names this decision as the maintainer's decision.
2. Must `.gitignore` line 29 (`!.oh/logs/CLAUDE.md`) go too? Git tracks no file under `.oh/logs/`. The plan removes the line, because the line serves only the alias.
3. Does `mifunedev/agro-web` document the `CLAUDE.md` alias? If yes, the task needs a matching change there. The link is `<agro-web issue or PR>`.
4. What is the id of the new probe? The plan uses `<new-probe-id>`. A candidate is `agents-md-sole-instructions`.
5. Does the maintainer want the root `AGENTS.md` notice replaced with a floor-and-escape-hatch pointer, or removed? The plan replaces the notice with a pointer. The four nested `AGENTS.md` files drop the notice.

## Acceptance Criteria

- [ ] The maintainer answers open question 1 with an explicit acceptance of the floor.
- [ ] Git tracks no path that matches `(^|/)CLAUDE\.md$`.
- [ ] `.gitignore`, `.dockerignore`, and `.github/workflows/ci-harness.yml` do not name `CLAUDE.md`.
- [ ] `bash .agro/skills/eval/run.sh` exits with no REGRESSION, and the new probe reports PASS.
- [ ] `pnpm test` exits 0.
- [ ] `docs/harnesses/claude-code.md` states the floor `2.1.277`, the unsupported cases, and the `@AGENTS.md` escape hatch.
- [ ] `CHANGELOG.md` has a `### Removed` entry for #1082 under `## [Unreleased]`.
- [ ] `grep -rn 'CLAUDE.md' AGENTS.md docs/glossary.md .agro/scripts/README.md .agro/skills/harness-context/SKILL.md .agro/skills/rlm/SKILL.md .agro/skills/audit/references/context.md .agro/skills/audit/references/harness.md` prints only text that describes the escape hatch or the floor.

## Lessons

Filled by the advisor before undraft.
