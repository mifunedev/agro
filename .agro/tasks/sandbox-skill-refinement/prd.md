# PRD: Sandbox skill readiness refinement

Status: APPROVED by the operator's active goal.

## User Stories

### US-001: Clarify workflows and add a routing-decision grader

**Description:** As an operator, I want accurate execution guidance and a strict decision grader so that review checks task decisions rather than prose presence.

**Acceptance Criteria:**

- [ ] Clone-result retrieval names the required brain checkout and hand remote before fetch.
- [ ] Public documentation matches allowlist-only `run.env` behavior.
- [ ] MicroVM permission guidance distinguishes historical observations from fresh runtime evidence.
- [ ] Eight routing cases cover the frozen R1 through R8 tasks without changing the rubric.
- [ ] Grader tests reject wrong routes, missing or duplicate cases, invalid owners, stale instruction hashes, and invented execution claims.
- [ ] The existing changelog entry describes the added routing evidence and links issue #1618.
- [ ] Public hand application examples require capability-checked sandbox execution. SSH alone is not an application runtime.
- [ ] Mount scope includes writable external Git metadata. Readiness states attempts plus probe duration. Cleanup remains best effort. Stop limitations stay adapter scoped.

### US-002: Execute fresh routing decisions and bind their evidence

**Description:** As an advisor, I want eight fresh decision-only runs so that regression evidence records actual model decisions against the current skill.

**Acceptance Criteria:**

- [ ] Each case uses a fresh context without answer keys, peer outputs, or inherited advisor preferences.
- [ ] Actual responses satisfy the expected routes and required ownership decisions for all eight cases.
- [ ] The evidence identifies its cases, observed model, worker handles, and exact instruction hashes.
- [ ] The grader rejects a mutated wrong-route response and stale source evidence.
- [ ] No replay runs a provider command, reads credentials, or creates infrastructure.

### US-003: Verify the candidate and prepare review evidence

**Description:** As a reviewer, I want reproducible verification and a complete PR body so that the scored revision has an auditable acceptance path.

**Acceptance Criteria:**

- [ ] Full tests, typecheck, and build pass inside `agro run`.
- [ ] Skill structure, provider links, shell syntax, and changed prose pass relevant checks.
- [ ] All sixteen moved machinery files retain their original blobs and modes.
- [ ] Manual review evidence includes a real positive command and an invalid-provider failure from fresh temporary state.
- [ ] The final commit excludes `agro.json`, runtime code, dependency changes, and unrelated main-checkout edits.
- [ ] Manual review evidence records reproducible commands, outputs, and limits for pinned PR links.

## Summary

PR #1619 opened as a draft at `7d4900b71128409f58a9ef2b56aae27d0a658489`.
The first ten-member council averaged 0.866 after exact arithmetic correction.
The operator requires an average of at least 0.930, then a non-draft PR on green CI.
The original rubric remains unchanged: 60 checks with weights 0.25, 0.20, 0.25, 0.15, 0.10, and 0.05.
Its SHA256 is `9b0281a76335f6a25431c8ce0f46521b00eb554e7bf7010708387b772f126f66`.
Unknown checks still earn zero. New judges receive no target score or preferred answer.

## Key Integration Points

| File | Symbol or section | Role |
| --- | --- | --- |
| `.agro/skills/sandbox/references/mifune-console.md` | Execute and Verify | Explain project and clone retrieval prerequisites. |
| `docs/lifecycle-commands.md` | Services and MicroVM isolation | Align public facts with implementation and qualified observations. |
| `.agro/skills/sandbox/references/local-msb.md` | Verify | Qualify external permission behavior. |
| `.agro/scripts/__tests__/sandbox-routing.test.ts` | New decision regression suite | Grade actual decisions and negative mutations. |
| `.agro/scripts/__tests__/fixtures/sandbox-routing/` | Cases and observed replay data | Bind expected decisions to real input provenance. |
| `.agro/tasks/sandbox-skill-refinement/evidence/` | Baseline and manual review | Keep observed verification evidence. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Sandbox references | Modify | Clarify truthful operational instructions. |
| Regression suite | Add | Evaluate task decisions without changing the CLI. |
| PR #1619 | Update | Add evidence and remove draft only after the score and CI gates. |

## Storage

Use committed JSON fixtures for routing cases and actual decisions.
Bind records to instruction content hashes so evidence-only commits cannot disguise changed instructions.
Keep task plans and review transcripts in the canonical task directory.
Keep council dispatch records local until their evidence has a stable publication form.

## Architectural Decisions

The task refines documentation and verification without a new runtime design.
Use one implementation worker in the existing PR worktree.
The advisor owns task state, evidence capture, scoring arithmetic, and acceptance.
Fresh replay contexts decide only. They never execute suggested provider commands.
Keep the original ten-member lenses, source budgets, score weights, and unknown penalties.
Do not alter the rubric to reach the target or discard a low score.
A source inspection map can identify relevant implementation and evidence without supplying grades.

## Bounded council repair

The second council's exact raw mean was 5677/6000 (0.946 displayed).
A fresh critic confirmed a public SSH application-test example that bypasses the required runtime boundary.
The frozen critical cap is 0.499. The raw mean does not establish readiness.
Correct that example and the four related truthfulness findings inside the existing PR.
Retain every earlier member report and score. Do not replace low members.
Changed instruction bytes require eight genuinely new decision contexts and a new ten-member council.

| Surface | Disposition |
| --- | --- |
| Host and sandbox | Applied: host control-plane documentation; all verification uses `agro run`. |
| Lifecycle door | Applied: align `agro run` and `agro hands` guidance without CLI changes. |
| Canonical and provider | Applied: canonical sandbox references; preserve provider links. |
| Root and scaffold | Applied: portable instructions and public documentation. |
| Interactive and headless | Not applicable: no process-runtime change; checks use bounded monitors. |
| Local and remote | Applied: disclose mounts and require remote runtime capabilities. |
| Parallel operation | Applied: one sequential worker in the existing isolated task worktree. |
| Public documentation | Applied: fix inherited mount and SSH-example contradictions. |
| Verification | Applied: focused guards, fresh routing decisions, preserved machinery, full checks, fresh council and final-head CI. |

## Test Plan (TDD)

| Test File | Cases | Validates |
| --- | --- | --- |
| `sandbox-routing.test.ts` | Eight observed routes, wrong routes, missing or duplicate cases, wrong owners, stale hashes | Decision correctness and provenance. |
| `sandbox-skill.test.ts` | Existing metadata, links, guards, and retirement | Preserve the skill contract. |
| Existing hands and run tests | Clone/project/fetch semantics and allowlist-only environment | Ground documentation in current behavior. |
| Existing remote driver tests | Signals, partial creation, cleanup, and compatibility | Preserve moved machinery. |

Write grader tests before adding observed replay data.
Missing real evidence must fail the final regression check rather than skip it.

## Design Principles

Fix verified gaps inside their existing owners.
Preserve the small dispatcher and on-demand references.
Use actual observed decisions, not synthetic records presented as agent runs.
Separate inherited documentation gaps from new runtime regressions.

## Out of Scope

No new CLI, provider, runtime, registry publication, live VM validation, or application feature.
No browser evidence applies because the task changes no user interface.
The manual review uses local test commands and a safe invalid-provider failure path.
No merge permission follows from this goal.

## Open Questions

None. The active goal authorizes bounded implementation and evaluation through PR readiness.

## Acceptance Criteria

- [ ] All three implementation and evidence stories pass.
- [ ] A fresh ten-member council explores the immutable candidate before scoring under the unchanged rubric.
- [ ] The exact unrounded mean is at least 0.930; displayed scores use at most three decimal places.
- [ ] Material disputes receive bounded independent verification before acceptance.
- [ ] The published PR body uses pinned evidence links and records known verification limits.
- [ ] GitHub CI is green for the exact final PR head.
- [ ] GitHub reports `isDraft: false` only after the score and CI gates pass.
- [ ] The operator's unrelated changes remain untouched.

## Lessons

The second raw council mean exceeded the target, but a source-confirmed unsafe SSH example activated the unchanged safety cap.
Numerical agreement cannot override a verified isolation violation.
The bounded repair aligns public application examples, writable Git mounts, readiness attempts, best-effort cleanup, and adapter-local capability claims.
Source `1d17ba3c262ee1777f261d24b7ddd1be5269cf8e` corrects those claims and adds four guards.
A fresh independent critic found no remaining source-confirmed cap instruction or concrete blocker in the inspected scope.
Outcome: fixed in this PR.

The advisor distinguished source acceptance from final publication so evidence links can use the actual final commit without a self-reference cycle.
All publication, score, and CI gates remain mandatory before undrafting.
A provenance audit found two linked public inputs outside the initial hash list.
The bounded repair hashes those inputs and tests document-byte mutations; it preserves the original model decisions.
Outcome: fixed in this PR.
Suggested commands in the decision-only responses remain ungraded and unexecuted.
Broader live-provider validation needs separate authority and is not evidence from this task.
Outcome: dropped from this change because the task does not authorize those runs.
The critic suggested repeating the public mounted-path credential warning in the execution reference.
The reference already discloses the extra writable Git mount, and public instructions require review of all mounted paths.
Outcome: dropped because the additional wording duplicates an existing warning and resolves no false absence claim.
A monitor launcher assumed Bash and exited before tests. A separate compound check was safety-blocked.
An explicit Bash wrapper and the guard's literal-command remedy resolved both invocation problems.
Outcome: dropped because no harness product defect or new implementation work remains.
