# PRD: Align the supervisor skill with the prd task artifacts

Status: DRAFT

## User Stories

### US-001: Replace retired artifact names in the supervisor skill

**Description:** As a supervisor, I want `/supervisor` to name `prd.json` and the PR body as the advisor record so that no advisor writes the retired `progress.txt`.

**Acceptance Criteria:**

- [x] `git grep -n -E 'progress\.txt|progress/evidence|evidence\.md|evidence artifact' -- .agro/skills/supervisor` prints nothing and exits 1.
- [x] Each replaced passage names `prd.json` (`passes`, `commit`, `notes`) or the PR body evidence sections as the advisor record.
- [x] The `description` and `allowed-tools` frontmatter lines are byte-identical to `origin/development`.
- [x] The description text has 1024 characters or fewer.
- [x] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0.

### US-002: Replace retired artifact names in other control-plane surfaces

**Description:** As an advisor, I want each `.agro/` and `docs/` surface to name only current task artifacts so that no procedure routes me to a retired file.

**Acceptance Criteria:**

- [x] `.agro/logs/AGENTS.md`, `.agro/memories/AGENTS.md`, and `.agro/skills/audit/references/implementation.md` name no retired artifact.
- [x] `git grep -n -I -E 'progress\.txt|evidence\.md|progress/evidence' -- .agro docs ':!.agro/tasks'` prints only `.agro/scripts/registry-portability.md:65` and `.agro/skills/audit/references/reviewer-evidence-doc.md:13`.
- [x] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 for each of the three edited files.

### US-003: Make the supervisor skill harness-neutral about monitor tools

**Description:** As a supervisor in any coding harness, I want `/supervisor` to name monitor capabilities so that the skill works in Claude Code and in Pi.

**Acceptance Criteria:**

- [ ] The skill requires three capabilities by name: a bounded background monitor that reports on completion, a stop operation, and a list operation.
- [ ] One section of the skill holds the only tool mapping. Claude Code provides `Monitor` (create, with a completion notice) and `TaskStop` (stop), and has no list operation. Pi with `@trevonistrevon/pi-loop` provides `MonitorCreate`, `MonitorStop`, and `MonitorList`.
- [ ] `git grep -n -E 'MonitorCreate|MonitorList|MonitorStop|TaskStop|onDone' -- .agro/skills/supervisor/SKILL.md` prints only lines of the `description`, `allowed-tools`, and the mapping section.
- [ ] The skill states: when the harness has no list operation, the supervisor reconciles handles from its run record.
- [ ] The skill states: when the harness has no bounded monitor with a completion notice, the supervisor stops and reports the blocker.
- [ ] The bans on `LoopCreate`, polling, and sleep loops stay.
- [ ] The description text has 1024 characters or fewer.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` exits 0.

### US-004: Add the supervisor entry to the root glossary

**Description:** As an operator, I want the root glossary to define "supervisor" so that every harness reads one meaning of the role.

**Acceptance Criteria:**

- [ ] `AGENTS.md` § A small glossary has one entry that starts with `- **supervisor** means`.
- [ ] The entry defines the behavior of launching, monitoring, and escalating for advisor sessions in other Herdr panes. The entry states that the supervisor is not an identity and is distinct from the root orchestrator.
- [ ] The entry matches the style of the other glossary entries: one bullet, a bold term, "means", and a wrap at 80 to 85 columns.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh AGENTS.md` exits 0.

## Summary

The core planning chain retired two task artifacts:

- `93b009d0` (#1148) removed `progress.txt` from the core contract. Story evidence moved to `prd.json` `notes`.
- `32d03ac9` (#1088) retired `.agro/tasks/<slug>/evidence.md` into the PR body.
- `9d4f7cc8` (#1157), `197fb5e9` (#1272), and `3dd7d985` (#1279) removed the remaining skills and machinery that wrote those files.
- `d793a492` (#1237) added the PR `## Manual review` section as the evidence destination of the last story.

`/delegate` now states the model: the advisor alone writes `passes`, `commit`, and `notes` in `prd.json`, and Close fills the PR evidence sections from `notes`.

`.agro/skills/supervisor/SKILL.md` still names `progress.txt` and "progress/evidence files" at lines 36, 174, 294 to 296, 342, and 351. A supervised session in the hermes-generate tab followed this text and used `progress.txt`.

A sweep of `.agro/` and `docs/` finds four more hits outside the supervisor skill. Two are stale instructions, one is stale scope prose, and two are deliberate. US-002 fixes three and keeps two.

The selected approach edits only prose. The supervisor description keeps its text, so the Pi 1024-character limit from `5c71ebb9` (#1069) stays met. The current description has 721 characters.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Role boundary (36), brief template (174), Duty 3 reads (294 to 296), Duty 4 (342, 351) | Canonical supervisor skill to correct |
| `.agro/skills/delegate/SKILL.md` | Acceptance, Close | Source of the `prd.json` and PR body model |
| `.agro/skills/prd/references/tracker.md` | Field ownership | Source of the `passes`, `commit`, `notes` ownership |
| `.agro/logs/AGENTS.md` | Line 19 | Names `evidence.md` |
| `.agro/memories/AGENTS.md` | Line 33 | Names `.agro/tasks/<slug>/evidence.md` |
| `.agro/skills/audit/references/implementation.md` | Inputs table, line 25 | Locates `progress.txt` from the slug |
| `.agro/scripts/registry-portability.md` | `HARNESS-SKILL` rule, line 65 | Kept: the path is a false-hit example for the slash-command pattern, and `registry-portability.sh` reads this file as its exceptions source |
| `AGENTS.md` | § A small glossary | Gains the supervisor entry (US-004) |
| `docs/harnesses/pi.md` | Monitor and loops | Source of the Pi tool names |
| `.agro/skills/audit/references/reviewer-evidence-doc.md` | Line 13 | Kept: the line states the retirement of `evidence.md` |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` skill body | Prose | The advisor record becomes `prd.json` and the PR body |
| `/audit implementation` reference | Prose | The slug locates `prd.json` only |
| Provider mirrors | None | Mirrors are symlinks to `.agro/skills/`; `link-providers.sh --check` proves they resolve |

## Storage
N/A. The change edits prose only and adds no state.

## Architectural Decisions

- `prd.json` holds story state and acceptance notes. The PR body holds criterion evidence. Source: `/delegate` Acceptance and Close.
- US-001 kept the supervisor description and `allowed-tools`. US-003 changes both by supervisor direction. The description names capabilities, and `allowed-tools` lists the tools of each mapped harness.
- The root glossary defines "supervisor" as a behavior, like "advisor" and "worker".
- No `CHANGELOG.md` entry. The change corrects stale names in agent guidance and changes no runtime or workflow behavior, because #1148 already retired the files. `/git` § Changelog skips such chores.
- Each edited prose file passes `ste-check.sh` with exit 0. The pre-existing findings in the edited files are fixed in the same story.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `git grep` sweep in US-001 and US-002 | Retired names | No stale reference remains, except the two kept lines |
| `.agro/scripts/__tests__/standard-skills-link.test.ts` | Skill frontmatter and links | The supervisor frontmatter still parses and links resolve |
| `.agro/scripts/__tests__/skill-shell-portability.test.ts` | Skill shell blocks | Edited skills keep portable shell |
| `.agro/scripts/__tests__/hermes-links.test.ts` | Provider links | Mirrors still resolve |
| `bash .agro/scripts/link-providers.sh --check` | Provider mirrors | Every provider symlink resolves |
| `bash .agro/skills/ste/scripts/ste-check.sh <file>` | Each changed `.md` file | Prose meets `/ste` |

## Design Principles

- Change the canonical `.agro/` source. Do not patch a provider mirror.
- Keep one source of truth. Point at `/delegate` and `/prd` for the artifact model. Do not restate their rules.
- Add no explanatory comments to tracked code.
- Apply `/ste` to every changed prose file.

## Out of Scope

- A change to `CHANGELOG.md` and its released sections.
- Historical task folders under `.agro/tasks/`. These record past runs.
- A manual review evidence story. The plan changes no user interface, server, CLI, or API. The change edits agent guidance prose only.

## Open Questions

None. Supervisor direction resolved the monitor tool question with US-003. Claude Code exposes `Monitor` and `TaskStop`, and does not expose `MonitorCreate`, `MonitorList`, or `MonitorStop`. The skill now names capabilities and holds one tool mapping.

## Acceptance Criteria

- [x] `git grep -n -I -E 'progress\.txt|evidence\.md|progress/evidence' -- .agro docs ':!.agro/tasks'` prints only the two kept lines, and the PR body lists each kept line with its reason.
- [ ] The supervisor description has 1024 characters or fewer.
- [x] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [x] `pnpm vitest run .agro/scripts/__tests__/standard-skills-link.test.ts .agro/scripts/__tests__/skill-shell-portability.test.ts .agro/scripts/__tests__/hermes-links.test.ts` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh <file>` exits 0 for `prd.md` and for each changed `.md` file. The advisor also reviews each change by hand against the `/ste` rules that the checker cannot catch. The PR body holds each command and its exit 0 output under this criterion. The PR opens only after this criterion passes.
- [ ] A PR from `task/1402-supervisor-prd-align` to `development` exists with each criterion's command output in its body. The PR is not merged.

## Lessons

1. Claim: an operator rule that requires `ste-check.sh` exit 0 on each changed file makes the edit fix earlier findings in that file. Evidence: the three edited files carried 30 earlier findings, 4 in the supervisor skill and 26 in US-002. Outcome: fixed in this PR.
2. Claim: `/supervisor` requires `MonitorCreate`, `MonitorList`, and `MonitorStop`, and Claude Code exposes `Monitor` and `TaskStop`. Evidence: the supervisor `description` and `allowed-tools`, and the Claude Code session that runs the supervisor. Outcome: fixed in this PR by US-003, after supervisor direction.
3. Claim: `registry-portability.md:65` keeps `tasks/<slug>/progress.txt` as a false-hit example. Evidence: `registry-portability.sh` reads the file as its exceptions source, and the line names no task procedure. Outcome: dropped, because the example still describes the pattern rule.
