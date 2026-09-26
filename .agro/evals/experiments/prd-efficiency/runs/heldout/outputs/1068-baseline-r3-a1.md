# PRD: Shorten the supervisor skill description

Status: DRAFT

Source: `work/issue-1068.md` (issue #1068).

## User Stories

### US-001: Fit the supervisor description inside the Pi limit

**Description:** As a Pi operator, I want a `/supervisor` description inside the Pi length limit so that Pi loads every skill without a warning.

**Acceptance Criteria:**

- [ ] Before the edit, the Pi loader command in the Test Plan prints exactly one diagnostic: `description exceeds 1024 characters (1103)` for `.agents/skills/supervisor/SKILL.md`.
- [ ] After the edit, the same Pi loader command prints zero diagnostics and reports 36 loaded skills.
- [ ] After the edit, the parsed `description` value in `.agro/skills/supervisor/SKILL.md` has at most 1,024 characters. The Pi loader counts the value, including the trailing newline of the `|` block scalar.
- [ ] The parsed `description` still states each role boundary in the "Preserved content" list of the Summary.
- [ ] The parsed `description` still names each positive trigger and each negative trigger in the "Preserved content" list of the Summary.
- [ ] `git diff <base>...HEAD --name-only` prints only `.agro/skills/supervisor/SKILL.md`.
- [ ] `git diff <base>...HEAD` changes only lines inside the `description:` value. The `name:` line, the `allowed-tools:` line, and the skill body stay byte-identical.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no probe that moves from PASS before the edit to REGRESSION after the edit.

## Summary

Verified current state:

- `.agro/skills/supervisor/SKILL.md` is the canonical file. `.claude/skills` and `.agents/skills` are symlinks to `../.agro/skills`. The Claude path and the canonical path hold the same bytes.
- The frontmatter `description` is a `|` block scalar with three lines: a role-boundary paragraph, a `TRIGGER when:` line, and a `Do NOT trigger when` line.
- The installed Pi is `@earendil-works/pi-coding-agent` version `0.87.1`. Its `dist/core/skills.js` sets `MAX_DESCRIPTION_LENGTH = 1024`. For a longer description, the loader emits the warning `description exceeds 1024 characters (<length>)` and still loads the skill.
- A call to `loadSkills` with `skillPaths: [".agents/skills"]` loads 36 skills. The call emits one diagnostic: `description exceeds 1024 characters (1103)` for `supervisor`. No other skill emits a diagnostic.
- The `supervisor-skill` task progress log recorded a 990-character description at creation. Later edits raised the value to 1,103 characters.
- No eval probe reads the supervisor description text. CI job `eval-probes` in `.github/workflows/ci-harness.yml` runs `bash .agro/scripts/link-providers.sh --init` and then `bash .agro/skills/eval/run.sh`.

Selected approach: rewrite only the `description` value. Keep the three-part shape. Merge and tighten clauses in the role-boundary paragraph, because that paragraph repeats rules that the body section `## Role boundary` owns in full. Keep each item in the preserved-content list. Do not move content into the body.

Preserved content. The shortened description must keep each item below. The wording can change. The meaning cannot change.

- Role boundaries:
  1. The supervisor supervises advisor sessions from outside those sessions.
  2. All advisor observation, readiness waits, status checks, and output reads use `MonitorCreate` with `onDone`.
  3. Handle control uses `MonitorList` and `MonitorStop`.
  4. The supervisor never uses `LoopCreate` or polling.
  5. The supervisor uses inline Herdr commands only for launch and guarded downward steering.
  6. The supervisor blocks reverse Herdr messages from advisors and workers.
  7. The supervisor does not write code and does not review code.
  8. The supervisor owns context budgets and operator escalation.
- Positive triggers:
  1. A request to supervise, babysit, watch, or drive an agent in another pane.
  2. The quoted request `"run this build in a second pane and keep it on track"`.
  3. A request to own a long build to its Definition of Done from outside the implementing session.
  4. An advisor needs a brief, a compaction decision, or an escalation route.
  5. The quoted questions "what is the advisor doing" and "is the advisor still on the contract".
- Negative triggers:
  1. The active session implements the work.
  2. The request asks for a code review.
  3. The request asks to dispatch bounded workers inside one session, with the pointer `/delegate`.
  4. The request asks to run a single `herdr` command, with the pointer `/herdr`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` | Canonical source. The only file that changes. |
| `.agents/skills/supervisor/SKILL.md` | symlink target through `.agents/skills` | The path that the Pi loader reports. No edit. |
| `.claude/skills/supervisor/SKILL.md` | symlink target through `.claude/skills` | Claude Code mirror. No edit. |
| `<pi-root>/dist/core/skills.js` | `loadSkills`, `MAX_DESCRIPTION_LENGTH` | Installed Pi loader. The verification oracle. No edit. |
| `.agro/scripts/link-providers.sh` | `--check` | Provider symlink check. |
| `.agro/skills/eval/run.sh` | probe runner | Before and after regression gate. Rewrites `.agro/evals/RESULTS.md`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Skill metadata that Pi, Claude Code, and Codex read | Modified | The `supervisor` description gets shorter. The trigger coverage and the role boundaries stay the same. |
| Skill body of `/supervisor` | None | The body stays byte-identical. |
| Public documentation in `mifunedev/agro-web` | None | No user-facing behavior or term changes. |

## Storage

N/A. The change edits one tracked Markdown file and adds no persistent state.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` stays the single source of truth. The worker edits no provider mirror.
- The installed Pi loader is the oracle for the diagnostic. A character count by another tool is secondary evidence.
- The body section `## Role boundary` stays the full owner of the supervisor rules. The description keeps a short, complete summary for trigger routing.
- The branch follows the `/git` skill: `skill/1068-supervisor-description-length`, based on `development`.

## Test Plan (TDD)

Run each command in the sandbox, from the worktree root. Run each command once before the edit and once after the edit.

Pi loader command:

```bash
PI_SKILLS="$(dirname "$(readlink -f "$(command -v pi)")")/../core/skills.js"
node --input-type=module -e "
import { loadSkills } from '$PI_SKILLS';
const r = loadSkills({ cwd: process.cwd(), agentDir: '/tmp/pi-empty-agent', skillPaths: ['.agents/skills'], includeDefaults: false });
console.log('skills', r.skills.length);
for (const d of r.diagnostics) console.log(JSON.stringify(d));
"
```

| Test File | Case(s) | Validates |
|---|---|---|
| Pi loader command (above) | Before: prints `skills 36` and one diagnostic with `description exceeds 1024 characters (1103)`. After: prints `skills 36` and no diagnostic. | The actual Pi diagnostic is present before the fix and absent after the fix. |
| `bash .agro/scripts/link-providers.sh --check` | Exit code 0 after the edit. | The canonical and provider symlinks still resolve. |
| `bash .agro/skills/eval/run.sh` | No probe moves from PASS to REGRESSION between the two runs. After each run, restore the file with `git checkout -- .agro/evals/RESULTS.md`. | The regression floor holds. |
| `git diff <base>...HEAD --name-only` and `git diff <base>...HEAD` | One path. Changed lines fall inside the `description:` value only. | The change stays in scope. |
| Manual review of the new description against the preserved-content list | Each of the 17 listed items is present. | Trigger coverage and role boundaries hold. |
| CI job `eval-probes` and the other checks on the pull request | All required checks pass on the exact head SHA. | CI is green. |

## Design Principles

- Edit the canonical `.agro/` source. Do not patch a provider mirror.
- Apply the smallest realistic change: one frontmatter value in one file.
- Do not redesign the skill. Do not reorder, rename, or extend the body.
- Add no explanatory comment to tracked code.
- Use the installed Pi loader as evidence. Do not rely on an estimated length.

## Out of Scope

- Any change to the `/supervisor` body, `name`, or `allowed-tools`.
- Any edit to `.claude/`, `.agents/`, or another provider mirror.
- A new eval probe or a change to an existing probe. See Open Question 1.
- Description changes to other skills.
- A merge, a release, a force push, or a committed `.agro/evals/RESULTS.md` refresh.

## Open Questions

1. Does the operator want a new regression probe that fails when any `.agro/skills/*/SKILL.md` description exceeds 1,024 characters? The issue scope says to edit only the supervisor frontmatter. This plan adds no probe. A probe needs a separate, authorized change.
2. Which base commit does `<base>` name in the diff checks? This plan assumes the tip of `development` at branch creation.
3. The Pi loader command reads the host-specific Pi install path through `command -v pi`. CI does not install Pi. CI cannot run the Pi check. The implementation owner records the Pi check output in the pull request body as local sandbox evidence.

## Acceptance Criteria

- [ ] The parsed `description` in `.agro/skills/supervisor/SKILL.md` has at most 1,024 characters.
- [ ] The Pi loader command prints no diagnostic after the fix. The pull request body records the before output and the after output.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` shows no new REGRESSION, and `.agro/evals/RESULTS.md` has no uncommitted change.
- [ ] The diff against `<base>` touches only the `description:` value of `.agro/skills/supervisor/SKILL.md`.
- [ ] All required CI checks pass on the pull request head.
- [ ] A non-draft pull request targets `development` and states its exact head SHA.
- [ ] No merge, release, or force push occurs.

## Lessons

Filled by the advisor before undraft.
