# PRD: Supervisor description length

Status: DRAFT

Source: `work/issue-1068.md` (issue #1068)

## User Stories

### US-001: Shorten the supervisor skill description

**Description:** As a Pi operator, I want a shorter `/supervisor` description so that the Pi skill loader emits no length warning.

**Acceptance Criteria:**

- [ ] The diff touches only the `description` value in the frontmatter of `.agro/skills/supervisor/SKILL.md`. The diff touches no line of the skill body and no other frontmatter key.
- [ ] The Pi loader check in the Test Plan prints a parsed `description` length of 1024 or less for `.agro/skills/supervisor/SKILL.md`.
- [ ] The Pi loader check in the Test Plan prints `[]` for the diagnostics of `.agro/skills`. The warning `description exceeds 1024 characters` is absent.
- [ ] The new description names each of these positive triggers: supervise, babysit, watch, or drive an agent in another pane; a long build owned to its Definition of Done from outside the implementing session; an advisor that needs a brief, a compaction decision, or an escalation route; the question "what is the advisor doing".
- [ ] The new description names each of these negative triggers: the active session implements the work; a code review request; bounded workers inside one session, with a pointer to `/delegate`; a single `herdr` command, with a pointer to `/herdr`.
- [ ] The new description keeps each of these role boundaries: observation only through `MonitorCreate` with `onDone`; handle control through `MonitorList` and `MonitorStop`; no `LoopCreate` and no polling; Herdr commands only for launch and guarded downward steering; no reverse Herdr messages from advisors and workers; no code written or reviewed; the supervisor owns context budgets and operator escalation.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION` that the pre-change run on the same base commit did not report.

## Summary

Verified current state:

- The frontmatter `description` of `.agro/skills/supervisor/SKILL.md` is a YAML block scalar (`|`) with three lines. The Pi loader measures the parsed value at 1103 characters.
- Pi `0.87.1` sets `MAX_DESCRIPTION_LENGTH = 1024` in `dist/core/skills.js` of `@earendil-works/pi-coding-agent`. For a longer description, `validateDescription` adds the warning `description exceeds 1024 characters (<length>)`. The loader still loads the skill.
- A run of `loadSkillsFromDir({ dir: '.agro/skills', source: 'project' })` on the base commit returns 36 skills and one diagnostic: `description exceeds 1024 characters (1103)` for `.agro/skills/supervisor/SKILL.md`.
- `.claude/skills` and `.agents/skills` are symlinks to `../.agro/skills`. The provider mirrors hold no separate copy of the supervisor skill.
- No probe under `.agro/evals/probes/` reads the supervisor description or checks a description length.
- The next-longest skill description is `.agro/skills/sync/SKILL.md` at 931 characters.

Selected approach: rewrite the description value in place. Tighten the first line, which states the role boundaries. Tighten the `TRIGGER when:` line and the `Do NOT trigger when:` line only as far as the length target requires. Keep every trigger and every boundary that the acceptance criteria list. A first-line rewrite alone measured 1035 characters, so the rewrite must also shorten at least one trigger line.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` | The canonical source. The only file that changes. |
| `.claude/skills`, `.agents/skills` | symlinks to `../.agro/skills` | Provider mirrors. They must still resolve. No edit. |
| `.agro/scripts/link-providers.sh` | `--check` mode | Verifies the provider symlinks and the vendored `.agro/` pack. |
| `@earendil-works/pi-coding-agent` `dist/core/skills.js` | `MAX_DESCRIPTION_LENGTH`, `validateDescription`, `loadSkillsFromDir` | The external Pi loader that emits the diagnostic. Read only. |
| `.agro/skills/eval/run.sh` | probe suite runner | The regression floor that CI job `eval-probes` runs. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` skill metadata in Pi, Claude Code, and Codex | Modified text | The description that each harness shows to the model gets shorter. Trigger coverage stays the same. |
| Pi skill-loader diagnostics | Removed warning | The loader emits no warning for the supervisor skill. |

## Storage

N/A. The change edits one text value in a tracked file. The task adds no persistent state.

## Architectural Decisions

- Source of truth: `.agro/skills/supervisor/SKILL.md` owns the description. The provider directories are symlinks, so the provider directories get the change with no edit.
- Oracle: the installed Pi loader is the authority on the limit and on the diagnostic. The plan measures with that loader, not with a separate YAML parser.
- Scope: the skill body keeps the full role boundary. The description is a trigger summary. The description can use shorter wording than the body, but the description must not drop a boundary that the acceptance criteria list.

## Test Plan (TDD)

No repository test covers the description length. The issue limits the edit to the description, so the task adds no probe. Run the checks below before the edit and after the edit. Record each result in `.agro/tasks/supervisor-description-length/evidence.md`.

| Test File | Case(s) | Validates |
|---|---|---|
| Pi loader check (command below) | Before the edit: the diagnostics hold `description exceeds 1024 characters (1103)`. After the edit: the diagnostics are `[]`, and the supervisor length is 1024 or less. | US-001 length criterion and diagnostic criterion |
| `bash .agro/scripts/link-providers.sh --check` | Exit 0 after the edit. | Canonical and provider symlinks stay intact |
| `bash .agro/skills/eval/run.sh` | Run before the edit and after the edit on the same base. The set of `REGRESSION` results does not grow. | Probe floor |
| `git diff --stat` and `git diff` | One file changes. The hunk stays inside the frontmatter `description`. | Scope criterion |
| Manual review of the new description against the US-001 lists | Each positive trigger, negative trigger, and boundary is present. | Trigger coverage and role boundaries |
| CI workflow `.github/workflows/ci-harness.yml` | Jobs pass on the PR head SHA. | CI criterion |

Pi loader check. Run the check in the sandbox from the repository root:

```bash
node --input-type=module -e "
import {loadSkillsFromDir} from '$(dirname "$(dirname "$(readlink -f "$(command -v pi)")")")/core/skills.js';
const r = loadSkillsFromDir({dir: '.agro/skills', source: 'project'});
const s = r.skills.find(k => k.name === 'supervisor');
console.log(s.description.length, JSON.stringify(r.diagnostics));"
```

## Design Principles

- Change the canonical `.agro/` source. Do not patch a provider mirror.
- Make the smallest realistic change. Do not redesign the supervisor skill.
- Keep one source of truth. The skill body stays the full statement of the role boundary.
- Use the real Pi loader as evidence. Do not trust a character count from a different parser.
- Add no comment to tracked code.

## Out of Scope

- Edits to the supervisor skill body, to `allowed-tools`, or to any other skill.
- A new probe or CI gate for description length across all skills.
- Edits to `.claude/`, `.agents/`, or other provider mirrors.
- Changes to the Pi package or to the Pi loader limit.
- Public documentation in `mifunedev/agro-web`. The user-facing behavior and the terminology do not change.
- Merge, release, force push, and unrelated changes.

## Open Questions

1. Does the operator want a follow-up issue for a probe that keeps every `.agro/skills/*/SKILL.md` description at 1024 characters or less? The issue scope excludes the probe from this task.

## Acceptance Criteria

- [ ] Each US-001 acceptance criterion passes.
- [ ] `.agro/tasks/supervisor-description-length/evidence.md` records the before and after output of the Pi loader check, `link-providers.sh --check`, and the probe suite.
- [ ] CI on the PR head SHA passes.
- [ ] A non-draft PR exists. The PR body names the exact head SHA.
- [ ] No merge, release, or force push happens.

## Lessons

Filled by the advisor before undraft.
