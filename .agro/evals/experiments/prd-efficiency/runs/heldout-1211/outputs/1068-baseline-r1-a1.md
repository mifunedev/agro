# PRD: Shorten the supervisor skill description

Status: DRAFT

## User Stories

### US-001: Fit the supervisor description inside the Pi limit

**Description:** As a Pi operator, I want the `/supervisor` description to fit the Pi loader limit so that Pi loads the skill without a warning.

**Acceptance Criteria:**

- [ ] The diff touches only the `description` block of `.agro/skills/supervisor/SKILL.md`, plus the `CHANGELOG.md` entry that Open Question 1 governs.
- [ ] The Pi loader reports a `supervisor` description length of 1024 characters or fewer. The check uses the length command in the Test Plan.
- [ ] The Pi loader diagnostic command in the Test Plan prints `[]` and exits 0 against `.agro/skills`.
- [ ] The description keeps a `TRIGGER when:` clause. The clause names these triggers: supervise, babysit, watch, or drive an agent in another pane; a build in a second pane; a long build to its Definition of Done; an advisor brief, compaction, or escalation; "what is the advisor doing".
- [ ] The description keeps a `Do NOT trigger when` clause. The clause names these exclusions: the active session implements the work; a code review; bounded workers inside one session, with `/delegate`; a single `herdr` command, with `/herdr`.
- [ ] The description keeps these role boundaries: `MonitorCreate` with `onDone` for observation; `MonitorList` and `MonitorStop` for handle control; no `LoopCreate` and no polling; Herdr commands for launch and downward steering only; no reverse Herdr messages from advisors or workers; no code writing or review; ownership of context budgets and operator escalation.
- [ ] The frontmatter keys `name` and `allowed-tools` keep their current values byte for byte.
- [ ] The Markdown body of `.agro/skills/supervisor/SKILL.md` below the closing `---` stays byte for byte unchanged.

### US-002: Prove the fix and publish a ready PR

**Description:** As the operator, I want before-and-after evidence and a ready PR at a known SHA so that I can review the fix.

**Acceptance Criteria:**

- [ ] `evidence.md` in this task folder records the "before" diagnostic from the Test Plan: `description exceeds 1024 characters (1103)` for `.agro/skills/supervisor/SKILL.md`.
- [ ] `evidence.md` records the "after" diagnostic output `[]` with exit status 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0 and prints `Providers OK`.
- [ ] `git ls-files -s .claude/skills .agents/skills` shows mode `120000` for both entries.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION that the base commit did not report.
- [ ] The PR targets `development`, is not a draft, and carries `Closes #1068` in the body.
- [ ] The PR body states the exact head SHA. `gh pr view <PR number> --json headRefOid,isDraft` returns that SHA and `"isDraft": false`.
- [ ] Every required CI check on that head SHA reports success.

## Summary

Issue #1068 reports a Pi skill-loader warning for the `/supervisor` skill.

Verified current state, on base commit `a33545a`:

- Pi `0.87.1` sets `MAX_DESCRIPTION_LENGTH = 1024` in `dist/core/skills.js`. The loader pushes the warning `description exceeds 1024 characters (<n>)` when a description passes that limit.
- The parsed `supervisor` description holds 1103 characters. The fix must remove at least 79 characters.
- `/supervisor` is the only skill under `.agro/skills` that yields a Pi loader diagnostic.
- The description has three paragraphs: role boundaries, `TRIGGER when:`, and `Do NOT trigger when`.
- No probe under `.agro/evals/probes/` and no test pins the text of the supervisor description.
- `.claude/skills` and `.agents/skills` are tracked symlinks to `../.agro/skills`. The provider copy therefore changes with the canonical file.

Selected approach: rewrite the three description paragraphs with fewer words. Keep every trigger, every exclusion, and every role boundary. The Markdown body already states each rule in full. The description needs only the routing signal and the hard boundaries.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` | Canonical text to shorten. The only source edit. |
| `<pi install>/dist/core/skills.js` | `loadSkillsFromDir`, `MAX_DESCRIPTION_LENGTH` | Pi loader that emits the diagnostic. Read only. |
| `.agro/scripts/link-providers.sh` | `--check` | Verifies the provider symlinks into `.agro/skills`. Read only. |
| `.agro/skills/eval/run.sh` | probe runner | Runs the regression floor. Read only. |
| `CHANGELOG.md` | `## [Unreleased]` | Receives one `### Fixed` entry if Open Question 1 resolves to yes. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Skill listing in Pi, Claude Code, and Codex | Modified text | Each harness shows the shorter `/supervisor` description. Routing triggers stay the same. |
| Pi skill-loader diagnostics | Removed warning | Pi stops reporting the `supervisor` description-length warning. |

## Storage

N/A. The change edits static skill frontmatter. The change adds no persistent state.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` is the source of truth. Do not edit a file under `.claude/skills/` or `.agents/skills/` directly.
- The Pi loader is the oracle for the length check. The loader parses the YAML block scalar. A raw byte count of the file does not match the parsed length.
- The Markdown body owns the full supervisor procedure. The description carries only routing triggers and role boundaries.

Surface review:

- **Host and sandbox:** applied. The application agent edits the file and runs every check inside the sandbox.
- **Lifecycle door:** not applicable. No `agro` verb changes.
- **Canonical and provider surfaces:** applied. Edit `.agro/` only. `link-providers.sh --check` proves the symlinks.
- **Root and scaffold:** applied. Initialized projects receive the vendored skill pack, so both surfaces get the shorter description.
- **Interactive and headless processes:** not applicable. No process changes.
- **Local and remote operation:** not applicable. The change is static text.
- **Parallel operation:** applied. The owner works in one isolated worktree under `.worktrees/`.
- **Public documentation:** not applicable by assumption. This plan did not search `mifunedev/agro-web`. Open Question 3 records the check.
- **Verification:** applied. See the Test Plan.

## Test Plan (TDD)

Set the loader path once, in the sandbox shell, from the repository root:

```bash
PI_SKILLS="$(dirname "$(readlink -f "$(command -v pi)")")/../core/skills.js"
```

Diagnostic command. The command exits 1 before the fix and exits 0 after the fix:

```bash
node --input-type=module -e 'const {loadSkillsFromDir}=await import(process.argv[1]); const r=loadSkillsFromDir({dir:".agro/skills",source:"project"}); console.log(JSON.stringify(r.diagnostics)); process.exit(r.diagnostics.length?1:0)' "$PI_SKILLS"
```

Length command. The command prints `1103` before the fix:

```bash
node --input-type=module -e 'const {loadSkillsFromDir}=await import(process.argv[1]); console.log(loadSkillsFromDir({dir:".agro/skills",source:"project"}).skills.find(s=>s.name==="supervisor").description.length)' "$PI_SKILLS"
```

| Test File | Case(s) | Validates |
|---|---|---|
| Diagnostic command above | Run before the edit, then after the edit | Before: one warning for `supervisor`. After: `[]` and exit 0. |
| Length command above | Run after the edit | The parsed description holds 1024 characters or fewer. |
| `.agro/scripts/link-providers.sh --check` | Provider symlink check | Canonical and provider paths still resolve. |
| `.agro/skills/eval/run.sh` | Full probe suite | No new REGRESSION against the base commit. |
| `git diff development -- .agro/skills/supervisor/SKILL.md` | Manual review | Only the `description` block changes. Each trigger, exclusion, and boundary remains. |
| GitHub Actions on the PR head SHA | `ci-harness.yml` and other required checks | CI passes on the exact head SHA. |

## Design Principles

- Change the canonical `.agro/` file. Do not patch a provider mirror.
- Apply the smallest realistic change. Do not redesign the supervisor skill.
- Keep one source of truth. The body owns the procedure. The description owns routing.
- Use the real Pi loader as evidence. Do not substitute an estimate.

## Out of Scope

- Changes to the supervisor Markdown body, references, or allowed tools.
- Changes to any other skill description.
- A new probe or CI job that enforces the description limit across all skills. Open Question 2 covers this.
- Changes to provider symlinks or to `link-providers.sh`.
- Merge, release, force push, and unrelated changes.

## Open Questions

1. Does the PR add a `CHANGELOG.md` entry? The issue limits edits to the description. `.agro/skills/git/SKILL.md` requires an entry for a user-visible change. Default: add one `### Fixed` entry that links #1068.
2. Does a follow-up issue add a probe that fails when any skill description passes 1024 characters? This task does not add the probe.
3. Does any page in `mifunedev/agro-web` quote the `/supervisor` description? Default: no public documentation change.

## Acceptance Criteria

- [ ] The Pi loader diagnostic command exits 0 and prints `[]` for `.agro/skills`.
- [ ] The parsed `supervisor` description holds 1024 characters or fewer.
- [ ] Each trigger, exclusion, and role boundary in US-001 remains in the description.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] The eval probe suite reports no new REGRESSION.
- [ ] A non-draft PR into `development` names its exact head SHA, and CI passes on that SHA.
- [ ] No merge, release, or force push occurs.

## Lessons

Filled by the advisor before undraft.
