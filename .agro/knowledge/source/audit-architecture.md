---
title: "Audit Architecture"
slug: audit-architecture
kind: repo
tags: [audit, pr, workflow, safety, observability]
created: 2026-07-17
updated: 2026-09-07
sources:
  - raw/2026-07-17-audit-architecture.md
  - .agro/skills/audit/SKILL.md
  - .agro/skills/audit/scripts/audit-run.sh
  - .agro/skills/audit/scripts/pr-classify.sh
  - .agro/skills/audit/scripts/implementation-gates.sh
  - .agro/skills/audit/references/full.md
  - .agro/skills/audit/scripts/route-driver.sh
verified_at: a0d0437ec9819ce6ecf879cabeaefef9980cdcec
related: [oh-cli-portable-lifecycle]
confidence: confirmed
---

# Audit Architecture

## Relevant Source Files
- `.agro/skills/audit/SKILL.md:15` — public dispatcher, route ownership, effects, and run roots.
- `.agro/skills/audit/scripts/audit-run.sh:1` — executable validation, immutable-root, run-ID, cleanup, and locked-log lifecycle.
- `.agro/skills/audit/scripts/pr-classify.sh:1` — frozen real-GitHub CI evidence/readiness model.
- `.agro/skills/audit/scripts/implementation-gates.sh:1` — rooted task, focused PR, and non-mutating browser gates.
- `.agro/skills/audit/references/full.md:1` — campaign composition and synthesis.
- `.agro/skills/audit/scripts/route-driver.sh` — the shipped production driver: deterministic gates for the two gating targets, no nested inference CLI.

## Summary
`/audit` is one explicit namespace over nine audit targets. It routes to specialized protocols without flattening their native verdicts, while private PR and recovery primitives provide deterministic evidence shared by workflow callers.

## Detail
The public targets are `implementation`, `pr`, `prs`, `harness`, `context`, `skills`, `eval-quality`, `drift`, and `full` (`.agro/skills/audit/SKILL.md:25`). `/eval`, `/benchmark`, `/ci-status`, `/health-check`, and `/wiki lint` remain independent instruments because they execute floors, ceilings, polling, readiness, remediation, or corpus maintenance rather than owning audit targets.

PR acquisition is network-facing but classification is pure JSON-in/JSON-out. Real GitHub CheckRun shapes may carry `status: COMPLETED` alongside a terminal conclusion; failure conclusion takes precedence, pending status follows, and unknown/malformed combinations fail evidence closed. Readiness is intentionally split: `readyForReview` applies only to a green/mergeable/clean draft, `readyToMerge` only to a corresponding non-draft with approved or explicitly review-free state, and `promotable` is their union (`.agro/skills/audit/references/pr-classification.md:7`). Audit never undrafts or merges.

**The shipped driver runs gates, not an agent.** PR #991's advisor-first orchestration replaced the driver that launched a non-interactive agent process (`AUDIT_AGENT_COMMAND_JSON`, with the `AUDIT_*` lifecycle variables scrubbed from its environment) with a script that runs the deterministic gates itself for `implementation` and `pr`, prints the gate report ending in `AUDIT-EVIDENCE: <NATIVE-VERDICT>`, and publishes the correlated evidence atomically. The seven report-only routes (`prs`, `harness`, `context`, `skills`, `eval-quality`, `drift`, `full`) are read directly by the active session; the driver exits 64 for them and publishes no evidence, because they never gated a merge (`.agro/skills/audit/SKILL.md:84-89`). The nine targets, the classification model, the readiness split, and the boundary lifecycle below are unchanged by that swap.

Default execution is report-only except disclosed scoreboards, remote fetches, temporary/recovery state, and one outer log. The executable lifecycle creates invocation-scoped temp state only after usage validation, changes to `AUDIT_ROOT`, binds validated arguments to the selected route driver, forwards TERM/INT/HUP to its process group, and serializes a complete/failed/interrupted terminal record after real work exits. Implementation Gate 1 rejects symlinked task roots, malformed array contracts, unfinished stories, and missing/root-escaping artifacts. Focused and queue PR checks accept an explicit repository or resolve the current repository once; `full --repo` forwards the same queue repository. Browser preflight uses an isolated temporary profile and detects tracked, dirty, untracked, and ignored repository writes. Comments, labels, closes, external issues, durable context baselines, and wiki ingest are explicit opt-ins. `AUDIT_ROOT` fixes source and scoreboard paths to the invoking checkout; `AUDIT_LOG_ROOT` selects the configured shared log checkout; one immutable `AUDIT_RUN_ID` correlates children and suppresses child logging (`.agro/skills/audit/SKILL.md:61`).

`full` preserves provenance and native verdicts, correlates duplicate root causes, then ranks Tier 1/2/3 findings and concrete Recommended Next 3 Actions. Missing nested fan-out yields a visibly partial campaign with exact reruns, never silent success (`.agro/skills/audit/references/full.md:11`).

The migration is clean-breaking: former standalone audit-family commands and the routing agent are removed, not aliased. Rollback therefore reverts the consolidation atomically and coordinates protected-path restoration; a mixed vocabulary is not a safe rollback.

## System Relationships
```mermaid
flowchart LR
  D["/audit target"] --> R["one route reference"]
  R --> DRV["route-driver.sh: gates for implementation/pr, exit 64 for report-only"]
  R --> P["private PR/recovery primitives"]
  R --> N["native verdict"]
  D --> C["AUDIT_RUN_ID + roots"]
  C --> L["one outer locked log"]
  F["/audit full"] --> R
  F --> I["retained /eval + optional health dry-run"]
```

## See Also
- [[oh-cli-portable-lifecycle]]
