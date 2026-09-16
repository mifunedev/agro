# PRD: Council skill

## Introduction

Create a bounded deliberation skill for the active coding agent.
The operator requested council exploration, Claude and Pi trace mining, `/builder`, `/ste`, and a completed PR.
This request authorizes implementation through a ready-for-review PR. The operator retains merge authority.

## Goals and Definition of Done

- D1: Run independent council lenses and one critic. Record evidence, counterevidence, and the advisor's decision.
- D2: Mine both local harness trace stores. Separate observed actions from proposals, summaries, and copied instructions.
- D3: Add a canonical `/council` skill with explicit inputs, outputs, limits, failure handling, and boundaries.
- D4: Apply `/builder command` and `/ste`. Verify structure, provider links, and decision scenarios.
- D5: Complete the build gates and deliver a ready-for-review PR with green CI. Do not merge.

## User Stories

### US-001: Define and author bounded deliberation

As an operator, I want independent perspectives without creating another build owner.

- Accept the council design after one adversarial critique.
- Create `.agro/skills/council/SKILL.md` with clear positive and negative triggers.
- Keep synthesis in the active advisor and dispatch mechanics in `/delegate`.
- Distinguish `/architect`, `/audit`, `/strategic-proposal`, `/spec`, `/supervisor`, `/builder`, `/ste`, and `/wiki`.
- State terminal outcomes, source trust, evidence limits, and authorization boundaries.
- Add a changelog entry and one append-only skill proposal record.
- Typecheck passes.

### US-002: Verify the contract and record evidence

As a reviewer, I want evidence that the new skill has distinct, bounded behavior.

- Inspect Claude and Pi trace samples and record sanitized findings with limitations.
- Exercise normal input, missing input, missing workers, disagreement, injection, and unauthorized side effects.
- Run builder validation, STE, provider-link checks, and regression checks.
- Resolve every knowledge-impact finding with a stated reason or verified update.
- Obtain an independent simplicity review.
- Commit reviewer evidence and verify current-head CI before undrafting.
- Typecheck passes.

## Functional Requirements

1. Accept a decision question or an explicitly supplied brief.
2. Compare independent perspectives before advisor synthesis.
3. Require one critic for this build. Future councils require one critique only when material conflict, safety risk, or reversal cost justifies it.
4. Return a recommendation, dissent, evidence limits, and the next authorized step.
5. Reuse existing skill owners rather than copying their mechanics.

## Non-goals

Do not add a persistent agent, scheduler, trace collector, provider adapter, or automatic publication.
Do not migrate or edit existing skills in this PR.
Do not assert universal superiority from a small trace sample.

## Advisor orchestration strategy

The active session owns architecture, task state, synthesis, and acceptance.
Three read-only workers inspect separate evidence surfaces in parallel.
A fresh critic reviews the advisor draft after those results arrive.
One continuing worker authors the skill, scenario reference, and changelog in this isolated worktree.
The advisor appends the builder proposal ledger as a decision record.
The worker cannot edit task state, provider mirrors, existing skills, runtime settings, or GitHub state.
A fresh read-only reviewer checks simplicity and behavioral cases.
The advisor runs all acceptance checks and finalizes the PR.
Worker settings and stopping conditions live in `delegate-graph.json`.
No direct implementation exception applies.

## Knowledge Context

- **Base commit**: `1317f352ccbafeab747521446ac93b63c588605c`
- **Queries**: `council delegate skills`; `council delegate skills --patterns`
- **Knowledge used**: `[[pattern-delegate-ledger-stale-at-acceptance]]`, `[[pattern-delegate-builtin-type-carries-own-model]]`, `[[pattern-evals-probe-failure-path-untested]]`
- **Grounded against**: `AGENTS.md`, `.agro/skills/delegate/SKILL.md`, `.agro/skills/architect/SKILL.md`, `.agro/skills/strategic-proposal/SKILL.md`, `.agro/skills/builder/SKILL.md`, `.agro/skills/ste/SKILL.md`, `.agro/skills/spec/SKILL.md`, `.agro/skills/audit/SKILL.md`, `docs/rfcs/README.md`
- **Conflicts discovered**: The task-directory README retains historical `.oh/` paths. Canonical `.agro/` paths and current skill ownership govern this build.

The query also returned release-versioning, agro-web-pipeline, audit-architecture, pattern-wiki-frontmatter-edit-without-reindex, and pattern-evals-inherited-environment-diagnosis.
The advisor read those pages. Their unrelated claims do not determine the council design.
No prior council proposal or rejected council record exists in the skill-impact ledger.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: none
- **Affected source paths**: `.agro/skills/council/`, `CHANGELOG.md`, `.agro/evals/decisions/skill-impact.md`
- **Reason**: The skill adds reusable behavior. Derive affected pages from the final diff and resolve each result.

## Plan Reconciliation

- **Source plan**: The operator's current end-to-end request.
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**: Preserve accepted decisions #929 and #989. Keep raw traces private. Historical evidence does not prove optimality.
- **Orchestration preserved**: YES

## Success Metrics

The required scenarios pass review. The regression suite has no new failures. Current-head CI is green.
Quality improvement beyond these checks remains a measured claim only when comparative evidence supports it.

## Open Questions

None that block implementation. The critic may refine the mechanism without changing the approved scope.
