# PRD: CLI-first release preparation

## 1. Overview and authority

Prepare a verified CLI-first candidate and an honest release handoff for issue #939.
The reader is the implementation advisor and the bounded core and agro-web workers.

This PRD owns acceptance criteria. [The plan](../../plans/cli-first-release/plan.md) owns source grounding, sequencing, and bounded write sets.
`prd.json` projects these same 13 stories into execution order. All stories remain unpassed until evidence supports acceptance.

The operator approved source changes and candidate verification, ending automatic legacy npm publication, and the four bounded review additions.
Retain published packages and GHCR aliases. Revalidate recorded source refs before implementation.
Updating planning-only PR #1031 authorizes no implementation, migration, deployment, or publication.
The current S1–S6 section of issue #939 controls release acceptance; this task covers only part of that contract.

## 2. Goals

1. Align CLI-first onboarding, executable-aware help, and canonical fresh image defaults.
2. Align release behavior and instructions; build documentation from the exact source commit.
3. Prove candidate installation and state-preserving recreation on existing disposable Docker CI.

## 3. User stories and acceptance criteria

IDs match `prd.json`. US-001 precedes implementation; US-012 verifies the candidate tests; US-013 closes the source task.

### US-001: Freeze the implementation scope

**Description:** As the advisor, I want accepted refs and explicit dispositions so that workers do not restore withdrawn release requirements.

- [ ] Revalidate accepted refs, issue #939 S1–S6, related drafts, paused workers, and worktree ownership before dispatch.
- [ ] Classify every plan finding as active, optional, deferred, or post-publication; record the accepted ref matrix in `evidence/scope.md`.
- [ ] Record the approved end of automatic legacy npm publication and retained GHCR alias promotion.
- [ ] Preserve paused work. Resolve conflicting new evidence before dispatch; do not promote draft-only requirements into scope.

### US-002: Match CLI help to executable behavior

**Description:** As an operator, I want executable-specific help so that I select the intended update operation.

- [ ] Top-level and command-specific `agro` help describe `agro update` as CLI self-upgrade.
- [ ] Equivalent `oh` help describes `oh update` as project vendoring.
- [ ] Tests exercise both executable identities and preserve existing dispatch semantics.
- [ ] CLI typecheck, build, and focused help tests pass.

### US-003: Align core onboarding with CLI-first installation

**Description:** As a new operator, I want checkout-free instructions so that I can start a sandbox without adopting the harness repository.

- [ ] Current onboarding describes `npm install -g @mifune/agro`, or `get-agro.sh`, followed by `agro sandbox install docker`.
- [ ] Onboarding requires no clone, fork, retired `install.sh`, or `config repo` step.
- [ ] Core documentation distinguishes CLI self-upgrade from optional project vendoring; historical material remains outside the required path.
- [ ] Changed Markdown passes the STE checker. The advisor reviews command consistency against US-002.

### US-004: Preserve explicit selections while changing fresh defaults

**Description:** As an operator, I want canonical defaults without changes to my existing image choices or state.

- [ ] CLI and image-only Compose fallbacks both resolve to `ghcr.io/mifunedev/agro:latest`.
- [ ] Tests preserve `AGRO_SANDBOX_IMAGE` precedence over `OH_SANDBOX_IMAGE` and explicit canonical, legacy, custom, and digest references, including `image.ref`.
- [ ] Existing configuration, registry files/directories, and volume names remain unchanged.
- [ ] Registry discovery, conflict refusal, `/opt/oh` ownership detection, and seed-marker protections remain intact.
- [ ] CLI typecheck, lifecycle, registry, and config-render tests pass, including protection of seeded workspace content.

### US-005: Remove automatic legacy npm publication and align instructions

**Description:** As a release operator, I want one canonical npm release policy in workflows and instructions so that neither restores legacy co-release requirements.

- [ ] The normal release path performs no legacy npm publish, wait, or deprecate operation; no replacement toggle or publication workflow appears.
- [ ] Retained shim source and published versions remain available.
- [ ] Behavioral tests execute changed workflow shell bodies with fake registry/publish commands; canonical failure fails and success requires no legacy npm operation.
- [ ] Preserve release reservation, image smoke, canonical branch checks, forward recovery, and image publication before canonical CLI release.
- [ ] Preserve GHCR alias promotion and checks, plus automatic docs notification after finalization. Do not hide canonical failures with `continue-on-error`.
- [ ] Canonical `/git` and `/release` instructions match the new npm artifact, version, and verification contract; they require no newly published legacy version.
- [ ] Instruction updates do not restore withdrawn time-window gates or make automatic docs dispatch the only documentation acceptance path.
- [ ] Workflow validation, focused contract tests, applicable skill probes, STE, and provider-link checks pass without real publication.

### US-006: Separate canonical parity from retained shim integrity

**Description:** As a maintainer, I want independent parity contracts so that canonical releases can advance without corrupting the retained shim.

- [ ] Keep root/canonical CLI version parity and the dated changelog requirement.
- [ ] The retained shim's own version and exact dependency pin remain internally coherent without matching a later canonical version.
- [ ] Mutation fixtures reject canonical drift, a missing shim target, a ranged pin, and a conflicting executable.
- [ ] Fixtures accept a coherent retained shim when the canonical version advances.
- [ ] Both parity probes and focused fixture tests pass; release instructions agree with these checks.

### US-007: Build retained documentation bundles from the resolved commit

**Description:** As a release operator, I want exact-source docs builds so that a successful build proves the requested source identity.

- [ ] The real builder resolves a full SHA, tag, or branch, fetches the commit, and checks it out detached.
- [ ] Compare `git rev-parse HEAD` with the resolved SHA. Fail on mismatch, invalid refs, or unavailable commits; never substitute `main`.
- [ ] Tests use disposable Git origins and the actual checkout/build path, including a branch moving after resolution and an injected checkout mismatch.
- [ ] Git calls use argument arrays rather than shell interpolation; CLI dependency installation uses the lockfile.
- [ ] Retain Pages JS endpoint paths. Focused tests and agro-web typecheck pass.

### US-008: Fetch mirrored scripts from the same source identity

**Description:** As a release operator, I want matching script and bundle provenance so that release verification cannot accept stale assets.

- [ ] Download scripts by the resolved commit, not a moving branch URL. Supply the accepted full SHA to both build scripts through the existing `AGRO_SCRIPTS_REF` contract.
- [ ] Evidence identifies the actual source commit of mirrored scripts and JS bundles.
- [ ] Tests execute real scripts with disposable origins and network stubs, preserve shell-safe output checks, and reject moving-ref substitution.
- [ ] Stale-asset fallback or branch-only preview success cannot satisfy release verification, even when the build exits successfully.
- [ ] Focused script tests and agro-web typecheck pass.

### US-009: Align public onboarding with the CLI

**Description:** As a new operator reading agro-web, I want instructions that match the supported CLI installation path.

- [ ] Installation and quickstart pages match US-003 and distinguish `agro update` from `oh update`.
- [ ] Require no clone, fork, retired `install.sh`, or `config repo` step; retain historical posts and optional advanced workflows.
- [ ] Agro-web tests, typecheck, docs-drift checks, build, and changed-Markdown STE checks pass.
- [ ] Verify in browser using agent-browser skill. Review rendered installation and quickstart instructions locally or in a non-production preview.

### US-010: Add candidate installation, bootstrap, and fresh-seeding checks

**Description:** As a maintainer, I want tests of the real candidate distribution so that packaging or seeding defects cannot hide behind stub artifacts.

- [ ] Build and `npm pack` the canonical CLI; install the tarball into a temporary npm prefix and invoke that prefix's `agro` executable.
- [ ] Also run the real `get-agro.sh` against the same candidate's built `agro.js` through `AGRO_JS_URL`, using an isolated HOME, profile, and bin directory.
- [ ] Bootstrap verification uses the real bundle, not a version-printing stub; independently verify executable identity, version, and activation in a new shell.
- [ ] Each installed CLI provisions its own uniquely named sandbox with an isolated registry home and the explicit locally built candidate image.
- [ ] Begin with empty persistent workspace storage and no bind-mounted source checkout. Verify canonical `.agro/` seed content, `.agro/.image-seeded`, and absence of `.oh/`.
- [ ] Never substitute a released `latest` image. US-004 verifies default selection separately; record image, tarball, bundle, and executable identities.
- [ ] Provision through `agro`; inspection commands collect evidence only. Cleanup affects only recorded fixture resources after success or failure.
- [ ] Define the script argument contract before CI integration. Shell syntax, focused bootstrap tests, and safety tests pass, including rejection of unscoped cleanup.
- [ ] The bootstrap candidate case starts with supported Node available. Record the separate Node-missing S4 obligation; do not claim this case proves Node installation.

### US-011: Add saved-state recreation assertions to the candidate smoke

**Description:** As an operator, I want recreation tests to protect saved settings and persisted files. US-012 owns actual CI execution and runtime evidence.

- [ ] Extend the same smoke script and safety tests with saved `access.dockerSocket=false` and `access.dockerSocket=true`; do not create a second framework.
- [ ] Configure installed fixtures through `agro config set --sandbox <name>` and apply settings through the supported lifecycle before baseline capture.
- [ ] Record saved configuration, effective mounts, container ID, storage identity, workspace hashes, and seed-marker metadata before recreation.
- [ ] Add synthetic persisted files owned by the sandbox user: a `0600` credential stand-in and a `0755` executable. Record hashes, modes, and UID/GID.
- [ ] Edit a seeded file before recreation. Assertions require that edit and seed-marker metadata to survive without reseeding or overwriting the workspace.
- [ ] Define and fixture-test a supported `agro` recreation invocation before CI integration; keep the registry entry and persistent volume.
- [ ] Require a different container ID, the same storage, unchanged saved settings, and unchanged fixture content, modes, and UID/GID after recreation.
- [ ] Reject restarts with unchanged IDs, re-entered settings, injected socket flags, and manual socket attachment. File equality alone does not prove effective settings.
- [ ] With access disabled, assert no socket mount/file and no connection to the runner's Docker API; with access enabled, assert the mount and a successful read-only API call as the sandbox user.
- [ ] Target the socket explicitly; fixture tests reject false success from an inherited remote Docker endpoint.
- [ ] Reuse PID1/service checks, recheck bootstrap and cron runtime health, and exercise scoped cleanup on failure as well as success.
- [ ] The script emits before/after observations for US-012. Focused fixture and safety tests pass; stub results do not establish live runtime acceptance.

### US-012: Verify the candidate on existing Docker CI

**Description:** As the advisor, I want exact-head runtime evidence so that source acceptance does not rely on stale checks or unexecuted assertions.

- [ ] Existing non-publishing Docker CI executes both real installation paths from US-010 and both recreation cases from US-011 against the tested candidate image.
- [ ] All seed, state, metadata, socket, health, and cleanup assertions pass in actual containers. Test definitions, stubs, or unchanged container IDs cannot satisfy this story.
- [ ] Record source SHA, image/tarball/bundle identities, invoked executables, real exit statuses, and before/after observations in `evidence/candidate.md`.
- [ ] Exact-head core and agro-web CI pass; web PR deployment remains skipped.
- [ ] Install missing worktree dependencies rather than claiming an environmental waiver. A missing local Docker daemon routes verification to existing CI.
- [ ] Failed or skipped required cases remain incomplete. No socket access or lifecycle operation may affect the operator's host or live sandbox.

### US-013: Produce a source-completion handoff

**Description:** As the operator, I want reviewed source evidence separated from release operations so that I can authorize the remaining work explicitly.

- [ ] Review both complete diffs, final SHAs, test logs, and evidence links against every story and D1–D7 criterion.
- [ ] Reject missing, stale, skipped, or substituted evidence; report remaining obligations in the release-gate table below.
- [ ] Record actual-install inventory, backup, migration rehearsal, version selection, publication approval, and post-publication checks separately from source completion.
- [ ] Resolve agreed-scope changes with the advisor and update issue #939 during approved execution; do not claim publication readiness or epic completion.
- [ ] The closeout passes STE and includes exact-head CI results. Keep every uncompleted release gate explicit.

## 4. Functional requirement traceability

Story criteria above define the checks; this table preserves requirement identifiers without duplicating those checks.

| Requirement | Contract | Stories |
|---|---|---|
| FR-1 | Supported installation and onboarding | US-003, US-009, US-010 |
| FR-2 | Executable-aware update help | US-002 |
| FR-3 | Canonical fresh image defaults | US-004 |
| FR-4 | Explicit settings and state preservation | US-004, US-011 |
| FR-5 | Canonical-only automatic npm publication | US-005 |
| FR-6 | Release safety, ordering, retained GHCR promotion, and docs notification | US-005 |
| FR-7 | Canonical parity and independent shim integrity | US-006 |
| FR-8 | Exact-commit docs build or failure | US-007 |
| FR-9 | Shared script/bundle source identity | US-008 |
| FR-10 | Real candidate installation and recreation | US-010–US-012 |
| FR-11 | Fixture-scoped cleanup, including failure paths | US-010–US-012 |
| FR-12 | Complete, exact-head acceptance evidence | US-001, US-012, US-013 |
| FR-13 | Retained artifacts, state guards, and user-file protections | US-004–US-006, US-011 |
| FR-14 | Separation from live migration and publication authority | US-013 |

## 5. Non-goals and safety boundaries

- No live repair, host provisioning, paid infrastructure, credential changes, Cloudflare/DNS/routing changes, production deployment, release version selection, or publication.
- No required clone-and-own onboarding, retired `install.sh` repair, `config repo` dependency, broad installer/platform matrix, or replacement Pages/Git/workflow framework.
- No historical compatibility campaign, 90-day/three-release gate, wholesale alias retirement, or automatic import of paused installer work.
- No deletion of published artifacts, registry readers, ownership guards, seed markers, user files, or existing image choices; no cosmetic rename of `/opt/oh` or volumes.
- Keep Cloud, orchestra, website, and other secondary repositories parked. Agro-web remains in scope; retain its historical posts and existing JS endpoint paths.
- Never use production volumes, real credentials as fixtures, host-wide prune, or unrelated root files. Never attach the operator's Docker socket for testing.

## 6. Design considerations

AGRO owns the lifecycle boundary; the operator owns the selected environment.
Use canonical sources and existing lifecycle commands. Test effective runtime behavior rather than only saved configuration or source literals.
Preserve explicit `AGRO_*`/`OH_*` precedence and active compatibility consumers without introducing a new compatibility layer.
The plan's file boundaries and single-advisor assignments govern implementation; unexpected defects require scope review before additional edits.

## 7. Technical verification

Run core checks from its isolated sandbox worktree:

```bash
pnpm install --frozen-lockfile
npm --prefix .agro/cli ci --ignore-scripts
npm --prefix .agro/cli run typecheck
npm --prefix .agro/cli run build
pnpm exec vitest run
bash .agro/evals/probes/version-parity.sh
bash .agro/evals/probes/agro-legacy-shim.sh
bash -n .agro/scripts/cli-first-install-smoke.sh
bash .agro/scripts/link-providers.sh --check
```

Run agro-web checks from its separate worktree:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm run typecheck
pnpm run check:docs-drift
pnpm run build
```

Use disposable Git origins and stubbed network responses for docs ref tests; do not send a real repository dispatch for testing.
Set `AGRO_SCRIPTS_REF` to the accepted full SHA for release-ref verification.
The candidate bootstrap may use a fixture artifact URL, but must execute the real built bundle and installed CLI.
That substitution proves candidate behavior, not public endpoint availability or published-byte provenance.
Use the tested smoke-script argument contract on existing Docker CI; keep all fixture lifecycle mutations behind `agro`.
Apply STE to changed prose and the applicable skill probes to canonical instruction edits.

## 8. Success metrics and Definition of Done

Success means every story passes its checks with current evidence; no required skipped case counts as completion.
The plan maps D1–D7 to owners, stories, and evidence files. The advisor accepts those rows after workers stop writing.
Evidence paths are relative to `.agro/tasks/cli-first-release/` in the execution worktree.
The source task does not mark S1–S6 complete merely because candidate CI passes.

## 9. Open release gates and deferred decisions

No new product-scope decision blocks this source draft. The following obligations remain separate from its acceptance:

| Gate | Remaining evidence or decision |
|---|---|
| S1 | Identify `<operator-installation>`, its host/image/state locations, and recovery route; verify a restorable backup at `<backup-location>` before live changes. |
| S2 | Rehearse migration on a disposable copy of that identified state, including data, uncommitted work, credentials, permissions, and recovery commands. Synthetic fixtures cannot replace this evidence. |
| S3 | Use candidate installation, seeding, CLI, and runtime evidence from US-010–US-012; do not infer coverage of every historical image. |
| S4 | Verify the advertised install sequence, including `get-agro.sh` on a disposable host initially without supported Node. Candidate npm/bootstrap checks do not establish this Node-provisioning case. Record any advertised `npx` path and retained executable URLs in the release checklist; do not silently waive them. |
| S5 | Select `<release-version>` and verify version/files/CI agreement plus a short release/recovery procedure before requesting publication approval. A green unbumped no-op publishes nothing. |
| S6 | After `<publication-approver>` authorizes publication, verify public npm/GHCR/release-asset provenance, advertised URLs, deployed docs, fresh installation, and migration on the disposable state copy. |

An authorized, verified manual docs deployment can satisfy documentation acceptance. If the release uses automatic dispatch, observe delivery rather than inferring it from a green skip.
A retained executable URL must not return HTML or select the wrong installation. Review release sequencing before promotion can break an advertised URL.
Do not infer migration needs from synthetic legacy fixtures. Never expose secret values in evidence.
A current consumer requiring a newly published legacy npm version must return to the operator for policy review.
Source rollback uses reviewed revert commits; retain the previous working release identity until the operator accepts release and migration evidence.
