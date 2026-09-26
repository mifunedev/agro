# PRD: Retire the task evidence file and close two gate gaps

Status: DRAFT

Source: `work/issue-1088.md` (issue #1088).

## User Stories

### US-001: Move the reviewer evidence contract into the PR body

**Description:** As a reviewer, I want the implementation's answer back to the plan in the PR description. Then I read the evidence where I already review. GitHub keeps the edit history, and no gitignored file can drop out of the diff.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/reviewer-evidence-doc.md` defines the evidence as a PR-body contract. The contract keeps the five questions (0 to 4) in their current order, the observed-output rule, the `AUDIT_RUN_ID` correlation rule, the honesty rule, and the rule `Follow-ups are cited, not named`.
- [ ] `.agro/skills/audit/references/reviewer-evidence-doc.md` contains no instruction to write, add, or commit `evidence.md`, and contains no `git add -f` instruction.
- [ ] The PR-body template in step 10 of `.agro/skills/spec/references/execute.md` carries one heading for each of the five questions, the Knowledge impact table, and the audit run id. The template no longer links `.agro/tasks/<slug>/evidence.md`.
- [ ] The step 10 evidence gate in `execute.md` reads the PR body with `gh pr view <PR> --repo "$SPEC_REPO" --json body` and refuses the undraft when a required heading is absent. The gate contains no `git ls-files --error-unmatch` command.
- [ ] Step 7, the halt table, the idempotency table, and the finalization contract in `execute.md` name the PR body as the evidence location. `grep -c 'evidence\.md' .agro/skills/spec/references/execute.md` prints `0`.
- [ ] `.agro/skills/spec/templates/task-prompt.md`, `.agro/skills/spec/SKILL.md`, and `.agro/tasks/README.md` name the PR body as the evidence location. `grep -c 'evidence\.md'` prints `0` for each of the three files.

### US-002: Remove the remaining evidence-file references from skills and guides

**Description:** As an application agent, I want one evidence location in every skill and guide. Then no procedure tells me to write a file that no gate reads.

**Acceptance Criteria:**

- [ ] `grep -c 'evidence\.md'` prints `0` for each of these files: `.agro/skills/spec/references/retro.md`, `.agro/skills/retro/SKILL.md`, `.agro/skills/wiki/references/compile.md`, `.agro/skills/audit/references/pr.md`, `.agro/skills/audit/references/implementation.md`, `.agro/skills/escalate/SKILL.md`, `.agro/skills/supervisor/SKILL.md`, `.agro/memories/AGENTS.md`, `.agro/logs/AGENTS.md`.
- [ ] `.agro/skills/wiki/references/schema.md` keeps a valid pinned-evidence example. The example names a task file that the procedure still writes, for example `.agro/tasks/<slug>/progress.txt@<sha>`.
- [ ] `/retro --task <slug>` and `/wiki compile --task <slug>` read the PR body through `gh pr view` as the corroborating evidence source in place of `evidence.md`.
- [ ] The change edits no file under `.agro/knowledge/`, no file under `.agro/tasks/archive/`, no existing `.agro/tasks/<slug>/evidence.md`, no released `CHANGELOG.md` entry, and no existing entry in `.agro/evals/decisions/skill-impact.md`.

### US-003: Rebase the four evidence probes on the new evidence locations

**Description:** As the operator, I want each probe that reads `evidence.md` to read a new evidence location. Then each probe still guards its original lesson after the file retires.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/spec-ready-finalization.sh` requires the PR-body evidence gate in the `Promotable gate` section. The probe reports `REGRESSION` when that section contains `evidence.md` or `git ls-files --error-unmatch`.
- [ ] `.agro/evals/probes/spec-single-owner.sh` checks for the task-prompt token that assigns PR-body evidence ownership to the single implementation owner, in place of `write and commit \`evidence.md\``.
- [ ] `.agro/evals/probes/protected-path-deletion.sh` reads each justification from the commit messages in `$BASE..HEAD` (`git log --format=%B "$BASE"..HEAD`). The probe no longer reads `evidence.md`. The REGRESSION message tells the author to name the path in a commit message on the branch.
- [ ] A fixture run of `protected-path-deletion.sh` in a temporary git repository exits 1 when a branch deletes a protected path with no commit-message justification, and exits 0 when a commit message on the branch names the path.
- [ ] `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` checks the follow-up citation rule in the PR-body contract. The probe no longer reads tracked `evidence.md` files, and its `# desc:` line states that the probe guards the contract text.
- [ ] `bash .agro/skills/eval/run.sh` reports `PASS` for all four probes on the branch HEAD.

### US-004: Add a probe that checks a completed task folder for its required artifacts

**Description:** As the operator, I want a probe that fails when a completed task folder lacks a required artifact. Then a skipped gate leaves a red probe, not a silent absence.

**Acceptance Criteria:**

- [ ] A new probe `.agro/evals/probes/spec-task-artifacts-complete.sh` carries the `# tier:`, `# source:`, and `# desc:` header lines. The `# source:` line names `pattern-spec-procedure-executed-from-summary`.
- [ ] The probe selects each non-archive task folder that `git diff --name-only "$BASE"..HEAD` touches and whose `prd.json` satisfies `jq -e 'all(.userStories[]; .passes == true)'`.
- [ ] For each selected folder, the probe requires these files tracked at HEAD: `prd.md`, `prd.json`, `progress.txt`, `simplicity-review.json`. The probe also requires `ui-evidence.json` when `implementation-gates.sh browser-required <slug>` exits 0.
- [ ] Each REGRESSION line names the slug, the missing file, and the `execute.md` step that produces the file.
- [ ] The probe exits 2 with `SKIPPED` when the branch touches no completed task folder.
- [ ] A fixture run in a temporary git repository exits 1 for a completed folder without `simplicity-review.json`, and exits 0 when the folder carries every required file.
- [ ] Step 5 of `execute.md` orders the simplicity review before the `/eval` run, so that the single suite run in the cycle sees the review on disk.

### US-005: Give the audit driver a distinct tooling-blocked verdict

**Description:** As the operator, I want an unrunnable audit gate to report a tooling gap, not a defect. Then I upgrade `gh` instead of changing the PR, and no hand-rolled substitute replaces the gate.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/scripts/route-driver.sh` runs a preflight before gate 1 for the `implementation` route with `--pr`, and before classification for the `pr` route. The preflight compares `gh --version` with the minimum version that `pr-acquire.sh` needs.
- [ ] When `gh` is absent or older than the minimum, the driver prints one line in the form `preflight: UNOBTAINABLE (gh <observed> < <required> required for closingIssuesReferences)`.
- [ ] After that line, the `implementation` route publishes `AUDIT-UNOBTAINABLE`, and the `pr` route publishes `PR-AUDIT-UNOBTAINABLE`. Neither route publishes `AUDIT-FAIL` or `PR-AUDIT-UNKNOWN` for this cause.
- [ ] The verdict tables in `.agro/skills/audit/scripts/audit-run.sh`, `.agro/skills/audit/references/implementation.md`, and `.agro/skills/audit/references/pr.md` list the new tokens.
- [ ] Step 10 of `execute.md` treats both new tokens as blocking. On either token, the owner leaves the PR draft, records `DRAFT-BLOCKED(tooling)`, and runs no substitute classification.
- [ ] A fixture probe with a mock `gh` that reports version `2.45.0` observes `preflight: UNOBTAINABLE` and the verdict `AUDIT-UNOBTAINABLE`. The same probe with a mock at or above the minimum observes no preflight line.

## Summary

Issue #1088 carries three findings from the `agro-workspace-verb` build (#1086).

**Verified current state:**

- `.agro/skills/spec/references/execute.md:502-540` (step 7) writes `.agro/tasks/<slug>/evidence.md`. Step 10 (`execute.md:602-621`) refuses the undraft without the file and checks tracking with `git ls-files --error-unmatch`. Step 10 then copies most of the same sections into the PR body (`execute.md:629-656`). The evidence exists twice.
- `.agro/tasks/` is gitignored. `.agro/tasks/README.md:30-35` and `reviewer-evidence-doc.md` both warn that a file added without `-f` is absent from the PR diff.
- `grep -rln 'evidence\.md'` outside `.agro/knowledge/`, `.agro/tasks/archive/`, and `CHANGELOG.md` finds 4 probes, 15 skill or guide files, and the append-only `.agro/evals/decisions/skill-impact.md`. The issue counted 12 skill or doc files. The stories list the verified set.
- `route-driver.sh:70-82` (`gate3_pr`) maps every non-zero exit of `classify-pr` to `gate3: FAIL (classification exited <rc>)`. `route-driver.sh:163-174` (`pr_route`) maps the same exit to `PR-AUDIT-UNKNOWN`. The `UNKNOWN` token also covers incomplete PR data, so the token does not isolate a tooling gap.
- `pr-acquire.sh:32` requests `closingIssuesReferences` in one `gh` call. The pattern page records that `gh` 2.45.0 and 2.63.2 reject the field, and `gh` 2.101.0 accepts it.
- `implementation-gates.sh gate1` already checks `artifact_contract.required_artifacts` from `prd.json`. That check runs only when the audit runs. The #1086 build skipped the audit, so no gate saw the missing artifacts.
- `audit-evidence.sh:13` accepts any uppercase verdict token. The new tokens need no change to that script.

**Selected approach:**

1. Make the PR body the single evidence location.
2. Rebase the four probes on locations that they read offline.
3. Add one artifact-completeness probe scoped to the branch.
4. Add one `gh` version preflight to the audit driver.

**Affected surfaces:**

| Surface | Status |
|---|---|
| Host and sandbox | Applied. The change edits tracked `.agro/` files only. The application agent makes the edits in the sandbox. |
| Lifecycle door | Not applicable. No `agro` verb changes. |
| Canonical and provider surfaces | Applied. Edit only canonical `.agro/skills/` files. `.claude/skills/` mirrors resolve through symlinks. |
| Root and scaffold | Applied to both. The spec and audit skills ship to initialized projects. |
| Interactive and headless processes | Not applicable. No persistent process changes. |
| Local and remote operation | Applied. The preflight reports the same verdict on a local host and on a remote VM. |
| Parallel operation | Applied. The new probe reads only the branch's own task folders. |
| Public documentation | Not applicable, pending open question 5. `docs/` contains no `evidence.md` reference. |
| Verification | Applied. See the test plan. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/audit/references/reviewer-evidence-doc.md` | Contract, five questions, Shape | Evidence contract; becomes the PR-body contract |
| `.agro/skills/spec/references/execute.md` | Steps 5, 6, 7, 10; halt, idempotency, finalization tables | Build procedure; evidence gate moves to the PR body |
| `.agro/skills/spec/templates/task-prompt.md` | Evidence ownership lines 15 and 71 | Task prompt the owner receives |
| `.agro/skills/spec/SKILL.md` | Pipeline diagram line 58, folder tree line 103, line 223 | Dispatcher description of the task folder |
| `.agro/tasks/README.md` | Artifact table, `git add -f` convention | Task folder guide |
| `.agro/skills/audit/scripts/route-driver.sh` | `gate3_pr`, `pr_route`, `implementation`, new preflight | Scripted audit driver |
| `.agro/skills/audit/scripts/pr-acquire.sh` | `fields` at line 32 | Source of the `gh` version requirement |
| `.agro/skills/audit/scripts/audit-run.sh` | Verdict table lines 15-16 | Verdict token reference |
| `.agro/evals/probes/spec-ready-finalization.sh` | Evidence gate checks, lines 46-57 | Probe over the undraft gate |
| `.agro/evals/probes/spec-single-owner.sh` | `in_prompt` evidence token, line 35 | Probe over owner responsibilities |
| `.agro/evals/probes/protected-path-deletion.sh` | `evidence_files`, `justified` | Probe over protected-path deletions |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | Data half, lines 25-53 | Probe over follow-up citations |
| `.agro/skills/audit/scripts/implementation-gates.sh` | `browser-required` | Condition for `ui-evidence.json` in the new probe |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PR body written by `/spec execute` | Modified | Carries the five evidence sections, the Knowledge impact table, and the audit run id. Becomes the only evidence location. |
| `.agro/tasks/<slug>/evidence.md` | Removed | The procedure no longer writes the file. Existing tracked copies stay as history. |
| `/audit implementation` verdict | Added token | `AUDIT-UNOBTAINABLE` |
| `/audit pr` verdict | Added token | `PR-AUDIT-UNOBTAINABLE` |
| Route driver output | Added line | `preflight: UNOBTAINABLE (gh <observed> < <required> required for closingIssuesReferences)` |
| `/spec execute` terminal state | Added gate name | `DRAFT-BLOCKED(tooling)` |
| Protected-path justification | Moved | From `evidence.md` to a commit message on the branch |
| Probe suite | Added probe | `spec-task-artifacts-complete.sh` |

## Storage

The PR description on GitHub stores the evidence. GitHub keeps the edit history of the description.

Commit messages on the branch store protected-path justifications. `git log` reads the messages offline, and the merge commit keeps them.

The task folder keeps its JSON records (`eval-result.json`, `simplicity-review.json`, `simplify-rounds.json`, `ui-evidence.json`) and `progress.txt`. Those files still need `git add -f`. This task does not change that convention.

## Architectural Decisions

1. **One evidence location.** The PR body is the source of truth for the answer back to the plan. `reviewer-evidence-doc.md` stays the one contract for the body's content. `execute.md` step 10 holds the one template.
2. **Offline probes stay offline.** No probe calls `gh`. The protected-path probe moves to commit messages because `git log` answers offline and deterministically. The follow-up citation probe keeps only its contract-text half. The PR-body data check is open question 3.
3. **The artifact probe reads run artifacts, not rule text.** The probe checks files that a run produces, per `pattern-evals-document-conformance-proxy-oracle`. The probe scopes to task folders that the branch touches. That scope keeps older completed folders that predate `simplicity-review.json` out of the check.
4. **The artifact probe excludes files that the eval run writes.** The single `/eval` run writes `eval-result.json` after the probe runs. A requirement on that file makes the probe red on every build. Audit gate 2 already covers the file.
5. **The tooling verdict still blocks.** `AUDIT-UNOBTAINABLE` and `PR-AUDIT-UNOBTAINABLE` fail closed. The verdicts differ from `FAIL` only in cause. The owner never answers them with a hand-rolled classification.
6. **The preflight runs once, at the top.** A version skew prints one line before any gate runs. The skew does not appear as a per-gate failure.
7. **Existing evidence files stay.** Tracked `evidence.md` files in live and archived task folders are history. Knowledge pages cite them by pinned commit (`@<sha>`), so the citations stay valid.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/spec-ready-finalization.sh` | Section requires the PR-body evidence gate; `evidence.md` or `git ls-files --error-unmatch` in the section reports REGRESSION | US-001, US-003 |
| `.agro/evals/probes/spec-single-owner.sh` | Task prompt assigns PR-body evidence ownership to the owner | US-001, US-003 |
| `.agro/evals/probes/protected-path-deletion.sh` | Real branch: PASS. Fixture repo: unjustified deletion exits 1; commit-message justification exits 0 | US-003 |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | Contract text carries the follow-up citation rule | US-003 |
| `.agro/evals/probes/spec-task-artifacts-complete.sh` | Fixture: completed folder without `simplicity-review.json` exits 1; complete folder exits 0; no touched completed folder exits 2; browser-required folder without `ui-evidence.json` exits 1 | US-004 |
| `<new or extended audit fixture probe>` | Mock `gh` 2.45.0: `preflight: UNOBTAINABLE` and `AUDIT-UNOBTAINABLE`; mock `gh` at the minimum: no preflight line; `pr` route with old `gh`: `PR-AUDIT-UNOBTAINABLE` | US-005 |
| `bash .agro/skills/eval/run.sh` | Full suite on the branch HEAD | All stories; no new green-to-red transition |
| `bash .agro/skills/ste/scripts/ste-check.sh <each edited Markdown file>` | STE checker | Prose standard for edited guides |

Write each fixture case first and observe the expected red before the implementation change.

## Design Principles

- Keep one source of truth for each policy. The evidence lives in one place.
- Delete the obsolete path. Do not keep `evidence.md` as a dormant alternative.
- Put the oracle on the artifact that a run produces, not on the text of the rule.
- Fail closed, and name the cause. A tooling gap and a defect get different verdicts, and both block.
- Keep probes deterministic and offline.
- Edit canonical `.agro/` sources only. Add no explanatory comments to tracked code.
- Apply `/ste` to every edited guide and to the PR body.

## Out of Scope

- `knowledge-citation-symbol-liveness.sh`, the fourth candidate from `pattern-wiki-verified-at-advanced-over-unread-citations`. Another issue tracks it.
- A change to the gate 5 `netAdded` termination instrument.
- A rewrite of existing tracked `evidence.md` files, knowledge pages, archived task folders, released `CHANGELOG.md` entries, or existing `skill-impact.md` entries.
- A split of `pr-acquire.sh` into per-field `gh` calls. See open question 4.
- A probe that proves `knowledge-impact.sh` ran. The script writes no file artifact that a probe reads.

## Open Questions

1. **Minimum `gh` version.** The pattern page records that 2.101.0 accepts `closingIssuesReferences` and that 2.63.2 rejects it. Nobody has verified the first accepting release. The plan uses 2.101.0 as `<required>` until the operator confirms `<first gh release with closingIssuesReferences>`.
2. **`simplify-rounds.json` as a required artifact.** The issue lists the file as absent in #1086. `execute.md:378-396` writes the file only after an `AUDIT-FAIL (gate 5)`, and `route-driver.sh:137` reads the file only when present. Choose one:
   - A. Keep the file optional in the new probe, as the driver does.
   - B. Make the owner write a round-0 record on every build, and require the file in the probe.
   - The stories assume A.
3. **PR-body data checks.** The follow-up citation probe loses its data half. Choose one:
   - A. Accept the contract-text check only.
   - B. Add a flag in `pr-classify.sh` that reports a PR body without the five evidence headings or with an uncited follow-up, since `pr-acquire.sh` already fetches `body`.
   - The stories assume A.
4. **Degrade one field in place of one route.** The pattern page recommends a separate `gh` call for `closingIssuesReferences`, so an old `gh` degrades one field. `pr-classify.sh` `refs` already scans the title and body for `#N`. Choose one:
   - A. Keep the single call and the preflight only.
   - B. Also move the field into a separate call.
   - The stories assume A.
5. **Public documentation.** Confirm that `mifunedev/agro-web` describes neither `evidence.md` nor the audit verdict tokens. If the site describes either, add a matching change there.

## Acceptance Criteria

- [ ] `grep -rln 'evidence\.md' .agro/skills .agro/evals/probes .agro/tasks/README.md .agro/memories .agro/logs` prints no path.
- [ ] `bash .agro/skills/eval/run.sh` exits 0 on the branch HEAD and reports no new green-to-red transition.
- [ ] `spec-task-artifacts-complete.sh` reports `PASS` or `SKIPPED` on the branch HEAD. The fixture case without `simplicity-review.json` reports `REGRESSION`.
- [ ] The route driver with a mock `gh` 2.45.0 publishes `AUDIT-UNOBTAINABLE`, and `execute.md` step 10 maps that verdict to `DRAFT-BLOCKED(tooling)`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 for `reviewer-evidence-doc.md` and for every other Markdown file that the change rewrites in full.
- [ ] `CHANGELOG.md` carries one new entry for the change, in the form that `.agro/skills/git/SKILL.md` requires.

## Lessons

Filled by the advisor before undraft.
