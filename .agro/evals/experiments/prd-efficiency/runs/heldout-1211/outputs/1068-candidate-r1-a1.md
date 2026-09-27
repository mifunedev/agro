# PRD: Shorten the supervisor skill description

Status: BLOCKED

## User Stories

### US-001: Shorten the supervisor frontmatter description

**Description:** As a Pi operator, I want a shorter `/supervisor` description so that Pi loads the skill without a warning.

**Acceptance Criteria:**

- [ ] The change edits only the `description` value in the frontmatter of `.agro/skills/supervisor/SKILL.md`.
- [ ] Before the edit, the length command in the Test Plan prints a value greater than `1024` on the current file.
- [ ] After the edit, the length command in the Test Plan prints a value of `1024` or less.
- [ ] The new description names the supervisor role, `MonitorCreate` with `onDone`, `MonitorList`, `MonitorStop`, the `LoopCreate` and polling ban, and the downward-only Herdr steering rule.
- [ ] The new description keeps each positive trigger: supervise, babysit, watch, or drive an agent in another pane; a second-pane build; a long build to its Definition of Done; an advisor brief, compaction, or escalation route; "what is the advisor doing".
- [ ] The new description keeps each negative trigger: the active session implements the work; a code review; bounded workers inside one session (`/delegate`); one `herdr` command (`/herdr`).
- [ ] The new description states that the supervisor writes no code and reviews no code.
- [ ] Before the edit, `<pi diagnostic command>` prints `<pi diagnostic text>` for the supervisor skill.
- [ ] After the edit, `<pi diagnostic command>` prints no metadata-length diagnostic for the supervisor skill.

### US-002: Prove the provider links and the regression gates

**Description:** As an operator, I want the link check, the probe suite, and CI to pass so that the change breaks no provider surface.

**Acceptance Criteria:**

- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0 inside the sandbox.
- [ ] `.claude/skills` and `.agents/skills` remain symlinks that resolve to `.agro/skills`.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION before the edit and no REGRESSION after the edit.
- [ ] `git diff --name-only origin/main...HEAD` lists only `.agro/skills/supervisor/SKILL.md` and files under `.agro/tasks/supervisor-description-length/`.
- [ ] Every required check of the CI workflow `CI: Harness` passes on the pull-request head SHA.
- [ ] A non-draft pull request exists, and the pull-request body names the exact head SHA.

## Summary

Issue #1068 (`work/issue-1068.md`) reports a Pi skill-loader warning about the metadata length of the `/supervisor` skill.

Verified current state:

- The frontmatter of `.agro/skills/supervisor/SKILL.md` holds a literal block `description: |` on lines 3 to 6.
- The parsed description is 1103 characters long, measured with the length command in the Test Plan. The limit is 1024 characters.
- `.claude/skills` is a symlink to `../.agro/skills`. `.agents/skills` is a symlink to `../.agro/skills`. No provider mirror holds a copy of the supervisor skill.
- `.agro/scripts/link-providers.sh` retires `.pi/skills`. Pi reads skills through `.agents/skills`.
- No eval probe pins the text of the supervisor description.

Selected approach: rewrite the description into shorter sentences. Keep every trigger phrase and every role boundary. Change no other line of the file. The body of `SKILL.md` keeps the full procedure, so the description needs only the routing facts.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` (lines 3 to 6) | Canonical source of the supervisor routing text |
| `.agro/scripts/link-providers.sh` | `--check` mode | Verifies the provider symlinks without a change |
| `.agro/skills/eval/run.sh` | probe suite runner | Runs every probe under `.agro/evals/probes/` |
| `.github/workflows/ci-harness.yml` | job `Eval Probe Regression Gate`, job `Lint, Typecheck, Build & Test` | CI gates for the pull request |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Skill frontmatter `description` of `/supervisor` | Modified | Shorter text with the same triggers and role boundaries |
| Pi skill loader | Diagnostic removed | Pi reports no metadata-length warning for the supervisor skill |

## Storage

N/A. The change edits one text field in a tracked Markdown file. The change adds no persistent state.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` stays the single source of truth. The provider directories reach the file through symlinks.
- The description carries routing facts only. The body of `SKILL.md` carries the full procedure and the full role boundary.
- The limit of 1024 characters applies to the parsed description value, not to the raw YAML lines.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| Length command: `awk '/^description: \|/{f=1;next} /^[a-z-]+:/{f=0} f{sub(/^  /,"");print}' .agro/skills/supervisor/SKILL.md \| wc -c` | Before the edit: prints a value greater than `1024`. After the edit: prints `1024` or less. | Red and green proof for the length limit |
| `<pi diagnostic command>` | Before the edit: the supervisor warning appears. After the edit: the supervisor warning is absent. | The actual Pi loader diagnostic |
| `bash .agro/scripts/link-providers.sh --check` | Exit 0 after the edit | Canonical and provider symlinks stay intact |
| `bash .agro/skills/eval/run.sh` | No REGRESSION before the edit and after the edit | The probe floor stays green |
| `.github/workflows/ci-harness.yml` | All jobs pass on the head SHA | CI gate |

## Design Principles

- Edit the canonical `.agro/` source. Do not patch a provider mirror.
- Preserve the operator's intent in the smallest change.
- Keep one term per concept: supervisor, advisor, worker.
- Apply `/ste` to the new description text.

## Out of Scope

- A redesign of the supervisor skill or a change to the body of `SKILL.md`.
- A change to other skill descriptions.
- A new eval probe for description length, unless the operator answers Open Question 2 with B.
- A change to `mifunedev/agro-web`. The user-facing behavior does not change.
- Merge, release, force push, and unrelated changes.

## Open Questions

1. Which command reproduces the Pi diagnostic, and what is the exact diagnostic text? The issue omits both. The plan uses `<pi diagnostic command>` and `<pi diagnostic text>`.
2. Does the task add a regression probe for description length?
   A. No. Edit only `.agro/skills/supervisor/SKILL.md`, as the issue scope states.
   B. Yes. Add `.agro/evals/probes/<probe name>.sh` that checks every skill description against 1024 characters.

## Acceptance Criteria
- [ ] The parsed description of `.agro/skills/supervisor/SKILL.md` has 1024 characters or less.
- [ ] `<pi diagnostic command>` prints no metadata-length diagnostic for the supervisor skill.
- [ ] Every positive trigger, every negative trigger, and every supervisor, advisor, and worker boundary from the old description stays in the new description.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION, and CI passes on the head SHA.
- [ ] A non-draft pull request names its exact head SHA.

## Lessons

Filled by the advisor before undraft.
