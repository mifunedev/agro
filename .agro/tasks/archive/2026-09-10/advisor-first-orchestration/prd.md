# PRD: Advisor-first orchestration from AGENTS.md

**Issue:** [#988](https://github.com/mifunedev/openharness/issues/988) · **ADR:** [#989](https://github.com/mifunedev/openharness/issues/989) · **Prefix:** `feat` · **Repo:** `mifunedev/openharness` · **Base:** `development`
**Source plan:** `/home/sandbox/harness/.oh/plans/advisor-first-orchestration/plan.md` (operator-approved; ignored planning input, read by absolute path)

## Introduction

The operator wants the active session to advise: interpret the goal, decompose work, assign bounded workers, inspect evidence, and decide acceptance. Today the root `AGENTS.md`, `/spec execute`, the rendered task prompt, `/delegate`, and the local `/plan` skill all permit or require the parent to implement directly. That contradiction, not a weak handoff, is why the prior AGRO handoff did not produce worker-first execution.

This task changes the defaults in place. The advisor is behavior of the active session, independent of provider, model, terminal, or prior handoff. Workers perform tracked implementation edits according to each subtask's complexity and risk. One accountable owner keeps `prd.json`, progress, integration decisions, evidence, and PR readiness. Continue in the active session by default; handoff is optional and needs an operator request.

Operator model preferences for Claude Code: Fable 5.1 advisor; Opus with thinking disabled for low-complexity workers; never Sonnet. For a native surface exposing the other requested family: Luna/Max for the least complex work, Astra/high for the hardest. These are provider-specific preferences kept in `/delegate`, honored only after a native capability check. An unavailable required control blocks the assignment; it never authorizes substitution.

## Goals

- `AGENTS.md` states advisor-first accountability within 9,500 bytes and keeps all five non-negotiables.
- Root, `/spec` (skill, `plan.md`, `execute.md`, task prompt), `/delegate`, and `/plan` share one execution model: advisor owns decisions and acceptance; bounded workers own tracked edits; same-session continuation by default; optional operator-requested transfer.
- Every future plan carries executable worker briefs with complete DoD coverage; a plan without a handoff prompt is valid.
- Model policy honors explicit operator selections after native checks, records requested and observed settings separately, and blocks on unsupported controls.
- Probes protect the new contract with demonstrated failure branches; the full eval suite shows no new regression.
- Docs, glossary, task guide, RFC index, and CHANGELOG describe the changed default; ADR #989 supersedes #929's direct-implementation default without rewriting history.
- Efficiency claims distinguish measurement from assumption; no measured comparison means no savings claim.

## Non-goals

No external plugin installation, persistent advisor process, project-agent catalog, dashboard, scheduler, model router, billing subsystem, automatic merge, or change to the active AGRO task or the operator's parent settings.

## Definition of Done

| ID | Observable outcome | Verification and expected result | Evidence | Owner |
|---|---|---|---|---|
| D1 | The root states advisor-first accountability without losing existing safety principles. | Read the complete root diff; run `agents-identity-contract.sh` and `context-tier-size-budget.sh`. Both pass; `AGENTS.md` stays at or below 9,500 bytes. | Root review and byte/probe output. | Bounded policy worker; advisor and independent reviewer. |
| D2 | Root, execution skill, delegation skill, plan conversion, and rendered prompt have one consistent execution model. | Review every active direct-implementation and inheritance instruction. A substantial task reaches worker dispatch before tracked implementation edits. | Contract inventory and actual invocation trace. | Policy worker; advisor. |
| D3 | Claude routing honors Fable advisor preference, Opus thinking-off low workers, and no Sonnet without defining the portable advisor by those names. | Perform native preflight and bounded calls. Record task-specific hard-worker choices and effective model/reasoning evidence. Unsupported required controls block rather than silently degrade. | Requested/observed capability matrix and redacted native results. | Advisor performs preflight and native trials. |
| D4 | Luna/Max and Astra/high requests use only a native surface that supports them. | Verify tool schema and exact model IDs; exercise low/high dispatch or record a blocking capability gap. Never pass an invented parameter or unsupported `thinking: max`. | Provider-specific invocation evidence. | Advisor. |
| D5 | Each worker receives bounded, complexity-based work with isolation and dependencies. | Inspect real delegation records. Verify serial coupled work, isolated parallel writers, blocked dependents, and limits inherited from the canonical procedure. | Graph, native worker IDs, branch paths, and result artifacts. | Advisor; implementation workers; independent reviewer. |
| D6 | Verification remains independent and commit-specific. | Seed a defective worker patch in a disposable checkout. The advisor/reviewer rejects it; repair plus new checks precede acceptance. A summary or stale green cannot pass. | Rejection, repair, integrated diff, fresh review, and check outputs. | Verification worker; advisor; fresh read-only reviewer. |
| D7 | Plans provide executable worker briefs without requiring a handoff. Decisions survive same-session execution, resumption, and requested transfers. | Validate brief fields and DoD coverage. A plan without a handoff prompt must pass. Test same-session dispatch and requested-transfer support; preserve model constraints and reject duplicate ownership or completed work. | Plan-contract checks, redacted execution/resume traces, and requested-transfer test evidence. | Advisor; check worker; independent reviewer. |
| D8 | Durable state has no competing owner or new persistent hierarchy. | Review writes to existing task/delegation files. Run single-owner, roles-as-skills, worker-boundary, and provider-link checks. No new supervisor or project-agent catalog exists. | State ownership review and probe output. | Policy worker; advisor; independent reviewer. |
| D9 | Tests protect the new behavior without weakening unrelated contracts. | Update affected probes, demonstrate their failure branches in disposable committed checkouts, then run the full eval suite. No new unrelated regression remains. | Before/after probe output, fault-injection evidence, commit-keyed eval result. | Verification worker; advisor. |
| D10 | Efficiency claims distinguish measurement from assumption. | Compare the approved baseline and candidate on the same bounded tasks and fixed criteria. Report parent, worker, reviewer, retry, and repair usage or explicit gaps. | Matched-run report with quality, usage coverage, time, and pricing assumptions. | Advisor; check worker; independent reviewer; operator approves run budget. |
| D11 | Documentation and architecture records describe the changed default without rewriting history. | Review the new ADR, skill prose, task guide, glossary, changelog, and affected public guidance. Provider links resolve; consumer-owned roots remain untouched. | Documentation diff, ADR link, link check, and STE output. | Policy/docs worker; advisor; external docs owner if required. |
| D12 | The rollout preserves current work and remains reversible. | Verify isolated implementation, the local plan-skill baseline, no active-session mutation, and no source-plan staging. Rehearse rollback of policy and tests together on a scratch branch. | Workspace diff, baseline reconciliation, and rollback evidence. | Advisor; bounded implementation worker. |

## Advisor orchestration strategy

The source plan's strategy applies unchanged: the active advisor owns decisions, the integration branch `feat/988-advisor-first-orchestration`, execution state, evidence acceptance, and PR readiness. Workers T1 (policy, H), T2 (test author, H), T3 (docs, L), T4 (check runner, L), and T5 (independent read-only review, H) run through `/delegate` with the briefs in the source plan's "Ready-to-send worker briefs" section. Waves W0–W5, the failure table, and the shared restrictions come from the source plan. Concrete bindings, native worker IDs, and observed settings are recorded in `.oh/tasks/advisor-first-orchestration/delegate-graph.json` and `delegate-log.txt`.

Bindings resolved during W0 preflight are recorded in `delegate-graph.json`, not here. `L` under the Claude preference means Opus with thinking disabled; if native evidence cannot confirm that control, the L assignments block and the advisor asks for an authorized alternative. `H` inherits the parent Fable 5.1 session model with the operator-selected effort; the advisor records that selection reason per task.

## User Stories

### US-001: Root and canonical skills state one advisor-first execution model

**Description:** As the operator, I want `AGENTS.md`, `/spec`, `/delegate`, the task prompt, and `/plan` to agree that the active session advises and accepts while bounded workers implement, so that a handoff is never needed to obtain worker-first execution.

**Acceptance Criteria:**

- [ ] `AGENTS.md` states advisor-first accountability as a declarative principle with links to `.oh/skills/spec/SKILL.md` and `.oh/skills/delegate/SKILL.md`; no model names, thinking controls, worker limits, retry rules, evidence formats, workflow section, skills section, or direct slash-skill mention; `wc -c AGENTS.md` ≤ 9500; `CLAUDE.md` remains a symlink
- [ ] `bash .oh/evals/probes/agents-identity-contract.sh` and `bash .oh/evals/probes/context-tier-size-budget.sh` exit 0
- [ ] `.oh/skills/spec/SKILL.md`, `references/execute.md` (steps 3–4 and the PR template), and `templates/task-prompt.md` route tracked implementation edits through bounded `/delegate` workers before the owner performs acceptance; direct parent implementation requires a recorded operator exception; the single owner, human merge gate, and no-second-supervisor rules remain
- [ ] `.oh/skills/spec/references/plan.md` carries an orchestration-transfer check: worker briefs, model constraints, evidence gates, and exceptions survive conversion into `prd.md` and the rendered prompt
- [ ] `.oh/skills/delegate/SKILL.md` keeps judgment in the advisor, keeps coupled implementation in one continuing worker, honors explicit operator selections and exclusions after a native capability check, records requested and observed settings separately, blocks on unsupported required controls, and keeps bounded concurrency and recursion rules; provider-specific preferences are separated from the portable contract
- [ ] `.oh/skills/plan/SKILL.md` (added to the tree from the local baseline) requires the bounded-assignment fields, complete DoD coverage, repair routes, and same-session default with optional handoff text; planning-only behavior preserved
- [ ] No file under `.oh/skills/` introduces `Advisor` as a role identity (probe `roles-are-skills.sh` passes); `bash .oh/scripts/link-providers.sh --check` exits 0
- [ ] `git diff --check` exits 0; STE check passes on every changed Markdown file
- [ ] Typecheck passes

### US-002: Probes enforce the advisor-first contract with demonstrated failure branches

**Description:** As a maintainer, I want the six named probes plus two new instruction probes to reject omitted delegation, invalid routing claims, stale evidence, and incomplete briefs, so that the contract cannot silently regress.

**Acceptance Criteria:**

- [ ] `delegate-model-effort-policy.sh` replaces the obsolete inherit/routine-tier assertions with the approved contract: explicit operator selections honored after capability checks, requested/observed recorded separately, unsupported required controls block, Sonnet exclusion, no `max` thinking, attribution checks preserved
- [ ] `delegate-worker-boundary.sh`, `spec-single-owner.sh`, and `roles-are-skills.sh` enforce the new ownership wording (advisor owns acceptance; workers own tracked edits; no second supervisor; no project-agent catalog) without weakening isolation or read-only-worker protection
- [ ] New `advisor-execution-contract.sh` checks `execute.md`, the task prompt, and `spec/SKILL.md` for worker-first implementation, recorded operator exception for direct edits, same-session default, optional transfer, and no fixed advisor identity
- [ ] New `plan-orchestration-contract.sh` checks `plan/SKILL.md` and `spec/references/plan.md` for the required assignment fields, DoD coverage, repair routes, and validity without a handoff prompt
- [ ] Each changed or new probe demonstrates REGRESSION under an injected defect in a disposable committed checkout and PASS after restoration; recipes cover missing delegation, silent Sonnet substitution, off-to-low substitution, unsupported max, stale acceptance evidence, overlapping writers, forced handoff, hard-coded advisor identity, and concurrent ownership after transfer
- [ ] Runtime model checks remain distinct from prose checks; no probe claims to prove effective thinking settings
- [ ] `bash .oh/skills/eval/run.sh` exits 0 with no new green→red regression; result recorded in `eval-result.json`
- [ ] Typecheck passes

### US-003: Documentation and architecture records describe the changed default

**Description:** As a reader, I want the task guide, glossary, RFC index, and changelog to describe advisor-first ownership and link ADR #989, so that the recorded architecture matches the skills.

**Acceptance Criteria:**

- [ ] `docs/rfcs/README.md` indexes [#989] as the ADR that supersedes #929's direct-implementation default while preserving its role-as-skill and single-runtime decisions; #929's row is not rewritten as if the new default already existed
- [ ] `docs/glossary.md` defines the advisor as behavior of the active session and keeps the existing `worker / subagent`, `rule`, `rfc / adr`, and runtime/owner wording the `roles-are-skills.sh` probe pins
- [ ] `.oh/tasks/README.md` names the advisor as the accountable owner and bounded workers as the writers of tracked edits
- [ ] `CHANGELOG.md` Unreleased carries entries referencing #988 and #989
- [ ] No duplicated routing tables outside `.oh/skills/delegate/SKILL.md`; STE and `git diff --check` pass
- [ ] Typecheck passes

### US-004: Native routing preflight records requested and observed worker settings

**Description:** As the advisor, I want a requested/observed capability matrix from real native calls before dispatch, so that model preferences are honored only where the provider supports them.

**Acceptance Criteria:**

- [ ] `delegate-graph.json` records, for every worker, complexity, requested model and reasoning, selection reason, observed settings with provenance, native worker ID, status, and artifact references; unknown values remain unknown
- [ ] The Agent tool schema is inspected and documented: which model aliases and reasoning controls exist; Sonnet is never passed; `max` is never passed
- [ ] Any required control that native evidence cannot confirm blocks the affected assignment; the gap and the operator's alternative decision are recorded before dispatch
- [ ] The Luna/Max and Astra/high preference is recorded as a capability gap or verified surface; no invented parameter is passed
- [ ] Typecheck passes

### US-005: Checks, fault injection, and same-session and transfer trials produce commit-specific evidence

**Description:** As the advisor, I want fixed checks and trials run against the integrated commit, so that acceptance rests on observed outputs rather than worker summaries.

**Acceptance Criteria:**

- [ ] The plan's verification commands run against the integrated commit with real exit codes captured
- [ ] Fault-injection recipes run only in a disposable committed checkout outside the integration worktree and the root; restored PASS follows each case
- [ ] A defective worker patch seeded in a disposable checkout is rejected; repair and fresh checks precede acceptance
- [ ] Same-session dispatch is exercised without a handoff prompt; a requested-transfer kickoff prompt is validated to point to the plan without duplicating briefs, and duplicate ownership is rejected
- [ ] A rollback rehearsal on a scratch branch restores policy and probes together
- [ ] Typecheck passes

### US-006: Efficiency claims are measured or explicitly absent

**Description:** As the operator, I want any efficiency statement backed by a matched comparison or marked unmeasured, so that the PR does not claim savings it cannot show.

**Acceptance Criteria:**

- [ ] If the operator approves tasks, repeats, and a budget, a matched baseline-versus-candidate comparison runs from one starting revision with fixed criteria and records parent, worker, reviewer, retry, and repair usage or explicit gaps
- [ ] If no budget is approved, `evidence.md` states that no efficiency claim is made and records the operator disposition
- [ ] No token, cost, or time saving is asserted without complete observed totals
- [ ] Typecheck passes

### US-007: Independent review, knowledge impact, evidence, and PR gates complete

**Description:** As the reviewer, I want a fresh read-only review keyed to D1–D12, resolved knowledge pages, and a committed evidence document, so that the PR is promotable on its actual head.

**Acceptance Criteria:**

- [ ] A read-only reviewer reports findings keyed to D1–D12 on the integrated head; blocking findings are repaired by the original writer and re-reviewed
- [ ] `knowledge-impact.sh --changed <actual diff>` runs; every page in the union ends UPDATED, REVERIFIED, or NOT-AFFECTED with a reason; `wiki-readme-index.sh` passes
- [ ] `evidence.md` answers the five questions, includes the requested/observed matrix and the D1–D12 disposition, and is committed with `git add -f`
- [ ] `/audit implementation` returns AUDIT-PASS; `/audit pr` classifies the pushed head promotable; the PR is marked ready and not merged
- [ ] Typecheck passes

## Knowledge Context

- **Base commit**: `9261d5127102b112ee1f0c7f6b74fbb1c619fc9e`
- **Queries**: `delegate advisor orchestration spec` over `.oh/knowledge/source` and `.oh/knowledge/patterns` (grep; the plan's own query returned one pattern match)
- **Knowledge used**: `[[pattern-evals-probe-brief-under-enumeration]]`, `[[pattern-wiki-external-model-over-mapping]]`, `[[plan-vs-built-reconciliation]]`
- **Grounded against**: `AGENTS.md`, `.oh/skills/spec/SKILL.md`, `.oh/skills/spec/references/plan.md`, `.oh/skills/spec/references/execute.md`, `.oh/skills/spec/templates/task-prompt.md`, `.oh/skills/delegate/SKILL.md`, `.oh/skills/plan/SKILL.md` (untracked local baseline), `.oh/evals/probes/agents-identity-contract.sh`, `.oh/evals/probes/context-tier-size-budget.sh`, `.oh/evals/probes/delegate-model-effort-policy.sh`, `.oh/evals/probes/delegate-worker-boundary.sh`, `.oh/evals/probes/spec-single-owner.sh`, `.oh/evals/probes/roles-are-skills.sh`, `.oh/scripts/link-providers.sh`, `docs/rfcs/README.md`, `docs/glossary.md`, `.oh/tasks/README.md`, `CHANGELOG.md`
- **Conflicts discovered**: none. `pattern-evals-probe-brief-under-enumeration` warns that a name inventory is not the regression surface; the plan already says the six probes are a starting set and the suite run is authoritative.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `plan-vs-built-reconciliation` (declares `execute.md` as a source); possibly a new `kind: repo` page for the advisor-first execution contract if the diff introduces a reusable mechanism
- **Affected source paths**: `AGENTS.md`, `.oh/skills/spec/**`, `.oh/skills/delegate/SKILL.md`, `.oh/skills/plan/SKILL.md`, `.oh/evals/probes/{delegate-*,spec-single-owner,roles-are-skills,advisor-execution-contract,plan-orchestration-contract}.sh`, `docs/glossary.md`, `docs/rfcs/README.md`
- **Reason**: The task changes the execution-ownership model, skill behavior, and shared vocabulary.

## Plan Reconciliation

- **Source plan**: `/home/sandbox/harness/.oh/plans/advisor-first-orchestration/plan.md`
- **Intent preserved**: YES
- **Material deviations**: one, operator-approved during execution on 2026-09-06: the nested-agent audit route driver (`claude -p` behind `AUDIT_AGENT_COMMAND_JSON`) is retired and replaced by a scripted driver inside this PR (issue #993). Trigger: the driver was refused by a provider spend limit while the session and its workers kept running; its model is unrecorded and unbound by the operator's constraints; the gates it re-derives are deterministic. Owner: bounded worker T6.
  Second, operator-approved in the pre-merge repair round: the D3 request "Opus with thinking disabled" was reinterpreted by the operator as Opus for low-complexity workers with the advisor judging the effort level per task (never `max`); no fixed effort preference and no subagent definition file. Owner: bounded worker T7.
- **Constraints discovered during grounding**:
  - The planning base `9a479575` moved to `9261d512` on `origin/development`. The intersection with grounded paths is `docs/rfcs/README.md` and `CHANGELOG.md` (T3's files); no skill, template, or named probe changed.
  - `.oh/skills/plan/SKILL.md` is untracked at the root. The scaffold commit adds the unmodified local baseline to this branch so T1's diff shows only its reconciliation edits. `.claude/skills` is a directory symlink to `.oh/skills`, so no provider link is needed for the new skill.
  - The `roles-are-skills.sh` probe rejects the capitalized token `Advisor` in `.oh/skills/` outside a negation; the new prose uses lowercase `advisor` as a behavior, never a role identity.
  - Tracking issue #988 and ADR issue #989 were opened at the start of execution; the ADR stays Draft until the PR lands.
  - The Agent tool schema visible to this session exposes `model` (aliases `sonnet`, `opus`, `haiku`, `fable`) and no per-call `thinking` or `effort` parameter; the D3 capability gate resolves this during W0 preflight and may block the `L` assignments.
  - The D10 comparison requires operator approval of tasks, repeats, and a resource budget; that approval was not part of the implementation authorization, so US-006 records the disposition the operator gives.
