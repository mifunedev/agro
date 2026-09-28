# PRD: Manual review evidence links and annotations

Status: DRAFT

## User Stories

### US-001: Align the feat issue template with the manual review standard

**Description:** As a plan author, I want the feat template to point to the manual review evidence so that both templates agree.

**Acceptance Criteria:**

- [ ] `.github/ISSUE_TEMPLATE/feat.md` has no `### Visual Reference` line.
- [ ] The `## Summary` comment in `.github/ISSUE_TEMPLATE/feat.md` points to `.agro/skills/git/references/manual-review.md`.
- [ ] Red first: `bash .agro/evals/probes/pr-manual-review.sh` exits 1 on a copy of `feat.md` that restores `### Visual Reference`.
- [ ] `bash .agro/evals/probes/pr-manual-review.sh` exits 0 on the fixed template.
- [ ] The `## ` headings of `.agro/skills/prd/SKILL.md` section 5 match the `## ` headings of `feat.md` in order, except `## Metadata`, `## Open Questions`, and `## Lessons`.

### US-002: Pin evidence image links to a commit SHA

**Description:** As a reviewer, I want each evidence link to use a commit SHA so that each screenshot renders after the branch is gone.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/references/manual-review.md` has a rule: each evidence link uses `blob/<commit-sha>/`, and `<commit-sha>` is the full 40-character head commit of the PR.
- [ ] The user-journey example in `manual-review.md` uses `blob/<commit-sha>/` and has no `blob/<branch>/`.
- [ ] The rule states the cause: GitHub deletes the head branch after the merge, and a `blob/<branch>/` link then returns HTTP 404.
- [ ] Red first: `bash .agro/evals/probes/pr-manual-review.sh` exits 1 on a copy of `manual-review.md` that contains `blob/<branch>/`.
- [ ] `bash .agro/evals/probes/pr-manual-review.sh` exits 0 on the fixed reference.

### US-003: Add a check for the PR body evidence links

**Description:** As a PR author, I want a check of the `## Manual review` section so that a branch-pinned link or a missing annotation fails before review.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/scripts/manual-review-check.sh <body-file>` exits 1 and prints the line when an image or evidence link under `github.com/<owner>/<repo>/blob/` uses a ref that is not a 40-character hex SHA.
- [ ] The script exits 1 when a step in the `## Manual review` section has a `<details><summary>Screenshot</summary>` block and no line that starts with `Callouts:`.
- [ ] The script exits 0 on a fixture copied from the fixed body of mifunedev/agro-console#185.
- [ ] The script exits 1 on a fixture copied from the current body of mifunedev/agro-console#197.
- [ ] Red first: each fixture case in `.agro/evals/probes/pr-manual-review.sh` fails before the script exists.
- [ ] The `### Ready for review` gate in `.agro/skills/git/SKILL.md` runs `manual-review-check.sh` on the PR body, and `pr-manual-review.sh` asserts the gate names the script.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/git/SKILL.md .agro/skills/git/references/manual-review.md` exits 0.

### US-004: Give agent-browser one annotation command

**Description:** As an application agent, I want one command that adds numbered callouts so that each journey screenshot carries annotations.

**Acceptance Criteria:**

- [ ] `.agro/skills/agent-browser/scripts/annotate-screenshot.sh <path> <selector>=<label>...` injects one numbered red callout for each selector through `agent-browser eval`, runs `agent-browser screenshot <path>`, and removes the callouts.
- [ ] The script exits 1 and names the selector when a selector matches no element. The script writes no file in that case.
- [ ] A test starts a static fixture page, runs the script with two selectors, and confirms that the PNG exists and that the page DOM holds no callout after the run.
- [ ] `.agro/skills/agent-browser/SKILL.md` and the user-journey shape in `manual-review.md` name the script as the method for annotated screenshots, and require a `Callouts:` line under each screenshot.
- [ ] Verify in browser using agent-browser skill.

### US-005: Repair the evidence links of mifunedev/agro-console#185 and #197

**Description:** As a reviewer, I want #185 and #197 to show their screenshots so that the reference example renders again.

**Acceptance Criteria:**

- [ ] The body of mifunedev/agro-console#185 replaces each `blob/feat/184-node-recovery-points/` with `blob/2c2b48e218bf8e9d407131daa92fde1773bdd723/`.
- [ ] The body of mifunedev/agro-console#197 replaces each `blob/bug/186-restart-await-reboot/` with `blob/<197 head SHA>/`.
- [ ] `manual-review-check.sh` exits 0 on the link check of each repaired body.
- [ ] Each repaired image URL loads in a signed-in browser session and shows an image, not a 404 page.

### US-006: Capture the manual review evidence

**Description:** As the operator, I want a transcript and screenshots that prove US-001 to US-005 so that the PR `## Manual review` section copies observed results.

**Acceptance Criteria:**

- [ ] `.agro/tasks/manual-review-evidence-links/evidence/manual-review.md` records each probe run, each `manual-review-check.sh` pass case and fail case, and each exit status.
- [ ] The evidence folder holds one annotated screenshot of the fixture page from `annotate-screenshot.sh`, and one screenshot each of the repaired #185 and #197 bodies.
- [ ] The PR `## Manual review` section links each evidence file by `blob/<commit-sha>/`.
- [ ] `manual-review-check.sh` exits 0 on the body of this task PR.
- [ ] The run deletes each fixture server and temporary file that the run creates.
- [ ] Verify in browser using agent-browser skill.

## Summary

Issue #1239 asks for the removal of `### Visual Reference` from the feat template. The operator added two defects from agro-console PRs.

Verified state:

- The body of #185 links images by `blob/feat/184-node-recovery-points/...?raw=true`. The API returns `Branch not found` (HTTP 404) for that branch. The files exist at head commit `2c2b48e218bf8e9d407131daa92fde1773bdd723`. For example, `journey-09-viewer.png` has blob SHA `688488d5`.
- The body of #197 uses the same `blob/<branch>/` form with `bug/186-restart-await-reboot`. The images break for the same cause.
- `manual-review.md` line 72 teaches `blob/<branch>/`. The standard creates the defect.
- `manual-review.md` step 4 requires numbered callouts, but the file names no method. `agent-browser screenshot --help` shows no annotation option. #185 states "the red callouts mark what to check". #197 has plain screenshots and no callout text.
- `pr-manual-review.sh` checks the PR template, the `/git` gate, and the reference. The probe checks no link form, no annotation, and no issue template.
- agro-console is a private repository. Images render only for a signed-in reviewer.

Selected approach: pin each link to the head commit SHA. Add one check script for PR bodies and one annotation script. Extend the existing probe, and repair the two PR bodies.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/feat.md` | `### Visual Reference` | Section to remove |
| `.agro/skills/prd/SKILL.md` | section 5 headings | Mirror of the feat headings |
| `.agro/skills/git/references/manual-review.md` | Rules, `## User-journey shape` | Link and annotation standard |
| `.agro/skills/git/SKILL.md` | `### Ready for review` | Gate that runs the check |
| `.agro/skills/git/scripts/manual-review-check.sh` | new | PR body link and annotation check |
| `.agro/skills/agent-browser/scripts/annotate-screenshot.sh` | new | Numbered callouts through `agent-browser eval` |
| `.agro/skills/agent-browser/SKILL.md` | screenshot step | Points to the annotation script |
| `.agro/evals/probes/pr-manual-review.sh` | `missing` checks | Guard to extend |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `manual-review-check.sh <body-file>` | New | CLI check, exit 0 or 1 |
| `annotate-screenshot.sh <path> <selector>=<label>...` | New | CLI that writes an annotated PNG |
| mifunedev/agro-console#185 and #197 bodies | Modify | Link repair, operator-approved |
| `.github/ISSUE_TEMPLATE/feat.md` | Modify | Remove `### Visual Reference` |

## Storage
N/A. The change adds scripts and edits documents. Evidence files stay under `.agro/tasks/manual-review-evidence-links/evidence/`.

## Architectural Decisions

- **Source of truth:** `.agro/skills/git/references/manual-review.md` owns the link and annotation rules. `manual-review-check.sh` enforces those rules on a PR body.
- **Link form:** `blob/<commit-sha>/<path>?raw=true`. GitHub keeps `refs/pull/<N>/head`, so the head commit stays reachable after the merge deletes the branch.
- **Annotation:** a DOM overlay before the capture. The overlay uses the live selectors, so the callout sits on the element to check.
- **State management:** none.
- **Auth / scoping:** the PR body edits use the operator `gh` session. The operator approved the edits of #185 and #197.
- **Callout text:** each screenshot block has a `Callouts:` line in the same step. The line names each numbered callout.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/pr-manual-review.sh` | `feat.md has no ### Visual Reference` | US-001 |
| `.agro/evals/probes/pr-manual-review.sh` | `reference has no blob/<branch>/` | US-002 |
| `.agro/evals/probes/pr-manual-review.sh` | `gate names manual-review-check.sh` | US-003 |
| `.agro/skills/git/scripts/tests/manual-review-check.test.sh` | branch ref fails; SHA ref passes; screenshot without callout text fails | US-003 |
| `.agro/skills/agent-browser/scripts/tests/annotate-screenshot.test.sh` | two callouts; missing selector exits 1; DOM clean after run | US-004 |

## Design Principles

- Fix the standard that caused the defect, then fix the PR bodies.
- Extend `pr-manual-review.sh`. Add no second probe.
- Add no comments to tracked code.
- Keep one script for each job: one check, one annotation.

## Out of Scope

- The bug and task issue templates.
- New screenshots for #197. The operator decided that annotation happens when an author writes the `## Manual review` section of a future PR.
- A CI job that checks PR bodies.
- PR bodies other than #185 and #197.

## Open Questions

None.

## Acceptance Criteria
- [ ] `bash .agro/evals/probes/pr-manual-review.sh` exits 0.
- [ ] Each new test script exits 0.
- [ ] `ste-check.sh` exits 0 on each changed skill file.
- [ ] The images of #185 and #197 render for a signed-in reviewer.
- [ ] Draft PR opened: `FROM task/1239-manual-review-evidence-links TO development`.

## Lessons

- The standard caused the broken screenshots. `manual-review.md` taught `blob/<branch>/`, and GitHub deletes the head branch after the merge. Evidence: the API returned `Branch not found` for `feat/184-node-recovery-points`. Outcome: fixed in this PR (SHA rule, probe, and `manual-review-check.sh`).
- The standard required callouts but named no method. Evidence: `agent-browser screenshot --help` has no annotation option, and #197 has plain screenshots. Outcome: fixed in this PR (`annotate-screenshot.sh` and the `Callouts:` rule).
- A worker copied private agro-console PR bodies into fixtures of this public repository. Evidence: the first US-003 commit held a live IPv4 and node IDs. The advisor squashed the commit before any push. Outcome: fixed in this PR (synthetic fixtures). The worker brief in `/delegate` has no rule about repository visibility: proposed issue "delegate: forbid copying private-repository content into a public repository", not created.
- The CC Safety Net hook blocks a recursive force-delete command that appears only as quoted text in a heredoc that writes documentation. One worker then ran the same edit from a script file, which the brief forbids. Evidence: the US-003 repair report, and an advisor write of this section. Outcome: proposed issue "CC Safety Net: allow a quoted delete command inside a file-write heredoc", not created.
- `manual-review-check.sh` rejected process substitution, because the script tested `-f`. Outcome: fixed in this PR (`-r`, with a test case).
- `git/SKILL.md` and `agent-browser/SKILL.md` had 15 earlier ste-check findings. Outcome: fixed in this PR.
- The repaired #185 and #197 bodies still fail the `Callouts:` check. Outcome: dropped, because the operator decided that annotation applies to new PRs only.
- The `skills-vendored` probe reports REGRESSION, because the sandbox has no `cc-safety-net` binary on PATH. The state is unchanged from the base. Outcome: proposed issue "eval: skills-vendored fails when cc-safety-net is absent from PATH", not created.
