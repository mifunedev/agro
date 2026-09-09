# PRD: CLI-first release preparation

## 1. Introduction and overview

Align release preparation with the supported CLI-first installation path.
Correct active onboarding, fresh image defaults, release dependencies, and documentation source selection.
Preserve operator state and retained compatibility behavior.

The reader is the implementation advisor and the bounded core and agro-web workers.
This PRD defines source changes and candidate verification. The PRD does not authorize implementation, live migration, or publication.

### Source and approved decisions

Source: `.agro/plans/cli-first-release/plan.md`.
The operator confirmed these choices in response to the PRD questions:

- **1A:** Preserve the plan's source-change and candidate-verification scope.
- **2A:** End automatic legacy npm publication. Retain published packages and GHCR aliases.
- **3A:** Use the plan as the drafting source. Revalidate refs and issue decisions before implementation.
- **Approved addition:** Verify disposable recreation with both saved Docker socket settings. Preserve workspace data and reapply runtime configuration without live sandbox repair.

This document carries the plan's Architecture Brief forward. It introduces no replacement architecture.
The plan's recorded refs are historical inputs, not freshly verified repository state:

| Input | Value recorded in the plan |
|---|---|
| Accepted Agro source | `75b593eabc376b6a0b55575086fa91d55344ddf9` |
| Accepted agro-web source | `956bb1d723100b5779b02d617620fb9cf7193090` |
| Released Agro `main` | `823aabbd7324e08e3b685af6b0a5ef5c3467a15f`, version `0.9.0` |
| Release acceptance | Operator-approved S1–S6 section of issue #939 |
| Related scope | Issues #945, #944, and #1019 |
| Unaccepted drafts | Agro #1029 and agro-web #53 |
| Paused work to preserve | `.worktrees/task/installer-dual-layout` |

Before implementation, the advisor must revalidate these inputs and worktree ownership.
Do not treat a draft head or the dirty root checkout as an accepted baseline.
If new evidence contradicts the approved scope, the advisor must resolve the conflict before dispatch.

## 2. Goals

- Make current core and agro-web onboarding describe the same CLI-first path.
- Make help distinguish `agro update` from `oh update` without changing dispatch semantics.
- Use `ghcr.io/mifunedev/agro:latest` for fresh image defaults while preserving explicit selections.
- Remove legacy npm co-release requirements without weakening canonical release checks.
- Build documentation assets from the exact resolved commit or fail.
- Verify a packaged candidate CLI through disposable Docker installation and recreation.
- Prove that recreation preserves workspace data and reapplies saved runtime settings, including enabled and disabled Docker socket access.
- Produce a source-completion report that separates remaining migration and publication gates.

## 3. User stories

### US-001: Freeze the implementation scope

**Description:** As the advisor, I want accepted source identities and finding dispositions so that workers do not restore withdrawn release requirements.

**Acceptance Criteria:**

- [ ] Revalidate the source refs, issue #939 S1–S6, related drafts, paused workers, and worktree ownership before dispatch.
- [ ] Classify every source-plan finding as active, optional, deferred, or post-publication.
- [ ] Record the approved end of automatic legacy npm publication and the retention of GHCR alias promotion.
- [ ] Preserve paused work and reject draft-only requirements that conflict with the approved scope.
- [ ] Record the accepted ref matrix and dispositions in `evidence/scope.md`.

### US-002: Match CLI help to executable behavior

**Description:** As an operator, I want executable-specific help so that I select the intended update operation.

**Acceptance Criteria:**

- [ ] `agro` help describes `agro update` as CLI self-upgrade.
- [ ] `oh` help describes `oh update` as project vendoring.
- [ ] Top-level and command-specific help agree with the invoked executable.
- [ ] Tests exercise both executable identities and preserve existing update dispatch semantics.
- [ ] CLI typecheck, build, and focused help tests pass.

### US-003: Align core onboarding with CLI-first installation

**Description:** As a new operator, I want checkout-free installation instructions so that I can start a sandbox without adopting the harness repository.

**Acceptance Criteria:**

- [ ] Current core onboarding starts with `npm install -g @mifune/agro`, or `get-agro.sh`, followed by `agro sandbox install docker`.
- [ ] Core onboarding requires no clone, fork, retired `install.sh`, or `config repo` step.
- [ ] Core documentation distinguishes CLI self-upgrade from optional project vendoring.
- [ ] Historical material and optional advanced workflows remain outside the required onboarding path.
- [ ] The changed Markdown passes the STE checker. The advisor reviews command consistency against US-002.

### US-004: Preserve explicit image selections while changing fresh defaults

**Description:** As an operator, I want canonical defaults for new sandboxes without changes to my existing image choices or state.

**Acceptance Criteria:**

- [ ] CLI and image-only Compose fallbacks both resolve to `ghcr.io/mifunedev/agro:latest`.
- [ ] Tests preserve `AGRO_SANDBOX_IMAGE` precedence over `OH_SANDBOX_IMAGE`.
- [ ] Tests preserve explicit canonical, legacy, and custom image references, including digest references and `image.ref` values.
- [ ] The change does not rewrite existing configuration, registry files, registry directories, or volume names.
- [ ] Registry discovery, conflict refusal, `/opt/oh` ownership detection, and seed-marker behavior remain intact.
- [ ] CLI typecheck, lifecycle, registry, and config-render tests pass. Tests confirm that seeded workspaces remain unchanged.

### US-005: Remove automatic legacy npm publication

**Description:** As a release operator, I want canonical release success to depend on canonical artifacts rather than a new legacy npm shim.

**Acceptance Criteria:**

- [ ] The normal release path performs no legacy npm publish, wait, or deprecate operation.
- [ ] Existing shim source and published package versions remain available. The change introduces no replacement publication workflow or toggle.
- [ ] Behavioral tests execute the changed workflow shell bodies with fake registry and publish commands.
- [ ] Canonical publication failure fails the release path. Canonical success requires no legacy npm operation.
- [ ] Release reservation, image smoke, canonical branch checks, and forward-recovery behavior remain intact.
- [ ] Image publication still precedes canonical CLI release. GHCR alias promotion and its checks remain intact.
- [ ] Automatic documentation notification remains after finalization. No canonical failure receives `continue-on-error` treatment.
- [ ] Workflow validation and the focused publication-contract tests pass without real publication.

### US-006: Separate canonical parity from retained shim integrity

**Description:** As a maintainer, I want independent parity contracts so that canonical releases can advance without corrupting the retained shim.

**Acceptance Criteria:**

- [ ] Root and canonical CLI version parity checks remain active. The dated changelog requirement remains active.
- [ ] The retained shim need not match a later canonical version.
- [ ] The retained shim's own version and exact dependency pin remain internally coherent.
- [ ] Mutation fixtures reject real canonical version drift, a missing shim target, a ranged dependency pin, and a conflicting executable.
- [ ] Fixtures accept a coherent retained shim when the canonical version advances.
- [ ] `version-parity.sh`, `agro-legacy-shim.sh`, and the focused fixture tests pass.

### US-007: Build retained documentation bundles from the resolved commit

**Description:** As a release operator, I want the docs builder to use the requested source commit so that a successful build proves source identity.

**Acceptance Criteria:**

- [ ] The real builder resolves a full SHA, tag, or branch to a commit, fetches that commit, and checks it out detached.
- [ ] The builder compares `git rev-parse HEAD` with the resolved SHA and fails on a mismatch.
- [ ] Invalid refs and unavailable commits fail. The builder never silently substitutes `main`.
- [ ] A branch movement after resolution cannot change the selected commit. The build uses that commit or fails.
- [ ] Git calls use argument arrays rather than shell interpolation of refs. CLI dependency installation uses the lockfile.
- [ ] Tests run the actual checkout/build path against disposable Git origins, including checkout mismatch and moving-branch cases.
- [ ] Retained Pages JS endpoint paths remain unchanged. Focused tests and agro-web typecheck pass.

### US-008: Fetch mirrored scripts from the same source identity

**Description:** As a release operator, I want mirrored scripts and JS bundles to identify their actual source so that release verification cannot accept stale assets.

**Acceptance Criteria:**

- [ ] Script downloads use the resolved commit SHA, not a moving branch URL after resolution.
- [ ] Release verification supplies the accepted full SHA to both build scripts through the existing source-ref contract, including `AGRO_SCRIPTS_REF`.
- [ ] Verification identifies the actual source commit for mirrored scripts and JS bundles.
- [ ] Tests execute the real scripts with disposable origins and stubbed network responses.
- [ ] Tests retain shell-safe output checks and reject moving-ref source substitution.
- [ ] Stale-asset fallback and branch-only preview success do not satisfy release verification, even when a build exits successfully.
- [ ] Focused script tests and agro-web typecheck pass.

### US-009: Align public onboarding with the CLI

**Description:** As a new operator reading agro-web, I want public instructions that match the supported CLI installation path.

**Acceptance Criteria:**

- [ ] Current agro-web installation and quickstart pages describe the same installation sequence as US-003.
- [ ] Public onboarding requires no clone, fork, retired `install.sh`, or `config repo` step.
- [ ] Public documentation distinguishes `agro update` from `oh update`.
- [ ] Historical posts and optional advanced workflows remain intact.
- [ ] Agro-web tests, typecheck, docs-drift checks, and build pass. Changed Markdown passes the STE checker.
- [ ] Verify in browser using agent-browser skill. Review the rendered installation and quickstart instructions from a local build or non-production preview.

### US-010: Add a safely scoped candidate installation smoke test

**Description:** As a maintainer, I want a packaged-CLI smoke test so that verification exercises the distribution users will install.

**Acceptance Criteria:**

- [ ] The smoke test builds and runs `npm pack` for the canonical CLI.
- [ ] The smoke test installs the tarball into a temporary npm prefix and invokes that prefix's `agro` executable.
- [ ] The fixture uses an isolated registry home, a unique sandbox name, and an explicit locally built candidate image.
- [ ] The fixture cannot substitute a released `latest` image. US-004 verifies default image selection separately.
- [ ] Lifecycle changes run through `agro`. Inspection commands supply health evidence only.
- [ ] Cleanup targets only the fixture's recorded sandbox and volumes, including failure paths.
- [ ] Safety tests reject unscoped cleanup. The test never runs host-wide prune or uses a production volume.
- [ ] The script's argument contract exists before CI integration. Shell syntax checks and focused safety tests pass.

### US-011: Verify candidate installation and recreation on existing Docker CI

**Description:** As the advisor, I want exact-head candidate evidence so that source acceptance does not rely on an unrelated image or stale checks.

**Acceptance Criteria:**

- [ ] Existing non-publishing Docker CI runs US-010 with the candidate image from the tested source.
- [ ] The packaged CLI installs a sandbox. Evidence confirms boot and the required bootstrap and cron runtime service health.
- [ ] Extend the US-010 smoke script and safety tests with two disposable recreation cases: saved `access.dockerSocket=false` and saved `access.dockerSocket=true`.
- [ ] Configure each installed fixture through `agro config set --sandbox <name>`. Apply saved settings through the supported lifecycle before baseline capture.
- [ ] Record saved configuration, effective mounts, container ID, and a fixture-owned workspace file's content hash before recreation.
- [ ] Define and test the exact supported `agro` recreation invocation before CI integration. Keep the existing registry entry and persistent volume.
- [ ] Recreate without re-entering settings, injecting socket flags, or manually attaching the socket. A restart with an unchanged container ID does not qualify.
- [ ] After recreation, require a different container ID, the same persistent storage, unchanged workspace file content, and unchanged saved configuration.
- [ ] Compare the recreated runtime with saved settings. Configuration-file equality alone does not prove runtime behavior.
- [ ] With socket access disabled, require no socket mount or socket file and no successful connection to the runner's Docker API.
- [ ] With socket access enabled, require the socket mount and a successful read-only Docker API call as the recreated sandbox's normal user.
- [ ] Target the socket explicitly in API checks. An inherited remote Docker endpoint must not produce a false pass.
- [ ] Recheck bootstrap and cron runtime health after recreation. Run scoped cleanup after success or failure.
- [ ] Evidence records source SHA, image identity, tarball identity, invoked executable, and before/after recreation observations for both cases in `evidence/candidate.md`.
- [ ] Keep socket access on the disposable CI runner. Never attach the operator's Docker socket or alter the live sandbox.
- [ ] Exact-head core and agro-web CI pass. Web PR deployment remains skipped.
- [ ] Verification installs missing dependencies in disposable worktrees rather than claiming an environmental waiver.
- [ ] A missing local Docker daemon routes runtime verification to existing CI. A skipped required candidate case remains incomplete.

### US-012: Produce a source-completion handoff

**Description:** As the operator, I want completed source work separated from release operations so that I can authorize the remaining work explicitly.

**Acceptance Criteria:**

- [ ] The advisor reviews both complete diffs, final source SHAs, and test logs against every requirement.
- [ ] The closeout maps every plan criterion D1–D7 to evidence and identifies missing evidence without claiming completion.
- [ ] The remaining checklist separates actual-install inventory, backup, migration rehearsal, version selection, publication approval, and post-publication checks.
- [ ] The closeout does not claim release readiness or full issue #939 completion from source acceptance alone.
- [ ] Changes to agreed scope return to the advisor for resolution and an issue #939 update during approved execution.
- [ ] The closeout passes the STE checker. The advisor verifies every evidence link and exact-head check result.

## 4. Functional requirements

- **FR-1:** Current onboarding must support `npm install -g @mifune/agro`, or `get-agro.sh`, followed by `agro sandbox install docker`.
- **FR-2:** Help must describe `agro update` as CLI self-upgrade and `oh update` as project vendoring. Dispatch semantics must remain unchanged.
- **FR-3:** Fresh CLI and image-only Compose fallbacks must use `ghcr.io/mifunedev/agro:latest`.
- **FR-4:** Image selection must preserve explicit settings and environment precedence. The change must not migrate existing operator state.
- **FR-5:** Canonical release success must not require legacy npm publication, waiting, or deprecation.
- **FR-6:** Canonical release safety checks, publication ordering, GHCR alias promotion, and post-finalization docs notification must remain active.
- **FR-7:** Canonical parity must reject root/CLI version drift. Retained shim checks must enforce the shim's own exact dependency and executable contract.
- **FR-8:** The docs builder must build the resolved commit exactly or fail. Ref resolution must not permit silent branch substitution.
- **FR-9:** Mirrored scripts must use that resolved commit. Release evidence must identify the actual source of both scripts and bundles.
- **FR-10:** Candidate verification must invoke the temporarily installed packaged CLI against the locally built candidate image on a disposable Docker runner.
  Verification must include actual container recreation with saved socket access disabled and enabled.
  Recreation must preserve workspace data and reapply saved runtime settings without manual restoration.
- **FR-11:** Candidate cleanup must affect only recorded fixture resources, including after failures.
- **FR-12:** Acceptance must use complete diffs, exact-head CI, and requirement-specific evidence. Missing or stale evidence must not count as success.
- **FR-13:** Implementation must preserve published artifacts, registry readers, ownership checks, seed markers, existing selections, and user files.
- **FR-14:** Source acceptance must remain separate from migration and publication authorization under issue #939 S1–S6.

## 5. Non-goals

- Repairing the retired `install.sh`, clone-and-own onboarding, or `config repo` as release prerequisites.
- Restoring the historical compatibility matrix, exhaustive historical installation tests, a 90-day window, or a three-release requirement.
- Publishing packages, images, releases, or production documentation during this task.
- Selecting a release version or migrating the operator's live installation.
- Changing Cloudflare, credentials, host configuration, or paid infrastructure.
- Changing cloud, orchestra, website, or other secondary repositories. Agro-web remains in scope.
- Deleting historical packages, images, aliases, registry readers, seed markers, or user files.
- Ending GHCR alias promotion or removing retained Pages JS endpoints.
- Replacing the Pages build system or adding a general workflow parser, compatibility framework, or Git abstraction.
- Importing paused installer work or altering unrelated dirty root files.

## 6. Design considerations

Preserve the plan's narrow decision: repair active behavior and remove only unnecessary legacy npm release coupling.
Keep GHCR alias promotion because the plan has not established that existing installations no longer need those aliases.
Keep the current Pages builder and endpoint paths.

The CLI is the lifecycle entry point. Optional project vendoring is not a prerequisite for starting a sandbox.
The public documentation change concerns rendered instructions, not navigation redesign or new UI components.

## 7. Technical considerations

### Change boundaries

The source plan's bounded write sets control future implementation.
The following paths identify the main integration points; they do not expand those write sets.

| Surface | Primary paths |
|---|---|
| CLI help and image fallback | `.agro/cli/src/cli.ts`, `.agro/cli/src/commands/lifecycle.ts` |
| Compose fallback | `.devcontainer/docker-compose.image-only.yml` |
| Release and candidate CI | `.github/workflows/publish-cli.yml`, `.github/workflows/release.yml`, `.github/workflows/sandbox-boot-guard.yml` |
| Parity probes | `.agro/evals/probes/version-parity.sh`, `.agro/evals/probes/agro-legacy-shim.sh` |
| Candidate smoke | `.agro/scripts/cli-first-install-smoke.sh` and its focused tests |
| Core documentation | `README.md`, `.agro/cli/README.md`, `.agro/scripts/README.md`, and the plan's listed `docs/` files |
| Agro-web source handling | `scripts/build-oh-cli.mjs`, `scripts/sync-external-scripts.mjs`, `scripts/oh-source.mjs`, and their tests |
| Agro-web documentation | `docs/installation.md`, `docs/quickstart.md`, `README.md`, `scripts/check-docs-drift.mjs` |

Agro-web paths are relative to the agro-web repository.
Only change the shared source helper when exact-ref reuse requires the change.
Review any additional write path with the advisor before editing.
Preserve producer/consumer test drafts unless verification demonstrates a defect within this scope.

### Execution and ownership

This request creates only `prd.md`. It starts no worker, service, commit, push, merge, deployment, or publication.
Future approved execution uses `/spec` for build state and `/delegate` for bounded worker assignments.
The active session remains the single accountable advisor.

1. The advisor revalidates accepted refs, scope, and ownership.
2. One core worker handles runtime and documentation changes in an isolated sandbox worktree.
3. The same core worker continues with release contracts, candidate installation, and saved-state recreation verification.
4. An independent agro-web worker handles docs source identity and onboarding in a separate worktree.
5. The advisor reviews final evidence after the workers stop writing.

Core and agro-web work can overlap after scope acceptance. Two workers must not write to the same checkout.
Use existing CI Docker runners for runtime verification. Do not repair the host to obtain a local Docker daemon.
Extend the existing candidate smoke and its safety tests; do not add a separate compatibility framework.
If recreation exposes a defect outside the plan's bounded write sets, return the defect to the advisor before changing source.
Use local fixtures and network stubs for docs tests. Do not send a real repository dispatch for testing.

### Affected surfaces

| Surface | Disposition |
|---|---|
| Host and sandbox | Applied. Develop in sandbox worktrees; run disposable Docker verification on existing CI hosts. |
| Lifecycle door | Applied. Preserve lifecycle semantics and execute fixture lifecycle operations through `agro`. |
| Canonical and provider surfaces | Applied. Edit canonical `.agro/` sources, not provider mirrors. Preserve provider links. |
| Root and scaffold | Applied. Update core onboarding without rewriting existing scaffolds or dirty root files. |
| Interactive and headless processes | Applied to verification. Use existing Herdr and CI mechanisms; create no persistent service. |
| Local and remote operation | Applied. Verify saved-state recreation and deterministic source identity; keep evidence independent of an attached terminal. |
| Parallel operation | Applied. Isolate core and agro-web worktrees; serialize coupled core edits. |
| Public documentation | Applied. Update agro-web onboarding; leave secondary repositories and historical posts unchanged. |
| Verification | Applied. Require behavioral tests, negative cases, packaged installation, recreation with both socket settings, browser review, and exact-head CI. |

### Verification commands

Run core checks from the future core worktree:

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

Run agro-web checks from the future agro-web worktree:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm run typecheck
pnpm run check:docs-drift
pnpm run build
```

For release-ref verification, set `AGRO_SCRIPTS_REF` to the accepted full commit SHA.
Run candidate installation and both saved socket recreation cases on existing Docker CI through the tested smoke-script argument contract.
Record before/after container IDs, saved settings, storage identity, workspace hashes, socket checks, service health, and scoped cleanup.
Do not count a successful build of a different commit, stale assets, or an unrelated image as verification.

## 8. Success metrics and Definition of Done

All acceptance criteria must pass. No required skipped case counts as completion.
Evidence paths below are relative to `.agro/tasks/cli-first-release/` in the future execution worktree.
This PRD does not create evidence or report implementation results.

| Plan criterion | Observable completion metric | Stories | Required evidence |
|---|---|---|---|
| D1 | Every source-plan finding has a disposition and an accepted source reference. | US-001 | `evidence/scope.md` |
| D2 | Both executable identities have matching help; core and public onboarding require no repository adoption. | US-002, US-003, US-009 | `evidence/onboarding.md`, including browser results |
| D3 | Both fresh defaults select the canonical image; explicit selections and state-preservation cases pass. | US-004 | `evidence/image-selection.md` |
| D4 | Canonical success requires zero legacy npm operations; failure and parity mutation cases pass. GHCR checks remain intact. | US-005, US-006 | `evidence/release-contract.md` |
| D5 | SHA, tag, branch, invalid-ref, moving-ref, and mismatch tests prove exact source identity or explicit failure. | US-007, US-008 | `evidence/docs-ref.md` |
| D6 | Candidate installation and actual recreation pass with saved socket access disabled and enabled. Workspace data, effective settings, health, and scoped cleanup pass. Both repositories have passing exact-head CI. | US-010, US-011 | `evidence/candidate.md`, including before/after recreation evidence |
| D7 | Every requirement maps to reviewed evidence; remaining live-state and publication gates have a separate checklist. | US-012 | `evidence/closeout.md` |

The advisor owns acceptance for all seven criteria.
Return core failures to the continuing core worker and web failures to the agro-web worker.
Inspect terminated-worker artifacts before assigning replacement work.

## 9. Open questions and deferred decisions

No product-scope decision remains open for this PRD. Ref and ownership revalidation remain implementation prerequisites.
If evidence shows a current consumer requires a newly published legacy npm version, the advisor must return the policy conflict to the operator.

The following values belong to separate release or migration approval:

- `<operator-installation>`: Which actual installation requires inventory and an update rehearsal?
- `<backup-location>`: Where will the operator store the verified state backup?
- `<release-version>`: Which version will the operator authorize for publication?
- `<publication-approver>`: Name the person who can authorize publication and any manual documentation deployment.

Do not infer a migration need from a synthetic legacy fixture.
Identify the actual update operation and affected state before proposing changes to the operator's installation.
An authorized, verified manual docs deployment can satisfy later documentation acceptance; automatic dispatch is not a policy prerequisite.
Published-byte provenance and post-publication runtime checks remain release gates even when a version-exists guard succeeds.
Use reviewed revert commits for source rollback. Never rewrite shared history, published versions, or operator state.
Retain the previous working release identity until the operator accepts release and migration evidence.
