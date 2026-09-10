# PRD: AGRO CLI entry point and dual-published artifacts (Phase 1, #941)

## Introduction

Phase 1 of the OpenHarness → AGRO migration (epic #939, RFC
`docs/rfcs/rfc-agro-migration.md`). AGRO becomes a real public entry point —
`@mifune/agro`, the `agro` executable, `dist/agro.js`, `get-agro.sh`, canonical
`ghcr.io/mifunedev/agro` version/SHA references — on top of the Phase 0
compatibility layer, while every persisted default (`.oh/`, `oh.json`, `OH_*`,
`~/.oh`, `/opt/oh-seed`, `ghcr.io/mifunedev/openharness` as the default image ref)
stays on the legacy generation. One bundle serves both executables; the product
identity is derived from the invoked executable name, so `oh` and `agro` cannot
diverge. `agro update` upgrades only the installed CLI (Q1); `oh update` keeps its
project-payload behavior through the SLA; canonical installation is artifact-only
(Q2); no `agro project update` and no `init` (Q3).

## Goals

- `npm install -g @mifune/agro` installs a working `agro`; `agro --version` prints
  the release version; `agro` runs every existing verb against a legacy `.oh/` +
  `oh.json` + `OH_*` project and registry with no migration.
- `@mifune/openharness` stays installable and is a delegation shim over the exact
  same `@mifune/agro` version: its only code is the `oh` bin that imports the AGRO
  bundle. Both packages can be installed together and removed in any order
  without one removing the other's executable (disjoint bins).
- `agro update` is CLI self-upgrade through the owning distribution mechanism
  (npm-managed or standalone); it refuses image-managed, source-managed, read-only,
  and ambiguous installations with the supported procedure, verifies the upgraded
  executable, is a no-op when current, never escalates privileges, and rejects
  legacy payload flags with a command-specific error.
- `get-agro.sh` installs the prebuilt `agro.js` artifact only (no host clone, no
  host build), honours `AGRO_*` installer variables with `OH_*` fallbacks through
  Phase 0 precedence, and reports artifact failures instead of working around them.
- The release pipeline publishes both npm packages (legacy one deprecated toward
  `@mifune/agro`), pushes `ghcr.io/mifunedev/agro:<version>` and `:sha-<sha>` from
  the same build as the legacy tags, proves digest equality, promotes `latest` on
  both repositories, attaches `agro.js`/`get-agro.sh`/`oh.js`/`get-oh.sh` as release
  assets (the transitional hosting that makes the artifacts testable before the
  Phase 3 domain cutover), and smoke-tests `agro` as a first-class entry point.
- Docs present `agro` as the canonical CLI with `oh` as the compatibility entry
  point, without changing persisted-state defaults or publishing Phase 2+ guidance.

## User Stories

### US-001: One bundle, two executables, two packages

**Description:** As an operator, I want `agro` and `oh` to be the same
implementation so the compatibility entry point can never drift.

**Acceptance Criteria:**

- [ ] `.oh/cli/src/lib/product.ts` exports `resolveProduct(argv1)` → `{ name: "agro" | "oh", bin, title, packageName }`: a basename beginning with `oh` (extension stripped) is the legacy product; everything else is `agro`. `cli.ts` computes the product once from `process.argv[1]` and every help banner, usage line, and `oh <verb>:` error prefix uses the product bin (legacy invocations print byte-identical text to today).
- [ ] `oh --help` (legacy product) ends with one line stating that `oh` is the compatibility entry point for `agro` (`@mifune/agro`); `agro --help` prints `agro — AGRO CLI (v<version>)` and no deprecation line. `--version` prints the bare version for both.
- [ ] `.oh/cli/package.json` is `@mifune/agro` with `bin: { agro: ./dist/agro.js }`, `files: [dist, NOTICE]`, and no `oh` bin; `build.mjs` emits `dist/agro.js` and `dist/oh.js` from one esbuild invocation (identical bytes), both mode 0755; `OH_ASSET_ROOT` and `oh-asset:` unchanged.
- [ ] `.oh/cli/legacy/package.json` is `@mifune/openharness`, same version, `dependencies: { "@mifune/agro": "<exact same version>" }`, `bin: { oh: ./bin/oh.js }`; `bin/oh.js` imports `@mifune/agro/dist/agro.js` and nothing else; its README states the deprecation and the `npm install -g @mifune/agro` path.
- [ ] `.devcontainer/Dockerfile` links `/usr/local/bin/agro` → `/opt/oh/dist/agro.js` beside the existing `oh` link; `.oh/scripts/verify-sandbox-image.sh` (or the boot smoke it drives) checks `agro --version` equals `oh --version` inside the image.
- [ ] `.oh/evals/probes/oh-npm-package.sh` pins the new package identity (`@mifune/agro`, `bin.agro`), and a new probe or test pins the legacy shim (name, exact pin equals version, `bin.oh`, no bundle of its own); `version-parity.sh` includes `.oh/cli/legacy/package.json` and the pin.
- [ ] Tests: `product.test.ts` (resolution table incl. `agro.js`, `oh`, `oh.js`, symlink names, undefined), a test that spawns `node dist/agro.js --help|--version` and `node dist/oh.js --help` after building and asserts the two banners and identical bytes of the two bundles; existing suites pass unchanged.

### US-002: `agro update` is CLI self-upgrade; `oh update` stays the payload path

**Description:** As an operator with an installed `agro`, I want `agro update` to
upgrade that executable and nothing else.

**Acceptance Criteria:**

- [ ] `.oh/cli/src/commands/self-upgrade.ts` exports `classifyInstallation(argv1, deps)` → `npm` (realpath under `node_modules/@mifune/agro/`, prefix derived from the path), `standalone` (regular file elsewhere), `image` (realpath under `/opt/oh/`), `source` (realpath under a checkout's `.oh/cli/dist/` with `src/` beside it), `legacy-package` (under `node_modules/@mifune/openharness/`), `unknown`; and `runSelfUpgrade(opts, deps, io)` with injectable `fetch`, `runNode`, `npm`, `which`, `fs`, and `env`.
- [ ] npm-managed: reads the available version from the registry (`npm view @mifune/agro version`), no-ops when equal, otherwise runs `npm install -g --prefix <owning prefix> @mifune/agro@<version>` and verifies the bin reports the new version. Standalone: downloads `AGRO_JS_URL` (Phase 0 alias precedence over `OH_JS_URL`; default `https://github.com/mifunedev/openharness/releases/latest/download/agro.js`) to a temp file in the target directory, requires a `#!` shebang and a semver `--version`, no-ops when equal, refuses downgrades, then renames atomically over the target and re-verifies; the previous file is kept as `<target>.prev` until verification succeeds.
- [ ] Refusals (exit 1, no mutation, message names the supported procedure): image-managed, source-managed, legacy-package, unknown, target directory not writable, another `agro` earlier on `PATH` than the one being upgraded, current executable failing its own `--version` check, download failure, invalid artifact. Never `sudo`, never a symlink replacement of an unrelated executable.
- [ ] Output reports the installation kind, target path, current and new versions; `--dry-run` reports without mutating.
- [ ] `cli.ts`: with the `agro` product, `update` dispatches to self-upgrade and `parseUpdateArgs` rejects `--from`, `--from-remote`, `--ref`, `--force` with `agro update: <flag> belongs to the legacy project-payload command; run \`oh update <flag>\` during the compatibility window — agro update upgrades only the installed CLI`. With the `oh` product, `update` is byte-for-byte the existing payload path. `printUpdateHelp` is product-specific.
- [ ] Tests (`self-upgrade.test.ts`, new, not repurposed payload tests): older-fixture → newer release for npm and standalone, each run from inside an equipped checkout and from an empty directory, asserting that `.oh/`, `oh.json`, `.env` manifests and a registry fixture are byte-identical before and after; already-current no-op for both kinds; every refusal above including interrupted replacement (temp file left, target intact), permission denial, ambiguous PATH, unsafe symlink target; `agro update` rejecting each payload flag; `oh update` behaviour unchanged.
- [ ] Typecheck and the full suite pass.

### US-003: `get-agro.sh` artifact-only installer with `AGRO_*` aliases

**Description:** As a new operator, I want `curl … get-agro.sh | bash` to install
the published `agro` artifact without cloning or building on my host.

**Acceptance Criteria:**

- [ ] `.oh/scripts/get-agro.sh` (mode 0755, shellcheck-clean at `-S warning`) downloads `AGRO_JS_URL` (default `https://github.com/mifunedev/openharness/releases/latest/download/agro.js`), checks the shebang, installs to `AGRO_BIN_DIR/agro` (default `~/.local/bin`), offers nvm + Node 22 when Node ≥ 20 is missing (`AGRO_NVM_VERSION`), honours `AGRO_ASSUME_YES` / `-y` / `-n`, appends a `# Added by AGRO get-agro.sh` PATH line to the first existing profile, and prints `agro --version` plus `agro sandbox install docker` as the next step.
- [ ] No source-build fallback, no `git clone`, no `npm install`, no `AGRO_GITHUB_REPO`/`AGRO_GITHUB_REF` behaviour: a download or artifact failure exits non-zero with the URL and the retry/`npm install -g @mifune/agro` alternative.
- [ ] Every `AGRO_<NAME>` control falls back to `OH_<NAME>` with Phase 0 precedence (AGRO non-empty wins, differing pair warns naming keys only, empty is unset), implemented by one local function whose behaviour is proven against the `env` vectors in `compat-vectors.json` by `.oh/scripts/__tests__/get-agro.test.ts`.
- [ ] `get-agro.test.ts` also runs the installer end-to-end against a local `file://`-style fixture (a fake `agro.js` that prints a version) with `HOME`, `AGRO_BIN_DIR`, and `AGRO_JS_URL` pointed at temp dirs, and against a missing artifact, asserting install path, mode, profile line, and the failure message.
- [ ] `get-oh.sh` is unchanged. New probe `.oh/evals/probes/get-agro-bootstrap.sh` pins executable bit, the default URL, the absence of `git clone`/`npm run build`/`build_from_source`, the `AGRO_JS_URL` and `OH_JS_URL` fallback, and fails under fault injection (verified in evidence).

### US-004: Dual-published release artifacts

**Description:** As the release operator, I want one release to publish both
generations from one build so the artifacts cannot diverge.

**Acceptance Criteria:**

- [ ] `release.yml` builds once with tags `ghcr.io/mifunedev/openharness:<v>`, `:sha-<sha>`, `ghcr.io/mifunedev/agro:<v>`, `:sha-<sha>`, pushes all four, and a step asserts (via `docker buildx imagetools inspect`) that the agro and legacy version tags share one digest, failing the job otherwise.
- [ ] `promote-release-latest.sh promote` accepts a space-separated `IMAGE_REPOSITORIES` (default both repositories) and promotes `latest` by digest on each; `release-latest.test.ts` covers two repositories and a digest mismatch refusal.
- [ ] `.devcontainer/Dockerfile` sets `org.opencontainers.image.source=https://github.com/mifunedev/openharness`, `org.opencontainers.image.title=agro`, and `org.opencontainers.image.description`; the existing labels stay.
- [ ] `publish-cli.yml` publishes `@mifune/agro` from `.oh/cli`, then `@mifune/openharness` from `.oh/cli/legacy` (each guarded by its own `npm view` skip), then runs `npm deprecate @mifune/openharness@<v> "…install @mifune/agro…"`; the legacy shim's `npm ci` uses the registry version just published.
- [ ] `finalize` uploads `.oh/cli/dist/agro.js`, `.oh/cli/dist/oh.js`, `.oh/scripts/get-agro.sh`, and `.oh/scripts/get-oh.sh` as release assets so `releases/latest/download/<asset>` resolves; the release-smoke step runs `agro --version` and `oh --version` in the booted container and requires equality.
- [ ] `release-reservation.test.ts` pins the four push lines, the digest-equality step, the asset upload, and the deprecate call; `.oh/skills/release/SKILL.md` and `.oh/skills/git/SKILL.md` § Releases name the new artifacts and the four version sites a cut must bump (root, `.oh/cli`, `.oh/cli/legacy`, the exact pin).

### US-005: Docs, inventory, and changelog

**Description:** As a reader, I want current guidance to present `agro` accurately
without publishing Phase 2+ instructions.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/quickstart.md` lead with `npm install -g @mifune/agro` / `get-agro.sh`, keep the `oh` paths as the compatibility section, and document the PATH/package collision rules (disjoint bins; both packages may coexist; `npx @mifune/agro`). `README.md` install snippet and `docs/lifecycle-commands.md` name `agro` with `oh` as the alias; `docs/agro-compatibility.md` gains a "Phase 1" section (entry points, `agro update` vs `oh update`, installer aliases, release artifacts, transitional hosting) and its "left for later phases" list is trimmed accordingly; `.oh/cli/README.md` is the `@mifune/agro` README.
- [ ] `.oh/compat-inventory.json` notes for `dist/oh.js`, `@mifune/openharness`, `.oh/scripts/get-oh.sh`, the installer `alias-sla` variables, and `ghcr.io/mifunedev/openharness` (dual-published from Phase 1; default switch stays Phase 3) reflect the delivered state; `agro-compat-inventory.sh` and `compat-inventory.test.ts` stay green.
- [ ] `CHANGELOG.md` Unreleased entry (≤250 chars) links #941; `docs/rfcs/rfc-agro-migration.md` gains a Phase 1 contract pointer. No doc tells a user to create `.agro/`, `agro.json`, or `~/.agro`, and no doc mentions `agro migrate` or `agro project update` as available.

### US-006: Knowledge impact and evidence

**Acceptance Criteria:**

- [ ] `knowledge-impact.sh` run against the final diff; `release-versioning` and `oh-cli-portable-lifecycle` updated (sources, `verified_at`, body) for the dual-package/dual-image pipeline and the `agro`/`oh` product split; `fresh-machine-setup` reverified or updated for `get-agro.sh`.
- [ ] `.oh/knowledge/README.md` regenerated; `bash .oh/evals/probes/wiki-readme-index.sh` passes.
- [ ] `evidence.md` records commands, exit codes, probe fault-injection transitions, and the items that remain unverified (publication itself is operator-gated).

## Functional Requirements

- FR-1: Product identity is a pure function of the invoked executable basename; there is no build-time fork and the two bundles are byte-identical.
- FR-2: The legacy npm package contains no CLI code; it pins the exact `@mifune/agro` version it delegates to.
- FR-3: `agro update` mutates exactly one thing — the executable it resolved as the upgrade target — and only after verifying the candidate.
- FR-4: `get-agro.sh` never clones, builds, or requires a source checkout; `get-oh.sh` keeps its fallback unchanged through the SLA.
- FR-5: Legacy and AGRO image tags come from one build and are verified to share a digest; the default `image.ref` stays `ghcr.io/mifunedev/openharness:latest`.
- FR-6: No persisted-state default changes: fresh `agro sandbox install docker` still writes `oh.json` under `~/.oh/sandboxes`.

## Non-Goals

- Renaming the GitHub or docs repositories, the domain, or the default image ref (Phase 3).
- `.agro/`, `agro.json`, `~/.agro`, `/opt/agro-seed` defaults, `agro migrate` (Phase 2).
- Retiring `oh`, `@mifune/openharness`, `get-oh.sh`, or legacy GHCR tags (Phase 5).
- Cloud defaults (Phase 4). `install.sh` changes (obsolete; untouched).
- Actually publishing: npm publication, GHCR pushes, and the first public AGRO release happen when the operator cuts a release; the npm org scope for `@mifune/agro` and GHCR package visibility are operator actions.

## Technical Considerations

- `process.argv[1]` is the invoked path (symlink not resolved), so npm bin links, `/usr/local/bin/agro`, and `dist/agro.js` all resolve to `agro`; Windows cmd shims pass the real path, hence extension stripping.
- The legacy shim nests `@mifune/agro` under its own `node_modules`, so a global install of both packages exposes exactly one `agro` and one `oh` bin.
- Release assets on GitHub are the transitional artifact host; `oh.mifune.dev` (web repo) can mirror them later without changing defaults here.
- `agro-compat-inventory.sh` scans untracked files: every new `OH_*` mention must already be inventoried (only existing installer variables are referenced as fallbacks).

## Success Metrics

- Full suite, typecheck (both configs), shellcheck, `/eval` green from the clean worktree; CI green on the PR head; classifier promotable.

## Open Questions

None. Q1–Q4 settled by the operator.

## Knowledge Context

- **Base commit**: `9261d5127102b112ee1f0c7f6b74fbb1c619fc9e`
- **Queries**: `cli install release update` (entity), `cli install release update --patterns`
- **Knowledge used**: `[[release-versioning]]` (NEEDS-REVIEW: declared sources moved since 60f8c12d), `[[oh-cli-portable-lifecycle]]`, `[[pattern-cli-bundled-asset-relative-import]]`
- **Grounded against**: `.oh/cli/package.json`, `package.json`, `.oh/cli/build.mjs`, `.oh/cli/src/cli.ts`, `.oh/cli/src/commands/update.ts`, `.oh/cli/src/lib/compat.ts`, `.oh/cli/src/lib/registry.ts`, `.oh/scripts/get-oh.sh`, `.oh/scripts/install.sh`, `.oh/scripts/compat.sh`, `.oh/scripts/promote-release-latest.sh`, `.oh/scripts/reserve-github-release.mjs`, `.oh/scripts/release-reservation.mjs`, `.github/workflows/release.yml`, `.github/workflows/publish-cli.yml`, `.github/workflows/ci-harness.yml`, `.devcontainer/Dockerfile`, `.devcontainer/entrypoint.sh`, `.oh/compat-inventory.json`, `.oh/evals/probes/{oh-npm-package,get-oh-bootstrap,version-parity,agro-compat-inventory,oh-sandbox-image-mode}.sh`, `.oh/scripts/__tests__/{release-reservation,release-latest,install-prereqs}.test.ts`, `.oh/cli/src/__tests__/update.test.ts`, `vitest.config.ts`, `docs/agro-compatibility.md`, `docs/rfcs/rfc-agro-migration.md`, `docs/installation.md`, `.oh/cli/README.md`
- **Conflicts discovered**: `release-versioning` page describes `release.yml` line numbers that have since moved and omits `publish-cli.yml` details; its claims about reservation/`v`-prefix/`latest` promotion were re-read in source and hold. `oh-cli-portable-lifecycle` says `oh update` is "also the upgrade path" for the CLI — source shows it only overlays the payload; the page needs the Q1 split recorded (repair in US-006).

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `release-versioning`, `oh-cli-portable-lifecycle`, `fresh-machine-setup`
- **Affected source paths**: `.github/workflows/release.yml`, `.github/workflows/publish-cli.yml`, `.oh/scripts/promote-release-latest.sh`, `.oh/cli/package.json`, `.oh/cli/build.mjs`, `.oh/cli/src/cli.ts`, `.devcontainer/Dockerfile`, `.oh/scripts/get-agro.sh`
- **Reason**: Public entry points, package identity, release artifact set, and the CLI-upgrade/payload split are new mechanisms those pages describe.

## Plan Reconciliation

- **Source plan**: `/home/sandbox/harness/.oh/plans/agro-compatibility-migration/plan.md`
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**:
  - Nothing in this repository uploads `oh.js`/`get-oh.sh` to `oh.mifune.dev`; the web repo hosts them out of band. GitHub release assets are used as the testable transitional host for `agro.js`/`get-agro.sh` (issue #941 allows transitional infrastructure); `AGRO_JS_URL` defaults there. Phase 3 can repoint the default to the canonical domain.
  - The Phase 0 inventory marks `ghcr.io/mifunedev/openharness` as Phase 3; the plan and #941 require canonical AGRO GHCR version/SHA references in Phase 1. Reconciled as: dual-publish from Phase 1, default image ref switch stays Phase 3; the inventory note is updated (US-005).
  - Product identity by executable name (not a build-time define) keeps the bundles byte-identical and the existing 1064 tests untouched; the delegation shim is chosen over a second bundle because it makes "one implementation" structural.
  - Publishing itself (npm, GHCR, first public release, package visibility, org scope) is an operator action at release time; this PR makes the pipeline produce and verify the artifacts.
  - The operator directed that this session orchestrates and delegates implementation to bounded workers; workers own disjoint files per wave and never commit — the owner reconciles, tests, commits, and runs every gate.
