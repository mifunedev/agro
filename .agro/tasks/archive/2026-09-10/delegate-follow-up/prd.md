# PRD: Delegate follow-up — four residual delegation corrections

## Approved namespace-reconciliation continuation

The operator approved repair of PR #1004's conflicts with namespace-cutover PR #996, fresh review and verification, then merge and safe PR-specific cleanup.
The integration target is `a227bbf3f3166a0e1a8a1951fc88694cfa0151ee`.
The accepted pre-migration head is `e81a5aad703a0f7081104a97d2eea980b72bca2e`.
The current repaired content is `e139bc363d95b5ee1acf4a22ca3c1a2a7c37c1c4`.

Current source and task paths use `.agro/`.
The original plan below retains the paths and baseline that the operator approved at that time.
Those historical paths do not authorize a second current `.oh` control plane.
Historical raw evidence and frozen procedures retain their original bytes and observation limits.
SA-1 still defers only successful cross-session reconnection on the tested provider.
Issue #1014 remains separate and does not authorize an experiment or implementation here.

| Criterion | Implementation or execution owner | Acceptance evidence |
|---|---|---|
| R1: Preserve all four accepted behavioral repairs in the canonical namespace | Continuing Luna worker in the isolated PR worktree | Complete source delta, namespace-normalized equivalence, focused and adjacent probes, independent review |
| R2: Preserve historical task and runtime provenance | Luna relocates files; parent owns current completion records | Exact identity of all 104 original task blobs at the repair head; frozen runtime and repair manifests remain unchanged |
| R3: Verify the actual target and repaired head | Parent and independent read-only reviewer | Full base/head evals, individual non-PASS receipts, mutation outcomes, final-head CI and actual audits |
| R4: Merge only the accepted matching head into development | Luna, after explicit parent acceptance release | Fresh head/base checks, expected-head merge guard, GitHub merge receipt, post-merge CI and issue #1003 closure |
| R5: Clean only safe PR-specific resources | Luna for PR resources; parent for parent-created verification worktrees | Classified resource inventory, merged-content proof, preserved unique evidence, final removed/retained list |

The parent retains scope, task state, integration approval, verification, acceptance, and undraft authority.
Luna stays the single continuing implementation worker and pauses at the repair-review gate.
Independent review reads an immutable commit in an isolated worktree and owns no implementation files.
A successful worker report alone releases no merge or cleanup.

### Surface reconciliation

This table records the parent reconciliation after the repair. It is not a claim that a checklist preceded dispatch.

| Surface | Disposition |
|---|---|
| Host and sandbox | Applied: all work stays inside the sandbox; root shared checkout and active writers remain untouched |
| Lifecycle door | Not applicable: no lifecycle verb, installer, or runtime command changes |
| Canonical and provider surfaces | Applied: reconcile `.agro` source and verify provider links; never edit a mirror |
| Root and scaffold | Applied: preserve portable canonical skill behavior; no separate scaffold implementation |
| Interactive and headless processes | Applied: Luna remains in existing Herdr; finite checks use managed background monitors; no service changes |
| Local and remote operation | Applied: GitHub checks and expected-head merge guard use actual remote refs; work does not require an attached operator terminal |
| Parallel operation | Applied: isolated implementation, independent review, and parent evaluation worktrees; serialize writes and freeze reviewed source |
| Public documentation | Not applicable to this repair: no new public feature; the external documentation follow-up remains deferred |
| Verification | Applied: R1–R5 map to explicit evidence and acceptance owners above |

## Original approved plan and baseline

Issue: #1003. Predecessor: #988 / PR #991, merged at `e90bbed8`.
Source plan: `.oh/plans/delegate-follow-up/plan.md` (operator-approved).
Approved baseline: `56ab2bab894e43073bf79edc43f70fe3ddd6d6de`.

## Introduction

PR #991 made the active session the advisor of every build and gave `/delegate` the
worker-model policy, the dispatch-record contract, and the audit gate-4/gate-5
completion rules. Four instruction gaps survived that work, all inside
`.oh/skills/delegate/SKILL.md`: the wave loop still releases dependents on a worker's
*report* rather than on the advisor's *acceptance*; sizing guidance still tells the
advisor to maximize parallelism and prefer smaller tasks regardless of coupling; resume
skips `running` tasks entirely and trusts a saved `completed` label without checking
that its evidence still describes the required artifact revision; and the skill calls a
Memory Protocol that does not exist while its own trigger fires on plan creation and its
diagram writes the run ledger before the `--dry-run` branch that the prose says must
write nothing.

This task closes those four gaps and extends the two probes that pin the affected
contracts. It changes no other behavior.

## Goals

- A dependent wave consumes accepted artifacts, never an unverified worker summary.
- Delegation boundaries follow complexity, briefing overhead, shared context, and
  verification cost; one continuing bounded worker stays a valid answer.
- Resume reconciles `running` tasks against real worker state and artifacts, never
  spawning a duplicate and never trusting stale completion evidence.
- Every procedure reference in the skill resolves, planning alone dispatches nothing,
  and the read-only `--dry-run` contract is preserved in both the prose and the diagram.
- The merged model/effort, ownership, handoff, and gate-4/gate-5 contracts survive
  unchanged.

## User Stories

### US-001: Gate dependency release on advisor acceptance

**Description:** As the advisor, I want a wave's dependents to start only after I have
accepted the artifacts they consume, so that a defective worker result cannot propagate
into downstream work.

**Acceptance Criteria:**

- [ ] `.oh/skills/delegate/SKILL.md` step 5b distinguishes a worker's reported
      `completed` status from advisor acceptance, and names the recorded acceptance state
      that step 5d reads
- [ ] Step 5d passes accepted artifacts and accepted summaries forward; an unaccepted or
      failed result blocks its dependents and returns the defect to the bounded writer
      named in the task's failure / repair route
- [ ] The final integrated validation in step 6 remains a separate, still-required check;
      per-task acceptance does not replace it
- [ ] The change reuses the existing `pending`/`running`/`completed`/`FAIL`/`BLOCKED`
      state model and the existing evidence ownership; no new lifecycle is introduced
- [ ] A disposable-context exercise records dependency eligibility before checking, after
      a failed check, and after a verified repair, with real observations in `evidence.md`
- [ ] `bash .oh/evals/probes/delegate-worker-boundary.sh` and
      `bash .oh/evals/probes/advisor-execution-contract.sh` exit 0

### US-002: Replace maximum-parallelism slogans with useful bounded sizing

**Description:** As the advisor, I want sizing guidance that names the factors deciding a
task boundary, so that I neither split coupled work artificially nor spawn workers a
sequential task does not need.

**Acceptance Criteria:**

- [ ] The core principle at `.oh/skills/delegate/SKILL.md:19` no longer instructs the
      advisor to maximize parallelism; dependency order remains absolute
- [ ] The decomposition rule at `:199` no longer prefers more smaller tasks as a default;
      it states that complexity, briefing overhead, shared context, and verification cost
      decide the boundary, and that one continuing bounded worker is a valid answer
- [ ] Existing concurrency (max 5 per wave) and recursion-authorization limits are
      unchanged
- [ ] The dispatch record requires scope, selection reason, search/output limits, expected
      evidence, and a stopping condition in the worker brief. The search/output-limits and
      stopping-condition fields are ADDED by this change: independent review established that
      neither existed in the dispatch-record table at the approved base, so the earlier
      "still requires" wording was false
- [ ] No scheduler, no new machinery, and no unmeasured efficiency or token-savings claim
      is added
- [ ] One coupled, one independent, and one mechanical brief are reviewed against the
      revised skill; the full review is recorded in `progress.txt`, with a summary and
      pointer in `evidence.md`

### US-003: Reconcile interrupted `running` tasks on resume

**Description:** As the advisor resuming a delegation, I want `running` tasks reconciled
against real worker state and artifacts, so that I never spawn a duplicate writer or
accept a completion label whose evidence has gone stale.

**Acceptance Criteria:**

- [ ] Step 4's resume rule covers `running`: inspect the persisted native worker
      reference and the current artifacts before any retry
- [ ] A worker still active is reconnected to or observed through the supported native
      mechanism; the skill forbids spawning a duplicate for it
- [ ] A worker that ended has its artifacts validated before the advisor decides to
      accept, resume, or retry only the incomplete scope
- [ ] Unknown native status or unknown artifact provenance is reported as ambiguity and
      blocks duplicate writes
- [ ] A saved `completed` label whose evidence no longer describes the required artifact
      revision is not trusted
- [ ] The resume path still appends to `delegate-log.txt` and never truncates it
- [ ] Active, ended-with-valid-artifacts, interrupted-incomplete, unknown-status, and
      stale-evidence cases are exercised; the case-by-case record is in `progress.txt`,
      summarised in `evidence.md`. Each case states whether it is a **live native
      observation** or a **fixture**, and the cross-session reconnect branch is recorded
      **BLOCKED on a missing native capability** rather than silently satisfied
      *(amended by SA-1 — see the note below; the branch is now recorded* **DEFERRED** *rather
      than* **BLOCKED**, *and is still not recorded as satisfied)*

> **AMENDMENT NOTE — operator scope amendment SA-1 (2026-09-07).**
>
> This document is the approved plan **as written**, and its criteria above are left
> unticked and undeleted on purpose. `prd.json` carries the authoritative completion
> state; where the two differ, `prd.json` decides.
>
> **Deferred, and only this:** D4 cross-session reconnection on the tested provider —
> that a still-active worker can be reconnected to or observed *across sessions*, from
> persisted state alone, through a supported native mechanism.
>
> **Still required, and verified:** within-session recovery (reconnect to or observe a
> still-active worker without spawning a duplicate); and cross-session **fail-closed**
> behaviour (no duplicate writer, no unauthorized writes when the handle cannot be
> resolved).
>
> **What SA-1 is not:** not evidence that cross-session reconnection works; not a blanket
> waiver of US-003 or D4; not a waiver of any other criterion; not authorization for new
> infrastructure or a repeat experiment.
>
> **Retained as:** a deferred provider-capability item. Closing it needs a provider surface
> exposing a durable worker handle that survives the dispatching session.
>
> **Two criteria above are affected.** The second criterion — *"A worker still active is
> reconnected to or observed through the supported native mechanism"* — did not distinguish
> within-session from cross-session recovery. `prd.json` now splits it: the within-session
> half is verified live; the cross-session half is marked in place with the prefix
> `[DEFERRED BY OPERATOR SCOPE AMENDMENT SA-1 - NOT SATISFIED, NOT CLAIMED]`. The final
> criterion's requirement that the branch be recorded **BLOCKED** was accurate when written
> and was met — the branch stood BLOCKED, audit `audit-20260907T214546Z-3826355` failed gate
> 1 closed, and the PR was DRAFT-BLOCKED. SA-1 came afterwards and changes that record from
> BLOCKED to DEFERRED. **Neither state is "satisfied", and none of that history is rewritten
> as a prior pass.** The full boundary and the measurement it rests on are in
> `evidence.md` under *D4 cross-session reconnect*.

### US-004: Remove the undefined Memory Protocol and the accidental execution trigger

**Description:** As a reader of the skill, I want every procedure reference to resolve and
planning alone to dispatch nothing, so that loading the skill or finishing a plan cannot
start execution or write execution state.

**Acceptance Criteria:**

- [ ] No `Memory Protocol` reference remains in `.oh/skills/delegate/SKILL.md` (currently
      `:125`, `:132`, `:145`, `:162`); no memory subsystem is created to satisfy the stale text
- [ ] The frontmatter trigger at `:5` no longer fires on `/prd` or plan creation; the
      description keeps its valid triggers and its skill-frontmatter contract
      (`name`, `description`, `argument-hint`)
- [ ] The Decision Flow diagram branches on `--dry-run` before the run-ledger write, matching
      the prose rule at `:260` that `--dry-run` writes neither file
- [ ] `--dry-run` remains read-only: it emits the task graph and wave plan, dispatches no
      worker, and creates no execution state
- [ ] A plan-only request and an authorized `--dry-run` are exercised with native dispatch
      events and execution-state files observed before and after; neither path dispatches a
      worker nor creates execution state

### US-005: Extend the two contract probes to pin the corrected behavior

**Description:** As the maintainer, I want the corrected contracts pinned by the existing
probes, so that a future edit cannot silently reopen any of the four gaps.

**Acceptance Criteria:**

- [ ] `.oh/evals/probes/delegate-worker-boundary.sh` and
      `.oh/evals/probes/advisor-execution-contract.sh` gain checks for acceptance-before-release,
      useful sizing, `running`-task reconciliation, resolved procedure references, and the
      preserved read-only `--dry-run` contract
- [ ] No parallel test framework is created; both probes keep their existing structure and
      runner contract
- [ ] Each added check rejects its targeted mutation in a disposable copy and passes after
      restoration; the injected fault and the restored pass are both recorded with exit codes
- [ ] Per `[[pattern-evals-negation-must-govern-token]]`, each negative assertion binds its
      negation to the token it forbids rather than to a whole sentence
- [ ] Both probes exit 0 on the integrated result

### US-006: Prove the merged contracts and the suite still hold

**Description:** As the advisor, I want the predecessor's contracts and the wider probe
suite verified on the integrated commit, so that no merged guarantee is weakened and no
new regression ships.

**Acceptance Criteria:**

- [ ] `bash .oh/evals/probes/delegate-model-effort-policy.sh`,
      `bash .oh/evals/probes/spec-single-owner.sh`,
      `bash .oh/evals/probes/plan-orchestration-contract.sh`, and
      `bash .oh/evals/probes/roles-are-skills.sh` each exit 0 on the integrated result
- [ ] `bash .oh/scripts/link-providers.sh --check` exits 0; the canonical `.oh/` source was
      edited and no provider mirror was patched
- [ ] `bash .oh/skills/eval/run.sh` runs on the approved base and on the integrated result;
      every non-PASS row is reviewed and each pre-existing failure is reproduced on the base
      before it is attributed elsewhere
- [ ] Per `[[pattern-evals-probe-brief-under-enumeration]]`, the suite run — not a name
      grep — is the authoritative list of affected probes
- [ ] The merged model/effort policy, the no-Sonnet exclusion, the requested-vs-observed
      evidence rule, single-owner ownership, optional handoff, and the audit gate-4/gate-5
      completion contract are unchanged by this diff
- [ ] Real exit codes and the tested commit are recorded in `evidence.md`; a skipped check
      is recorded as a gap, never as a pass

### US-007: Record the core-versus-deferred disposition

**Description:** As the operator, I want every deferred item to carry an explicit
disposition, so that the follow-up register stays visible without this PR silently
absorbing or silently dropping it.

**Acceptance Criteria:**

- [ ] `evidence.md` gives an explicit disposition to each retained register row: audit
      gate-3 remote-PR/local-HEAD mismatch, audit gate-5 metric-base skew,
      `mifunedev/openharness-web` documentation, probe robustness, the three known
      environment failures (`curl-bash-safe-alternatives`, `oh-config-surfaces`,
      `skills-vendored`), the optional efficiency comparison, live transfer testing, and
      historical unknown model/effort observations
- [ ] The final diff touches none of the deferred surfaces;
      `.oh/skills/audit/scripts/route-driver.sh` and
      `.oh/evals/probes/audit-run-root-contract.sh` are read-only in this task
- [ ] No paid experiment and no external documentation change is started without separate
      operator approval
- [ ] Historical unknown model and effort observations are preserved as unknown; no
      retrospective setting is manufactured
- [ ] The final diff is compared against the four core gaps and every register row, and the
      comparison is recorded

## Functional Requirements

- FR-1: `.oh/skills/delegate/SKILL.md` step 5b records advisor acceptance as state distinct
  from a worker's reported `completed` status.
- FR-2: Step 5d releases a dependent only on accepted artifacts; an unaccepted result blocks
  dependents and routes the defect to the named repair worker.
- FR-3: Step 6's integrated validation remains required and separate from per-task acceptance.
- FR-4: The core principle and the decomposition rules state the factors that decide a task
  boundary instead of maximizing parallelism or preferring smaller tasks by default.
- FR-5: Max 5 concurrent workers per wave and the `Max depth` / `Max children per level` /
  `Step budget` recursion triple are unchanged.
- FR-6: Step 4's resume rule reconciles `running` tasks against native worker state and current
  artifacts before any retry, and forbids duplicate dispatch for an active worker.
- FR-7: Resume treats unknown native status or unknown artifact provenance as ambiguity that
  blocks writes, and does not trust a `completed` label with stale evidence.
- FR-8: No `Memory Protocol` reference remains anywhere in the skill.
- FR-9: The frontmatter trigger does not fire on `/prd` or plan creation.
- FR-10: The Decision Flow diagram branches on `--dry-run` before the run-ledger write.
- FR-11: `--dry-run` stays read-only — no worker dispatch, no execution state.
- FR-12: `delegate-worker-boundary.sh` and `advisor-execution-contract.sh` assert FR-1 through
  FR-11 and reject a targeted mutation of each.

## Non-Goals

- The audit driver's gate-3 remote-PR/local-HEAD mismatch and gate-5 metric-base skew. Both
  are deferred; `.oh/skills/audit/scripts/route-driver.sh` and
  `.oh/evals/probes/audit-run-root-contract.sh` are read-only here.
- Any change to `mifunedev/openharness-web` or other published documentation.
- Broad probe hardening or a rewrite of the paraphrase blind spots disclosed by #991.
- Triage or repair of the three known environment failures.
- An efficiency comparison, a token-savings claim, or a live two-session transfer test.
- Any rewrite of historical unknown model or effort observations.
- Re-implementing the predecessor's advisor ownership, worker-model policy, worker-brief
  contract, evidence rules, or optional handoff — or creating a second routing policy.
- Creating a repository agent catalog, a memory subsystem, a scheduler, or a new task
  lifecycle.

## Technical Considerations

- The canonical source is `.oh/skills/delegate/SKILL.md`. `.claude/skills` is a symlink to
  `../.oh/skills`; no provider mirror is edited, and `link-providers.sh --check` proves it.
- The two probes assert instruction text. Text assertions do not prove runtime ordering or
  recovery, so the acceptance-ordering, resume, and dry-run rows of the verification matrix
  require real isolated worker observations. A missing capability or an unauthorized test
  context blocks its required criterion rather than being satisfied by a static check.
- `.oh/tasks/` is gitignored; `prd.md`, `prd.json`, `progress.txt`, `evidence.md`, and any
  `delegate-graph.json` / `delegate-log.txt` this PR carries are staged with `git add -f`.
- This follow-up writes only `.oh/tasks/delegate-follow-up/`. It never appends to the
  predecessor's `.oh/tasks/advisor-first-orchestration/` records.

## Success Metrics

- All seven DoD criteria D1–D7 in the source plan are satisfied or explicitly recorded as
  blocked with a named missing capability.
- The six named probes exit 0 on the integrated result and each new probe check is
  fault-injection tested.
- `.oh/skills/eval/run.sh` shows no new regression against the approved base.
- The PR reaches a verified ready-for-review state. It is not merged.

## Open Questions

None at planning time. The plan's open-question section is empty and grounding introduced
none.

## Knowledge Context

- **Base commit**: `56ab2bab894e43073bf79edc43f70fe3ddd6d6de`
- **Queries**: `/wiki query delegate spec evals audit skill orchestration advisor`; `/wiki query delegate spec evals audit skill orchestration advisor --patterns`
- **Knowledge used**: `[[plan-vs-built-reconciliation]]`, `[[audit-architecture]]`, `[[pattern-audit-remote-head-verdict]]`, `[[pattern-spec-simplify-round-seeded-non-reducing]]`, `[[pattern-evals-probe-brief-under-enumeration]]`, `[[pattern-delegate-worker-terminated-before-report]]`, `[[pattern-audit-driver-tool-allowlist]]`
- **Grounded against**: `.oh/skills/delegate/SKILL.md` (all four gap sites re-read at the base commit: `:5`, `:19`, `:125`, `:132`, `:145`, `:162`, `:199`, `:255-258`, `:260`, `:295-301`, `:320`), `.oh/skills/audit/scripts/route-driver.sh` (`gate3_pr` has no `headRefOid`/`HEAD` comparison; `gate5` passes the plain `--base` ref to `slop-metrics` — both deferred, read-only), `.oh/evals/probes/delegate-worker-boundary.sh`, `.oh/evals/probes/advisor-execution-contract.sh`, `.oh/evals/probes/delegate-model-effort-policy.sh`, `.oh/evals/probes/spec-single-owner.sh`, `.oh/evals/probes/plan-orchestration-contract.sh`, `.oh/evals/probes/roles-are-skills.sh`, `.oh/evals/probes/audit-run-root-contract.sh`, `.oh/tasks/README.md`, `.oh/skills/git/SKILL.md`, `.oh/skills/wiki/references/query.md`
- **Conflicts discovered**: `[[plan-vs-built-reconciliation]]` is `NEEDS-REVIEW` — its declared source `.oh/skills/spec/references/execute.md` changed after `verified_at: 14127d7c`. Its claims are used here only as orientation; the evidence-gate mechanics this build relies on are re-read from `execute.md` itself during `/spec execute`. `[[pattern-audit-driver-tool-allowlist]]` is already `confidence: deprecated` and describes the retired `claude -p` driver — carried for history, relied on for nothing. The other five recalled pages agreed with their sources.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `plan-vs-built-reconciliation` (REVIEW — declares `execute.md`, which this build re-reads); no page declares `.oh/skills/delegate/SKILL.md` or either edited probe as a source, so no entity page is predicted to change on the diff alone
- **Affected source paths**: `.oh/skills/delegate/SKILL.md`, `.oh/evals/probes/delegate-worker-boundary.sh`, `.oh/evals/probes/advisor-execution-contract.sh`
- **Reason**: The change alters skill behavior and the delegation runtime flow — acceptance ordering, resume semantics, and the dry-run contract. `pattern-delegate-builtin-type-carries-own-model` and `pattern-evals-negation-must-govern-token` cite delegate paths, but pattern provenance is immutable, so they are `NOT-AFFECTED` by construction. The authoritative impact is derived from the actual diff at the knowledge-impact gate, not from this prediction.

## Plan Reconciliation

- **Source plan**: `.oh/plans/delegate-follow-up/plan.md`
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**: (1) The approved baseline `56ab2bab` is
  current `origin/development` HEAD — nothing landed after the plan's snapshot, so the
  plan's S0 recheck removes no work and all four gaps remain live, each re-verified at its
  cited line. (2) The plan's line citations for the trigger and Memory Protocol resolve to
  `:5` and `:125`/`:132`/`:145`/`:162`, and the ledger-before-dry-run ordering to `:129-131`
  against the prose at `:260`; the plan's approximate ranges are correct.
  (3) `plan-vs-built-reconciliation` is `NEEDS-REVIEW`, recorded above.
- **Orchestration preserved**: YES

## Advisor orchestration strategy

Carried from the source plan's `## advisor orchestration strategy`. The active session is
the sole advisor and owns scope, task state, integration, acceptance, and this task folder.
It dispatches no nested workers of its own beyond the two assignments below, and it never
appends to the predecessor's task folder.

| Task | Complexity and selection reason | Requested model / reasoning | Depends on | Read scope; owned write paths; exclusions | Execution directory; worker type; continuation | Deliverable and verification | DoD IDs; acceptance owner; repair route |
|---|---|---|---|---|---|---|---|
| A0 | Bounded advisor review of scope and baseline; no worker dispatch. | Active session. | Operator approval. | Read the plan, predecessor evidence, the current skill, the probes, and the `/spec` consumers. Own only this task folder and the acceptance records, through their canonical procedures. | Active sandbox session. | Approved baseline, native preflight, retained-item dispositions. | D1, D7; active advisor; ambiguity goes to the operator. |
| T1 | Medium: acceptance and recovery share the graph's semantics and need negative cases, so the edits stay coupled in one continuing worker. | Resolved per `.oh/skills/delegate/SKILL.md` `## Worker model and reasoning policy` before dispatch — a supported non-Sonnet model with the advisor-judged effort, requested and observed recorded separately. Never Sonnet, never `max`. | A0. | Read the verification matrix and its sources. Owns exactly `.oh/skills/delegate/SKILL.md`, `.oh/evals/probes/delegate-worker-boundary.sh`, `.oh/evals/probes/advisor-execution-contract.sh`. Excludes the audit driver and its tests, model policy, provider settings, root instructions, public docs, and the predecessor's task files. | Absolute isolated worktree `/home/sandbox/harness/.worktrees/skill/1003-delegate-follow-up`; native write-capable built-in (`general-purpose`); native continuation, else checkpoint-and-rebrief of only the incomplete scope. | Bounded patch, worker log, tested revision, verification-matrix results with real exit codes. The advisor records accepted evidence in `.oh/tasks/delegate-follow-up/evidence.md`. | D2, D3, D4, D5, D6; active advisor; failed checks return to T1. |
| T2 | Medium: independent cross-file and runtime-evidence review; no duplicate implementation. | Resolved under the same policy; no excluded model. | T1 integrated and the advisor's own checks complete. | Read the complete diff, all matrix sources, and this task's evidence. Owns no write paths. Excludes dispatch, implementation, and session steering. | Same worktree, read-only; native general-purpose reviewer under a read-only brief; checkpoint-and-rebrief for a repair review. | Findings per criterion against the tested revision; independent verification of the matrix evidence and the deferred dispositions. The advisor records the verdict. | D1–D7; active advisor; T1 repairs, T2 re-reviews. |

Before dispatch the advisor supplies exact worktree paths, native model/reasoning bindings,
allowed side effects, test commands, and evidence destinations, and it records requested
versus observed settings. `inherit` is a provisional request, never a claim about effective
settings. If a required native control is unavailable, the advisor follows the canonical
blocked-control procedure rather than changing parent or shared settings. The advisor
conducts the native runtime rows of the verification matrix through separately bounded
disposable test assignments; T1 supplies the setup instructions and dispatches no nested
worker. A missing required capability blocks its gate and is reported, never substituted
with a static check.

### Verification matrix

| Check | Procedure | Required result; DoD IDs |
|---|---|---|
| Acceptance ordering | In a disposable task, a worker returns a defective artifact as complete. Observe dependency eligibility before checking, after the failed check, and after bounded repair. | No dependent starts before verified acceptance; repair permits release; step 6 integration checks stay separate. D2 |
| Useful sizing | Review one coupled, one independent, and one mechanical brief against the revised skill. | Scope, selection reason, search/output limits, stopping condition, and decisive checks are present; coupled work needs no artificial split. D3 |
| Resume | Exercise an active worker, an ended worker with valid artifacts, interrupted incomplete work, unknown native status, and stale completion evidence. | No duplicate for active work; ended work is verified before acceptance; unknown provenance blocks writes; only incomplete authorized scope retries. D4 |
| Plan-only and dry-run | Observe native dispatch events and execution-state files before and after a plan-only request and an authorized `--dry-run`; read the diagram and prose together. | Neither path dispatches a worker or creates execution state; no Memory Protocol reference remains. D5 |
| Contract probes | `bash .oh/evals/probes/delegate-worker-boundary.sh`; `bash .oh/evals/probes/advisor-execution-contract.sh`, extended for the residual contracts. | Both exit 0 on the integrated result; each added check rejects its targeted mutation in a disposable copy and passes after restoration. D2–D6 |
| Preserved contracts | `bash .oh/evals/probes/delegate-model-effort-policy.sh`; `bash .oh/evals/probes/spec-single-owner.sh`; `bash .oh/evals/probes/plan-orchestration-contract.sh`; `bash .oh/evals/probes/roles-are-skills.sh`. | All four exit 0; a required failure returns to the writer or blocks acceptance. D6 |
| Integrated regression | `bash .oh/scripts/link-providers.sh --check`; `bash .oh/skills/eval/run.sh` on the approved base and on the integrated result. | No new regression; reproduced base failures stay explicit; skips never satisfy a required runtime criterion. D6 |
| Scope disposition | Compare the final diff and evidence against the four core gaps and every retained register row. | No duplicated predecessor repair and no unauthorized deferred work; historical unknowns stay unknown. D1, D7 |

## Affected surfaces

| Surface | Disposition |
|---|---|
| Host and sandbox | Applied. All work and tests run in the isolated sandbox worktree; no host change. |
| Lifecycle door | Not applicable. No `oh` verb, CLI, or Docker change. |
| Canonical and provider surfaces | Applied. Only canonical `.oh/` files are edited; `link-providers.sh --check` proves the symlinks still resolve. |
| Root and scaffold | Not applicable. `AGENTS.md` and the scaffold keep the predecessor's decisions. |
| Interactive and headless processes | Applied to native worker observation and recovery. No new persistent process and no session transfer. |
| Local and remote operation | Applied. Resume relies on durable artifacts and observable worker state across a disconnect. |
| Parallel operation | Applied. The corrections prevent duplicate and premature workers; one writer owns the shared files. |
| Public documentation | Applied as an impact review only. Affected published claims are recorded; a separately authorized owner implements any external change. |
| Verification | Applied. Ordering, recovery, no-mutation paths, and regression are tested against the accepted baseline. |
