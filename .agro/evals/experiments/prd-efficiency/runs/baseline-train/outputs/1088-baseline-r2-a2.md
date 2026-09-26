# PRD: Move task evidence into the PR body and close two gate gaps

Status: BLOCKED

Source: issue #1088 (`work/issue-1088.md`).

## User Stories

### US-001: Move the five evidence questions into the PR-body contract

**Description:** As a reviewer, I want the build's answer in the PR description so that I read one versioned artifact.

**Acceptance Criteria:**

- [ ] `.agro/skills/spec/references/execute.md` step 7 tells the owner to write the five questions (0 to 4) into the PR body with `gh pr edit`. Step 7 no longer tells the owner to write a file.
- [ ] The step 10 evidence gate reads the PR body with `gh pr view <PR> --repo "$SPEC_REPO" --json body`. The gate refuses the undraft when one of the five section headings is absent.
- [ ] `grep -n 'git ls-files --error-unmatch' .agro/skills/spec/references/execute.md` prints nothing.
- [ ] The step 10 PR-body template carries a `## Why this is better` section ahead of `## What the plan asked for`.
- [ ] `.agro/skills/audit/references/reviewer-evidence-doc.md` defines the PR body as the artifact location. The file keeps the five questions, the observed-only rule, the correlation rule, and the follow-up citation rule. The file drops the `git add -f` rule.
- [ ] The failure table row 10 and the reuse table row 7 in `execute.md` name the PR body, not `evidence.md`.

### US-002: Remove `evidence.md` from the remaining skill and doc files

**Description:** As an implementation owner, I want each procedure to name the PR body so that I write no retired file.

**Acceptance Criteria:**

- [ ] Each of these files names the PR body where the file named `evidence.md`: `.agro/skills/spec/SKILL.md`, `.agro/skills/spec/templates/task-prompt.md`, `.agro/skills/spec/references/retro.md`, `.agro/skills/audit/references/implementation.md`, `.agro/skills/audit/references/pr.md`, `.agro/skills/retro/SKILL.md`, `.agro/skills/wiki/references/compile.md`, `.agro/skills/wiki/references/schema.md`, `.agro/skills/escalate/SKILL.md`, `.agro/skills/supervisor/SKILL.md`, `.agro/memories/AGENTS.md`, `.agro/logs/AGENTS.md`, `.agro/tasks/README.md`.
- [ ] This command prints nothing: `git grep -n 'evidence\.md' -- .agro/skills .agro/memories .agro/logs .agro/tasks/README.md docs`.
- [ ] `.agro/tasks/README.md` lists no `evidence.md` row and no `evidence.md` entry in the `git add -f` list.
- [ ] `/retro --task` and `/wiki compile --task` read the PR body with `gh pr view --json body` when the task has a PR.

### US-003: Rescope the four probes that read `evidence.md`

**Description:** As a harness maintainer, I want the four probes to guard the PR-body contract so that each lesson keeps its guard.

**Acceptance Criteria:**

- [ ] `spec-ready-finalization.sh` fails when the step 10 section of `execute.md` stops reading the PR body for the five headings. The probe no longer requires `evidence.md` or `git ls-files --error-unmatch`.
- [ ] `spec-single-owner.sh` checks the task-prompt token that names the PR-body evidence, not `write and commit \`evidence.md\``.
- [ ] `protected-path-deletion.sh` reads its justification from <justification source>. The probe exits 1 on a fixture that deletes a protected path with no justification. The probe exits 0 on a fixture that names the path in <justification source>.
- [ ] `docs-20260901-followup-artifact-cited.sh` has the disposition that open question 2 selects, and its `desc:` names what the probe measures.
- [ ] `bash .agro/skills/eval/run.sh` shows no new green-to-red transition against the base.

### US-004: Probe a completed task folder for the artifacts `execute.md` requires

**Description:** As an operator, I want a check of each completed task folder so that a skipped gate fails the suite.

**Acceptance Criteria:**

- [ ] A new probe `.agro/evals/probes/spec-task-artifacts-complete.sh` exists with `# tier: A`, `# source: issue #1088`, and a `desc:` line.
- [ ] The probe selects each task folder that the branch changes against the merge base and whose `prd.json` satisfies `all(.userStories[]; .passes == true)`.
- [ ] For each selected folder, the probe requires tracked `prd.md`, `prd.json`, `progress.txt`, `eval-result.json`, and `simplicity-review.json`.
- [ ] The probe requires tracked `ui-evidence.json` when a story in `prd.json` names `Verify in browser` or `agent-browser`.
- [ ] The probe exits 1 on a fixture folder that lacks `simplicity-review.json`. The REGRESSION line names the folder and the absent file.
- [ ] The probe exits 0 on a fixture folder that carries every required file.
- [ ] The probe exits 2 with `SKIPPED` when the branch changes no completed task folder.
- [ ] The probe reads the required-artifact list from one place, and `execute.md` names that probe as the check for the list.

### US-005: Give the audit driver a distinct tooling-blocked verdict

**Description:** As an operator, I want an unrunnable gate to report a tooling gap so that I see no false PR defect.

**Acceptance Criteria:**

- [ ] `route-driver.sh` checks the `gh` version once, ahead of gate 1, for the `implementation` route with `--pr` and for the `pr` route.
- [ ] If `gh` is older than 2.101.0, the driver prints one line with the dependency, the observed version, and the required version. The line has this form: `preflight: UNOBTAINABLE (gh <observed> < 2.101.0 required for closingIssuesReferences)`.
- [ ] After that line, the `implementation` route publishes `AUDIT-UNOBTAINABLE`, and the `pr` route publishes `PR-AUDIT-UNOBTAINABLE`.
- [ ] A current `gh` that returns a non-promotable PR still publishes `AUDIT-FAIL` and `PR-AUDIT-BLOCKED`, as before.
- [ ] `execute.md` step 5 and step 10 treat an `UNOBTAINABLE` verdict as a block on the undraft. The steps forbid a hand-rolled substitute classification.
- [ ] `.agro/skills/audit/SKILL.md`, `audit-run.sh` usage table, `references/implementation.md`, and `references/pr.md` list the new verdict tokens.
- [ ] A probe with a mock `gh` that reports version 2.63.2 observes `AUDIT-UNOBTAINABLE` and `PR-AUDIT-UNOBTAINABLE`. The same probe with a mock that reports 2.101.0 observes no `UNOBTAINABLE` token.

## Summary

Verified current state at `80b9342`:

- `execute.md` step 7 (line 502) tells the owner to write and commit `.agro/tasks/<slug>/evidence.md`. The step 10 evidence gate (lines 602 to 622) checks the file with `[ -f ]` and `git ls-files --error-unmatch`. Step 10 then copies most of the file into the PR body, and the template omits question 0.
- `git grep 'evidence\.md'` finds live references in 4 probes and 15 skill or doc files. The issue counts 12 skill or doc files. US-001 and US-002 list the 15 files.
- Tracked task folders show the gap from finding 2. Of 10 tracked, non-archived folders whose stories all pass, 6 carry no `simplicity-review.json`. No probe opens a task folder to check the artifact set.
- `pr-acquire.sh:32` requests `closingIssuesReferences` in one `gh` call. `route-driver.sh:75` prints `gate3: FAIL (classification exited $rc)`, and `route-driver.sh:170` maps the same failure to `PR-AUDIT-UNKNOWN`. Neither route separates a tooling gap from a PR defect. The sandbox has `gh` 2.101.0.

Selected approach: the PR body becomes the one evidence artifact. The undraft gate reads the PR body through `gh`. A new behavior probe reads task-folder artifacts, not procedure text, per `pattern-evals-document-conformance-proxy-oracle`. The driver adds one preflight and one verdict token per route.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/spec/references/execute.md` | step 5, step 7, step 10, failure table, reuse table | Owns the evidence contract and the undraft gate |
| `.agro/skills/audit/references/reviewer-evidence-doc.md` | five questions, contract list, shape | Defines the evidence content |
| `.agro/skills/audit/scripts/route-driver.sh` | `gate3_pr`, `pr_route`, `publish`, new preflight | Emits the audit verdicts |
| `.agro/skills/audit/scripts/pr-acquire.sh` | `fields` | Requests `closingIssuesReferences`, which needs `gh` 2.101.0 |
| `.agro/skills/audit/scripts/audit-run.sh` | usage table, lines 15 and 16 | Lists verdict tokens |
| `.agro/evals/probes/spec-ready-finalization.sh` | evidence-gate checks, lines 46 to 56 | Guards the undraft gate |
| `.agro/evals/probes/spec-single-owner.sh` | `in_prompt` check, line 35 | Guards task-prompt evidence ownership |
| `.agro/evals/probes/protected-path-deletion.sh` | `evidence_files`, line 42 | Reads the deletion justification |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | tracked-file loop, line 48 | Reads follow-up citations |
| `.agro/tasks/README.md` | artifact table, conventions | Lists task-folder files |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/spec execute` evidence gate | Modified | Reads the PR body for five headings, not a tracked file |
| PR body template | Modified | Adds `## Why this is better` and drops the `evidence.md` link |
| `/audit implementation` verdicts | Added | `AUDIT-UNOBTAINABLE` |
| `/audit pr` verdicts | Added | `PR-AUDIT-UNOBTAINABLE` |
| Probe suite | Added | `spec-task-artifacts-complete.sh` and the `UNOBTAINABLE` probe |
| `.agro/tasks/<slug>/evidence.md` | Removed | New builds write no file. Tracked historical files stay. |

## Storage

The PR description on GitHub stores the evidence, and GitHub keeps its edit history. Task folders under `.agro/tasks/<slug>/` keep the JSON gate records and add them with `git add -f`, as before. The change adds no schema.

## Architectural Decisions

- **Source of truth.** The PR body owns the build's answer back to the plan. `reviewer-evidence-doc.md` owns the content contract. `execute.md` owns the gate.
- **Historical records.** Tracked `evidence.md` files in task folders and in `archive/`, knowledge-page `sources:` pins, `CHANGELOG.md` entries, and `.agro/evals/decisions/skill-impact.md` stay unchanged. Each one records history at a pinned commit.
- **Probe scope.** The artifact probe checks only completed task folders that the branch changes. Folders from earlier builds predate the rule and stay out of scope.
- **Fail closed.** An `UNOBTAINABLE` verdict blocks the undraft as `AUDIT-FAIL` does. The new token changes the diagnosis, not the block.
- **One preflight.** The driver checks `gh` once at the start of a route. The driver does not split the `pr-acquire.sh` field list.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/spec-ready-finalization.sh` | gate reads PR body; five headings present; no `--error-unmatch` | US-001 |
| `.agro/evals/probes/spec-single-owner.sh` | task prompt names PR-body evidence | US-002 |
| `.agro/evals/probes/protected-path-deletion.sh` | unjustified deletion exits 1; justified deletion exits 0 | US-003 |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | disposition from open question 2 | US-003 |
| `.agro/evals/probes/spec-task-artifacts-complete.sh` | missing `simplicity-review.json` exits 1; complete folder exits 0; UI story without `ui-evidence.json` exits 1; no completed folder exits 2 | US-004 |
| `.agro/evals/probes/audit-gate-unobtainable.sh` | mock `gh` 2.63.2 gives both `UNOBTAINABLE` tokens; mock `gh` 2.101.0 gives none | US-005 |
| `.agro/evals/probes/audit-shellcheck-coverage.sh` | new and changed scripts pass shellcheck | US-003, US-004, US-005 |
| `bash .agro/skills/eval/run.sh` | full suite, no new green-to-red transition | all stories |

Write each new probe case first. Confirm that the case exits 1 against the current tree, then implement.

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- Keep one source of truth for each policy. The PR body holds evidence, and the probe holds the artifact list.
- Measure behavior through its artifact, not through the rule text.
- Fail closed, and name the cause.
- Delete the obsolete path. Leave no dormant `evidence.md` fallback.
- Apply `/ste` to every prose change.

## Out of Scope

- `knowledge-citation-symbol-liveness.sh`, which issue #1088 tracks separately.
- Changes to the gate 5 `netAdded` termination instrument.
- Deletion or rewrite of tracked historical `evidence.md` files, knowledge pages, `CHANGELOG.md` history, or `skill-impact.md`.
- A probe that proves `knowledge-impact.sh` ran. The knowledge-impact table moves to the PR body, and an offline probe cannot read the PR body.
- A split of the `pr-acquire.sh` field list into per-gate `gh` calls.
- Changes to `mifunedev/agro-web`. The affected surfaces are internal skills and probes.

## Open Questions

1. Where does `protected-path-deletion.sh` read the deletion justification after `evidence.md` retires? The probe runs offline and cannot read the PR body.
   - A. Commit message bodies in `<merge-base>..HEAD`. This source is local, deterministic, and part of the diff history. (Recommended.)
   - B. A tracked `.agro/tasks/<slug>/protected-deletions.txt` file. This option adds a new gitignored artifact, which the issue retires.
   - C. The PR body through `gh`. The probe then reports `SKIPPED` offline.
2. What happens to `docs-20260901-followup-artifact-cited.sh`? After the change, no new tracked `evidence.md` exists for the probe to read.
   - A. Keep only the contract check over `reviewer-evidence-doc.md`, and rename the `desc:` to say that the probe guards the text. (Recommended.)
   - B. Delete the probe, and record the lesson in the PR-body gate.
3. Does the artifact probe require `simplify-rounds.json`? `route-driver.sh` gate 5 reads the file only when it exists, and `execute.md` writes it only after an `AUDIT-FAIL (gate 5)`. The issue names the file as absent in #1086.
   - A. Do not require the file. (Recommended, matches gate 5.)
   - B. Require the file for every completed folder, and change `execute.md` to write round 0.
4. Does the artifact probe require `delegate-graph.json` when `progress.txt` records a `/delegate` dispatch? The issue does not name this file.
5. Which verdict does gate 3 on the branch path (`gate3_branch`, `gh run list`) emit when `gh` exits non-zero? The recommended answer keeps `AUDIT-FAIL` because the preflight already catches the version skew.

## Acceptance Criteria

- [ ] Each story's acceptance criteria pass.
- [ ] `bash .agro/skills/eval/run.sh` exits 0, or reports only reds that the base already had.
- [ ] `.agro/evals/RESULTS.md` lists `spec-task-artifacts-complete.sh` and the `UNOBTAINABLE` probe as `PASS` or `SKIPPED`.
- [ ] `CHANGELOG.md` `## [Unreleased]` carries one entry for the evidence move, one for the artifact probe, and one for the new verdict.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown procedure file.

## Lessons

Filled by the advisor before undraft.
