# PRD: Evidence in the PR body, and two gate gaps

Status: DRAFT

Source: the issue #1088 input file under the work directory. Base commit: `80b9342`.

## User Stories

### US-001: Move the five evidence questions into the PR-body contract

**Description:** As a reviewer, I want the answer back to the plan in the PR description so that I read the evidence where I review. GitHub keeps the history.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/references/reviewer-evidence-doc.md` names the PR body as the location of the five questions. The file contains no `evidence.md` path and no `git add -f` rule.
- [ ] The PR-body template in `.agro/skills/spec/references/execute.md` step 10 carries one heading per question, in this order: "Why this is better", "What the plan asked for", "What was built", "Where it diverged from the plan, and why", "What remains unverified".
- [ ] Step 7 of `.agro/skills/spec/references/execute.md` writes the five answers into the PR body with `gh pr edit`. Step 7 writes no file under `.agro/tasks/<slug>/`.
- [ ] The evidence gate in step 10 reads `gh pr view <PR> --json body` and refuses the undraft when one of the five headings is absent. The gate contains no `git ls-files --error-unmatch` command.
- [ ] The knowledge-impact states from step 6 go to the PR body "Knowledge impact" section. Step 6 records no state in a task-folder file.
- [ ] `git grep -n 'evidence\.md' -- .agro/skills/spec .agro/skills/audit` prints no line.

### US-002: Remove `evidence.md` from the remaining skills, docs, and probes

**Description:** As an implementation owner, I want one evidence location in every skill and probe so that no procedure asks for an unread file.

**Acceptance Criteria:**

- [ ] `git grep -n 'evidence\.md' -- .agro/skills .agro/evals/probes .agro/tasks/README.md .agro/logs/AGENTS.md .agro/memories/AGENTS.md` prints no line.
- [ ] Each of these files refers to the PR body instead of `evidence.md`: `.agro/skills/escalate/SKILL.md`, `.agro/skills/retro/SKILL.md`, `.agro/skills/supervisor/SKILL.md`, `.agro/skills/wiki/references/compile.md`, `.agro/skills/wiki/references/schema.md`, `.agro/skills/spec/SKILL.md`, `.agro/skills/spec/references/retro.md`, `.agro/skills/spec/templates/task-prompt.md`, `.agro/skills/audit/references/implementation.md`, `.agro/skills/audit/references/pr.md`, `.agro/tasks/README.md`, `.agro/logs/AGENTS.md`, `.agro/memories/AGENTS.md`.
- [ ] `bash .agro/evals/probes/spec-ready-finalization.sh` exits 0 and asserts the PR-body evidence gate. The probe exits 1 on a copy of `execute.md` whose step 10 drops the "What remains unverified" heading.
- [ ] `bash .agro/evals/probes/spec-single-owner.sh` exits 0 and asserts that the task prompt assigns the PR-body evidence to the owner.
- [ ] `bash .agro/evals/probes/docs-20260901-followup-artifact-cited.sh` exits 0 and asserts the follow-up citation rule in the PR-body contract. The probe no longer reads tracked task-folder files.
- [ ] `bash .agro/evals/probes/protected-path-deletion.sh` exits 0. The probe accepts a justification in the body of a commit in `BASE..HEAD` and no longer reads task-folder files.
- [ ] Pinned `sources:` entries of the form `.agro/tasks/<slug>/evidence.md@<sha>` in `.agro/knowledge/` stay unchanged.

### US-003: Probe that a completed task folder carries every required artifact

**Description:** As an operator, I want a probe for missing artifacts in a completed task folder so that a skipped gate has an oracle.

**Acceptance Criteria:**

- [ ] `.agro/skills/spec/references/execute.md` declares one list of required task artifacts. Each entry names the file and the condition that requires the file.
- [ ] New file `.agro/evals/probes/task-folder-required-artifacts.sh` reads that list from `execute.md`. The probe copies no artifact name into its own source.
- [ ] The probe checks each task folder that `BASE..HEAD` adds or changes and whose `prd.json` has every story at `passes: true`.
- [ ] On a fixture folder with all stories passing and no `simplicity-review.json`, the probe exits 1 and prints `REGRESSION` with the folder and the missing file.
- [ ] On a fixture folder with all required artifacts, the probe exits 0.
- [ ] When no completed task folder changes in `BASE..HEAD`, the probe exits 2 with `SKIPPED`.

### US-004: Preflight the `gh` version in PR acquisition

**Description:** As an operator, I want `pr-acquire.sh` to report an unsupported `gh` before any query so that a version gap is not a JSON dump.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/scripts/pr-acquire.sh` reads `gh --version` before the `gh pr` call. If the version is lower than 2.101.0, the script prints `UNOBTAINABLE: gh <observed> lacks closingIssuesReferences; requires >= 2.101.0` to stderr and exits 69.
- [ ] `bash .agro/evals/probes/audit-pr-acquire.sh` exits 0 with a mock `gh` that reports 2.101.0.
- [ ] The same probe asserts exit 69 and the `UNOBTAINABLE` line with a mock `gh` that reports 2.45.0. The mock records no `pr view` call in that case.

### US-005: Give the audit driver a tooling-blocked verdict

**Description:** As an operator, I want a distinct signal for a gate that cannot run so that I do not debug a sound PR.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/scripts/route-driver.sh` maps exit 69 from `classify-pr` in `gate3_pr` to `gate3: UNOBTAINABLE (<reason>)` and publishes `AUDIT-UNOBTAINABLE`. The output contains no `gate3: FAIL` line.
- [ ] `pr_route` maps exit 69 to the same `UNOBTAINABLE` line and publishes `PR-AUDIT-UNKNOWN`.
- [ ] Any other non-zero exit keeps the current `gate3: FAIL (classification exited <rc>)` output.
- [ ] `.agro/skills/audit/SKILL.md`, `.agro/skills/audit/scripts/audit-run.sh`, and `.agro/skills/audit/references/implementation.md` list `AUDIT-UNOBTAINABLE` as a verdict of the `implementation` route.
- [ ] `.agro/skills/spec/references/execute.md` treats `AUDIT-UNOBTAINABLE` as a draft block. The procedure forbids a substitute classification by hand.
- [ ] `bash .agro/evals/probes/audit-run-root-contract.sh` exits 0 and asserts both outcomes: exit 69 gives `AUDIT-UNOBTAINABLE`, and exit 1 gives `AUDIT-FAIL`.

## Summary

Verified current state at `80b9342`:

- `.agro/skills/spec/references/execute.md:502` (step 7) writes `.agro/tasks/<slug>/evidence.md`. Lines 602-621 (step 10) refuse the undraft without the file and run `git ls-files --error-unmatch` because `.agro/tasks/` is gitignored. Lines 623-661 copy part of the file into the PR body. The PR-body template lacks question 0, "Why this is better".
- `.agro/skills/audit/references/reviewer-evidence-doc.md` defines the five questions and the file contract.
- Four probes read `evidence.md`: `spec-ready-finalization.sh:46-55`, `spec-single-owner.sh:35`, `docs-20260901-followup-artifact-cited.sh:48`, `protected-path-deletion.sh:42`.
- `.agro/skills/audit/scripts/pr-acquire.sh:32` requests `closingIssuesReferences` in one field list. `route-driver.sh:75` reports every non-zero `classify-pr` exit as `gate3: FAIL (classification exited $rc)`. `pr_route` at `route-driver.sh:168` reports the same exit as `PR-AUDIT-UNKNOWN` with no cause.
- `implementation-gates.sh` gate 1 checks `artifact_contract.required_artifacts` from `prd.json`. No check compares a completed task folder against the artifacts that `execute.md` requires.

Selected approach: the PR body becomes the only evidence location. A new diff-scoped probe checks completed task folders against one list in `execute.md`. `pr-acquire.sh` preflights the `gh` version and exits 69 (`EX_UNAVAILABLE`). The driver maps exit 69 to a distinct `UNOBTAINABLE` signal and still fails closed.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/spec/references/execute.md` | step 6, step 7, step 10 evidence gate and PR-body template | Owns the evidence procedure and the required-artifact list |
| `.agro/skills/audit/references/reviewer-evidence-doc.md` | Contract, The five questions, Shape | Owns the evidence contract; retarget to the PR body |
| `.agro/skills/audit/scripts/pr-acquire.sh` | `fields`, `gh pr view` call | Adds the `gh` version preflight and exit 69 |
| `.agro/skills/audit/scripts/implementation-gates.sh` | `classify-pr` | Passes the `pr-acquire.sh` exit code through the pipe |
| `.agro/skills/audit/scripts/route-driver.sh` | `fail`, `publish`, `gate3_pr`, `pr_route` | Adds the `UNOBTAINABLE` path |
| `.agro/skills/audit/SKILL.md` | route verdict table | Lists `AUDIT-UNOBTAINABLE` |
| `.agro/skills/audit/scripts/audit-run.sh` | route verdict table at line 16 | Lists `AUDIT-UNOBTAINABLE` |
| `.agro/skills/audit/scripts/audit-evidence.sh` | `complete` | Must accept `AUDIT-UNOBTAINABLE`; see open question 3 |
| `.agro/skills/spec/templates/task-prompt.md` | lines 15 and 71 | Owner duties; replace `evidence.md` |
| `.agro/tasks/README.md` | file table, Conventions | Remove the `evidence.md` row |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PR body written by `/spec execute` | Modified | Carries the five questions and the knowledge-impact states |
| `/audit implementation` verdict | Added | `AUDIT-UNOBTAINABLE` joins `AUDIT-PASS` and `AUDIT-FAIL` |
| `pr-acquire.sh` exit code | Added | Exit 69 means an unsupported `gh` version |
| `.agro/tasks/<slug>/evidence.md` | Removed | No procedure writes or reads the file |
| Probe suite | Added | New file `.agro/evals/probes/task-folder-required-artifacts.sh` |

## Storage

The PR description on GitHub stores the evidence. GitHub keeps the edit history of the body. No repository file stores the evidence. The task folder keeps `prd.json`, `progress.txt`, `simplicity-review.json`, `simplify-rounds.json`, `eval-result.json`, and `ui-evidence.json` as today.

## Architectural Decisions

- Source of truth for the evidence contract: `.agro/skills/audit/references/reviewer-evidence-doc.md`. `execute.md` refers to the contract and does not copy the contract.
- Source of truth for required task artifacts: one list in `execute.md`. The new probe parses that list. This keeps one owner and avoids a second copy in the probe.
- The new probe checks only task folders in the `BASE..HEAD` diff. Older completed folders at the base commit do not turn the suite red.
- The tooling-blocked signal is an exit code plus a verdict. Exit 69 is `EX_UNAVAILABLE` from `sysexits.h`. The driver still blocks the undraft on `AUDIT-UNOBTAINABLE`.
- The `gh` minimum version 2.101.0 comes from `.agro/knowledge/patterns/pattern-audit-gate-unrunnable-reads-as-defect.md`.
- Execution location: all edits are control-plane files. The application agent in the sandbox makes the edits. The change needs no host command.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/spec-ready-finalization.sh` | PR-body gate present; step 10 lacks a heading gives exit 1 | US-001, US-002 |
| `.agro/evals/probes/spec-single-owner.sh` | task prompt assigns the PR-body evidence | US-002 |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | contract requires cited follow-ups | US-002 |
| `.agro/evals/probes/protected-path-deletion.sh` | deletion justified in a commit body | US-002 |
| new file `.agro/evals/probes/task-folder-required-artifacts.sh` | missing `simplicity-review.json` gives exit 1; complete folder gives exit 0; no changed folder gives exit 2 | US-003 |
| `.agro/evals/probes/audit-pr-acquire.sh` | mock `gh` 2.45.0 gives exit 69; mock `gh` 2.101.0 gives exit 0 | US-004 |
| `.agro/evals/probes/audit-run-root-contract.sh` | exit 69 gives `AUDIT-UNOBTAINABLE`; exit 1 gives `AUDIT-FAIL` | US-005 |
| `.agro/skills/eval/run.sh` | full probe suite | no regression |

Write each probe change first. Run the probe against the base code and record the red result in `progress.txt`. Then change the code.

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- Keep one source of truth for each policy.
- Fail closed. A gate that cannot run blocks the undraft and names its cause.
- Delete the obsolete path. Leave no dormant `evidence.md` fallback.
- Edit the canonical `.agro/` sources. Do not patch a provider mirror under `.claude/`.

## Out of Scope

- The `knowledge-citation-symbol-liveness.sh` probe. A separate issue tracks it.
- Changes to the gate 5 `netAdded` termination rule.
- Splitting the `pr-acquire.sh` field list into per-gate calls.
- Rewriting pinned `evidence.md@<sha>` sources in `.agro/knowledge/` or files under `.agro/tasks/archive/`.
- Public documentation in `mifunedev/agro-web`. No user-facing lifecycle verb changes.

## Open Questions

1. Which artifacts does the required list in `execute.md` hold, and under which condition? `simplify-rounds.json` exists only after a gate 5 failure round, and `route-driver.sh` treats the file as optional. The plan assumes `simplicity-review.json` always, `eval-result.json` when a probe suite applies, `ui-evidence.json` when a story requires the browser, and `simplify-rounds.json` only after a gate 5 failure.
2. Where does `protected-path-deletion.sh` read the justification? The probe runs offline and cannot read a PR body. The plan selects the commit body in `BASE..HEAD`. The alternative is a live `gh pr view` call with a `SKIPPED` path.
3. Does `.agro/skills/audit/scripts/audit-evidence.sh complete` accept a new verdict string, or does it hold a fixed list? The implementer reads the script before US-005.
4. `spec-ready-finalization.sh` reads `execute.md` through the `.claude/skills/spec` compatibility directory. Confirm that the link still resolves after the edit.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` exits 0 on the branch head.
- [ ] `git grep -n 'evidence\.md' -- .agro/skills .agro/evals/probes .agro/tasks/README.md .agro/logs/AGENTS.md .agro/memories/AGENTS.md` prints no line.
- [ ] `CHANGELOG.md` has an `## [Unreleased]` entry for the change.
- [ ] The PR body for this task answers the five questions in the new format.

## Lessons

Filled by the advisor before undraft.
