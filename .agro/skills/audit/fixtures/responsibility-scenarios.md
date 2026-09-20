# Audit responsibility scenarios

These cases support read-only contract review. They are not an executable scoring oracle, a runtime dependency, or evidence that an agent followed the procedure.
Use the retained panel sources and the revised evidence procedures. Do not dispatch workers, read private traces, publish, delete, or run evals for this review.

Council composition is **NOT SHIPPED**. The panel, dispatcher, external permissions, full campaign, runtime scripts, and standalone council retain their existing contracts.
C10–C16 concern the changed evidence procedures. Keep every original case visible; do not reinterpret a fallback as a composition pass.
Source citations below are relative to `.agro/skills/` unless they start with `.agro/evals/`.

## Contents

1. [Retained panel and council cases](#retained-panel-and-council-cases)
2. [Retained external permissions](#retained-external-permissions)
3. [Changed evidence judgments](#changed-evidence-judgments)
4. [Retained campaign and wrapper boundaries](#retained-campaign-and-wrapper-boundaries)
5. [Review record](#review-record)

## Retained panel and council cases

### C1 — Complete survey

Supply four non-empty reports with `PM_FINDINGS`, `IMP_FINDINGS`, `CRITIC_FINDINGS`, and `EXP_FINDINGS`, each with closing `END`.
The existing panel covers every domain check, validates outputs, then deduplicates and emits its native tiers, positive findings, and next three actions.
Source: `audit/references/harness.md`, sections 3 through 5 and Reference.
Applicability: retained panel. Routing this survey through council is **NOT SHIPPED**.

### C2 — Focus constraint

Supply a bounded `--focus` value. Every auditor receives the constraint.
Source: `audit/references/harness.md`, sections 1 and 2, including the snapshot's Focus constraint field.
Applicability: retained panel. The baseline still gathers its listed snapshot; this change adds no source-inspection restriction or council lens enforcement.
Do not claim that the baseline proves the original scenario's stronger no-unrelated-source-expansion outcome.

### C3 — Missing mandatory report

Omit each survey report in turn. The retained validator requires `FAIL-AUDITOR-OUTPUT`, the named defect, no deduplication or ranking, no recommended actions, and a non-zero invocation result.
Source: `audit/references/harness.md`, section 3.5.
Applicability: retained panel failure contract; no new critic or replacement behavior.

### C4 — Invalid mandatory report

Repeat with whitespace-only content, a wrong start sentinel, and missing `END`.
The retained validator has the same failure behavior as C3 and names the actual defect.
Source: `audit/references/harness.md`, section 3.5.
Applicability: retained panel. Review each defect separately; a happy-path report does not exercise these failures.

### C5 — Failed critic or conflicting evidence

For standalone council, require critique, then make that critique fail; also inspect a case with material evidence conflict.
Council withholds a dependent recommendation when required critique fails and forbids retry-until-consensus.
Source: `council/SKILL.md`, sections 4 and 5; retain `council/references/scenarios.md`.
Applicability: standalone council retained. An added council critic in an audit panel is **NOT SHIPPED**; the panel's mandatory Critic Auditor is not that conditional critic.

### C6 — Independence or budget unavailable

For standalone council, deny independent contexts or exhaust the agreed budget.
Council blocks without inline personas; delegate owns budget-stop and worker failure mechanics. Council launches no automatic replacements.
Source: `council/SKILL.md`, sections 2 and 3; `delegate/SKILL.md`, budget and failure rules.
Applicability: standalone council retained. Audit-to-council blocker propagation is **NOT SHIPPED**. The baseline panel references delegate for its worker policy, not a new council outcome mapping.

## Retained external permissions

### C7 — Source and wiki opt-in

Compare an external source alone with the same source plus `--wiki-ingest`.
Both remain report-only for issue operations. Only explicit wiki permission authorizes ingestion; it grants no issue permission.
Source: `audit/references/external-proposal-audit.md`, default mode; `audit/references/harness.md`, External proposal implementation audits.
Applicability: retained three-perspective decision audit, not council composition.

### C8 — Missing confirmation and dry-run

Use `--apply issue` without confirmation, then repeat with `--confirm --dry-run`.
The first stops after the exact preview. Dry-run prints the identical plan and writes nothing.
Source: `audit/references/external-proposal-audit.md`, issue operations; `audit/scripts/audit-run.sh`, argument validation.
Applicability: retained authorization. Do not claim the fallback adds the rejected adapter's explicit no-council-dispatch rule.

### C9 — Confirmed action and invalid arguments

Compare a valid confirmed external issue action with conflicting `--focus`, an unknown option, and a missing option value.
Only valid authorized action can proceed through the retained preview and fresh duplicate-check contract. Invalid arguments stop before lifecycle creation.
Source: `audit/references/external-proposal-audit.md`; `audit/SKILL.md`, Canonical usage and lifecycle boundary; `audit/scripts/audit-run.sh`.
Applicability: retained rules. No external mutation is necessary for this contract review. The fallback adds no post-confirmation recheck procedure beyond baseline.

## Changed evidence judgments

### C10 — Old valid skill with unknown use

Consider a skill last modified 90 days ago, with valid required frontmatter and resolvable required dependencies, but no authorized invocation evidence.
Age alone establishes neither drift nor uselessness. Usage remains unknown. `CURRENT` can describe complete mechanical checks, not usefulness or behavioral correctness.
Source: `audit/references/skills.md`, A, B, and Judge from evidence.
Applicability: changed. No freshness/usage total or automatic `STALE`/`DELETE` survives.

### C11 — Repeated mentions in one log

Consider one authorized log file with 20 mentions of a skill name and no verified invocation event.
Report mentions only. Do not infer 20 invocations, independent executions, or usefulness. Without event evidence, use remains unknown.
Source: `audit/references/skills.md`, B and Report and return.
Applicability: changed. The case supplies a hypothetical input, not permission to read a real private log.

### C12 — Concrete broken dependency or frontmatter

Consider one missing required local skill dependency. Repeat with absent required `description` and malformed YAML.
Keep each concrete failure visible as `BROKEN` with the governing requirement and observed defect. Other favorable signals cannot cancel it.
Repeat with an optional resource and absent memory protocol: do not treat them as universal failures.
If dependency inspection is unavailable rather than definitively absent, mark verification incomplete instead of inventing a broken dependency.
Source: `audit/references/skills.md`, C, D, E, and Judge from evidence.
Applicability: changed. Dependency scores do not recurse.

### C13 — Observed skip with a runnable intended path

Consider one latest `SKIPPED` row from a socket-less environment. Its source guard allows assertion execution in the intended environment with the dependency present.
Report the single observation and runnable path. Do not claim permanent skipping or recommend removal from that row alone.
If environment evidence is unavailable, report that limit rather than invent a persistence threshold.
Source: `audit/references/eval-quality.md`, question 3 and Triage observed failures.
Applicability: changed. Source-path analysis and evidence coverage determine the conclusion, not a scoreboard shortcut.

### C14 — Short probe or common issue

Consider a four-line probe with a reachable, decisive assertion. Also consider two probes citing one issue but checking different invariants or environments.
Neither length nor the shared citation proves duplication or justifies removal.
Compare assertion, invariant, input domain, environment, and retained responsibility before a duplicate finding.
Source: `audit/references/eval-quality.md`, questions 2, 4, and 6.
Applicability: changed. No line-count threshold or shared-issue verdict remains.

### C15 — Evidence supports action

Review four separate inputs:

1. Proven duplication with the same invariant and scope and a named retained replacement.
2. An assertion unreachable in every intended environment.
3. A proven tautology.
4. Implementation tuning that contaminates a holdout.
Each can support advisory `CUT` or redesign with cited evidence. Preserve responsibility ownership; identify the retained replacement for redundancy.
For skills, `DELETE` requires proven redundancy and a named retained owner for every responsibility.
No native label authorizes automatic deletion, and no flag total substitutes for the evidence.
Source: `audit/references/eval-quality.md`, questions 2, 3, 5, 6, and Recommend and report; `audit/references/skills.md`, Judge from evidence.
Applicability: changed. Unsupported removal is not the only possible conclusion; proven defects remain actionable.

### C16 — Already-dirty content

On a disposable copy, place a file in the index. Modify the file before the audit capture.
Run the section-5 capture and comparison without changing the file: expect equality despite dirty status.
Change that same file again, keeping its porcelain status identical: expect inequality from its content hash.
Source: `audit/references/eval-quality.md`, Compare before and after.
Applicability: changed. Run the actual published capture, not a separate mock oracle. Record commands, exit codes, and status/content evidence.
Do not run `/eval` during this read-only comparison or mutate the real eval tree for the experiment.

## Retained campaign and wrapper boundaries

### C17 — Nested fan-out unavailable

Consider a full campaign whose nested harness slice cannot dispatch workers.
Preserve inherited roots and identity, mark the slice deferred with its exact top-level rerun, retain provenance, and emit a partial campaign.
Source: `audit/references/full.md`; `audit/SKILL.md`, child identity and observation rules.
Applicability: retained. Do not retrofit the rejected composition's stronger incomplete-ranking wording into baseline claims.

### C18 — Unsupported scripted route or no-op callback

The shipped driver returns exit 64 for a report-only route. A zero-exit no-op supplies no target-correlated evidence and cannot certify completion.
The unchanged runtime owns immutable roots and one outer stderr record.
Source: `audit/scripts/route-driver.sh`; `audit/scripts/audit-run.sh`; `audit/SKILL.md`, transport-success distinction.
Applicability: retained runtime. Baseline dispatcher prose still contains historical persistent-log wording; the fallback does not repair it.

### C19 — Survey dry-run

Repeat `--dry-run` with and without `--focus`.
The retained procedure prints the briefing and auditor prompts, then stops without spawning workers. It adds no council ledger or source mutation.
Source: `audit/references/harness.md`, section 1; `audit/SKILL.md`, inherited child and report-only rules.
Applicability: retained panel dry-run. Council-composed dry-run is **NOT SHIPPED**.

## Review record

For each case, identify the inspected revision, relevant source, applicability, observed evidence, and limits.
Separate source-contract review, deterministic command evidence, and actual agent behavior.
Do not claim independent review or advisor acceptance from this document. Do not turn the rejected composition's D2 or D7 into a pass.
