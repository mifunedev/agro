# PRD: Move task evidence into the PR body and close two gate gaps

Status: DRAFT

## User Stories

### US-001: Move the evidence contract into the PR body

**Description:** As a reviewer, I want the five evidence answers in the PR description so that I read the answers without a gitignored file.

**Acceptance Criteria:**

- [ ] `.agro/skills/spec/references/execute.md` step 7 tells the owner to write the five answers into the PR body, not into `evidence.md`.
- [ ] The step 10 PR-body template carries one heading for each of the five questions, in step 7 order.
- [ ] The step 10 evidence gate reads the body with `gh pr view <PR> --json body` and refuses the undraft when a heading is absent.
- [ ] The step 10 evidence gate contains no `git ls-files --error-unmatch` command.
- [ ] Step 6 records each knowledge-impact state in the PR body `## Knowledge impact` section.
- [ ] Step 5 records each `SIMPLICITY-RESIDUAL` finding in the PR body.
- [ ] `.agro/skills/audit/references/reviewer-evidence-doc.md` names the PR body as the location of the evidence.
- [ ] `git grep -n 'evidence\.md' -- .agro/skills .agro/logs/AGENTS.md .agro/memories/AGENTS.md` prints no line that tells a session to write or read `evidence.md`.

### US-002: Retarget the four probes that read `evidence.md`

**Description:** As the operator, I want each probe that reads `evidence.md` to check the PR-body contract so that `/eval` stays green after the file is gone.

**Acceptance Criteria:**

- [ ] `spec-ready-finalization.sh` fails when the step 10 evidence gate stops reading the PR body.
- [ ] `spec-ready-finalization.sh` fails when the PR-body template loses a heading for one of the five questions.
- [ ] `spec-single-owner.sh` checks that the task prompt assigns the PR-body evidence to the implementation owner.
- [ ] `docs-20260901-followup-artifact-cited.sh` checks that the PR-body contract requires a follow-up issue or PR URL.
- [ ] `protected-path-deletion.sh` reads each justification from the source that Open Question 1 selects.
- [ ] Each of the four probes exits 0 on the branch head.
- [ ] Each of the four probes exits 1 when the guarded line is reverted in a scratch copy of the procedure file.

### US-003: Add a probe for completed task folder artifacts

**Description:** As the operator, I want a probe that checks each completed task folder for the artifacts `execute.md` requires so that a skipped gate fails `/eval`.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/spec-task-artifacts-complete.sh` exists with `# tier: A`, `# source:`, and `# desc:` header lines.
- [ ] The probe treats a task folder as complete when `jq -e 'all(.userStories[]; .passes == true)'` on its `prd.json` exits 0.
- [ ] For each complete, non-archived task folder, the probe requires the tracked files `prd.md`, `prd.json`, `progress.txt`, `eval-result.json`, and `simplicity-review.json`.
- [ ] The probe requires `ui-evidence.json` when `implementation-gates.sh browser-required <slug>` exits 0.
- [ ] The probe fails when a required file name no longer appears in `execute.md`.
- [ ] The probe skips each slug on its grandfather list, and the list holds only folders that are complete when the probe lands.
- [ ] Red test: a fixture folder with all stories passing and no `simplicity-review.json` makes the probe exit 1 and name the missing file.
- [ ] Green test: the probe exits 0 on the branch head.

### US-004: Report a tooling-blocked gate as `UNOBTAINABLE`

**Description:** As the operator, I want a distinct audit verdict for a gate that cannot run. A `gh` version gap then does not read as a PR defect.

**Acceptance Criteria:**

- [ ] `pr-acquire.sh` compares `gh --version` against 2.101.0 before the `gh pr view` call.
- [ ] When `gh` is older than 2.101.0, `pr-acquire.sh` prints the observed version, the required version, and the field `closingIssuesReferences` on one stderr line.
- [ ] When `gh` is older than 2.101.0, `pr-acquire.sh` exits with a dedicated code `<unobtainable exit code>` and makes no `gh pr` call.
- [ ] `route-driver.sh` `gate3_pr` maps that exit code to the line `gate3: UNOBTAINABLE (<reason>)`.
- [ ] `route-driver.sh` publishes the verdict `AUDIT-UNOBTAINABLE` for that case and exits non-zero.
- [ ] `execute.md` step 5 treats `AUDIT-UNOBTAINABLE` as a blocked undraft and forbids a substitute classification.
- [ ] Red test: with a stub `gh` that reports version 2.45.0, `audit-pr-acquire.sh` observes the dedicated exit code and the one-line reason.
- [ ] Red test: with the same stub, `audit-implementation-behavior.sh` observes `gate3: UNOBTAINABLE` and not `gate3: FAIL`.

## Summary

Issue #1088 reports three findings from the `agro-workspace-verb` build (#1086).
Two pattern pages from #1087 record the findings:
`pattern-spec-procedure-executed-from-summary` and `pattern-audit-gate-unrunnable-reads-as-defect`.

Current state, verified in the repository:

- `execute.md` step 7 tells the owner to write `.agro/tasks/<slug>/evidence.md` and commit the file with `git add -f`.
- The step 10 evidence gate checks the file with `[ ! -f ... ]` and `git ls-files --error-unmatch`.
- The step 10 PR-body template already carries four of the five answers: asked, built, diverged, and unverified.
- The PR-body template has no section for question 0, "Why this is better than not doing it".
- Four probes read `evidence.md`: `docs-20260901-followup-artifact-cited.sh`, `protected-path-deletion.sh`, `spec-ready-finalization.sh`, and `spec-single-owner.sh`.
- Fourteen skill and context files mention `evidence.md`. The issue counts 12.
- No probe checks that a completed task folder holds its required artifacts.
- Five of the twelve tracked task folders hold `simplicity-review.json`.
- `pr-acquire.sh:32` requests `closingIssuesReferences` in one `gh` call.
- `route-driver.sh:21` defines `fail()`, which publishes `AUDIT-FAIL`. `gate3_pr` calls `fail` for every non-zero exit.
- `audit-run.sh:187` accepts any verdict that matches `^[A-Z][A-Z0-9_-]{1,63}$`. `AUDIT-UNOBTAINABLE` matches.

Selected approach: move the five answers into the PR-body template and gate on the live PR body.
Retarget the four probes. Add one artifact probe with a grandfather list.
Add one version preflight in `pr-acquire.sh` and one verdict class in `route-driver.sh`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/spec/references/execute.md` | steps 5, 6, 7, 10; failure rows 7, 10; resume row 7 | Owns the evidence contract and the undraft gate |
| `.agro/skills/audit/references/reviewer-evidence-doc.md` | Path, tracked-file rule | States the evidence contract that step 7 follows |
| `.agro/skills/audit/references/implementation.md` | lines 297 and 333 | Names the owner of the evidence |
| `.agro/skills/audit/references/pr.md` | line 9 | Names the evidence location for an orchestrating caller |
| `.agro/skills/spec/SKILL.md` | lines 58, 103, 223 | Lists the task folder files and the pipeline |
| `.agro/skills/spec/templates/task-prompt.md` | lines 15 and 71 | Assigns the evidence to the owner |
| `.agro/skills/spec/references/retro.md`, `.agro/skills/retro/SKILL.md`, `.agro/skills/wiki/references/compile.md` | evidence inputs | Read the evidence as a retro input |
| `.agro/skills/supervisor/SKILL.md`, `.agro/skills/escalate/SKILL.md`, `.agro/skills/wiki/references/schema.md` | evidence mentions | Name `evidence.md` as a destination or a pin example |
| `.agro/logs/AGENTS.md`, `.agro/memories/AGENTS.md` | ownership lines | Name `evidence.md` as the owner of task evidence |
| `.agro/evals/probes/spec-ready-finalization.sh` | lines 46-55, 98 | Guards the evidence gate |
| `.agro/evals/probes/spec-single-owner.sh` | line 35 | Guards evidence ownership |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | lines 25-61 | Guards the follow-up citation rule |
| `.agro/evals/probes/protected-path-deletion.sh` | lines 42-87 | Reads deletion justifications |
| `.agro/skills/audit/scripts/pr-acquire.sh` | line 32 `fields` | Requests `closingIssuesReferences` |
| `.agro/skills/audit/scripts/route-driver.sh` | `fail()` line 21, `gate3_pr` lines 70-81 | Maps a helper exit to a gate verdict |
| `.agro/skills/audit/scripts/implementation-gates.sh` | `classify-pr`, `browser-required` | Pipes `pr-acquire.sh` into `pr-classify.sh`; detects UI tasks |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PR body written by `/spec execute` | Modified | Adds a question-0 section; becomes the only evidence location |
| `.agro/tasks/<slug>/evidence.md` | Removed from the contract | New builds write no `evidence.md` |
| `pr-acquire.sh` exit status | Added | Adds `<unobtainable exit code>` for an old `gh` |
| `/audit implementation` verdict | Added | Adds `AUDIT-UNOBTAINABLE` beside `AUDIT-PASS` and `AUDIT-FAIL` |
| `route-driver.sh` gate line | Added | Adds `gate3: UNOBTAINABLE (<reason>)` |
| `.agro/evals/probes/spec-task-artifacts-complete.sh` | Added | New tier-A probe |

## Storage

The evidence moves from a gitignored file to the GitHub PR description.
GitHub keeps the edit history of the description.
The artifact probe reads tracked files under `.agro/tasks/<slug>/` and writes nothing.
The twelve tracked `evidence.md` files stay in place as history. Wiki source pins reference them by commit.

## Architectural Decisions

- The PR body is the one source of truth for the five evidence answers.
- The evidence gate reads the live PR body, so the gate needs `gh` and network access at step 10. Step 10 already calls `gh pr view` and `gh pr ready`.
- `execute.md` stays the source of truth for the required artifact names. The probe fails when a name that the probe requires disappears from `execute.md`.
- A gate that cannot run still blocks the undraft. `AUDIT-UNOBTAINABLE` exits non-zero and never permits a substitute classification.
- The version preflight lives in `pr-acquire.sh`, because every `/audit pr` and `/audit prs` route reads through that script.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/spec-ready-finalization.sh` | gate reads PR body; five headings present; no `git ls-files --error-unmatch` | US-001, US-002 |
| `.agro/evals/probes/spec-single-owner.sh` | task prompt assigns PR-body evidence to the owner | US-002 |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | PR-body contract requires a follow-up URL | US-002 |
| `.agro/evals/probes/protected-path-deletion.sh` | deletion justification found in the selected source | US-002 |
| `.agro/evals/probes/spec-task-artifacts-complete.sh` | red: complete fixture without `simplicity-review.json`; green: branch head | US-003 |
| `.agro/evals/probes/audit-pr-acquire.sh` | stub `gh` 2.45.0 gives the dedicated exit and the one-line reason | US-004 |
| `.agro/evals/probes/audit-implementation-behavior.sh` | stub `gh` 2.45.0 gives `gate3: UNOBTAINABLE` and `AUDIT-UNOBTAINABLE` | US-004 |
| `/eval` full suite | no new regression | all stories |

## Design Principles

- Keep one source of truth for each policy. The PR body owns the evidence, and `execute.md` owns the artifact list.
- Delete the obsolete path. Remove `evidence.md` from every instruction instead of keeping two locations.
- Fail closed. A tooling gap blocks the undraft and names its cause on one line.
- Absence is not an oracle. The artifact probe turns a missing file into a failed check.
- Change the canonical `.agro/` sources. Do not patch a `.claude/` mirror.
- Add no explanatory comments to tracked code.

## Out of Scope

- `knowledge-citation-symbol-liveness.sh`, which the issue tracks separately.
- A change to the gate 5 `netAdded` termination instrument.
- Deletion or rewrite of the twelve tracked historical `evidence.md` files.
- A split of the `pr-acquire.sh` field list into per-gate calls.
- A preflight for tools other than `gh`.
- A change to `mifunedev/agro-web`, unless Open Question 5 selects one.

## Open Questions

1. Which source replaces `evidence.md` for `protected-path-deletion.sh` justifications? The probe runs offline, so the probe cannot read a PR body. Proposed default: the body of the commit that deletes the path.
2. Which exit code does `pr-acquire.sh` use for an old `gh`? Proposed default: `69`, the `EX_UNAVAILABLE` code of `sysexits.h`.
3. Does the artifact probe use a grandfather list or a cutoff commit? Proposed default: an explicit slug list in the probe.
4. Does the artifact probe require a knowledge-impact artifact? `knowledge-impact.sh` writes no file today, so the probe cannot detect a skipped step 6. Proposed default: no new artifact in this task; the PR-body `## Knowledge impact` section carries the states.
5. Does `mifunedev/agro-web` document `evidence.md` or the audit verdicts? The answer decides whether a public-docs change is in scope.

## Acceptance Criteria

- [ ] `git grep -n 'evidence\.md' -- .agro/skills .agro/logs/AGENTS.md .agro/memories/AGENTS.md` prints no line that tells a session to write or read `evidence.md`.
- [ ] `.agro/evals/probes/spec-task-artifacts-complete.sh` exits 0 on the branch head and exits 1 on the red fixture.
- [ ] With a stub `gh` at version 2.45.0, `/audit implementation` prints `gate3: UNOBTAINABLE` and publishes `AUDIT-UNOBTAINABLE`.
- [ ] `/eval` reports no new regression on the branch head.
- [ ] The provider link check reports no broken `.claude/` symlink.

## Lessons

Filled by the advisor before undraft.
