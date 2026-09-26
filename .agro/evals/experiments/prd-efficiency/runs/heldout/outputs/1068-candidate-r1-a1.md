# PRD: Supervisor Description Length

Status: DRAFT

## User Stories

### US-001: Shorten the supervisor frontmatter description

**Description:** As an operator, I want a shorter supervisor description so that Pi loads the skill without a warning.

**Acceptance Criteria:**

- [ ] Before the edit, the parsed `description` value in `.agro/skills/supervisor/SKILL.md` is more than 1,024 characters. The implementer records the measured value in `progress.txt`.
- [ ] After the edit, the parsed `description` value is 1,024 characters or fewer. The implementer measures the value with a YAML parser, not with a line count.
- [ ] Before the edit, `<pi skill-load command>` prints the supervisor metadata-length warning. After the edit, the same command prints no such warning.
- [ ] The new description still names each positive trigger: supervise, babysit, watch, or drive an agent in another pane; own a long build to its Definition of Done; an advisor needs a brief, a compaction decision, or an escalation route; and the advisor status questions.
- [ ] The new description still names each negative trigger: the active session implements the work, a code review, bounded workers inside one session with /delegate, and a single `herdr` command with /herdr.
- [ ] The new description still states the role boundaries: MonitorCreate with onDone for observation, no LoopCreate or polling, Herdr only for launch and downward steering, no reverse messages from advisors and workers, and no code writing or code review.
- [ ] `git diff --stat` shows `.agro/skills/supervisor/SKILL.md` as the only changed file, and the diff touches only the `description` block.

## Summary

The `description` block scalar in `.agro/skills/supervisor/SKILL.md` measures about 1,103 characters. The Pi loader limit is 1,024 characters. Pi discovers skills through `.agents/skills`, which is a symlink to `.agro/skills`. `.claude/skills` is also a symlink to `.agro/skills`. The edit therefore lands in the canonical file only, and every provider sees the change through the symlinks. The selected approach removes duplicate words from the three description paragraphs. The body of the skill already states the full role boundary, so the description keeps short trigger and boundary phrases only. The approach keeps the `name` and `allowed-tools` keys unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` | The canonical description that Pi parses. |
| `.agents/skills` | symlink to `.agro/skills` | The Pi discovery root. The edit must keep this symlink. |
| `.claude/skills` | symlink to `.agro/skills` | The Claude Code mirror. The edit must keep this symlink. |
| `.agro/evals/probes/skills-dir-clean.sh` | skills scan-dir guard | The existing Pi skill-loading probe. The probe must stay green. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Skill listing in each coding harness | Modify | The supervisor description text becomes shorter. The trigger meaning stays the same. |

## Storage

N/A. The change edits one frontmatter string and adds no persistent state.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` is the single source of truth. The implementer edits no provider mirror.
- The implementer keeps the YAML block-scalar form of `description`.
- The implementer changes no body section of the skill.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Parse the frontmatter with a YAML parser and print the length of `description` before and after the edit. | The length goes from more than 1,024 to 1,024 or fewer. |
| `<pi skill-load command>` | Load the skills before and after the edit. | The Pi metadata-length warning for supervisor is present before and absent after. |
| `.agro/evals/probes/skills-dir-clean.sh` | Run through `bash .agro/skills/eval/run.sh`. | The skills scan dir stays valid for Pi. |
| `.agro/skills/eval/run.sh` | Run the full probe suite. | No probe goes from PASS to REGRESSION. |
| `.github/workflows/ci-harness.yml` | CI on the pull request head SHA. | CI is green on the exact head. |

## Design Principles

- Edit the canonical `.agro/` source. Do not patch a mirror.
- Apply the smallest change that removes the warning.
- Keep every trigger and boundary. Remove duplicate words only.
- Add no explanatory comments to tracked code.

## Out of Scope

- A redesign of the supervisor skill body.
- Edits to other skill descriptions.
- A new probe for description length. See Open Questions.
- A merge, a release, or a force push.

## Open Questions

1. Which exact command reproduces the Pi skill-loader diagnostic in the sandbox? The issue gives no command. The plan uses `<pi skill-load command>` until the operator names the command.
2. Does the issue scope allow a new regression probe for description length? The scope limits edits to one file. A probe at new file `.agro/evals/probes/skill-description-length.sh` would guard all skills, but the plan excludes the probe unless the operator approves it.
3. Which command is the provider-link check in the root `AGENTS.md`? The planner located no script with that name. Until the operator names the check, the implementer verifies the symlinks with `readlink .agents/skills .claude/skills`.

## Acceptance Criteria

- [ ] The parsed supervisor `description` is 1,024 characters or fewer.
- [ ] `<pi skill-load command>` prints no supervisor metadata-length warning.
- [ ] `readlink .agents/skills .claude/skills` prints the relative target ../.agro/skills for each symlink.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] CI is green on the pull request head SHA.
- [ ] A non-draft pull request names its exact head SHA.

## Lessons

Filled by the advisor before undraft.
