# Plan: CLI-first release preparation

Status: DRAFT

## Goal and scope

Deliver a verified candidate and an honest release handoff through three bounded outcomes:

1. Align CLI-first onboarding, help, and fresh image defaults.
2. Align canonical release policy, release instructions, and documentation source identity.
3. Prove candidate installation and state-preserving recreation on existing disposable Docker CI.

The operator approved ending automatic legacy npm publication while retaining published packages and GHCR alias promotion.
The operator also approved recreation checks, real candidate bootstrap coverage, fresh-volume seeding assertions, and persisted-file metadata checks.
These additions stay inside the existing workstreams and 13-story graph. They do not authorize implementation or live operations.

### Document ownership

- [The PRD](../../tasks/cli-first-release/prd.md) owns acceptance criteria, invariants, non-goals, and remaining release gates.
- This plan owns source grounding, file boundaries, sequencing, and advisor assignments.
- [The Ralph JSON](../../tasks/cli-first-release/prd.json) projects the PRD stories into execution order and records completion state.

JSON and Markdown now use the same 13 story IDs. Earlier Markdown US-011 maps to US-011/US-012; its handoff US-012 maps to US-013.
The current S1–S6 section of issue #939 controls release acceptance. This task does not complete that release contract.

## Current state and decision

### Source grounding

The original plan recorded these accepted refs. Revalidate them before implementation; they are not assertions about current remote heads.

| Input | Recorded identity |
|---|---|
| Agro accepted source | `75b593eabc376b6a0b55575086fa91d55344ddf9` |
| Agro-web accepted source | `956bb1d723100b5779b02d617620fb9cf7193090` |
| Released Agro source | `823aabbd7324e08e3b685af6b0a5ef5c3467a15f`, version `0.9.0` |
| Scope decisions | Issue #939 S1–S6 and related issues #945, #944, #1019 |
| Unaccepted drafts | Agro #1029 and agro-web #53 |
| Paused work | `.worktrees/task/installer-dual-layout` |

| Finding | Source evidence | Disposition |
|---|---|---|
| Help and web onboarding diverge from CLI-first installation. | Agro `.agro/cli/src/cli.ts`; agro-web `docs/installation.md` | Apply US-002/US-003/US-009. |
| Fresh image defaults still select the legacy repository. | `.agro/cli/src/commands/lifecycle.ts`; `.devcontainer/docker-compose.image-only.yml` | Apply US-004 without migrating existing selections. |
| Workflows, probes, and release instructions enforce legacy npm co-release. | `.github/workflows/{publish-cli,release}.yml`; `.agro/evals/probes/{version-parity,agro-legacy-shim}.sh`; `.agro/skills/{git,release}/SKILL.md` | Apply US-005/US-006, including canonical instruction updates. |
| Docs pass a SHA to branch-clone logic. | Agro release notification; agro-web `scripts/build-oh-cli.mjs` | Apply US-007/US-008; retain the current builder and JS endpoints. |
| Bootstrap tests install a version-printing stub, not the candidate CLI. | `.agro/scripts/__tests__/get-agro.test.ts:11,97` | Extend US-010 with the real built bundle. Keep unverified S4/S6 cases explicit. |
| Fresh seeding has function tests but lacks explicit full-image assertions. | `.agro/scripts/__tests__/entrypoint-seed.test.ts:102`; `sandbox-boot-smoke.sh:239` | Add empty-volume and seed-preservation assertions to US-010/US-011. |
| Upgrade snapshots compare bytes but not modes or ownership. | `.agro/scripts/sandbox-upgrade-smoke.sh:158–187,210–213` | Add synthetic persisted-file metadata assertions to US-011. |

Claude pane `w4:p1` recorded the supporting review in `.agro/plans/agro-dod-wrap-up/dod-s1-s6-status.md` and its linked acceptance matrix.
Those records preserve evidence, not the superseded compatibility requirements. Do not restore retired installer or Cloudflare gates from them.

### Architecture decision carried forward

The change narrows the release contract and changes fresh image selection; the original plan classified those changes as architectural.
Select the smallest correction: remove unnecessary npm coupling, repair active behavior, and retain compatibility consumers with unresolved dependencies.
Reject both blanket legacy retirement and a replacement distribution or compatibility framework.
Preserve explicit settings, registry discovery, conflict refusal, ownership guards, seeded volumes, and published artifacts.
Retain GHCR alias promotion and existing Pages endpoints until a separate inventory supports retirement.
The verification additions change acceptance evidence, not runtime ownership or isolation boundaries.

### Knowledge to apply during execution

Check new tests before and after staging; tracked-only scans can miss uncommitted files.
Reconcile paused workers and artifacts before dispatch. Inspect terminated-worker evidence before starting replacement work.
Assert behavior rather than legacy-name literals. Leave unrelated knowledge pages and indexes unchanged.

## Definition of Done

Every cited PRD story must satisfy its acceptance criteria. A missing or skipped required case leaves its criterion incomplete.
`E` means `.agro/tasks/cli-first-release/evidence/` in the execution worktree. The advisor owns final acceptance of every row.

| ID | Observable outcome and verification | PRD stories | Evidence | Producer |
|---|---|---|---|---|
| D1 | Revalidated refs and explicit dispositions cover every finding without restoring withdrawn requirements. | US-001 | `E/scope.md` | Advisor |
| D2 | Executable-specific help and reviewed core/web onboarding agree with supported commands. | US-002, US-003, US-009 | `E/onboarding.md`, including browser evidence | Core and web workers |
| D3 | Default-selection and state-protection tests pass without rewriting existing settings. | US-004 | `E/image-selection.md` | Core worker |
| D4 | Behavioral publication tests, parity mutation fixtures, and release-instruction review agree with the canonical-only npm policy. | US-005, US-006 | `E/release-contract.md` | Continuing core worker |
| D5 | Real checkout/fetch tests prove exact source identity or failure for all specified ref cases. | US-007, US-008 | `E/docs-ref.md` | Web worker |
| D6 | Real candidate installation and both recreation cases pass on Docker CI with source identity, state, metadata, runtime, and cleanup evidence. | US-010, US-011, US-012 | `E/candidate.md` | Continuing core worker; advisor verifies exact-head CI |
| D7 | The closeout maps all evidence and separately lists unmet S1–S6 release obligations. | US-013 | `E/closeout.md` | Advisor |

## Implementation steps

### Bounded write sets

Paths are repository-relative. The advisor must approve any additional write path before a worker edits it.

**Core runtime and onboarding — T2**

- `.agro/cli/src/cli.ts`, `.agro/cli/src/commands/lifecycle.ts`
- `.devcontainer/docker-compose.image-only.yml`
- `.agro/cli/src/__tests__/lifecycle.test.ts`, `.agro/cli/src/lib/__tests__/config-render.test.ts`
- `.agro/cli/src/__tests__/cli-first-help.test.ts` — new
- `README.md`, `.agro/cli/README.md`, `.agro/scripts/README.md`
- `docs/installation.md`, `docs/quickstart.md`, `docs/lifecycle-commands.md`, `docs/agro-compatibility.md`

**Core release and candidate verification — T3**

- `.github/workflows/publish-cli.yml`, `.github/workflows/release.yml`, `.github/workflows/sandbox-boot-guard.yml`
- `.agro/evals/probes/version-parity.sh`, `.agro/evals/probes/agro-legacy-shim.sh`
- `.agro/skills/git/SKILL.md`, `.agro/skills/release/SKILL.md` — align publication, version, and verification instructions only
- `.agro/scripts/__tests__/canonical-publish-contract.test.ts`, `.agro/scripts/__tests__/version-parity-contract.test.ts` — new
- `.agro/scripts/cli-first-install-smoke.sh`, `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` — new
- `.agro/scripts/__tests__/get-agro.test.ts` — extend candidate bootstrap coverage only
- `CHANGELOG.md`

Use the existing `get-agro.sh` interface and real built bundle; this plan does not authorize a bootstrapper redesign.
Add seeding and metadata assertions to the candidate smoke, not a second upgrade framework.
Reuse existing PID1 and supervision checks rather than duplicating their implementation.

**Agro-web — T4**

- `scripts/build-oh-cli.mjs`, `scripts/sync-external-scripts.mjs`, `scripts/oh-source.mjs`
- `scripts/build-oh-cli.test.mjs`, `scripts/sync-external-scripts.test.mjs` — new
- `scripts/oh-source.test.mjs`, `scripts/check-docs-drift.mjs`
- `docs/installation.md`, `docs/quickstart.md`, `README.md`

Only change the shared source helper when exact-ref reuse requires the change.
Preserve the Pages workflow and producer/consumer drafts unless verification demonstrates a scoped defect.

| Step | Action | Dependency | Location | DoD |
|---|---|---|---|---|
| 1 | Revalidate scope, refs, drafts, and ownership. | None | Advisor; read-only sandbox review | D1 |
| 2 | Apply T2 runtime and onboarding edits. | Step 1 | Isolated core worktree | D2, D3 |
| 3 | Continue with T3 release instructions, contracts, and candidate tests. | Step 2 | Same core worktree and worker | D4, D6 |
| 4 | Apply T4 onboarding and exact-source docs edits. | Step 1 | Separate agro-web worktree | D2, D5 |
| 5 | Review stopped-writer trees, exact-head CI, and residual release gates. | Steps 3, 4 | Advisor | D1–D7 |

## advisor orchestration strategy

The active session remains the single accountable advisor. `/spec` owns the build; `/delegate` owns bounded dispatch records.
This planning revision launches no workers. Future implementation uses one continuing core worker and one independent agro-web worker.
Use native continuation or checkpoint-and-rebrief. Never start a second writer in either checkout.

Resolve execution worktrees under each repository's `.worktrees/` after ownership checks; do not reuse a paused task's checkout.
Core repository: `/home/sandbox/harness`. Agro-web checkout recorded in the original plan: `/home/sandbox/harness/projects/mifunedev/openharness-web`.
Revalidate that checkout's remote and path before dispatch. Record final absolute worktree paths in the build records.
Requested settings below are not observed settings. Apply `/delegate` capability, model-exclusion, budget, and recursion policies at dispatch.

| Task | Complexity; requested model/reasoning | Dependencies | Read scope and owned writes | Execution and continuation | Deliverable and verification | Acceptance/repair |
|---|---|---|---|---|---|---|
| T1 | Standard; `inherit / medium` | None | Read accepted refs, #939 and related drafts; own scope evidence only. | Active advisor; no worker | US-001 ref/disposition review; `E/scope.md`; D1 | Advisor resolves scope conflicts. |
| T2 | High: state selection; `inherit / high` | T1 | Read CLI, registry, compatibility code; own T2 write set. Exclude release files and live state. | Isolated core worktree; native `general-purpose`; retain for T3 | US-002–US-004 tests and docs review; D2/D3 evidence | Advisor accepts; same core worker repairs. |
| T3 | High: release safety and runtime evidence; `inherit / high` | T2 | Read release/probe/seed/bootstrap contracts and PRD checks; own T3 write set. Exclude publication, secrets, and GHCR retirement. | Same core worker/worktree; native resume or checkpoint-and-rebrief | US-005/US-006/US-010–US-012; D4/D6 evidence | Advisor accepts exact-head evidence; same worker repairs. |
| T4 | High: source identity; `inherit / high` | T1 | Read core source contract and web pipeline; own T4 write set. Exclude routing, credentials, deployment, and historical posts. | Separate agro-web worktree; native `general-purpose`; resume or checkpoint-and-rebrief | US-007–US-009 tests and browser review; D2/D5 evidence | Advisor accepts; web worker repairs. |
| T5 | Standard: independent acceptance; `inherit / medium` | T3, T4 | Read complete diffs and logs; own acceptance records only. No source edits. | Active advisor after writers stop | US-013 review of every D1–D7 row; `E/closeout.md` | Return defects to the owning worker; unresolved scope returns to operator. |

Bounded briefs:

- **T1:** Revalidate the recorded sources and #939. Preserve paused work. Record dispositions without reintroducing withdrawn gates.
- **T2:** In the core worktree, edit only the T2 files for executable-aware help, canonical fallbacks, and onboarding. Preserve state guards.
- **T3:** Continue the core worktree. Edit only the T3 files for canonical npm policy and candidate tests. Apply the PRD's fixture and evidence boundaries.
- **T4:** In the web worktree, edit only the T4 files for onboarding and exact-commit builds. Retain served JS paths and shell-safe outputs.
- **T5:** Review both completed diffs and every evidence artifact. Reject stale, skipped, or substituted results. Keep live release obligations separate.

| Wave | Work | Dependency | Handoff | DoD |
|---|---|---|---|---|
| 1 | T1 advisor | None | Accepted scope and source identities | D1 |
| 2 | T2 core and T4 web | T1 | Independent bounded changes | D2, D3, D5 |
| 3 | T3 continuing core; T4 may finish | T2 for T3 | Release and candidate evidence | D4, D6 |
| 4 | T5 advisor | T3, T4 | Accepted source handoff | D1–D7 |

Each worker stops at its bounded deliverable or first unmet prerequisite. Summaries identify changed paths, commands, exit statuses, failures, and evidence.
The advisor records native worker settings, source SHAs, and acceptance before releasing dependent work.

### Verification execution

The PRD's verification section owns commands and runtime assertions. Run non-Docker checks in the corresponding sandbox worktree.
Use existing Docker CI for candidate installation and recreation; do not repair the host or attach this sandbox's Docker socket.
For canonical skill edits, apply `/builder`, `/ste`, and the applicable `/eval` probes before and after the change.
Keep provider links intact. A probe failure requires review, not deletion of the assertion to obtain a pass.

## Affected surfaces

| Surface | Disposition |
|---|---|
| Host and sandbox | Applied. Development stays in sandbox worktrees; runtime fixtures use disposable CI hosts only. |
| Lifecycle door | Applied. Candidate provisioning and recreation use `agro`; no direct Compose bypass. |
| Canonical and provider surfaces | Applied. Update canonical release instructions and code; preserve provider links. |
| Root and scaffold | Applied. Update onboarding without rewriting existing scaffolds or unrelated root files. |
| Interactive and headless processes | Applied to verification. Reuse Herdr/CI; create no persistent service. |
| Local and remote operation | Applied. Verify reproducible source identity and saved-state recreation. |
| Parallel operation | Applied. Isolate core/web worktrees and serialize core edits. |
| Public documentation | Applied. Update agro-web; keep secondary repositories and historical posts parked. |
| Verification | Applied. Behavioral tests and before/after runtime evidence support all DoD rows. |

## Risks, rollback, and open questions

Fresh defaults do not migrate existing image selections. A failing recreation or bootstrap test requires scoped repair review, not permission to change live state.
Source rollback uses reviewed revert commits. Do not rewrite shared history, published versions, or operator state.
Retain the previous working release identity until the operator accepts release and migration evidence.
No new product-scope decision blocks this draft. The PRD explicitly lists unresolved release-stage values and checks.

## Approval and handoff

The operator authorized updating planning-only draft PR #1031. That authorization does not start implementation or complete any story.
After separate execution approval, use `/spec` with this plan and its PRD. Revalidate refs and ownership before dispatch.
The task ends at verified candidate source and a release handoff, not publication readiness or completion of epic #939.
