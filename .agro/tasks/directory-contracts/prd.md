# Separate directory contracts from documentation

Implement the operator-approved classification of all 15 nested READMEs outside archives and third-party packages. Retire harness-context as untrusted guidance. Do not reuse its rules or reference content as authority.

## Definition of Done

- D1: Add short AGENTS.md contracts at .agro/tasks/, .agro/knowledge/, .agro/knowledge/raw/, .agro/evals/, and .agro/evals/capability/. Replace tasks and raw READMEs; retain short orientation READMEs for evals and capability.
- D2: Keep package, dataset, local scratch, Pi-install, and docs-index READMEs. Preserve the generated knowledge index byte-for-byte. Move .agro architecture, scripts operations, eval reference, capability reference, and Hermes runtime explanations into docs, consolidating with existing pages.
- D3: Delete the canonical harness-context skill and references. Remove its lock entry and active dependencies, exemptions, and audit prompts. Update references and tracking exceptions for renamed documents. Do not rewrite archived tasks, immutable captures, historical changelog entries, or compatibility fixtures.
- D4: Correct stale .oh/ references in affected live documents. Preserve intentional compatibility names. Remove contradictory scripts instructions and verify moved examples against source.
- D5: Validate references, provider linking, impacted probes, generated index, typecheck, and CI. Resolve knowledge impact. Open one ready-for-review PR with observed evidence. Do not merge.

## Architecture decision

The operator approved scoped contracts instead of README-only guidance or wholesale renaming. Local obligations belong in AGENTS.md; descriptive references belong in docs; package and index READMEs stay. Canonical skills still own procedures. No new procedure layer, provider mirror, or runtime behavior is introduced. This is reversible file ownership restructuring; issue #1112 records the decision.

## Affected surfaces

- Host and sandbox: applied; edits and checks run in the sandbox worktree. No host mutation.
- Lifecycle door: not applicable; no agro command behavior changes.
- Canonical and provider surfaces: applied; remove canonical skill and verify symlinks. Never edit mirrors.
- Root and scaffold: applied; keep root guidance aligned with approved nested contracts. No scaffold creation behavior.
- Interactive and headless processes: applied; background validation uses MonitorCreate. No persistent service changes.
- Local and remote operation: applied; tracked links and contracts work in a fresh clone, with no machine-specific paths.
- Parallel operation: applied; one serialized writer owns the implementation worktree. Advisor only owns task state and acceptance.
- Public documentation: applied; update repository docs used by agro-web. No website runtime or deployment change.
- Verification: applied; reference checks, scoped probes, full eval, typecheck, independent review, and CI.

## Knowledge Context

- **Base commit**: `a83e2dca`
- **Queries**: `docs knowledge evals`; `docs knowledge evals --patterns`
- **Knowledge used**: `[[oh-cli-portable-lifecycle]]`, `[[fresh-machine-setup]]`, `[[compose-env-boundary]]`, `[[pattern-docs-prohibition-by-example]]`, `[[pattern-wiki-frontmatter-edit-without-reindex]]`, `[[pattern-evals-tracked-only-scan-misses-uncommitted]]`, `[[pattern-evals-product-name-literal-pinning]]`, `[[pattern-spec-self-staling-reuse-record]]`
- **Grounded against**: `AGENTS.md`, the 15 source READMEs, `.agro/skills/spec/SKILL.md`, `.agro/skills/spec/references/execute.md`, `.agro/skills/wiki/SKILL.md`, `.gitignore`, active references found by git grep.
- **Conflicts discovered**: tasks README still names evidence.md despite canonical spec assigning evidence to PR body. Scripts README says host-only despite sandbox scripts, and requests comments forbidden by root. Reject these stale claims rather than promoting them. Recalled lifecycle claims are not changed or relied on without worker source verification.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `oh-cli-portable-lifecycle`, `fresh-machine-setup`
- **Affected source paths**: `.agro/README.md`, `docs/oh-directory-layout.md`, `docs/harnesses/hermes.md`, `.agro/skills/harness-context/`, moved README contracts.
- **Reason**: documentation relocation may affect knowledge citations. Derive the final union from the diff. Do not advance freshness for unrelated claims.

## Plan Reconciliation

- **Source plan**: operator-approved classification table in this conversation.
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**: probes pin renamed files; ignore rules exempt the old tasks README; active registry allowance and audit prompt reference the retired skill. Update those consumers in the same PR.
- **Orchestration preserved**: NOT-APPLICABLE

## Advisor orchestration strategy

One continuing general-purpose worker implements D1-D4 and targeted validation for D5. The worker owns the classified documents, their direct consumers, narrow tests/probes, ignore/lock/manifest metadata if necessary, and changelog. The advisor owns task state, source-grounded review, acceptance, git publication, and knowledge-impact dispositions. The worker cannot merge, publish, modify runtime behavior, write task state, or delegate. A fresh read-only reviewer checks the integrated diff and simplicity. Route repairs to the same worker.

Requested model: inherit; reasoning: high. The native Agent tool exposes model and thinking controls. Effective model remains unknown until runtime evidence confirms it. Budget: 80 turns initial implementation, one bounded repair continuation if needed; escalate if still blocked. No parallel writer shares this checkout.
