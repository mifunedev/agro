# PRD: Shorten the supervisor skill description

Status: DRAFT

## User Stories

### US-001: Fit the supervisor description in the Pi limit

**Description:** As an operator, I want a shorter supervisor description so that Pi loads the skill without a warning.

**Acceptance Criteria:**

- [ ] Red test: before the edit, the awk length measurement in the Test Plan prints a value greater than 1024 for `.agro/skills/supervisor/SKILL.md`.
- [ ] Green test: after the edit, the same measurement prints a value of 1024 or less.
- [ ] The diff changes only the `description` block in the frontmatter of `.agro/skills/supervisor/SKILL.md`.
- [ ] The new description names MonitorCreate with onDone, MonitorList, and MonitorStop, and bans LoopCreate and polling.
- [ ] The new description states that the supervisor writes no code and reviews no code.
- [ ] The new description keeps each positive trigger: supervise, babysit, watch, or drive an agent in another pane; own a long build to its Definition of Done; an advisor brief, a compaction decision, or an escalation route; the "what is the advisor doing" question.
- [ ] The new description keeps each negative trigger and the redirects to /delegate and /herdr.
- [ ] The Pi skill loader reports no metadata-length diagnostic for the supervisor skill, as recorded in the task progress file with the command and its output.
- [ ] `.claude/skills` and `.agents/skills` still resolve to `.agro/skills`, and `cmp` of the canonical file and each mirror path exits 0.

## Summary

The Pi skill loader warns about the frontmatter of the /supervisor skill. The parsed `description` block in `.agro/skills/supervisor/SKILL.md` measures 1103 characters. The limit is 1024. The provider paths `.claude/skills` and `.agents/skills` are git symlinks to `.agro/skills`, so one edit to the canonical file fixes each provider. The approach is to reword the three description paragraphs. The role paragraph, the TRIGGER paragraph, and the Do NOT trigger paragraph stay. The body of the skill does not change.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` | Canonical text to shorten |
| `.claude/skills` | symlink to `.agro/skills` | Claude Code mirror; no edit |
| `.agents/skills` | symlink to `.agro/skills` | Pi and Codex discovery root; no edit |
| `.agro/scripts/link-providers.sh` | `provider_links` | Owns the provider symlinks; no edit |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Skill frontmatter | Modify | The `description` text gets shorter. Trigger coverage stays the same. |

## Storage

N/A. The change edits one tracked Markdown file and adds no state.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` is the single source of truth. Provider paths reach the file through symlinks.
- Keep a margin under the limit. Target 950 characters or fewer, so that a small later edit does not bring the warning back.
- Remove repeated words before you remove a trigger. The `allowed-tools` line already lists the Monitor tools, but the description keeps the MonitorCreate rule because the rule is a behavior constraint.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | Run `awk '/^description: \|/{f=1;next} f&&/^[a-z-]+:/{exit} f{sub(/^  /,"");s=s $0 "\n"} END{print length(s)}' .agro/skills/supervisor/SKILL.md` before and after the edit | The length goes from 1103 to 1024 or less |
| `<pi skill-loader command>` | Load the skills with Pi before and after the edit | The metadata-length warning for supervisor is present before and absent after |
| `.agro/evals/probes/escalate-destination-fan-out.sh` | Run before and after the edit | The probe stays green |
| `.agro/evals/probes/headless-tmux-preserved.sh` | Run before and after the edit | The probe stays green |
| `.agro/evals/probes/spec-single-owner.sh` | Run before and after the edit | The probe stays green |
| `.agro/evals/probes/skill-paths.sh` | Run before and after the edit | Skill paths stay valid through `.claude/skills` |
| `<full probe suite command>` | Run the /eval suite after the edit | No probe changes from PASS to REGRESSION |

## Design Principles

- Edit the canonical `.agro/` source. Never patch a provider mirror.
- Make the smallest change that removes the warning.
- Keep the supervisor, advisor, and worker role boundaries in the description.
- Add no comments to tracked files.

## Out of Scope

- A redesign of the supervisor skill or a change to the body below the frontmatter.
- A change to any other skill description.
- A new probe or a new description-length check. The issue limits the edit to one frontmatter block.
- A merge, a release, or a force push.

## Open Questions

1. Which command reproduces the Pi skill-loader diagnostic in the sandbox? The plan uses `<pi skill-loader command>` until the operator names the command.
2. Which command runs the full probe suite for the /eval skill? The plan uses `<full probe suite command>`.
3. Does the operator want a follow-up issue for a repository-wide probe that caps each skill description at 1024 characters?

## Acceptance Criteria

- [ ] The parsed supervisor description measures 1024 characters or fewer.
- [ ] The Pi skill loader reports no metadata-length diagnostic for the supervisor skill.
- [ ] The provider symlinks `.claude/skills` and `.agents/skills` resolve to `.agro/skills`.
- [ ] The probes in the Test Plan and the CI checks on the PR head pass.
- [ ] A non-draft PR states its exact head SHA.
- [ ] The diff touches only `.agro/skills/supervisor/SKILL.md`.

## Lessons

Filled by the advisor before undraft.
