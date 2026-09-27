# PRD: Shorten supervisor skill description

Status: DRAFT

Source: `work/issue-1068.md` (issue #1068).

## User Stories

### US-001: Shorten the supervisor frontmatter description

**Description:** As a Pi operator, I want a `/supervisor` description within the Pi loader limit so that Pi loads the skill without a length warning.

**Acceptance Criteria:**

- [ ] The diff touches only the `description:` value in the frontmatter of `.agro/skills/supervisor/SKILL.md`.
- [ ] The Pi loader probe in the Test Plan reports a parsed description length of 1024 characters or fewer for `.agro/skills/supervisor/SKILL.md`.
- [ ] The Pi loader probe reports no diagnostic whose `path` is `.agro/skills/supervisor/SKILL.md`.
- [ ] The description keeps a `TRIGGER when:` clause that covers each of these five triggers: supervise, babysit, watch, or drive an agent in another pane; run a build in a second pane and keep the build on track; own a long build to its Definition of Done from outside the implementing session; an advisor needs a brief, a compaction decision, or an escalation route; ask what the advisor does or whether the advisor stays on the contract.
- [ ] The description keeps a `Do NOT trigger` clause that covers each of these four exclusions: the active session implements the work; the request asks for a code review; the request asks to dispatch bounded workers inside one session, with a pointer to `/delegate`; the request asks to run a single `herdr` command, with a pointer to `/herdr`.
- [ ] The description keeps each of these role-boundary statements: `MonitorCreate` with `onDone` for advisor observation; `MonitorList` and `MonitorStop` for handle control; no `LoopCreate` and no polling; inline Herdr commands only for launch and guarded downward steering; no reverse Herdr messages from advisors and workers; no code written or reviewed; ownership of context budgets and operator escalation.
- [ ] The frontmatter keys `name` and `allowed-tools` stay byte-identical.
- [ ] The body of `.agro/skills/supervisor/SKILL.md` below the closing `---` stays byte-identical.

## Summary

The Pi coding agent `@earendil-works/pi-coding-agent` 0.87.1 validates each skill description in `validateDescription` in `dist/core/skills.js`. The constant `MAX_DESCRIPTION_LENGTH` is `1024`. When a description exceeds the limit, the loader emits a `warning` diagnostic with the message `description exceeds 1024 characters (<length>)`.

The current `/supervisor` description is a YAML literal block scalar (`description: |`). The block scalar keeps the final newline. The Pi loader measures 1103 characters. The loader emits this diagnostic before the fix:

```json
{ "type": "warning", "message": "description exceeds 1024 characters (1103)", "path": ".agro/skills/supervisor/SKILL.md" }
```

The description holds three parts: a role summary, a `TRIGGER when:` clause, and a `Do NOT trigger` clause. The approach removes at least 79 characters through tighter wording in all three parts. The approach keeps every trigger, every exclusion, and every role-boundary statement. The approach keeps the block-scalar style so that the frontmatter matches the other canonical skills.

`.claude/skills` is a symlink to `../.agro/skills`. `.agents/skills` links to the same pack. The Pi harness reads the pack through these links. The edit changes the canonical file only, so every provider surface sees the change through the existing symlinks.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` | Canonical source. The only file that changes. |
| `@earendil-works/pi-coding-agent/dist/core/skills.js` | `loadSkillsFromDir`, `validateDescription`, `MAX_DESCRIPTION_LENGTH` | Pi skill loader. Emits the length warning. Read only. |
| `.agro/scripts/link-providers.sh` | `--check` mode | Verifies provider symlinks to `.agro/skills`. Read only. |
| `.github/workflows/ci-harness.yml` | lint, format, typecheck, `pnpm test:scripts`, `bash .agro/skills/eval/run.sh` | CI gates on the pull request. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/supervisor` skill description | Modify | Pi, Claude Code, and Codex show the shorter description in the skill list. The trigger meaning stays the same. |
| Provider skill directories | None | `.claude/skills` and `.agents/skills` keep their symlinks to `.agro/skills`. |

## Storage

N/A. The task changes one Markdown frontmatter value and adds no persistent state.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` is the single source of truth. The worker edits no provider mirror.
- The Pi loader is the oracle for the length limit. The worker does not reimplement the YAML parse to prove the length.
- The task adds no new probe and no new test, because the scope permits an edit to the description only. See Open Questions.

Surface checklist:

| Surface | State |
|---|---|
| Host and sandbox | Applied. The worker edits and verifies inside the sandbox. The Pi loader runs in the sandbox. |
| Lifecycle door | Not applicable. No `agro` verb changes. |
| Canonical and provider surfaces | Applied. The edit targets `.agro/`. `link-providers.sh --check` proves the symlinks. |
| Root and scaffold | Applied. Initialized projects receive the vendored skill pack, so the shorter description reaches them on the next update. |
| Interactive and headless processes | Not applicable. No process starts. |
| Local and remote operation | Not applicable. No runtime behavior changes. |
| Parallel operation | Applied. The worker uses one task worktree and one branch. |
| Public documentation | Not applicable. `mifunedev/agro-web` needs no change, because no user-facing term changes. |
| Verification | Applied. The Pi loader probe, `link-providers.sh --check`, the eval suite, and CI prove the change. |

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| Pi loader probe (command below) | Run before the edit. Expect one `warning` with `description exceeds 1024 characters (1103)`. | The probe reproduces the defect. |
| Pi loader probe (command below) | Run after the edit. Expect an empty diagnostic list for the supervisor path and a length of 1024 or fewer. | The fix removes the diagnostic. |
| `bash .agro/scripts/link-providers.sh --check` | Exit 0. | Canonical and provider symlinks stay intact. |
| `bash .agro/skills/eval/run.sh` | No `REGRESSION` line. | The probe suite stays green. |
| `pnpm test:scripts` | Exit 0. | Script tests stay green. |
| `git diff --stat origin/<base-branch>...HEAD` | `.agro/skills/supervisor/SKILL.md` plus task files under `.agro/tasks/shorten-supervisor-skill-description/`. | The change stays in scope. |

The worker runs the Pi loader probe from the repository root in the sandbox:

```bash
PI_SKILLS_JS="$(dirname "$(readlink -f "$(command -v pi)")")/../core/skills.js"
node --input-type=module -e "
import { loadSkillsFromDir } from '$PI_SKILLS_JS';
const r = loadSkillsFromDir({ dir: '.agro/skills', source: 'project' });
const s = r.skills.find((k) => k.name === 'supervisor');
console.log(JSON.stringify({
  length: s ? s.description.length : null,
  diagnostics: r.diagnostics.filter((d) => d.path === '.agro/skills/supervisor/SKILL.md'),
}));
"
```

The worker records the before output and the after output in `.agro/tasks/shorten-supervisor-skill-description/evidence.md`.

## Design Principles

- Change the smallest surface that removes the diagnostic.
- Keep one source of truth. Edit `.agro/skills/supervisor/SKILL.md`, not a mirror.
- Keep trigger coverage. A shorter description must route the same requests to `/supervisor`.
- Use the real loader as evidence, not a character count by hand.
- Add no explanatory comments to tracked code.

## Out of Scope

- A redesign of the `/supervisor` skill or a change to the skill body.
- An edit to any provider mirror or symlink.
- A new probe or test that guards description length for every skill.
- Changes to any other skill description.
- A merge, a release, a force push, or any unrelated change.

## Open Questions

1. The Definition of Done asks for "relevant before/after probes". The scope permits an edit to the description only. This plan uses the Pi loader command as an evidence probe and adds no tracked probe. Does the operator want a tracked probe under `.agro/evals/probes/` that fails when any skill description exceeds 1024 characters? A yes answer widens the scope to a second file.
2. The base branch for the pull request is `<base-branch>`. The worker confirms the base branch through the "Draft PR for a task" procedure in `.agro/skills/git/SKILL.md`.

## Acceptance Criteria

- [ ] The Pi loader probe reports a supervisor description length of 1024 characters or fewer.
- [ ] The Pi loader probe reports no diagnostic for `.agro/skills/supervisor/SKILL.md`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION` line.
- [ ] Every required check in `.github/workflows/ci-harness.yml` passes on the pull request head.
- [ ] The pull request is non-draft and states the exact head SHA that CI verified.
- [ ] The branch diff against `<base-branch>` changes only `.agro/skills/supervisor/SKILL.md`, plus the task files under `.agro/tasks/shorten-supervisor-skill-description/`.
- [ ] Nobody merges the pull request, cuts a release, or force-pushes the branch.

## Lessons

Filled by the advisor before undraft.
