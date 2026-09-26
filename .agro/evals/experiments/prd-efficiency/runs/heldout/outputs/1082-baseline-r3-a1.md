# PRD: Retire the CLAUDE.md provider-compatibility symlinks

Status: DRAFT

## User Stories

### US-001: Probes guard the AGENTS.md-only invariant

**Description:** As the maintainer, I want the eval probes to assert that no `CLAUDE.md` alias exists so that a reintroduced alias fails CI.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/crons-directory-guide.sh` exits 1 when `crons/CLAUDE.md` exists, and the probe no longer requires the symlink.
- [ ] `.agro/evals/probes/escalate-contract.sh` exits 1 when `.agro/logs/CLAUDE.md` exists or when `.gitignore` contains `!.agro/logs/CLAUDE.md`.
- [ ] `.agro/evals/probes/worktrees-layout.sh` expects `git ls-files .worktrees projects` to return exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md`.
- [ ] The new probe `.agro/evals/probes/agents-md-single-source.sh` carries the `tier`, `source`, and `desc` header lines, and names issue #1082 in `source`.
- [ ] The new probe exits 1 when `git ls-files` lists any path that matches `(^|/)CLAUDE\.md$`.
- [ ] The new probe exits 1 when `.gitignore` or `.dockerignore` contains a line that matches `^!.*CLAUDE\.md$`.
- [ ] The new probe exits 1 when `.github/workflows/ci-harness.yml` contains the path filter `"CLAUDE.md"`.
- [ ] The new probe exits 1 when any of the five `AGENTS.md` files in US-003 contains the string `provider-compatibility symlink`.
- [ ] Each changed probe and the new probe exit 1 against the pre-change tree. The implementer records this red run as fault-injection evidence.
- [ ] The probe header comments in the three changed probes no longer describe a `CLAUDE.md` symlink.

### US-002: Delete the symlinks and their ignore and CI entries

**Description:** As the maintainer, I want the five tracked `CLAUDE.md` symlinks and their support entries removed so that Claude Code reads `AGENTS.md` natively.

**Acceptance Criteria:**

- [ ] `git ls-files -s | grep '^120000' | grep CLAUDE.md` prints nothing.
- [ ] `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md` do not exist in the working tree.
- [ ] `.gitignore` contains none of `!.worktrees/CLAUDE.md`, `!projects/CLAUDE.md`, `!.oh/logs/CLAUDE.md`, and `!.agro/logs/CLAUDE.md`.
- [ ] `.dockerignore` contains none of `!.worktrees/CLAUDE.md` and `!projects/CLAUDE.md`.
- [ ] `.github/workflows/ci-harness.yml` contains no `"CLAUDE.md"` entry under `push.paths` or `pull_request.paths`.
- [ ] `git check-ignore -q .worktrees/CLAUDE.md` exits 0, and `git check-ignore -q projects/CLAUDE.md` exits 0.

### US-003: Replace the symlink notice in each AGENTS.md

**Description:** As an agent, I want each `AGENTS.md` to state its real loading model so that the guide describes no deleted file.

**Acceptance Criteria:**

- [ ] `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, and `.agro/logs/AGENTS.md` do not contain the sentence "`CLAUDE.md` is a provider-compatibility symlink to this file."
- [ ] Each of the five files states that coding harnesses read `AGENTS.md` natively and that the repository tracks no `CLAUDE.md`.
- [ ] `crons/AGENTS.md` still does not open with `---`.
- [ ] `bash .agro/evals/probes/crons-directory-guide.sh` exits 0.

### US-004: Update the documents and skills that name CLAUDE.md as the bootloader

**Description:** As a reader of the harness docs, I want each bootloader reference to name `AGENTS.md` so that no reference points at a deleted file.

**Acceptance Criteria:**

- [ ] `docs/glossary.md` contains neither "aliased for provider compatibility as `CLAUDE.md`" nor "aliased `CLAUDE.md` for provider compatibility".
- [ ] `.agro/scripts/README.md` names `AGENTS.md` in place of `CLAUDE.md` at the orchestrator-scope rule.
- [ ] `.agro/skills/harness-context/SKILL.md` names `AGENTS.md` in step 1 and in the "Output shape" lifecycle bullet.
- [ ] `.agro/skills/rlm/SKILL.md` names `AGENTS.md` at the orchestrator-boundary reference.
- [ ] `.agro/skills/audit/references/harness.md` names `AGENTS.md` in audit area 1.
- [ ] `.agro/skills/audit/references/context.md` lists `AGENTS.md` as the bootloader with no `CLAUDE.md` symlink note.
- [ ] Generic target-repository guidance stays unchanged in `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, `.agro/skills/plan/SKILL.md`, `.agro/skills/blog/SKILL.md`, `.agro/skills/blog/references/loom-to-blog.md`, and `.pi/APPEND_SYSTEM.md`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-005: Document the version floor and the escape hatch

**Description:** As an operator on an unsupported provider, I want the floor and the workaround documented so that I can restore project instructions.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` states that AGRO requires Claude Code 2.1.277 or newer.
- [ ] `docs/harnesses/claude-code.md` names Amazon Bedrock, Vertex, Foundry, and sessions with telemetry disabled as sessions that do not read `AGENTS.md`.
- [ ] `docs/harnesses/claude-code.md` gives the escape hatch: a root `CLAUDE.md` that contains `@AGENTS.md`, plus one per nested guide that the operator needs.
- [ ] `docs/harnesses/claude-code.md` names the `/config` "Project instructions" setting and its default value `claude-md-or-agents-md`.
- [ ] `CHANGELOG.md` carries an entry that names the removal, the version floor, and the escape hatch, in the format that `.agro/skills/git/SKILL.md` requires.

## Summary

Claude Code 2.1.277 (2026-09-18) reads `AGENTS.md` natively when a directory has no `CLAUDE.md`. The default setting `claude-md-or-agents-md` loads each root and ancestor `AGENTS.md` at session start. The same setting loads a subdirectory `AGENTS.md` when the Read tool opens a file in that subdirectory.

Verified current state:

- `git ls-files -s` lists five mode-`120000` `CLAUDE.md` symlinks. Each symlink targets the sibling `AGENTS.md`: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- `.gitignore` lines 19, 22, 29, and 34 negate `CLAUDE.md` paths. Line 29 negates the legacy `.oh/logs/CLAUDE.md` path.
- `.dockerignore` lines 8 and 11 negate `CLAUDE.md` paths.
- `.github/workflows/ci-harness.yml` lines 32 and 57 list `"CLAUDE.md"` as a path filter.
- Five `AGENTS.md` files carry the notice "`CLAUDE.md` is a provider-compatibility symlink to this file."
- Three probes assert that a symlink exists: `crons-directory-guide.sh`, `escalate-contract.sh`, and `worktrees-layout.sh`.
- `.agro/cli/README.md` line 145 states that the CLI writes no scaffold. No file under `.agro/cli/`, `.agro/install/`, `.agro/scripts/`, or `.devcontainer/` creates a `CLAUDE.md`.
- `agro harness install claude-code` installs `@anthropic-ai/claude-code` with no version pin. A fresh install therefore meets the floor.

A `CLAUDE.md` in the working directory or in any ancestor directory disables the native `AGENTS.md` path. The symlinks therefore suppress the native behavior. Codex and Pi already read `AGENTS.md`. After this change, `AGENTS.md` is the single source of truth for every harness.

Selected approach: delete the symlinks and every entry that keeps them tracked. Rewrite the notices and the bootloader references. Invert the three probes. Add one probe for the new invariant. Document the floor and the escape hatch.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md` | symlinks to `AGENTS.md` | Files to delete |
| `.gitignore` | lines 19, 22, 29, 34 | `CLAUDE.md` negations to delete |
| `.dockerignore` | lines 8, 11 | `CLAUDE.md` negations to delete |
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths` | `"CLAUDE.md"` path filters to delete |
| `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, `.agro/logs/AGENTS.md` | symlink notice line | Notice to replace |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` check | Probe to invert |
| `.agro/evals/probes/escalate-contract.sh` | `.agro/logs/CLAUDE.md` checks | Probe to invert |
| `.agro/evals/probes/worktrees-layout.sh` | `expected`, alias loop | Probe to invert |
| `.agro/evals/probes/agents-md-single-source.sh` | new probe | Guard for the new invariant |
| `docs/glossary.md` | `orchestrator`, `rule` entries | Alias wording to remove |
| `.agro/scripts/README.md` | line 60 | Bootloader reference |
| `.agro/skills/harness-context/SKILL.md` | step 1, "Output shape" | Bootloader reference |
| `.agro/skills/rlm/SKILL.md` | line 65 | Bootloader reference |
| `.agro/skills/audit/references/harness.md` | audit area 1 | Bootloader reference |
| `.agro/skills/audit/references/context.md` | "Default-Loaded Set" table | Bootloader reference |
| `docs/harnesses/claude-code.md` | new section | Version floor and escape hatch |
| `CHANGELOG.md` | unreleased entry | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior change | Claude Code loads `AGENTS.md` through the native path instead of through a `CLAUDE.md` symlink. |
| Supported Claude Code versions | Compatibility change | The floor rises to Claude Code 2.1.277. |
| Bedrock, Vertex, Foundry, telemetry-disabled sessions | Compatibility change | These sessions load no project instructions unless the operator adds the escape hatch. |
| CI path filters | Configuration change | A change to `CLAUDE.md` no longer triggers `ci-harness.yml`. |
| Eval probe suite | New probe, three inverted probes | `bash .agro/skills/eval/run.sh` enforces the invariant. |
| `mifunedev/agro-web` | Possible documentation change | See the open questions. |

## Storage

N/A. The change removes tracked files and edits text. The change adds no persistent state.

## Architectural Decisions

- Source of truth: each directory `AGENTS.md` owns its instructions. No tracked mirror exists for any provider.
- The repository ships no `CLAUDE.md`. An operator who needs one creates it in the operator's own checkout. The ignore rules for `.worktrees/*` and `projects/*` then keep a nested `CLAUDE.md` untracked.
- The root `CLAUDE.md` stays untracked but not ignored. An operator who adds a root `CLAUDE.md` sees the file in `git status`. The new probe fails if the operator commits the file.
- Generic guidance that tells an agent to read a target repository's `AGENTS.md` or `CLAUDE.md` stays unchanged. That guidance applies to arbitrary repositories.
- Historical records stay unchanged: `CHANGELOG.md` history, `.agro/evals/decisions/skill-impact.md`, `.agro/knowledge/raw/`, and `docs/rfcs/preserved-changelog-rationale.md`.
- `.agro/evals/probes/oh-update-bootstrap.sh` lists `CLAUDE.md` as a file that an update must not write. That check stays unchanged.

Surface review:

- Host and sandbox: applied. The orchestrator edits tracked files at the root. No command runs in the sandbox.
- Lifecycle door: not applicable. No `agro` verb reads or writes `CLAUDE.md`.
- Canonical and provider surfaces: applied. `AGENTS.md` becomes the only instruction surface. `link-providers.sh --check` confirms that the skill symlinks still resolve.
- Root and scaffold: applied to the root. Not applicable to scaffolds, because the CLI writes no scaffold.
- Interactive and headless processes: not applicable. No process changes.
- Local and remote operation: applied. Remote sandboxes on Bedrock, Vertex, or Foundry lose project instructions without the escape hatch.
- Parallel operation: applied. Each worktree reads its own `AGENTS.md`. No shared mutable state changes.
- Public documentation: applied. See the open questions.
- Verification: applied. See the test plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/agents-md-single-source.sh` | Exit 1 on the pre-change tree. Exit 0 after US-002 and US-003. | No tracked `CLAUDE.md`, no ignore negation, no CI filter, no stale notice |
| `.agro/evals/probes/crons-directory-guide.sh` | Exit 1 with `crons/CLAUDE.md` present. Exit 0 after deletion. | Inverted alias check |
| `.agro/evals/probes/escalate-contract.sh` | Exit 1 with `.agro/logs/CLAUDE.md` or its negation present. Exit 0 after deletion. | Inverted alias check |
| `.agro/evals/probes/worktrees-layout.sh` | Exit 1 with the two nested aliases tracked. Exit 0 after deletion. | Exact tracked set |
| `.agro/skills/eval/run.sh` | Full suite | No other probe regresses |
| `.agro/scripts/link-providers.sh --check` | Provider link check | Skill and hook symlinks still resolve |
| `pnpm test` | Full vitest suite | No test depends on a `CLAUDE.md` alias |
| `bash .agro/skills/ste/scripts/ste-check.sh` on each changed Markdown file | STE checker | Changed prose passes the checker |

Run order: write US-001 first and record the red run. Then apply US-002 and US-003 and record the green run.

## Design Principles

- Code is the source of truth. Add no explanatory comments to the probes beyond the required header lines.
- Keep one source of truth for each policy. `AGENTS.md` owns project instructions for every harness.
- Delete obsolete paths instead of leaving dormant alternatives. Remove each negation, filter, and notice with its symlink.
- Keep the change small. Do not rename, restructure, or rewrite any guide beyond the notice line.

## Out of Scope

- A runtime check of the installed Claude Code version.
- A pinned Claude Code version in `agro harness install claude-code`.
- An `agro` verb that creates the escape-hatch `CLAUDE.md` files.
- Changes to generic target-repository guidance that names `AGENTS.md`/`CLAUDE.md`.
- Edits to historical records listed in Architectural Decisions.
- Changes to `.claude/`, `.codex/`, or `.agents/` skill and hook symlinks.

## Open Questions

1. Operator approval of this plan accepts the compatibility cost. The cost is the Claude Code 2.1.277 floor. The cost also includes lost project instructions on Bedrock, Vertex, Foundry, and telemetry-disabled sessions. Confirm this decision explicitly at approval.
2. Does `mifunedev/agro-web` describe `CLAUDE.md` as an alias or state a Claude Code version? If yes, the operator opens a matching change at `<agro-web issue or PR>`.
3. `.agro/skills/render-html/SKILL.md` line 38 lists `CLAUDE.md` as a skill or identity source. Should the implementer change that line to `AGENTS.md`? The plan leaves the line unchanged until the operator decides.
4. Should `docs/installation.md` or `docs/agro-compatibility.md` also state the Claude Code floor? The plan documents the floor only in `docs/harnesses/claude-code.md`.

## Acceptance Criteria

- [ ] `git ls-files | grep -E '(^|/)CLAUDE\.md$'` prints nothing.
- [ ] `bash .agro/evals/probes/agents-md-single-source.sh` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `grep -rn 'provider-compatibility symlink' --include=AGENTS.md .` prints nothing.
- [ ] `docs/harnesses/claude-code.md` states the 2.1.277 floor and the `@AGENTS.md` escape hatch.
- [ ] The CI workflow `ci-harness.yml` passes on the pull request.

## Lessons

Filled by the advisor before undraft.
