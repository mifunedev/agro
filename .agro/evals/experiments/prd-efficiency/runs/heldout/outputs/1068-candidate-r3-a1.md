# PRD: Shorten the supervisor skill description

Status: DRAFT

## User Stories

### US-001: Shorten the supervisor description

**Description:** As an operator, I want a shorter supervisor description so that Pi loads the skill without a warning.

**Acceptance Criteria:**

- [ ] The parsed `description` value in `.agro/skills/supervisor/SKILL.md` holds 1,024 characters or fewer.
- [ ] The description keeps each positive trigger: supervise, babysit, watch, drive an agent in another pane, own a long build to its Definition of Done, advisor brief, compaction decision, escalation route, and advisor status questions.
- [ ] The description keeps each negative trigger: the active session implements the work, a code review, dispatch of bounded workers inside one session with /delegate, and a single `herdr` command with /herdr.
- [ ] The description keeps the role boundaries: `MonitorCreate` with `onDone` for observation, `MonitorList` and `MonitorStop` for handle control, no `LoopCreate` or polling, downward Herdr steering only, no reverse Herdr messages, and no code writing or code review.
- [ ] The diff changes only the frontmatter `description` block of `.agro/skills/supervisor/SKILL.md`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] The Pi skill loader reports no metadata-length warning for `supervisor` after the change, and reports the warning at the base commit. The command is `<pi skill-loader command>`.

### US-002: Guard skill description length

**Description:** As a maintainer, I want a probe on description length so that the warning cannot return unseen.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/skill-description-length.sh` reports `REGRESSION` and exits nonzero when a canonical skill description holds more than 1,024 characters.
- [ ] The probe reports `REGRESSION` against the base-commit `.agro/skills/supervisor/SKILL.md`.
- [ ] The probe reports `PASS` and exits 0 after US-001.

## Summary

The frontmatter `description` in `.agro/skills/supervisor/SKILL.md` is a YAML block literal of 1,102 characters. The Pi loader limit is 1,024 characters, so Pi warns on load. The provider paths `.agents/skills` and `.claude/skills` are symlinks to `.agro/skills`. The fix therefore edits only the canonical file. The approach removes redundant words from the description. The approach keeps each trigger phrase and each role boundary. The skill body stays unchanged. A new probe measures every canonical skill description, so a later edit cannot pass the limit without a `REGRESSION`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` | The canonical text to shorten |
| `.agro/scripts/link-providers.sh` | `--check`, `check_symlink` | Proves the provider symlinks still resolve |
| `.agro/evals/probes/skill-paths.sh` | header, `PASS` and `REGRESSION` output | The probe shape to copy |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Skill metadata for all providers | Modify | Shorter supervisor `description` text |
| Probe suite | Add | New file `.agro/evals/probes/skill-description-length.sh` |

## Storage

N/A. The change edits static text and adds a stateless probe.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` is the single source of truth. The provider mirrors are symlinks and get no edit.
- The probe parses the frontmatter `description` value, not the raw lines. The measure matches the value that the loader reads.
- The limit is 1,024 characters, from the issue.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/skill-description-length.sh` | base commit gives `REGRESSION`; head gives `PASS` | US-002 and the length limit of US-001 |
| `.agro/scripts/link-providers.sh` | `--check` exits 0 | The symlinks resolve |
| `.agro/scripts/__tests__/standard-skills-link.test.ts` | existing cases | The provider link contract holds |
| `<pi skill-loader command>` | loader output before and after | The Pi warning is absent after the fix |

## Design Principles

- Edit the canonical `.agro/` source only.
- Make the smallest change that removes the warning.
- Add no comments to tracked code.
- Prove the fix with a deterministic probe and the real loader output.

## Out of Scope

- A redesign of the supervisor skill body.
- An edit to a provider mirror.
- A description change in any other skill.
- A merge, a release, or a force push.

## Open Questions

1. Which command runs the Pi skill loader and prints the metadata-length diagnostic? The plan uses `<pi skill-loader command>`.
2. If another canonical skill description holds more than 1,024 characters, does the probe scan only `supervisor`, or does the operator approve a wider fix?

## Acceptance Criteria

- [ ] The supervisor `description` holds 1,024 characters or fewer.
- [ ] The Pi loader metadata-length diagnostic for `supervisor` is absent at head.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] The new probe and the CI checks are green at head.
- [ ] A non-draft PR names its exact head SHA.

## Lessons

Filled by the advisor before undraft.
