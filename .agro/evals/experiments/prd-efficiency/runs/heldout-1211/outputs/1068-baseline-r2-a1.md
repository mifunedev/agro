# PRD: Shorten the supervisor skill description

Status: BLOCKED

## User Stories

### US-001: Fit the supervisor description in the Pi limit

**Description:** As a Pi operator, I want a `/supervisor` description within the Pi limit so that Pi loads the skill without a warning.

**Acceptance Criteria:**

- [ ] The only tracked file that the diff changes is `.agro/skills/supervisor/SKILL.md`, unless the operator answers open question 1 with option B.
- [ ] The diff changes only the `description:` value in the frontmatter of `.agro/skills/supervisor/SKILL.md`. The `name:` value, the `allowed-tools:` value, and the body stay byte-identical.
- [ ] The Pi parser reports a `description` length of 1024 characters or less for `.agro/skills/supervisor/SKILL.md`.
- [ ] The Pi loader probe in the Test Plan prints no line that contains `description exceeds 1024 characters` for `.agro/skills/supervisor/SKILL.md`.
- [ ] The Pi loader probe prints no new diagnostic for `.agro/skills/supervisor/SKILL.md` when the probe output is compared with the baseline output.
- [ ] The new description keeps each positive trigger: supervise, babysit, watch, or drive an agent in another pane; run a build in a second pane and keep the build on track; own a long build to its Definition of Done from outside the implementing session; an advisor needs a brief, a compaction decision, or an escalation route; the operator asks what the advisor is doing or whether the advisor is still on the contract.
- [ ] The new description keeps each negative trigger: the active session implements the work; the request asks for a code review; the request asks to dispatch bounded workers inside one session, with the pointer to `/delegate`; the request asks to run a single `herdr` command, with the pointer to `/herdr`.
- [ ] The new description keeps each role boundary: `MonitorCreate` with `onDone` for all advisor observation; `MonitorList` and `MonitorStop` for handle control; no `LoopCreate` and no polling; inline Herdr commands for launch and guarded downward steering only; no reverse Herdr messages from advisors and workers; no code writing and no code review; ownership of context budgets and operator escalation.

### US-002: Prove links, probes, and CI stay green

**Description:** As the advisor, I want before and after evidence for links, probes, and CI so that I can accept the change.

**Acceptance Criteria:**

- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0 before the edit and after the edit.
- [ ] `readlink .claude/skills` prints `../.agro/skills`, and `readlink .agents/skills` prints `../.agro/skills`, after the edit.
- [ ] `bash .agro/skills/eval/run.sh` reports no probe that moved from PASS to REGRESSION when the after run is compared with the before run.
- [ ] The implementation owner restores `.agro/evals/RESULTS.md` with `git checkout -- .agro/evals/RESULTS.md` after each local `run.sh` run, so that the diff carries no `RESULTS.md` change.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md` reports no new finding when the after run is compared with the before run.
- [ ] `git diff --check` exits 0.
- [ ] `.agro/tasks/shorten-supervisor-skill-description/evidence.md` records each command above with its exit status, before and after, and the Pi parser length before (`1103`) and after.
- [ ] Each required check of `.github/workflows/ci-harness.yml` on the PR head SHA reports success.
- [ ] A non-draft PR exists for the task branch. The PR body names the exact head SHA that the evidence covers.

## Summary

Verified current state:

- `.agro/skills/supervisor/SKILL.md` is the canonical source. `.claude/skills` and `.agents/skills` are directory symlinks to `../.agro/skills`. The provider mirrors are therefore not separate files.
- Pi `0.87.1` is installed at `/home/sandbox/.local/bin/pi`. The loader is `@earendil-works/pi-coding-agent/dist/core/skills.js`. The loader sets `MAX_DESCRIPTION_LENGTH = 1024` and pushes a `warning` diagnostic with the message `description exceeds 1024 characters (<n>)`. The loader still loads the skill.
- A run of `loadSkillsFromDir({ dir: '.agro/skills', source: 'project' })` against the current tree reports `description exceeds 1024 characters (1103) .agro/skills/supervisor/SKILL.md`. The description must lose at least 79 characters.
- The description has three lines: a role-boundary line, a `TRIGGER when:` line, and a `Do NOT trigger when` line. The body of the skill already states each role boundary in full under `## Role boundary`.

Selected approach: rewrite the three description lines with shorter wording. Keep each trigger and each role boundary from US-001. Target 950 characters or less, so that a later small edit does not cross the limit again. Change no other line.

Other skills also exceed the Pi limit, for example `.agro/skills/post-bridge/SKILL.md`. The issue scopes the fix to `/supervisor` only. See Out of Scope.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` | Canonical source. The only planned edit. |
| `/home/sandbox/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js` | `MAX_DESCRIPTION_LENGTH`, `loadSkillsFromDir` | Pi loader that emits the diagnostic. Read only. |
| `.agro/scripts/link-providers.sh` | `--check` | Verifies the provider symlinks without a change. |
| `.agro/skills/eval/run.sh` | probe runner | Runs `.agro/evals/probes/*.sh` and writes `.agro/evals/RESULTS.md`. |
| `.agro/skills/ste/scripts/ste-check.sh` | checker | Checks the prose of the skill file. |
| `.agro/evals/decisions/skill-impact.md` | `SI-nnnn` records | Skill-change ledger. `/builder` appends a `PROPOSED` record on each skill edit. See open question 1. |
| `.github/workflows/ci-harness.yml` | harness CI | Runs `link-providers.sh --init` and `.agro/skills/eval/run.sh` on the PR. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Skill metadata that Pi, Claude Code, and Codex read | wording | The `/supervisor` description gets shorter. The trigger meaning stays the same. |
| `agro` CLI verbs | none | Not applicable: no lifecycle verb reads the description. |
| Public documentation in `mifunedev/agro-web` | none | Not applicable: no user-facing behavior or term changes. |

## Storage

N/A: the change edits one frontmatter string. The task persists no state.

## Architectural Decisions

- Source of truth: `.agro/skills/supervisor/SKILL.md`. The implementation owner edits no provider path.
- Limit oracle: the installed Pi loader. The probe imports `loadSkillsFromDir` from the installed package, so that the length check uses the same parser as the real diagnostic.
- Surface check: host and sandbox — applied: the edit and all checks run in the sandbox checkout. Lifecycle door — not applicable. Canonical and provider surfaces — applied: edit `.agro/`, then run `link-providers.sh --check`. Root and scaffold — applied: initialized projects receive the vendored `.agro/skills/` pack, so the fix reaches them through the pack. Interactive and headless processes — not applicable. Local and remote operation — not applicable. Parallel operation — applied: the owner works in one isolated worktree on the task branch. Public documentation — not applicable. Verification — applied: see Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| Inline Pi loader probe, recorded in `evidence.md` (command below) | Run before the edit: the output contains `description exceeds 1024 characters (1103)`. Run after the edit: the output has no diagnostic for the supervisor file. | US-001 length and diagnostic criteria |
| `.agro/scripts/link-providers.sh --check` | Before and after: exit 0 | US-002 link criterion |
| `.agro/skills/eval/run.sh` | Before and after: no PASS to REGRESSION move | US-002 probe criterion |
| `.agro/skills/ste/scripts/ste-check.sh` | Before and after on the supervisor file: no new finding | US-002 prose criterion |
| Manual trigger review, recorded in `evidence.md` | Each trigger and each role boundary in US-001 maps to a phrase in the new description | US-001 coverage criteria |

The Pi loader probe runs from the repository root in the sandbox:

```bash
node --input-type=module -e "
import { loadSkillsFromDir } from '/home/sandbox/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js';
const r = loadSkillsFromDir({ dir: '.agro/skills', source: 'project' });
const s = r.skills.find(k => k.name === 'supervisor');
console.log('length', s && s.description.length);
for (const d of r.diagnostics) if (d.path.includes('/supervisor/')) console.log(d.type, d.message);
"
```

## Design Principles

- Change the canonical `.agro/` source. Do not patch a mirror.
- Keep the smallest realistic change: one frontmatter value.
- Keep the trigger meaning. A shorter description must route the same requests to `/supervisor` and away from `/supervisor`.
- Leave the full rules in the body. The description names each rule. The body explains each rule.
- Add no tracked comment and no new probe unless the operator asks for a probe.

## Out of Scope

- Changes to the body of `.agro/skills/supervisor/SKILL.md`.
- A redesign of the supervisor role, the advisor role, or the worker role.
- Other skills whose descriptions also exceed 1024 characters.
- A new repository probe that enforces the Pi limit for every skill.
- Changes to the Pi package or to the provider symlinks.
- Merge, release, and force push.

## Open Questions

1. The issue permits an edit to `.agro/skills/supervisor/SKILL.md` only. `/builder` requires a `PROPOSED` record in `.agro/evals/decisions/skill-impact.md` for each skill edit. Which rule wins?
   - A. Edit only `SKILL.md`. Record the skip in `evidence.md`.
   - B. Also append one `SI-nnnn` `PROPOSED` record to `skill-impact.md`.
2. Which base branch does the PR target? The issue template names `development`. The current checkout has no branch name in `git branch --show-current`. Use `<base branch>` until the operator confirms.
3. Which CI checks must pass on the PR? The plan assumes the jobs of `.github/workflows/ci-harness.yml`. Confirm `<required check list>`.

## Acceptance Criteria

- [ ] The Pi loader reports no `description exceeds 1024 characters` diagnostic for `.agro/skills/supervisor/SKILL.md`.
- [ ] The parsed supervisor description is 1024 characters or less.
- [ ] The diff changes only the supervisor `description:` value, plus the ledger record if the operator selects option B for open question 1.
- [ ] Each trigger and each role boundary listed in US-001 is present in the new description.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0 after the edit.
- [ ] The probe suite shows no PASS to REGRESSION move, and the required CI checks report success on the PR head SHA.
- [ ] A non-draft PR names the exact head SHA. No merge, release, or force push occurs.

## Lessons

Filled by the advisor before undraft.
