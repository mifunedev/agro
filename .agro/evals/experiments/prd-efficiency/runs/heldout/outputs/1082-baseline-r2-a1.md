# PRD: Retire the CLAUDE.md compatibility symlinks

Status: BLOCKED

## User Stories

### US-001: Guard the AGENTS.md-only invariant with probes

**Description:** As the maintainer, I want the probes to assert that no tracked `CLAUDE.md` alias exists so that the alias cannot return without a red eval.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/agents-md-native.sh` exists, is executable, and carries the `# tier: A`, `# source: issue #1082`, and `# desc:` header lines.
- [ ] `agents-md-native.sh` exits 1 when `git ls-files` lists a path whose basename is `CLAUDE.md`.
- [ ] `agents-md-native.sh` exits 1 when `.gitignore` or `.dockerignore` holds a line that ends in `CLAUDE.md`.
- [ ] `agents-md-native.sh` exits 1 when `.github/workflows/ci-harness.yml` holds the path-filter entry `- "CLAUDE.md"`.
- [ ] `agents-md-native.sh` exits 1 when a tracked `AGENTS.md` holds the string `provider-compatibility symlink`.
- [ ] `crons-directory-guide.sh` exits 1 when `crons/CLAUDE.md` exists as a file or as a symlink.
- [ ] `escalate-contract.sh` exits 1 when `.agro/logs/CLAUDE.md` exists or when `.gitignore` holds `!.agro/logs/CLAUDE.md`.
- [ ] `worktrees-layout.sh` expects `git ls-files .worktrees projects` to list exactly `.worktrees/AGENTS.md` and `projects/AGENTS.md`.
- [ ] No probe outside these four files asserts that a `CLAUDE.md` symlink exists. `grep -rln 'CLAUDE.md' .agro/evals/probes` lists no probe that requires the alias.

### US-002: Remove the symlinks and their ignore and CI entries

**Description:** As the maintainer, I want the five `CLAUDE.md` symlinks and every entry that keeps them tracked removed so that Claude Code reads `AGENTS.md` natively.

**Acceptance Criteria:**

- [ ] `git ls-files | grep -E '(^|/)CLAUDE\.md$'` prints nothing.
- [ ] `.gitignore` holds none of `!.worktrees/CLAUDE.md`, `!projects/CLAUDE.md`, `!.oh/logs/CLAUDE.md`, and `!.agro/logs/CLAUDE.md`.
- [ ] `.dockerignore` holds neither `!.worktrees/CLAUDE.md` nor `!projects/CLAUDE.md`.
- [ ] `.github/workflows/ci-harness.yml` holds no `- "CLAUDE.md"` entry under `push.paths` or under `pull_request.paths`.
- [ ] `.github/workflows/ci-harness.yml` still holds the `- "AGENTS.md"` entry under both path filters.
- [ ] `bash .agro/skills/eval/run.sh --probe agents-md-native` exits 0.
- [ ] `bash .agro/skills/eval/run.sh --probe crons-directory-guide`, `--probe escalate-contract`, and `--probe worktrees-layout` each exit 0.

### US-003: Rewrite the prose that names CLAUDE.md as this repository's bootloader

**Description:** As a harness agent, I want each guide to name `AGENTS.md` as the instruction file so that no guide cites a deleted path.

**Acceptance Criteria:**

- [ ] The root `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, and `.agro/logs/AGENTS.md` no longer hold the sentence "`CLAUDE.md` is a provider-compatibility symlink to this file. Edit `AGENTS.md`."
- [ ] The root `AGENTS.md` states that each coding harness reads `AGENTS.md` natively and that Claude Code requires version `2.1.277` or newer for native reading.
- [ ] `docs/glossary.md` holds neither "aliased for provider compatibility as `CLAUDE.md`" nor "aliased `CLAUDE.md` for provider compatibility".
- [ ] `.agro/scripts/README.md` cites `AGENTS.md` in place of `CLAUDE.md` at the orchestrator-boundary sentence.
- [ ] Each of these files names `AGENTS.md` as this repository's bootloader: `.agro/skills/harness-context/SKILL.md`, `.agro/skills/rlm/SKILL.md`, `.agro/skills/audit/references/context.md`, `.agro/skills/audit/references/harness.md`, `.agro/skills/render-html/SKILL.md`.
- [ ] Each of these files keeps its generic "`AGENTS.md`/`CLAUDE.md`" guidance for target repositories: `.agro/skills/plan/SKILL.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/builder/references/rule.md`, `.agro/skills/blog/SKILL.md`, `.agro/skills/blog/references/loom-to-blog.md`.
- [ ] `docs/rfcs/preserved-changelog-rationale.md` stays unchanged, because the file records history.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION row.

### US-004: Document the version floor and the escape hatch

**Description:** As an operator on an unsupported Claude Code session, I want documented recovery steps so that I can restore project instructions.

**Acceptance Criteria:**

- [ ] `docs/harnesses/claude-code.md` holds a `## Project instructions` section that states the floor `2.1.277`.
- [ ] The `## Project instructions` section names the unsupported sessions: Amazon Bedrock, Vertex, Foundry, and sessions with telemetry disabled.
- [ ] The `## Project instructions` section gives the escape hatch: a root `CLAUDE.md` that holds `@AGENTS.md`, plus one `CLAUDE.md` per nested guide the operator needs.
- [ ] The `## Project instructions` section tells the operator that a `CLAUDE.md` in a directory or in an ancestor disables native `AGENTS.md` reading.
- [ ] `CHANGELOG.md` holds a `### Removed` entry under `## [Unreleased]` that links issue `#1082` and names the floor `2.1.277`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/harnesses/claude-code.md` exits 0.

## Summary

Claude Code 2.1.277 reads `AGENTS.md` when no `CLAUDE.md` exists. The default setting is `claude-md-or-agents-md`. Under that setting, Claude Code reads each root and ancestor `AGENTS.md` at session start. Claude Code also reads a subdirectory `AGENTS.md` when the Read tool opens a file in that subdirectory. The source for these facts is issue #1082, which quotes the Claude Code release note and memory documentation. This plan did not verify these facts against a running Claude Code.

Verified current state at commit `81e66e6`:

- `git ls-files -s` lists five mode-`120000` entries that point at `AGENTS.md`: `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, and `.agro/logs/CLAUDE.md`.
- `.gitignore` negates `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `.oh/logs/CLAUDE.md`, and `.agro/logs/CLAUDE.md`. The `.oh/logs/CLAUDE.md` entry has no tracked target.
- `.dockerignore` negates `.worktrees/CLAUDE.md` and `projects/CLAUDE.md`.
- `.github/workflows/ci-harness.yml` lists `"CLAUDE.md"` at line 32 and at line 57.
- Three probes require the alias: `crons-directory-guide.sh`, `escalate-contract.sh`, and `worktrees-layout.sh`.
- `oh-update-bootstrap.sh` names `CLAUDE.md` only as a file that the update must not copy. That probe needs no change.
- No code under `.agro/cli/`, `.agro/scripts/`, or `.agro/install/` creates a `CLAUDE.md`. Initialized projects therefore receive no alias.
- Five skill files name `CLAUDE.md` as this repository's bootloader. Issue #1082 counts four. The fifth file is `.agro/skills/render-html/SKILL.md` at line 38.

The selected approach follows issue #1082. The approach deletes the aliases, inverts the three probes, and adds one probe for the new invariant. The approach also rewrites the bootloader prose and documents the floor and the escape hatch.

Affected surfaces:

| Surface | Mark | Reason |
|---|---|---|
| Host and sandbox | applied | The worker edits and tests in a sandbox worktree. The host needs no change. |
| Lifecycle door | not applicable | No `agro` verb reads or writes `CLAUDE.md`. |
| Canonical and provider surfaces | applied | `AGENTS.md` becomes the only instruction file. `.claude/skills` and `.claude/hooks` symlinks stay. |
| Root and scaffold | applied | The root checkout changes. The scaffold creates no alias today. |
| Interactive and headless processes | not applicable | No process changes. |
| Local and remote operation | applied | A remote session on Claude Code older than `2.1.277` loses project instructions. |
| Parallel operation | not applicable | The change edits tracked files only. |
| Public documentation | applied | `mifunedev/agro-web` can name `CLAUDE.md`. See open question 3. |
| Verification | applied | The four probes and the eval suite in CI job `eval-probes` prove the invariant. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `CLAUDE.md`, `.worktrees/CLAUDE.md`, `projects/CLAUDE.md`, `crons/CLAUDE.md`, `.agro/logs/CLAUDE.md` | symlink to `AGENTS.md` | Aliases that this task deletes |
| `.gitignore` | lines 19, 22, 29, 34 | Negations that keep the aliases tracked |
| `.dockerignore` | lines 8, 11 | Negations that keep the aliases in the build context |
| `.github/workflows/ci-harness.yml` | `on.push.paths`, `on.pull_request.paths` | CI path filters |
| `.agro/evals/probes/crons-directory-guide.sh` | `ALIAS` block, final `PASS` message | Probe to invert |
| `.agro/evals/probes/escalate-contract.sh` | lines 18-23 | Probe to invert |
| `.agro/evals/probes/worktrees-layout.sh` | `expected`, alias loop, `desc` header | Probe to invert |
| `.agro/evals/probes/agents-md-native.sh` | new file | Probe for the new invariant |
| `AGENTS.md`, `.worktrees/AGENTS.md`, `projects/AGENTS.md`, `crons/AGENTS.md`, `.agro/logs/AGENTS.md` | symlink notice line | Guides that carry the notice |
| `docs/glossary.md` | `orchestrator`, `rule` entries | Glossary text that names the alias |
| `.agro/scripts/README.md` | line 60 | Orchestrator-boundary citation |
| `.agro/skills/harness-context/SKILL.md` | step 1, output shape | Bootloader citation |
| `.agro/skills/rlm/SKILL.md` | line 65 | Bootloader citation |
| `.agro/skills/audit/references/context.md` | `Bootloader` row | Bootloader citation |
| `.agro/skills/audit/references/harness.md` | line 120 | Bootloader citation |
| `.agro/skills/render-html/SKILL.md` | line 38 | Bootloader citation |
| `docs/harnesses/claude-code.md` | new `## Project instructions` section | Floor and escape hatch |
| `CHANGELOG.md` | `## [Unreleased]` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code project instructions | Behavior change | Claude Code reads `AGENTS.md` natively in place of the `CLAUDE.md` alias. |
| Supported Claude Code versions | Compatibility floor | AGRO requires Claude Code `2.1.277` or newer for project instructions. |
| Bedrock, Vertex, Foundry, telemetry-disabled sessions | Removal | These sessions receive no project instructions until the operator adds the escape hatch. |
| Eval suite | New probe | `agents-md-native` joins `RESULTS.md`. |

## Storage

N/A. The task changes tracked files and adds no persistent state.

## Architectural Decisions

- `AGENTS.md` is the single source of instructions for every coding harness. No tracked mirror exists.
- The escape hatch stays in the operator's checkout. AGRO tracks no `CLAUDE.md` and ships no fallback file.
- The new probe checks tracked state with `git ls-files`. An untracked operator `CLAUDE.md` therefore does not fail the probe.
- The three inverted probes keep their original lessons. Each probe asserts the absence of its own alias. `agents-md-native.sh` asserts the repository-wide invariant.
- Generic guidance for arbitrary target repositories keeps both file names, because a target repository can use either file.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/agents-md-native.sh` | Exits 1 before US-002 on the current tree. Exits 0 after US-002 and US-003. | Invariant: no tracked alias, no ignore negation, no CI filter entry, no symlink notice |
| `.agro/evals/probes/crons-directory-guide.sh` | Exits 1 while `crons/CLAUDE.md` exists. Exits 0 after removal. | Inverted alias check |
| `.agro/evals/probes/escalate-contract.sh` | Exits 1 while `.agro/logs/CLAUDE.md` or its negation exists. Exits 0 after removal. | Inverted alias check |
| `.agro/evals/probes/worktrees-layout.sh` | Exits 1 while `git ls-files .worktrees projects` lists a `CLAUDE.md`. Exits 0 after removal. | Inverted tracked-file set |
| `bash .agro/skills/eval/run.sh` | Full suite | No REGRESSION row in `RESULTS.md` |
| `bash .agro/skills/ste/scripts/ste-check.sh` | Each edited Markdown file | STE compliance of new prose |

## Design Principles

- Keep one source of truth for each policy. `AGENTS.md` owns project instructions.
- Delete obsolete paths instead of leaving dormant alternatives.
- Add no explanatory comments to tracked code. The probe `desc` header is a machine-read field.
- Change only the prose that names this repository's bootloader.
- Record the compatibility cost in the changelog and in the harness documentation.

## Out of Scope

- The `.claude/skills` and `.claude/hooks` symlinks.
- A `CLAUDE.md` fallback that AGRO tracks or generates.
- Changes to `agro init`, `agro migrate`, or `agro update`.
- Historical records under `docs/rfcs/` and archived task evidence.
- Edits to `mifunedev/agro-web`. Open question 3 decides a follow-up.

## Open Questions

1. Does the maintainer accept the compatibility cost? The cost is a Claude Code floor of `2.1.277` and no project instructions on Bedrock, Vertex, Foundry, or telemetry-disabled sessions. Issue #1082 names this decision as the maintainer's call. This plan stays `BLOCKED` until the maintainer answers.
   - A. Accept. Build the plan as written.
   - B. Reject. Keep the symlinks and close issue #1082.
   - C. Other: <specify>
2. Does `.gitignore` ignore an operator's root `CLAUDE.md` escape hatch?
   - A. No. The operator manages the untracked file. This plan assumes A.
   - B. Yes. Add `/CLAUDE.md` to `.gitignore`, and let `agents-md-native.sh` allow that one line.
3. Does `mifunedev/agro-web` name `CLAUDE.md` as the AGRO bootloader? If so, the owner opens a follow-up issue in that repository. The current state is `<agro-web search result>`.
4. Does the maintainer confirm the fifth bootloader file, `.agro/skills/render-html/SKILL.md`? Issue #1082 counts four skill files. This plan includes all five.

## Acceptance Criteria

- [ ] `git ls-files | grep -E '(^|/)CLAUDE\.md$'` prints nothing.
- [ ] `grep -n 'CLAUDE.md' .gitignore .dockerignore .github/workflows/ci-harness.yml` prints nothing.
- [ ] `bash .agro/skills/eval/run.sh` exits 0, and `RESULTS.md` lists `agents-md-native` as PASS.
- [ ] CI job `eval-probes` in `.github/workflows/ci-harness.yml` passes on the task pull request.
- [ ] `docs/harnesses/claude-code.md` and `CHANGELOG.md` state the floor `2.1.277` and the escape hatch.
- [ ] Open question 1 holds the maintainer's recorded answer before the build starts.

## Lessons

Filled by the advisor before undraft.
