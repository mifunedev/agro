# PRD: Retire evidence.md and harden the spec gates

Status: DRAFT

Source: the operator input file work/issue-1088.md for issue #1088.

## User Stories

### US-001: Move the evidence contract into the PR body

**Description:** As a reviewer, I want the build evidence in the PR description so that no evidence file goes missing.

**Acceptance Criteria:**

- [ ] Step 7 of `.agro/skills/spec/references/execute.md` tells the owner to write the five evidence questions into the PR body, not into a task-folder file.
- [ ] The step 10 PR-body template in `.agro/skills/spec/references/execute.md` has one heading for each of the five questions, in this order: `## Why this is better`, `## What the plan asked for`, `## What was built`, `## Where it diverged from the plan, and why`, `## What remains unverified`.
- [ ] The step 10 PR-body template keeps the `## Knowledge impact` and `## Evidence` headings. The `## Evidence` section holds the `AUDIT_RUN_ID`, the native verdict, and the observed gate output.
- [ ] The step 10 evidence gate reads the body with `gh pr view <PR> --json body` and writes `DRAFT-BLOCKED(evidence)` when one of the five headings is absent.
- [ ] The step 10 evidence gate contains no `git ls-files --error-unmatch` call and no `evidence.md` path.
- [ ] `.agro/skills/audit/references/reviewer-evidence-doc.md` defines the PR body as the evidence location. The observed-only, correlated, honest, and cited-follow-up rules stay in the file.
- [ ] The halt table and the idempotency table in `.agro/skills/spec/references/execute.md` name the PR body instead of `evidence.md`.
- [ ] The task-folder tree in `.agro/skills/spec/SKILL.md` has no `evidence.md` row.

### US-002: Remove evidence.md from the remaining skill and doc files

**Description:** As an agent, I want every skill to name the PR body so that no instruction points at a retired file.

**Acceptance Criteria:**

- [ ] `git grep -n 'evidence\.md' -- .agro/skills .agro/logs/AGENTS.md .agro/memories/AGENTS.md` prints no line.
- [ ] `.agro/skills/spec/templates/task-prompt.md` tells the owner to write the evidence into the PR body.
- [ ] The example pin in `.agro/skills/wiki/references/schema.md` names a tracked file other than `evidence.md`.
- [ ] `.agro/knowledge/source/plan-vs-built-reconciliation.md` describes the PR body as the evidence location.
- [ ] Pinned `sources:` entries in `.agro/knowledge/patterns/` stay unchanged.

### US-003: Update the four probes that read evidence.md

**Description:** As an operator, I want the probes to guard the PR-body contract so that the retired file leaves no stale oracle.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/spec-ready-finalization.sh` reports REGRESSION when a heading of the five-question set leaves the step 10 template in `.agro/skills/spec/references/execute.md`.
- [ ] `.agro/evals/probes/spec-ready-finalization.sh` reports REGRESSION when the step 10 evidence gate stops refusing the undraft on a missing heading.
- [ ] `.agro/evals/probes/spec-single-owner.sh` checks that the task prompt assigns the PR-body evidence to the owner.
- [ ] `.agro/evals/probes/protected-path-deletion.sh` accepts a deleted protected path when the message of the deleting commit names the path.
- [ ] `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` checks the cited-follow-up rule in `.agro/skills/audit/references/reviewer-evidence-doc.md`, and reads no `evidence.md` file.
- [ ] Each of the four probes exits 0 on the branch head.
- [ ] Each of the four probes exits 1 against a fault injection of its guarded text. The implementer records each injection and its exit code in `progress.txt`.

### US-004: Add a completed-task artifact probe

**Description:** As an operator, I want a probe that checks completed task folders so that a skipped procedure step fails loudly.

**Acceptance Criteria:**

- [ ] new file `.agro/evals/probes/spec-task-artifacts.sh` declares the `tier`, `source`, and `desc` header lines that `.agro/evals/README.md` requires.
- [ ] The probe selects each task folder outside `.agro/tasks/archive` whose tracked `prd.json` passes `jq -e 'all(.userStories[]; .passes == true)'`.
- [ ] For each selected folder, the probe requires the tracked files `prd.md`, `prd.json`, `progress.txt`, `eval-result.json`, `simplicity-review.json`, and `simplify-rounds.json`.
- [ ] The probe reports REGRESSION with the folder and each absent file name when one required file is absent.
- [ ] The probe reports REGRESSION when a required file name no longer appears in `.agro/skills/spec/references/execute.md`.
- [ ] The probe exits 2 with `SKIPPED` when no completed task folder exists.
- [ ] A fixture folder that lacks `simplicity-review.json` makes the probe exit 1. The implementer records the injection in `progress.txt`.
- [ ] `bash .agro/evals/probes/spec-task-artifacts.sh` exits 0 on the branch head.

### US-005: Give the audit driver a distinct tooling-blocked verdict

**Description:** As an operator, I want a distinct verdict for an unrunnable gate so that I fix `gh` before the PR.

**Acceptance Criteria:**

- [ ] `.agro/skills/audit/scripts/pr-acquire.sh` checks `gh --version` before the query. When the version is lower than 2.101.0, the script prints the observed version and the required version to stderr and exits 69.
- [ ] When `implementation-gates.sh classify-pr` exits 69, `gate3_pr` in `.agro/skills/audit/scripts/route-driver.sh` prints `gate3: UNRUNNABLE (<reason>)` and publishes `AUDIT-UNRUNNABLE`.
- [ ] When the classification exits 69, `pr_route` in `.agro/skills/audit/scripts/route-driver.sh` publishes `PR-AUDIT-UNRUNNABLE`.
- [ ] Every other non-zero classification exit keeps the current `gate3: FAIL (classification exited <rc>)` and `PR-AUDIT-UNKNOWN` behavior.
- [ ] `.agro/skills/audit/references/implementation.md` lists `AUDIT-UNRUNNABLE` and routes the verdict to the operator, not to `implement`.
- [ ] The verdict list in `.agro/skills/audit/references/reviewer-evidence-doc.md` includes `AUDIT-UNRUNNABLE` and `PR-AUDIT-UNRUNNABLE`.
- [ ] The halt table in `.agro/skills/spec/references/execute.md` has a row for `AUDIT-UNRUNNABLE` that leaves the PR draft and escalates to the operator.
- [ ] `.agro/evals/probes/audit-run-root-contract.sh` runs a `gh` stub that reports version 2.45.0. The probe asserts `gate3: UNRUNNABLE` and `verdict=AUDIT-UNRUNNABLE`.
- [ ] `.agro/evals/probes/audit-pr-acquire.sh` asserts exit 69 from `pr-acquire.sh` under the 2.45.0 stub.

## Summary

Issue #1088 reports three findings from the #1086 build.

Finding 1: `evidence.md` lives in the gitignored `.agro/tasks/<slug>/` folder. Step 7 of `.agro/skills/spec/references/execute.md:502` writes the file. Step 10 at `.agro/skills/spec/references/execute.md:602` gates the undraft on the file and on `git ls-files --error-unmatch`. The same step already copies the evidence into the PR body at `.agro/skills/spec/references/execute.md:624`. The plan makes the PR body the only evidence location, and the gate reads the body through `gh pr view`.

Finding 2: no check compares a completed task folder with the artifacts that the procedure requires. Step 5 writes `simplicity-review.json`, `simplify-rounds.json`, and `eval-result.json`. The #1086 build skipped two of them, and no gate failed. The plan adds one probe that reads the tracked files of each completed folder.

Finding 3: `.agro/skills/audit/scripts/pr-acquire.sh:32` requests `closingIssuesReferences`. The issue states that `gh` before 2.101.0 rejects the field. `gate3_pr` in `.agro/skills/audit/scripts/route-driver.sh:70` then prints `gate3: FAIL (classification exited 1)`. The plan adds a version preflight with exit 69 and a new `UNRUNNABLE` verdict pair.

The grep at the base commit found `evidence.md` in 4 probes and in 14 skill, doc, and knowledge-source files. Pinned `sources:` entries in `.agro/knowledge/patterns/` cite historical commits. Those pins stay valid and stay unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/spec/references/execute.md` | step 7, step 10 evidence gate, PR-body template, halt table, idempotency table | Owns the evidence procedure and the undraft gate |
| `.agro/skills/audit/references/reviewer-evidence-doc.md` | Contract section | Owns the evidence rules; the file path stays, the location changes to the PR body |
| `.agro/skills/spec/SKILL.md` | task-folder tree, pipeline line 58 | Lists the task-folder files |
| `.agro/skills/spec/templates/task-prompt.md` | owner duties | Assigns the evidence to the owner |
| `.agro/skills/spec/references/retro.md` | retro trigger | Names the evidence input |
| `.agro/skills/retro/SKILL.md` | inputs list | Names the evidence input |
| `.agro/skills/supervisor/SKILL.md` | evidence mentions | Names the evidence location |
| `.agro/skills/escalate/SKILL.md` | human-visible destinations | Names the evidence location |
| `.agro/skills/audit/references/implementation.md` | ownership note, verdict routing table | Names the evidence owner and the verdicts |
| `.agro/skills/audit/references/pr.md` | caller note | Names the evidence owner |
| `.agro/skills/wiki/references/compile.md` | `--task` inputs | Reads the task evidence |
| `.agro/skills/wiki/references/schema.md` | pin example | Shows pin syntax |
| `.agro/logs/AGENTS.md` | scope note | Names the evidence location |
| `.agro/memories/AGENTS.md` | scope note | Names the evidence location |
| `.agro/knowledge/source/plan-vs-built-reconciliation.md` | artifact table, mermaid graph | Describes the evidence flow |
| `.agro/evals/probes/spec-ready-finalization.sh` | evidence-gate assertions at lines 46-55 | Guards the undraft gate |
| `.agro/evals/probes/spec-single-owner.sh` | line 35 prompt assertion | Guards evidence ownership |
| `.agro/evals/probes/protected-path-deletion.sh` | justification lookup at line 42 | Guards protected-path deletions |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | tracked-file loop at line 48 | Guards cited follow-ups |
| new file `.agro/evals/probes/spec-task-artifacts.sh` | whole probe | Checks completed task folders |
| `.agro/skills/audit/scripts/pr-acquire.sh` | `fields` at line 32 | Adds the `gh` version preflight |
| `.agro/skills/audit/scripts/implementation-gates.sh` | `classify-pr` | Passes exit 69 through to the driver |
| `.agro/skills/audit/scripts/route-driver.sh` | `gate3_pr`, `pr_route` | Maps exit 69 to the `UNRUNNABLE` verdicts |
| `.agro/evals/probes/audit-run-root-contract.sh` | fake `gh` fixtures | Proves the new driver verdict |
| `.agro/evals/probes/audit-pr-acquire.sh` | acquisition assertions | Proves the preflight exit |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PR body written by `/spec execute` | Changed | Gains `## Why this is better`; the `## Evidence` section carries the gate output inline |
| `/spec execute` undraft gate | Changed | Reads the PR body instead of a tracked file |
| Audit native verdicts | Added | `AUDIT-UNRUNNABLE` and `PR-AUDIT-UNRUNNABLE` |
| `pr-acquire.sh` exit codes | Added | Exit 69 means the `gh` version cannot serve the query |
| Probe suite | Added | `spec-task-artifacts` joins `.agro/evals/RESULTS.md` on the next /eval run |

## Storage

The evidence moves from a gitignored file to the GitHub PR description. GitHub keeps the edit history of the description. No schema changes. `progress.txt` keeps the per-story record and the fault-injection records.

## Architectural Decisions

- The PR body is the one source of truth for reviewer evidence. `.agro/skills/audit/references/reviewer-evidence-doc.md` keeps its path and owns the rules.
- The evidence gate checks the five question headings only. The gate does not judge the content under each heading.
- The artifact probe holds the required-file list. The probe also checks that each listed name appears in `.agro/skills/spec/references/execute.md`, so the list cannot drift from the procedure silently.
- A deleting commit message carries the protected-path justification. Git keeps the message, so the probe stays deterministic without network access.
- Exit 69 marks a tooling gap. Exit 69 matches `EX_UNAVAILABLE` from `sysexits.h`, and the audit scripts already use 64 for usage errors.
- The `UNRUNNABLE` verdicts route to the operator. The `implement` node cannot fix a host tool.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/spec-ready-finalization.sh` | template heading removed; gate refusal removed; clean head | US-001, US-003 |
| `.agro/evals/probes/spec-single-owner.sh` | owner duty removed; clean head | US-002, US-003 |
| `.agro/evals/probes/protected-path-deletion.sh` | deletion without commit justification; deletion with commit justification | US-003 |
| `.agro/evals/probes/docs-20260901-followup-artifact-cited.sh` | cited-follow-up rule removed; clean head | US-003 |
| new file `.agro/evals/probes/spec-task-artifacts.sh` | fixture without `simplicity-review.json`; required name removed from `execute.md`; no completed folder; clean head | US-004 |
| `.agro/evals/probes/audit-run-root-contract.sh` | `gh` stub at 2.45.0; stub with a non-69 failure | US-005 |
| `.agro/evals/probes/audit-pr-acquire.sh` | `gh` stub at 2.45.0; stub at 2.101.0 | US-005 |
| `.agro/skills/eval/run.sh` | full suite on the branch head | All stories |

Write each red case first. Run each probe with `bash <probe-path>`. Run the full suite with `bash .agro/skills/eval/run.sh`.

## Design Principles

- Keep one source of truth for each policy. The PR body holds the evidence, and one reference file holds the rules.
- Delete the obsolete gate path. Do not keep `evidence.md` as a fallback.
- Make an absence fail. A skipped artifact or an unrunnable gate produces a named signal.
- Keep the probes deterministic and offline, per `.agro/evals/README.md`.
- Add no explanatory comments to tracked code, per `AGENTS.md`.

## Out of Scope

- A citation-liveness probe for knowledge pages. The issue tracks it separately.
- A change to the gate 5 `netAdded` termination instrument.
- A rewrite of the pinned `sources:` entries in `.agro/knowledge/patterns/`.
- A change to the append-only ledger `.agro/evals/decisions/skill-impact.md` and to the raw snapshots under `.agro/knowledge/raw`.
- Removal of the `evidence.md` files that earlier task folders already track.
- A fix for `gh` on the operator host.

## Open Questions

1. Four non-archived task folders track `simplicity-review.json`, and other completed task folders lack the file. Does the implementer archive each completed folder that fails the new probe, or does the probe skip older folders? The plan assumes that the implementer archives the folders.
2. Gate 5 reads `simplify-rounds.json` only when the file exists. Does `/spec execute` require the file on every build? The plan assumes yes. If the answer is no, drop the file from the probe list.
3. The issue names `knowledge-impact.sh` as a skipped step. No task-folder file records the run today. Does the probe require a `knowledge-impact` line in `progress.txt`?
4. Does `implementation-gates.sh classify-pr` pass the exit code of `pr-acquire.sh` through unchanged? The planner did not read `classify-pr`. If `classify-pr` changes the exit code, US-005 also changes `classify-pr`.
5. Does the issue count of 12 skill and doc files include the two knowledge-source pages? The plan counts 14 files and updates the current-behavior pages only.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` exits 0 on the branch head.
- [ ] `git grep -n 'evidence\.md' -- .agro/skills .agro/evals/probes` prints no line.
- [ ] The PR for this task carries the five evidence headings in its body, and the PR diff adds no `evidence.md` file.

## Lessons

Filled by the advisor before undraft.
