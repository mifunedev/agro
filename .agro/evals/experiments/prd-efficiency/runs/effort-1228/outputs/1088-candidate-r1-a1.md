# PRD: Retire the task evidence file and close two gate gaps

Status: DRAFT

## User Stories

### US-001: Move the five evidence questions into the PR-body contract

**Description:** As a reviewer, I want the implementation's answer back to the plan in the PR description. Then the answer has a versioned history in GitHub and cannot drop out of the diff.

**Acceptance Criteria:**

- [ ] `.agro/skills/spec/references/execute.md` step 7 names the PR body as the home of the five questions (0 to 4) and names no `evidence.md` path.
- [ ] The step 10 evidence gate reads the body with `gh pr view <PR> --json body` and refuses the undraft when a question heading is absent.
- [ ] The step 10 evidence gate contains no `git ls-files --error-unmatch` call.
- [ ] `.agro/skills/audit/references/reviewer-evidence-doc.md` states the PR body as the path of the contract.
- [ ] `.github/pull_request_template.md` carries one heading for each of the five questions.
- [ ] `.agro/evals/probes/spec-ready-finalization.sh` asserts the PR-body gate. The probe exits 0 on the new `execute.md` and exits 1 on the current `execute.md`.

### US-002: Remove `evidence.md` from probes, skills, and docs

**Description:** As an implementation owner, I want one evidence location so that no procedure asks me to write a file that no gate reads.

**Acceptance Criteria:**

- [ ] `git grep -n 'evidence\.md' -- ':!.agro/tasks/' ':!.agro/evals/decisions/' ':!.agro/knowledge/' ':!CHANGELOG.md' ':!.agro/evals/RESULTS.md'` prints no line.
- [ ] `protected-path-deletion.sh` reads each deletion justification from the PR body or from `progress.txt`. The choice follows Open Question 1.
- [ ] `docs-20260901-followup-artifact-cited.sh` checks the follow-up rule against the PR-body contract. The probe exits 0.
- [ ] `spec-single-owner.sh` asserts that the task prompt tells the owner to write the PR body. The probe exits 0.
- [ ] `.agro/tasks/README.md` lists no `evidence.md` row.

### US-003: Add a probe for task-folder artifact completeness

**Description:** As an operator, I want a probe that fails when a completed task folder lacks a required artifact. Then a skipped procedure step becomes a red oracle and not a silent absence.

**Acceptance Criteria:**

- [ ] The new probe `.agro/evals/probes/task-folder-artifacts-complete.sh` treats a tracked task folder as complete when every `userStories[].passes` in `prd.json` is `true`.
- [ ] The probe requires each artifact that `execute.md` requires: `prd.md`, `prd.json`, `progress.txt`, `eval-result.json`, `simplicity-review.json`, and `simplify-rounds.json`.
- [ ] Red test: the probe prints `REGRESSION` and exits 1 on a fixture folder that copies the #1086 state, with `simplicity-review.json` and `simplify-rounds.json` absent.
- [ ] The probe exits 0 on the repository after US-001 and US-002 land, or each exempt folder appears in a list that the probe reads. The exemption rule follows Open Question 2.
- [ ] The probe skips `.agro/tasks/archive/`.

### US-004: Give the audit driver a tooling-blocked signal

**Description:** As an operator, I want the audit driver to separate a tooling gap from a PR defect. Then an unrunnable gate does not read as a failed gate.

**Acceptance Criteria:**

- [ ] Red test: with a stub `gh` that rejects the `closingIssuesReferences` field, `route-driver.sh` gate 3 prints `gate3: BLOCKED (tooling: <cause>)` and prints no `gate3: FAIL` line.
- [ ] The driver keeps a fail-closed result for a tooling block: the audit is not promotable.
- [ ] The driver exit status for a tooling block differs from the exit status for `FAIL`. The value follows Open Question 3.
- [ ] A real classification failure still prints `gate3: FAIL (<reason>)`.
- [ ] `.agro/evals/probes/audit-run-root-contract.sh` covers the stub case and exits 0.
- [ ] `.agro/skills/audit/references/implementation.md` documents the `BLOCKED` signal.

## Summary

Issue #1088 reports three findings from the `agro-workspace-verb` build (#1086).

Verified current state:

- `execute.md:502` (step 7) makes the owner write `.agro/tasks/<slug>/evidence.md`. `execute.md:602-621` gates the undraft on the file and on `git ls-files --error-unmatch`, because `.agro/tasks/` is gitignored.
- `execute.md:623-626` already copies the narrative into the PR body. The PR body is therefore a second copy of the evidence.
- `git grep` finds `evidence.md` in 4 probes: `spec-ready-finalization.sh`, `protected-path-deletion.sh`, `docs-20260901-followup-artifact-cited.sh`, `spec-single-owner.sh`.
- No probe checks a completed task folder for `simplicity-review.json` or `simplify-rounds.json`. `.agro/tasks/README.md` lists both files.
- `pr-acquire.sh` requests `closingIssuesReferences` in its `fields` list. `route-driver.sh:70-82` (`gate3_pr`) maps every classification exit to `gate3: FAIL (classification exited $rc)`.

Approach: make the PR body the single evidence location. Delete the file and its tracked-state check. Add one completeness probe. Add a `BLOCKED` line to gate 3.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/spec/references/execute.md` | steps 7 and 10, halt table rows 7 and 10, idempotency row 7, finalization contract | Evidence contract and undraft gate |
| `.agro/skills/audit/references/reviewer-evidence-doc.md` | Path, tracked-state rule | Evidence contract detail |
| `.github/pull_request_template.md` | headings | PR-body shape |
| `.agro/evals/probes/spec-ready-finalization.sh` | lines 46-55, 98 | Guards the undraft gate |
| `.agro/evals/probes/protected-path-deletion.sh` | `evidence_files` | Deletion justification source |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | tracked-file loop | Follow-up citation rule |
| `.agro/evals/probes/spec-single-owner.sh` | `in_prompt` line 35 | Task prompt ownership |
| `.agro/skills/spec/templates/task-prompt.md` | lines 15, 71 | Owner instructions |
| `.agro/skills/spec/SKILL.md`, `spec/references/retro.md`, `audit/references/implementation.md`, `audit/references/pr.md`, `escalate/SKILL.md`, `retro/SKILL.md`, `supervisor/SKILL.md`, `wiki/references/schema.md`, `wiki/references/compile.md`, `.agro/logs/AGENTS.md`, `.agro/memories/AGENTS.md`, `.agro/tasks/README.md` | `evidence.md` references | Documentation to update |
| `.agro/skills/audit/scripts/route-driver.sh` | `gate3_pr`, `fail` | Gate 3 result |
| `.agro/skills/audit/scripts/implementation-gates.sh` | `classify-pr` | Source of the classification exit |
| `.agro/skills/audit/scripts/pr-acquire.sh` | `fields` | Requests `closingIssuesReferences` |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PR body | Contract change | Carries the five evidence questions |
| `route-driver.sh` output | New line | `gate3: BLOCKED (tooling: <cause>)` |
| `route-driver.sh` exit status | New value | `<blocked exit code>` for a tooling block |
| Task folder | Removed file | `evidence.md` |

## Storage

The PR description in GitHub stores the evidence. The change removes one gitignored file. No schema changes.

## Architectural Decisions

- The PR body is the single source of truth for the evidence. The task folder keeps the machine records.
- A tooling block stays fail-closed. The driver changes the label and the exit status, not the promotable result.
- The completeness probe reads the required list from one array in the probe. `execute.md` stays the owner of the requirement.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/spec-ready-finalization.sh` | PR-body gate present; no `git ls-files` gate | US-001 |
| `.agro/evals/probes/protected-path-deletion.sh` | justification read from the new source | US-002 |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | follow-up rule in PR-body contract | US-002 |
| `.agro/evals/probes/spec-single-owner.sh` | task prompt names the PR body | US-002 |
| `.agro/evals/probes/task-folder-artifacts-complete.sh` | #1086-shaped fixture is red; repository is green | US-003 |
| `.agro/evals/probes/audit-run-root-contract.sh` | stub `gh` gives `BLOCKED`; real failure gives `FAIL` | US-004 |

Run `bash .agro/skills/eval/run.sh` for the full suite. The run must show no green-to-red transition.

## Design Principles

- Keep one source of truth for each policy (AGENTS.md, Taste).
- Delete obsolete paths. Leave no dormant `evidence.md` alternative.
- Absence is not an oracle. Each required artifact gets a probe.
- A gate that cannot run reports that state by name.

## Out of Scope

- `knowledge-citation-symbol-liveness.sh`. A separate issue tracks the probe.
- Gate 5 and its `netAdded` termination instrument.
- Edits to archived task folders and to existing `evidence.md` files in active task folders.
- A `gh` version upgrade on the operator host.

## Open Questions

1. Which source holds a protected-path deletion justification after the change?
   A. The PR body, read with `gh pr view` (the probe needs network access).
   B. `progress.txt` in the task folder (the probe stays offline).
2. Which active task folders predate the new probe and lack an artifact? Choose one rule.
   A. Exempt folders by a list in the probe.
   B. Require only folders created after this change.
3. Which exit status does the driver use for a tooling block? The value is `<blocked exit code>` until the operator decides.
4. Which `gh` failures count as a tooling gap? Candidates: an unknown JSON field, a missing `gh` binary, a failed `gh auth status`.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` exits 0 with no green-to-red transition.
- [ ] `git grep -n 'evidence\.md'` returns matches only under the exclusions in US-002.
- [ ] Each affected surface in AGENTS.md is marked applied or not applicable in the PR body. The `mifunedev/agro-web` check is recorded.

## Lessons

Filled by the advisor before undraft.
