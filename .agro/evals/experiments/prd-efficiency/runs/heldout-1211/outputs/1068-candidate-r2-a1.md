# PRD: Shorten the supervisor skill description

Status: DRAFT

## User Stories

### US-001: Fit the supervisor description in the Pi limit

**Description:** As an operator who runs Pi, I want a shorter `/supervisor` description so that the Pi skill loader reports no metadata warning.

**Acceptance Criteria:**

- [ ] Red test: before the edit, the Pi loader reports `description exceeds 1024 characters (1103)` for `.agro/skills/supervisor/SKILL.md`. Record the exact output in the task evidence.
- [ ] The edit changes only the `description:` value in the frontmatter of `.agro/skills/supervisor/SKILL.md`. `git diff --stat` lists that one file.
- [ ] The parsed `description` string is 1,024 characters or fewer. The Pi loader measures the parsed string, and that string includes the final newline of the `|` block scalar.
- [ ] After the edit, the Pi loader reports no diagnostic for `.agro/skills/supervisor/SKILL.md`.
- [ ] The new description keeps each of these trigger phrases or an equal phrase: supervise, babysit, watch, drive an agent in another pane, a build in a second pane, own a long build to its Definition of Done, advisor brief, compaction decision, escalation route, and "what is the advisor doing".
- [ ] The new description keeps each negative trigger: the active session implements the work, a code review, bounded workers inside one session (`/delegate`), and a single `herdr` command (`/herdr`).
- [ ] The new description keeps these role boundaries: `MonitorCreate` with `onDone` for observation, `MonitorList` and `MonitorStop` for handle control, no `LoopCreate` and no polling, Herdr only for launch and guarded downward steering, no reverse Herdr messages from advisors or workers, no code writes or code reviews, and supervisor ownership of context budgets and operator escalation.
- [ ] The `name:` and `allowed-tools:` lines stay byte-identical.

## Summary

The frontmatter of `.agro/skills/supervisor/SKILL.md` holds a three-line `|` block scalar. The parsed description is 1,103 characters, including the final newline. The limit is 1,024 characters, so the edit must remove at least 79 characters.

Pi validates each skill in `dist/core/skills.js` of `@earendil-works/pi-coding-agent`. Line 11 sets `MAX_DESCRIPTION_LENGTH = 1024`. The function `validateDescription` at lines 80-86 adds the error `description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${description.length})`. Lines 239-242 push each error as a `warning` diagnostic. Pi still loads the skill.

Pi reads the skills through `.agents/skills`, and `.claude/skills` also resolves to `.agro/skills`. Both paths are symlinks to `../.agro/skills`. An edit to the canonical file changes every provider view. No mirror edit is necessary.

The approach: rewrite the description text in STE style. Remove repeated words, and keep each trigger and each boundary. The implementation owner targets 950 characters or fewer, so that later edits keep a margin.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description:` (lines 3-6) | The only file to change. |
| `@earendil-works/pi-coding-agent/dist/core/skills.js` | `MAX_DESCRIPTION_LENGTH`, `validateDescription`, `loadSkillsFromDir` | Pi loader. It emits the warning diagnostic. Read-only. |
| `.agents/skills`, `.claude/skills` | symlinks to `../.agro/skills` | Provider views. They must still resolve after the edit. |
| `@earendil-works/pi-coding-agent/dist/core/skills.js` | `MAX_DESCRIPTION_LENGTH`, `validateDescription`, `loadSkillsFromDir` | Pi loader. The loader emits the warning diagnostic. Read-only. |
| `.agro/skills/eval/run.sh` | probe runner | Runs the full probe suite locally and in the `eval-probes` CI job. |
| `.github/workflows/ci-harness.yml` | jobs `eval-probes` and `pnpm test:scripts` | CI gates on the pull request. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Skill discovery metadata for `/supervisor` | text change | Every provider shows the shorter description. The trigger behavior stays the same. |

## Storage

N/A. The task changes one frontmatter string and adds no persistent state.

## Architectural Decisions

- The canonical source is `.agro/skills/supervisor/SKILL.md`. The provider symlinks carry the change.
- The Pi loader is the acceptance oracle for the diagnostic. The implementation owner runs the Pi loader against `.agro/skills` from the sandbox, before and after the edit. A candidate command is `node --input-type=module -e "import { loadSkillsFromDir } from '<pi-package>/dist/core/skills.js'; const r = loadSkillsFromDir(<options>); console.log(JSON.stringify(r.diagnostics.filter(d => d.path.includes('supervisor'))))"`.
- The body of the skill owns the full role boundary. The description keeps a short summary of that boundary.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| Pi loader command (see Architectural Decisions) | before the edit | The warning `description exceeds 1024 characters (1103)` appears for the supervisor skill. |
| Pi loader command (see Architectural Decisions) | after the edit | The supervisor skill has no diagnostic. |
| `bash .agro/skills/eval/run.sh` | full probe suite, before and after | No probe changes from PASS to REGRESSION. |
| `.agro/evals/probes/skills-dir-clean.sh` | skills scan dir | The Pi scan dir stays clean. |
| `test -d .agents/skills/supervisor && test -d .claude/skills/supervisor` | symlink resolution | Both provider views still resolve to the canonical skill. |
| `pnpm test:scripts` | script tests | The CI script tests stay green. |

## Design Principles

- Edit the canonical `.agro/` source. Do not patch a provider mirror.
- Make the smallest realistic change. Change one string in one file.
- Keep each trigger and each role boundary. Cut repeated words, not meaning.
- Write the new description in STE style.
- Add no explanatory comments.

## Out of Scope

- A redesign of the supervisor skill or of its body.
- An edit to a provider mirror or to a symlink.
- A new probe for description length in all skills. The issue limits the edit to one file.
- A description edit in any other skill.
- A merge, a release, or a force push.

## Open Questions

1. The `loadSkillsFromDir(options)` signature at `dist/core/skills.js:121` defines `<options>`. The implementation owner reads that signature and records the exact command in the evidence. Does the operator accept that command as the oracle for "the actual Pi skill-loader diagnostic"?
2. Does the operator want a follow-up issue for a probe that caps each skill description at 1,024 characters? This task does not add that probe.

## Acceptance Criteria

- [ ] The parsed supervisor description is 1,024 characters or fewer.
- [ ] The Pi loader reports no diagnostic for `.agro/skills/supervisor/SKILL.md` after the edit.
- [ ] `.agents/skills/supervisor/SKILL.md` and `.claude/skills/supervisor/SKILL.md` resolve to the canonical file.
- [ ] `bash .agro/skills/eval/run.sh` shows no new REGRESSION compared with the run before the edit.
- [ ] The `ci-harness.yml` jobs pass on the pull request head.
- [ ] A non-draft pull request names its exact head SHA.
- [ ] The diff holds no change outside `.agro/skills/supervisor/SKILL.md` and `.agro/tasks/supervisor-description-length/`.

## Lessons

Filled by the advisor before undraft.
