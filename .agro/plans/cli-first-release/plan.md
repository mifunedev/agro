# Plan: Align release preparation with CLI-first support

Status: DRAFT

## Goal and scope

Make the supported CLI-first path the basis for release preparation.
Remove obsolete onboarding instructions and unnecessary release dependencies.
Fix the docs build that receives a commit SHA but attempts a branch clone.
Preserve real runtime dependencies and operator state.
Test disposable sandbox recreation for workspace preservation and reapplication of saved runtime settings, including enabled and disabled Docker socket access.
The operator approved this additional candidate test. Live sandbox repair and migration remain outside this plan.

The supported path is `npm install -g @mifune/agro`, or `get-agro.sh`, followed by `agro sandbox install docker`.
`agro update` upgrades the CLI. `oh update` vendors project files; the commands are not interchangeable.

The operator-approved S1–S6 section of issue #939 controls release acceptance.
This plan addresses source changes and candidate verification, not publication or live migration.
The plan does not reinstate the historical compatibility matrix.

Exclude:

- Repairing the retired `install.sh`, clone-and-own onboarding, or `config repo` as release prerequisites.
- Cloudflare changes, new credentials, host repair, paid infrastructure, and publication.
- Cloud, orchestra, website, and other secondary repositories. Agro-web remains in scope.
- Deleting historical packages, images, aliases, registry readers, seed markers, or user files.
- Requiring a 90-day window, three releases, or exhaustive historical installation tests.
- Replacing the Pages build system, creating a general workflow parser, or adding a compatibility framework.

## Current state and decision

### Verified source snapshot

Use accepted refs, not the dirty repository-root checkout.

| Repository or artifact | Verified source |
|---|---|
| Agro | `75b593eabc376b6a0b55575086fa91d55344ddf9`, available in `.worktrees/prep/agro-release` |
| Agro-web | `956bb1d723100b5779b02d617620fb9cf7193090`; read Git objects when the local worker checkout has advanced |
| Current release | Agro `main` remains `823aabbd7324e08e3b685af6b0a5ef5c3467a15f`, version `0.9.0` |
| Current scope | GitHub issues #939, #945, #944 and #1019 contain the approved single-user revision |
| Related drafts | Agro #1029 and agro-web #53 contain producer/consumer tests; neither is the accepted baseline |
| Paused installer work | `.worktrees/task/installer-dual-layout`; preserve it, but do not import it into this plan |

Re-query refs, draft heads and ownership before implementation.
Do not replay the previous compatibility campaign.

### Findings and disposition

Paths in this table are relative to the named repository.

| Finding | Evidence | Selected disposition |
|---|---|---|
| Core installation is CLI-first, but web onboarding still teaches cloning and `install.sh`. | Agro `docs/installation.md:7–38`; agro-web `docs/installation.md:86–182` | Correct current onboarding. Preserve historical posts and optional advanced workflows. |
| Generic help describes `update` as project vendoring for both executable names. | Agro `.agro/cli/src/cli.ts:113,646–660,1131–1143` | Make help match the invoked executable. Do not change either command's dispatch semantics. |
| Canonical lifecycle still defaults to the legacy image repository. | Agro `.agro/cli/src/commands/lifecycle.ts:104,166`; `.devcontainer/docker-compose.image-only.yml:5` | Use `ghcr.io/mifunedev/agro:latest` for new defaults. Preserve explicit image references and existing configuration. |
| Release finalization requires publishing and deprecating the legacy npm shim. | Agro `.github/workflows/publish-cli.yml:72–131`; `.github/workflows/release.yml:261–275` | Remove automatic legacy npm publication from the normal release path. Retain existing shim source and published versions. |
| Version probes require the legacy shim to track every canonical release. | Agro `.agro/evals/probes/version-parity.sh:46–73`; `agro-legacy-shim.sh:29–40` | Keep canonical version checks. Validate the retained shim's own exact dependency contract without requiring canonical-version equality. |
| Legacy GHCR aliases still serve explicit configuration and current defaults. | Agro `.github/workflows/release.yml:234–257`; `.agro/scripts/promote-release-latest.sh:93–140` | Retain existing image-alias promotion in this change. Do not stop image-alias promotion merely because the fresh default changes. |
| Docs receive a SHA but run `git clone --branch` with that value. | Agro `.github/workflows/release.yml:401`; agro-web `.github/workflows/pages.yml:36–38`; `scripts/build-oh-cli.mjs:37–44` | Fetch and build the resolved commit exactly. Reject a different checkout rather than warning and continuing. |
| Pages rebuilds JS endpoints even though canonical bootstrap downloads a GitHub release asset. | Agro `.agro/scripts/get-agro.sh:99–100,173–180`; agro-web `package.json:8`, `scripts/build-oh-cli.mjs:23–25,46–58` | Keep the existing builder for retained endpoints. Fix its SHA handling; do not build a new distribution system. |
| Old-looking names protect current state and ownership. | Agro `.agro/cli/src/lib/compat.ts:148–170,333–345`; `commands/self-upgrade.ts:113–120`; `.devcontainer/Dockerfile:53–57` | Preserve registry discovery, conflict refusal and `/opt/oh` ownership detection. No cosmetic rename. |

### Architecture Brief

#### Classification

**ARCHITECTURAL**. The change narrows the release contract and changes fresh image selection.

#### Current State

Fact: the findings table identifies the supported entry point, legacy defaults and publication dependencies.
Unverified assumption: an existing operator installation still needs legacy GHCR promotion. Retain that promotion rather than guess.

#### Decision Drivers

Constraint: the approved single-user DoD replaces the historical compatibility campaign.
Judgment: correct active behavior and remove release coupling without a broad retirement campaign.

#### Invariants

Preserve explicit settings, registry readers, ownership checks, seeded volumes and published artifacts.
Keep the active session accountable. Do not create another advisor or ADR store.

#### Options Considered

1. Retain all release requirements. This preserves the accidental legacy npm dependency and the broken SHA checkout.
2. Remove every legacy surface. This risks existing configuration and creates another retirement campaign.
3. Correct canonical behavior and remove only the unnecessary npm release coupling. Retain cheap, active compatibility dependencies.

#### Recommendation

Select option 3.
Approval of this plan includes the proposed end of automatic legacy npm publication.
Do not unpublish any legacy package. The existing shim remains usable at its published version.
Keep GHCR alias promotion and the Pages JS builder for this release cycle.

#### Tradeoffs / Consequences

This choice retains some release coupling to protect unresolved image consumers.
A separate retirement decision can remove image-alias promotion after an inventory identifies the operator's actual image references.
The plan adds no legacy-publication toggle or replacement workflow.

#### Retirement / Consolidation

Remove automatic legacy npm publication and its canonical-version equality requirement.
Remove obsolete current-onboarding instructions. Retain historical artifacts and optional project-vendoring commands.

#### Migration / Sequencing

Change both fresh image defaults together. Preserve existing selections.
Preserve image publication before canonical CLI release so new clients can obtain their default image.
Keep live operator migration and publication under separate approval.

#### Validation

D2–D6 require behavior tests, negative cases and a candidate install through the packaged CLI.
Evidence of a current consumer needing a newly published legacy npm version would require reconsideration before execution.
A successful build of the wrong commit falsifies the docs solution.

#### Non-Goals

Do not retire all aliases or replace the Pages build system.
Automatic docs dispatch is not a policy prerequisite; an authorized, verified manual update can satisfy documentation acceptance.

#### Decision Record

**UPDATE #939** during approved execution if implementation changes the agreed scope.
The active session records and owns this decision.

### Knowledge context

The tracked query `release cli compatibility dispatch --patterns` matched eight pages.
The query loaded five pages and skipped three under its read cap.

- `[[pattern-evals-tracked-only-scan-misses-uncommitted]]`: verify new tests before and after staging; a tracked-only scan can miss them.
- `[[pattern-delegate-ledger-stale-at-acceptance]]`: reconcile paused workers and record acceptance before dispatching another writer.
- `[[pattern-delegate-worker-terminated-before-report]]`: inspect existing files and run missing verification rather than recreating finished work.
- `[[pattern-evals-product-name-literal-pinning]]`: assert invoked behavior, not a legacy name embedded in a source string.
- `[[pattern-wiki-frontmatter-edit-without-reindex]]`: relevant only if execution changes knowledge frontmatter; otherwise leave the knowledge index alone.

Current source and the loaded delegate procedure outrank older pattern descriptions.
The plan does not alter the knowledge schema or its generated index.

## Definition of Done

`E` means `.agro/tasks/cli-first-release/evidence/` in the future execution worktree.
This planning request creates no task folder or evidence files.

| ID | Observable outcome | Verification and expected result | Evidence | Owner |
|---|---|---|---|---|
| D1 | Every scan finding has an active, optional, deferred or post-publication disposition. | Re-read accepted refs and #939. Confirm that no retired-installer, time-window, fixture-policy or secondary gate returns through a draft. | `E/scope.md` | Active advisor |
| D2 | Help and onboarding describe the supported CLI path accurately. | Run CLI help/dispatch tests for `agro` and `oh`; review core and web onboarding. No mandatory clone, fork or `install.sh` step. Preserve the real distinction between self-upgrade and project vendoring. | `E/onboarding.md` | Core and web workers; advisor accepts |
| D3 | Fresh default image selection uses the canonical repository without rewriting existing selections or state. | Run lifecycle, registry and Compose tests. Default resolves to the canonical image; explicit canonical/legacy/custom references and environment precedence remain effective. Existing configuration, registry files and ownership protections remain unchanged. | `E/image-selection.md` | Core worker; advisor accepts |
| D4 | Canonical release success no longer depends on a new legacy npm package or deprecation notice. | Execute the changed workflow shell bodies with fake registry/publish commands. Canonical failure fails; canonical success needs no legacy publish, wait or deprecate call. Canonical parity still rejects real drift. Retained shim integrity checks still reject a missing target, ranged pin or conflicting executable. GHCR promotion checks remain intact. | `E/release-contract.md` | Continuing core worker; advisor accepts |
| D5 | Docs build the requested SHA and identify the actual source of mirrored scripts and JS bundles. | Run the real checkout/build path against disposable Git origins. Test a full SHA, tag, branch, invalid ref, moving branch and checkout mismatch. Build the resolved commit or fail; never silently substitute `main`. Test script fetches against the resolved SHA and retain shell-safe output checks. | `E/docs-ref.md` | Web worker; advisor accepts |
| D6 | Candidate packaging, fresh CLI-first installation, and saved-state recreation pass on a disposable Docker runner. | Install the candidate tarball into a temporary prefix and invoke its `agro` executable against the candidate image. Run the recreation procedure below for saved `access.dockerSocket=false` and `access.dockerSocket=true`. Verify replacement container IDs, preserved workspace data, reapplied settings, socket behavior, service health, and scoped cleanup. Exact-head core and web CI pass; web PR deployment remains skipped. | `E/candidate.md`, including before/after recreation evidence | Continuing core worker supplies tests; advisor accepts evidence and verifies CI |
| D7 | The closeout distinguishes completed source work from remaining live-state and publication evidence. | Review the integrated diff, exact SHAs and test logs. List actual-install inventory/backup/migration, release-version selection, publication approval and post-publication checks separately. Do not declare the release ready from this plan alone. | `E/closeout.md` | Active advisor |

## Implementation steps

### Bounded write sets

The following write sets bound future implementation. This plan changes none of those files.

**Core runtime and documentation:**

- `.agro/cli/src/cli.ts`
- `.agro/cli/src/commands/lifecycle.ts`
- `.devcontainer/docker-compose.image-only.yml`
- `.agro/cli/src/__tests__/lifecycle.test.ts`
- `.agro/cli/src/lib/__tests__/config-render.test.ts`
- `.agro/cli/src/__tests__/cli-first-help.test.ts` — new focused test
- `.agro/cli/README.md`, `.agro/scripts/README.md`, `README.md`
- `docs/installation.md`, `docs/quickstart.md`, `docs/lifecycle-commands.md`, `docs/agro-compatibility.md`

**Core release and candidate verification:**

- `.github/workflows/publish-cli.yml`, `.github/workflows/release.yml`, `.github/workflows/sandbox-boot-guard.yml`
- `.agro/evals/probes/version-parity.sh`, `.agro/evals/probes/agro-legacy-shim.sh`
- `.agro/scripts/__tests__/canonical-publish-contract.test.ts` — new behavioral test
- `.agro/scripts/__tests__/version-parity-contract.test.ts` — new fixture test
- `.agro/scripts/cli-first-install-smoke.sh` — new candidate-only packaging/install smoke
- `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` — new safety/cleanup checks
- `CHANGELOG.md`

**Agro-web:**

- `scripts/build-oh-cli.mjs`, `scripts/sync-external-scripts.mjs`, `scripts/oh-source.mjs`
- `scripts/build-oh-cli.test.mjs`, `scripts/sync-external-scripts.test.mjs` — new behavioral tests
- `scripts/oh-source.test.mjs`, `scripts/check-docs-drift.mjs`
- `docs/installation.md`, `docs/quickstart.md`, `README.md`

Only adjust the shared source helper if exact-ref reuse requires it.
Keep changes inside the existing scripts; do not add a generic Git or expression engine.
Preserve the Pages workflow and producer/consumer test drafts unless verification demonstrates a scoped defect.
Review any additional write path with the advisor before editing it.

| Step | Action and files | Dependencies | Execution context | DoD IDs |
|---|---|---|---|---|
| 1 | Reconcile accepted refs, paused drafts and supported-path findings. Record the selected npm policy and retained GHCR behavior. | None | Read-only advisor in sandbox | D1 |
| 2 | Apply the core runtime/documentation set. Change only fallback image selection; never rewrite explicit settings. Make help reflect executable identity. | Step 1 | Isolated core worktree | D2, D3 |
| 3 | Apply the release set with the same core worker. Remove normal legacy npm publish/deprecation steps and canonical-version coupling. Add candidate tarball installation and saved-state recreation checks to existing non-publishing CI. | Step 2 | Same isolated core worktree | D4, D6 |
| 4 | Apply the web set. Correct onboarding, checkout the resolved commit, and fetch mirrored scripts by that commit. Preserve retained endpoint outputs. | Step 1 | Separate agro-web worktree | D2, D5 |
| 5 | Verify both resulting trees and draft PR checks. Produce the source closeout and residual release checklist. | Steps 3, 4 | Advisor review; isolated verification checkouts and existing CI | D1–D7 |

### Required implementation details

**Default image selection:** change the CLI fallback and the image-only Compose fallback together.
Keep `AGRO_SANDBOX_IMAGE` over `OH_SANDBOX_IMAGE` precedence.
Preserve explicit `image.ref` values, including legacy URLs and digests.
Do not rename `/opt/oh`, volume names or registry directories.
Do not remove the existing seed marker or overwrite a seeded workspace.

**Release policy:** keep root/CLI version parity and the dated changelog requirement.
The retained shim's own version and exact dependency pin remain internally coherent.
Do not require its version to equal a later canonical release.
Keep the shim's executable and dependency checks; remove only assertions enforcing the withdrawn co-release policy.
Preserve release reservation, image smoke, canonical branch checks and forward-recovery behavior.
Do not remove canonical failure checks or hide failures with `continue-on-error`.
Keep automatic documentation notification after finalization; manual verified deployment remains an allowed operational alternative.

**Docs checkout:** resolve the requested ref, fetch that commit, and checkout it detached.
Compare `git rev-parse HEAD` with the resolved SHA and fail on a mismatch.
Use argument arrays rather than interpolating refs into shell commands.
Use locked CLI dependencies for reproducible builds.
Retain the current Pages JS endpoints in this change; their removal is optional future work.

**Docs provenance:** fetch bootstrap bodies from the resolved commit, not a moving branch URL after resolution.
Release verification must supply the accepted full SHA to both build scripts.
A branch-based development preview does not prove a release identity.
A transient fallback to old assets does not satisfy release verification, even when the build exits successfully.
Test the real script behavior with disposable origins and stubbed network responses, not copied command fragments.

**Candidate smoke:** use a temporary npm prefix, registry home and unique sandbox name.
Use an explicit locally built candidate image so the test cannot pull an unrelated released `latest`.
Verify the default image separately through CLI/Compose tests.
Run lifecycle changes through `agro`; use inspection commands only for health evidence.
Cleanup must target only the fixture's recorded sandbox and volumes.
Never run host-wide prune, mutate the dirty root, or use a production volume.
The local agent container lacks a Docker daemon; use the existing GitHub Docker runner, not host repair.

**Candidate recreation:** extend the same smoke script and its safety tests; do not add a separate compatibility framework.
Run two disposable cases with saved `access.dockerSocket=false` and `access.dockerSocket=true` through the packaged CLI.
Set each installed fixture's configuration through `agro config set --sandbox <name>`.
Apply the saved settings through the supported lifecycle before baseline capture.
Record the saved configuration, effective mounts, container ID, and a fixture-owned workspace file's content hash.
Recreate each container through the supported `agro` lifecycle without deleting its registry entry or persistent volume.
The worker must define and test the exact recreation invocation before CI integration. A restart with an unchanged container ID does not qualify.
Do not re-enter settings, inject socket flags, or attach the socket manually during recreation.
Require a different container ID, the same persistent storage, unchanged file content, and unchanged saved configuration.
Compare the recreated runtime with the saved settings; configuration-file equality alone does not prove runtime behavior.
For the disabled case, require no Docker socket mount or socket file and no successful connection to the runner's Docker API.
For the enabled case, require the socket mount and a successful read-only Docker API call from inside the recreated sandbox as its normal user.
Target the socket explicitly so an inherited remote Docker endpoint cannot produce a false pass.
Recheck bootstrap and cron runtime health after recreation. Record before/after observations and scoped cleanup results in `E/candidate.md`.
Keep all socket access on the disposable CI runner. Never attach the operator's Docker socket or alter the live sandbox.
A failed or skipped case leaves D6 incomplete. Route defects outside the bounded write sets to the advisor before changing source.

## advisor orchestration strategy

The active execution session is the single accountable advisor.
The advisor decides scope, accepts evidence and routes repairs.
Do not create a persistent advisor identity or competing coordinator.

This request is plan-only. Synthesis stays inline because the source review already shares context.
No worker, task folder, commit, push or service starts from writing this document.
The paused Claude session and earlier workers remain paused.

After approval, `/spec` owns execution state and `/delegate` owns bounded dispatch records.
Apply the loaded `/delegate` model, budget, concurrency and recursion policies without redefining them here.
The settings below are requests. Observed model, reasoning and native IDs remain unknown until native resolution.
Honor operator model exclusions. A missing required control blocks its assignment.

Proposed directories for future execution:

- `A` = `/home/sandbox/harness`
- `W` = `/home/sandbox/harness/projects/mifunedev/openharness-web`
- `AW` = `A/.worktrees/task/cli-first-release`
- `WW` = `W/.worktrees/task/cli-first-release`

Resolve ownership before creating either worktree.
If a path already belongs to another task, choose and record a non-conflicting path before dispatch.

| Task | Complexity and selection reason | Requested model / reasoning | Dependencies | Read scope; owned write paths; exclusions | Execution directory; worktree; worker type; continuation | Deliverable | Verification and evidence destination | DoD IDs; acceptance owner; repair route |
|---|---|---|---|---|---|---|---|---|
| T1 | Standard; stale refs and withdrawn requirements need reconciliation. | `inherit / medium` | None | Read accepted refs, #939 and related drafts. Own only future scope evidence. No implementation edits. | Active advisor; read-only source review in `A`; no worker | Frozen scope and ref matrix | Re-query GitHub and compare source functions; `E/scope.md` | D1; advisor; advisor resolves scope |
| T2 | High; image defaults affect real lifecycle behavior and state selection. | `inherit / high` | T1 | Read CLI, registry and compatibility code. Own the core runtime/documentation set. Exclude retired installer, registry mutation, live state and release workflows. | `AW`; isolated; native `general-purpose`; native resume or checkpoint-and-rebrief | Canonical default and accurate help/docs | CLI, lifecycle, config-render and help tests; `E/onboarding.md`, `E/image-selection.md` | D2, D3; advisor; T2 repairs |
| T3 | High; publication ordering and destructive cleanup require decisive negative tests. | `inherit / high` | T2 | Read release and probe contracts. Own the core release/candidate set. Exclude actual publication, secrets, GHCR alias retirement and real version selection. | `AW`; same continuing core worker as T2; no second writer | Canonical npm release contract and candidate installation/recreation smoke | Fake-command workflow tests, probe mutation fixtures, tarball install, saved-state recreation with both socket settings, and Docker CI; `E/release-contract.md`, `E/candidate.md` | D4, D6; advisor; same core worker repairs |
| T4 | High; ref identity spans fetch, build and deployed instructions. | `inherit / high` | T1 | Read accepted core contract and web pipeline. Own the agro-web set. Exclude routing, credentials, deployment, secondary repositories and historical posts. | `WW`; isolated; native `general-purpose`; native resume or checkpoint-and-rebrief | Correct onboarding and exact-SHA build | Web tests, local Git fixtures, typecheck, build and drift check; `E/onboarding.md`, `E/docs-ref.md` | D2, D5; advisor; T4 repairs |
| T5 | Standard; independent evidence review prevents false completion. | `inherit / medium` | T3, T4 | Read complete diffs, logs and PR checks. Own acceptance records only. No source edits, merge or publication. | Active advisor; verify final trees without active writers; no additional worker | Accepted source report and residual release gates | Review every D1–D7 row, final SHAs and exact-head CI; `E/closeout.md` | D1–D7; advisor; return code failures to T2/T3 or T4 |

Bounded worker briefs for future execution:

- **T1:** Read the exact accepted refs and #939. Classify every finding. Preserve draft work and record only the source scope approved here.
- **T2:** In `AW`, change the fresh image fallback and product-aware help. Update the listed core docs. Preserve explicit settings and all ownership/state guards.
- **T3:** Continue T2's worktree. Remove automatic legacy npm publishing from the normal path and narrow the two parity probes. Add fake-publish tests and the temporary-prefix candidate install smoke. Extend that smoke with both saved socket settings, real container recreation, workspace preservation, and runtime assertions. Record before/after evidence in `E/candidate.md`. Do not publish anything.
- **T4:** In `WW`, correct onboarding and build the resolved Git commit. Test actual checkout/fetch behavior, including SHA and moving-ref failures. Keep existing served JS paths; do not change Cloudflare.
- **T5:** Read both final diffs and verification evidence. Reject missing or stale evidence. Report publication and operator-migration work separately from source completion.

Every worker stops after its deliverable and evidence, or at the first unmet prerequisite.
Limit each worker summary to changed paths, observed results, failures and evidence locations.
The advisor records native settings, artifact SHAs and acceptance before releasing dependent work.
A terminated worker leaves evidence to inspect, not permission to start a duplicate writer.

| Wave | Work and owner | Dependencies | Output or handoff | DoD IDs |
|---|---|---|---|---|
| 1 | T1, active advisor | None | Accepted scope and baseline | D1 |
| 2 | T2 core worker and T4 web worker, independent worktrees | T1 | Core behavior and web changes | D2, D3, D5 |
| 3 | T3, continuing core worker; T4 may finish independently | T2 for T3 | Release contract and candidate verification | D4, D6 |
| 4 | T5, active advisor | T3, T4 | Source closeout and remaining release gates | D1–D7 |

### Verification commands and procedures

Run from the future core worktree:

```bash
pnpm install --frozen-lockfile
npm --prefix .agro/cli ci --ignore-scripts
npm --prefix .agro/cli run typecheck
npm --prefix .agro/cli run build
pnpm exec vitest run
bash .agro/evals/probes/version-parity.sh
bash .agro/evals/probes/agro-legacy-shim.sh
bash -n .agro/scripts/cli-first-install-smoke.sh
```

Run the proposed smoke on the existing Docker CI runner with the just-built image.
The worker must define its exact argument contract in the new script and its tests before wiring CI.
Record the image identity, tarball identity, invoked executable, boot result and cleanup result.
Run both saved socket cases through the candidate recreation procedure. Record container IDs, saved settings, storage identity, workspace hashes, socket checks, and service health.
Do not count an unrelated image boot, an unchanged container ID, or preserved configuration files alone as successful candidate verification.

Run from the future web worktree:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm run typecheck
pnpm run check:docs-drift
pnpm run build
```

For release-ref verification, run the build with `AGRO_SCRIPTS_REF` set to the accepted full commit SHA.
For offline tests, use disposable origins and network stubs.
Do not perform a real repository dispatch merely to run these tests.

Inspect exact-head CI after draft pushes during approved execution.
A missing dependency in a disposable worktree requires dependency installation, not an environmental waiver.
A missing local Docker daemon directs runtime verification to existing CI.
A skipped required candidate case remains incomplete.

## Affected surfaces

| Surface | Disposition |
|---|---|
| Host and sandbox | Applied. Development stays in sandbox worktrees; runtime tests use disposable existing CI hosts. No operator-host repair. |
| Lifecycle door | Applied. Preserve CLI lifecycle verbs and test canonical image selection. Do not revive `install.sh`. |
| Canonical and provider surfaces | Applied. Change canonical `.agro/` code only. Preserve provider links and stable internal names; no mirror edits. |
| Root and scaffold | Applied. Correct current core/web onboarding. Preserve dirty root files and existing repository scaffolds. |
| Interactive and headless processes | Applied to verification only. Use existing Herdr/CI mechanisms; create no persistent service. |
| Local and remote operation | Applied. Test ref identity and saved-state recreation; keep evidence independent of a terminal connection. |
| Parallel operation | Applied. One continuing core worker and one isolated web worker; serialize shared core changes. |
| Public documentation | Applied. Agro-web onboarding must match the CLI. Website and historical posts remain parked. |
| Verification | Applied. Behavioral tests, negative cases, candidate packaging, recreation with both socket settings, Docker CI, and independent final review. |

## Risks, rollback, and open questions

- Changing fresh defaults does not migrate existing image references. Preserve those references and current legacy GHCR promotion.
- Stopping legacy npm co-release must not remove the published shim or weaken its own dependency integrity checks.
- Keep the Pages builder until a separate change inventories the retained JS endpoints. Do not replace it merely to simplify a diagram.
- A successful version-exists guard does not verify published bytes. Publication acceptance still needs provenance and runtime smoke evidence.
- Exact-SHA Git fetches can fail. Fail clearly rather than silently selecting a branch or stale bundle.
- Use reviewed revert commits for source rollback. Never rewrite shared history, a published version, or operator state.
- Retain the previous working release identity until the operator accepts the new release and migration evidence.

No unresolved decision blocks this source-plan draft.
Approval must explicitly accept the proposed end of automatic legacy npm publication.
The plan deliberately retains image alias promotion to avoid guessing about existing consumers.

The following values belong to the later release/migration approval, not to this source implementation:

- `<operator-installation>` and `<backup-location>` for the actual state-preservation rehearsal.
- `<release-version>` for the next publication; this plan changes parity behavior but chooses no version.
- `<publication-approver>` and any authority for a manual docs deployment.

Do not fabricate a migration need from a synthetic legacy fixture.
Identify the actual update operation and affected state before changing the operator's installation.

## Approval and handoff

This draft authorizes no execution, worker dispatch, task scaffolding, commit, push, merge or publication.
The operator must approve the source scope before `/spec` creates an execution task.
Continue in the active execution session; that session remains accountable.

This plan ends at tested source and a release-readiness handoff.
The known-installation backup/rehearsal and published-artifact checks remain under #939 S1–S6.
Do not report this plan's completion as publication readiness or full EPIC completion.
