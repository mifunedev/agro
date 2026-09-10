# PRD: AGRO becomes the canonical external identity (Phase 3, #943)

## Introduction

Phase 3 of epic #939 (RFC `docs/rfcs/rfc-agro-migration.md`). Phases 0–2 made AGRO the
native state, the CLI, and the control-plane namespace while every OpenHarness surface
kept working. This phase cuts over the **external identity**: the core repository is
renamed in place to `mifunedev/agro`, the docs repository and its build pipeline adopt the
AGRO source contract, `agro.mifune.dev` becomes the canonical site, release metadata and
dispatch use AGRO names, and every `oh.mifune.dev` entry URL that automation consumes stays
shell-safe as an intentional compatibility surface.

Two facts found during grounding shape the order of work:

1. `mifunedev/openharness-web` at `bd9f104` still builds from `.oh/cli` and mirrors
   `.oh/scripts/get-oh.sh` from the core `main` branch, and the CDN serves
   `oh.mifune.dev/install.sh` as a 302 to `.oh/scripts/install.sh` on `main`. `main` is at
   0.9.0, before the #942 rename; `development` has the rename. **The next release push to
   `main` breaks the docs build, the daily mirror, and the `/install.sh` endpoint** unless
   the web pipeline learns the `.agro/` layout first. That repair is the first story.
2. The repository rename, the Pages custom domain, the Cloudflare rules, and the dispatch
   token are operator-owned external actions the plan explicitly does not authorize from a
   build. The PR prepares and verifies everything that can be verified before the rename,
   ships a runbook with exact commands and rollback, and the operator performs the cutover.
   Post-cutover verification is recorded in the task folder before the PR is undrafted.

## Goals

- `mifunedev/openharness` is renamed in place to `mifunedev/agro`; repository ID
  `R_kgDORyBFdg` is unchanged before and after; old URLs redirect; the old name is never
  reused.
- `mifunedev/openharness-web` (`R_kgDOTHLFeQ`) builds `agro.js` and mirrors `get-agro.sh`
  from the `.agro/` layout of the canonical repo, keeps `oh.js` and `get-oh.sh` for the
  SLA, accepts both `agro-release` and `openharness-release` dispatches, and asserts the
  renamed repository name.
- `https://agro.mifune.dev` is the canonical site (Docusaurus `url`, CNAME, canonical
  tags, sitemap, RSS, edit and GitHub links, social assets). `oh.mifune.dev` redirects
  documentation routes and keeps `/install.sh`, `/get-oh.sh`, `/oh.js` shell-safe.
- Core metadata points at AGRO: package `homepage`/`repository`/`bugs`, OCI
  `image.source`, README badges and canonical-repo prose, installer defaults, release
  smoke names and user agent, `promote-release-latest.sh` repository order. Legacy GHCR
  and npm aliases stay.
- The core release workflow sends `agro-release` to the web repository after a successful
  release, so the mirror no longer depends on the daily schedule.
- Every remaining OpenHarness reference in current docs is either updated or classified
  (historical, compatibility, or generic `harness`).

## User Stories

### US-001: Web pipeline accepts the AGRO source layout before any rename

**Description:** As the docs site, I build and mirror from `.agro/` so the next core
release cannot break `oh.mifune.dev/oh.js`, `/get-oh.sh`, and the site build.

**Acceptance Criteria:**

- [ ] In `mifunedev/openharness-web`, `scripts/oh-source.mjs` resolves `AGRO_GITHUB_REPO`
      then `OH_GITHUB_REPO` (default stays `mifunedev/openharness` until US-006 flips it)
      and `AGRO_SCRIPTS_REF` then `OH_SCRIPTS_REF`, warning when both are set and differ,
      never printing values.
- [ ] `scripts/build-oh-cli.mjs` (or its renamed successor) builds from `.agro/cli` when
      present and falls back to `.oh/cli`; it writes `static/agro.js` **and** `static/oh.js`
      from one build; both start with `#!`.
- [ ] `scripts/sync-external-scripts.mjs` mirrors `.agro/scripts/get-agro.sh` →
      `static/get-agro.sh` and `.agro/scripts/get-oh.sh` → `static/get-oh.sh`, with a
      `.oh/scripts/` fallback for a pre-rename ref; a missing canonical file at the pinned
      ref fails the build with the path it looked for.
- [ ] `.github/workflows/pages.yml` triggers on `repository_dispatch` types
      `[agro-release, openharness-release]`, reads `client_payload.ref` for both, and its
      repository assertions accept `mifunedev/agro-web` and `mifunedev/openharness-web`.
- [ ] `pnpm run build` succeeds against `mifunedev/openharness@development` (post-rename)
      and against `main` (pre-rename); the four static artifacts exist after each.
- [ ] `check-docs-drift.mjs` gains no new false positives; `pnpm run check:docs-drift` passes.
- [ ] Opened as a PR in `mifunedev/openharness-web` from a dedicated worktree; its URL is
      recorded in `progress.txt` and `evidence.md`. It is safe to merge before the rename.

### US-002: Core repository metadata, installers, and links name AGRO

**Description:** As a reader of the repository, npm, or the image, I see the AGRO
repository as the source, and old names only where they document compatibility or history.

**Acceptance Criteria:**

- [ ] `.agro/cli/package.json` and `.agro/cli/legacy/package.json` `homepage`,
      `repository.url`, and `bugs.url` point at `github.com/mifunedev/agro`.
- [ ] `.devcontainer/Dockerfile` `org.opencontainers.image.source` is
      `https://github.com/mifunedev/agro`.
- [ ] `README.md` badges, DeepWiki link, docs-site links, "canonical repo" sentence, and
      installer one-liners use `mifunedev/agro` and `agro.mifune.dev`; the docs-site source
      link names `mifunedev/agro-web`.
- [ ] `.agro/scripts/get-agro.sh` default `AGRO_GITHUB_REPO` is `mifunedev/agro`;
      `.agro/scripts/get-oh.sh` keeps `oh.mifune.dev/get-oh.sh` and `/oh.js` as its
      documented endpoints and its `OH_GITHUB_REPO` default becomes `mifunedev/agro`
      (GitHub redirects the old clone URL; the new default is the canonical one).
- [ ] Current docs (`docs/*.md`, `docs/integrations/*.md`, `docs/runtimes/*.md`,
      `docs/agro-compatibility.md`, `docs/deployment-prebuilt-image.md`) use the AGRO
      repository and site; `docs/agro-compatibility.md` "Legacy references intentionally
      left for later phases" moves the Phase 3 items to "Unchanged" or "Done" and lists
      each retained `oh.mifune.dev` endpoint with its SLA classification.
- [ ] `.agro/skills/sync/references/topology.md` names `github.com/mifunedev/agro` as
      upstream; `.agro/skills/git/SKILL.md`, `.agro/skills/release/SKILL.md`, and
      `.agro/skills/strategic-proposal/SKILL.md` current instructions use the new name.
- [ ] Historical files are untouched: `CHANGELOG.md` entries, `docs/rfcs/*`, dated task
      folders, `crons/prompt-miner.md` history lines. A classified list of every remaining
      `mifunedev/openharness` / `oh.mifune.dev` hit in tracked files (`historical`,
      `compatibility`, `test-fixture`, `generic`) is written to
      `.agro/tasks/agro-identity-cutover/reference-classification.md`.
- [ ] Probes that pin the old name (`get-oh-bootstrap.sh`, `get-agro-bootstrap.sh`,
      `oh-shipped-repo-overridable.sh`, `oh-sandbox-image-mode.sh`, `sync-skill-contract.sh`,
      `docs-build-fast-path.sh`, `agents-identity-contract.sh`,
      `docs-20260901-followup-artifact-cited.sh`) pin the canonical AGRO name where the
      intent is "the canonical product is documented" and accept the legacy name only
      where the probe guards compatibility; each changed probe is fault-injected.
- [ ] `pnpm test`, both typechecks, `link-providers.sh --check`, and `/eval` are green.

### US-003: Release infrastructure uses AGRO names and notifies the docs site

**Description:** As the release operator, I get AGRO-named release machinery that still
publishes the legacy aliases, and the docs mirror refreshes on every release.

**Acceptance Criteria:**

- [ ] `.github/workflows/release.yml` smoke sandbox names are `agro-release-smoke-<run>`;
      `IMAGE_REPOSITORIES` default order is `agro openharness`; the four image tags and the
      alias digest check are unchanged.
- [ ] `.agro/scripts/reserve-github-release.mjs` user agent is `agro-release-reservation`;
      `release-reservation.test.ts` fixtures follow.
- [ ] A `notify-docs` job in `release.yml` runs after `finalize` on a real release
      (`publishedNoop == 'false'`), sends `repository_dispatch` `agro-release` with
      `client_payload.ref = <released sha>` to `${{ vars.AGRO_WEB_REPO || 'mifunedev/openharness-web' }}`
      using secret `AGRO_WEB_DISPATCH_TOKEN`, and is skipped with a visible notice when the
      secret is absent. The step never prints the token.
- [ ] `docs/release-process.md` (or the existing release doc) documents the dispatch, the
      token scope (`repo` on the web repository, fine-grained: contents read, actions write),
      and how to set it with `gh secret set`.
- [ ] `.agro/skills/release/SKILL.md` prerequisites name the GHCR package `mifunedev/agro`
      and the dispatch secret.
- [ ] Workflow YAML validates (`actionlint` if available, else `gh workflow view` after push);
      the whole-diff leading-whitespace scan from `pattern-rename-sweep-collapses-block-scalar-indent`
      reports zero pairs.

### US-004: Docs site identity, domain, and SEO become AGRO

**Description:** As a visitor, I reach `agro.mifune.dev`, see AGRO branding, and every
edit, source, and navigation link points at the AGRO repositories.

**Acceptance Criteria:**

- [ ] `docusaurus.config.ts`: `title` "AGRO", tagline updated, `url`
      `https://agro.mifune.dev`, `organizationName` `mifunedev`, `projectName` `agro-web`,
      docs and blog `editUrl` under `mifunedev/agro-web`, navbar/footer GitHub and LICENSE
      links under `mifunedev/agro-web` and `mifunedev/agro`, blog feed title updated.
- [ ] `static/CNAME` is `agro.mifune.dev`; `static/robots.txt` sitemap URL updated.
- [ ] `package.json` `name` is `agro-web`; product-named scripts are renamed with the old
      names kept as aliases only if another workflow calls them.
- [ ] `scripts/render-blog-banner.mjs` product title and terminal branding read AGRO;
      regenerated banner assets are committed; historical blog posts and promos keep their
      text, and a short "OpenHarness is now AGRO" note is added to the docs landing page.
- [ ] Current docs pages (`docs/quickstart.md`, `docs/installation.md`,
      `docs/contributing.md`, `docs/deployment-prebuilt-image.md`, `docs/configuration.md`,
      `docs/runtimes/microsandbox.md`, `docs/docker-deployment.md`) use `agro.mifune.dev`,
      `mifunedev/agro`, `get-agro.sh`, and `agro.js`, and present `get-oh.sh` / `oh.js`
      only under a compatibility heading.
- [ ] `check-docs-drift.mjs` gains a rule that flags `oh.mifune.dev` and
      `mifunedev/openharness` outside `blog/`, `promos/`, and compatibility sections.
- [ ] `pnpm run build` passes; the built `sitemap.xml`, RSS/Atom feeds, and `<link rel="canonical">`
      use `https://agro.mifune.dev`.
- [ ] Delivered on the same web-repo PR as US-001 or a second PR stacked on it; it must
      **not** be merged before the operator activates the domain (US-006), because the
      CNAME switch moves the Pages site.

### US-005: Cutover runbook with rollback

**Description:** As the operator, I have one ordered, copy-pasteable procedure for the
external actions, the checks that prove each one, and the way back.

**Acceptance Criteria:**

- [ ] `docs/agro-cutover-runbook.md` exists and is linked from `docs/agro-compatibility.md`.
- [ ] Preconditions section: US-001 web PR merged; core PR (this branch) green; the operator
      account has admin on both repositories and on the Cloudflare zone; `agro.mifune.dev`
      DNS record present (already `CNAME`-proxied today, returning 421); the GHCR package
      `mifunedev/agro` is public; the dispatch token is issued but not yet stored.
- [ ] Ordered actions with exact commands and expected output: (1) record repository IDs
      and HTTP status of the five endpoints; (2) `gh repo rename agro --repo mifunedev/openharness --yes`;
      (3) `gh repo rename agro-web --repo mifunedev/openharness-web --yes`; (4) update
      description, homepage `https://agro.mifune.dev`, and topics on both repositories;
      (5) set the Pages custom domain to `agro.mifune.dev` and merge the US-004 PR;
      (6) Cloudflare: proxied `CNAME` for `agro.mifune.dev` to the Pages origin, a redirect
      rule `oh.mifune.dev/*` → `https://agro.mifune.dev/$1` (301) that **excludes**
      `/install.sh`, `/get-oh.sh`, `/oh.js`, `/get-agro.sh`, `/agro.js`, and per-path
      rules for those five that keep returning a script body (302 to the raw
      `mifunedev/agro` file on `main` for `/install.sh`; 302 to the same path on
      `agro.mifune.dev` for the other four); (7) `gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro`;
      (8) update the `origin` of the operator's checkouts only when the normalized URL
      equals `github.com/mifunedev/openharness(.git)`, never a fork.
- [ ] Verification matrix: `curl -fsSL` of all ten endpoint/host pairs returns a body whose
      first line is `#!` for scripts and JS, `gh repo view mifunedev/openharness` resolves to
      `mifunedev/agro`, `git ls-remote https://github.com/mifunedev/openharness.git` works
      via redirect, `docker pull ghcr.io/mifunedev/agro:latest` and the `openharness` alias
      share a digest, the web `pages.yml` run for the dispatch succeeds.
- [ ] Rollback: Pages custom domain back to `oh.mifune.dev`, Cloudflare rules disabled,
      dispatch job skipped by removing the secret; repository renames are **not** reverted
      (reverting breaks the new redirects); migrated filesystem state is never reverted.
- [ ] The runbook is `/ste` checked (`bash .agro/skills/ste/scripts/ste-check.sh docs/agro-cutover-runbook.md`).

### US-006: Operator cutover and canonical defaults

**Description:** As the operator, I perform the external actions from the runbook, and the
build then flips the last defaults that could not point at `mifunedev/agro` before it existed.

**Acceptance Criteria:**

- [ ] The operator has run runbook steps 1–8 and pasted the recorded outputs (repository
      IDs before/after, `gh repo view` names, endpoint matrix, Pages status) into
      `.agro/tasks/agro-identity-cutover/cutover-record.md`. Any skipped step is listed
      with its reason. **This story blocks until the operator reports completion.**
- [ ] Web repo default source becomes `mifunedev/agro`, `static/install.sh` is not added
      (the CDN rule owns that path), and the CNAME PR from US-004 is merged.
- [ ] Core `README.md`, `get-agro.sh`, and `get-oh.sh` one-liners are re-verified live from
      a clean container (`docker run --rm node:22-slim bash -c 'curl -fsSL https://agro.mifune.dev/get-agro.sh | bash -s -- --yes && ~/.local/bin/agro --version'`)
      and the legacy one-liner via `oh.mifune.dev/get-oh.sh`.
- [ ] `sandbox-boot-guard.yml`'s `LEGACY_IMAGE` still references the legacy GHCR name on
      purpose (compatibility evidence), and the `sandbox-boot-guard-ci` probe still passes.
- [ ] A release smoke: the next release from `main` publishes both image names with equal
      digests and the `notify-docs` dispatch triggers a green `pages.yml` run; the run URLs
      are recorded. If no release is due, a `workflow_dispatch` of `pages.yml` with
      `ref=main` stands in and is labelled as such.

### US-007: Knowledge impact, classification, changelog, evidence

**Description:** As the next planner, I read knowledge that names the AGRO repositories and
domain, and the evidence shows what was verified live.

**Acceptance Criteria:**

- [ ] `release-versioning` and `fresh-machine-setup` are updated (dispatch job, repository
      names, `agro.mifune.dev`, installer endpoints), `verified_at` advanced to a full SHA
      whose tree was re-read; `oh-cli-portable-lifecycle` is reverified if its claims name
      the download host.
- [ ] A new `kind: repo` page `agro-web-pipeline` documents the docs-site source contract
      (resolver, mirror, dispatch, Pages assertions, CDN-owned `/install.sh`) with sources
      pinned to the web repository paths and commit.
- [ ] `.agro/knowledge/README.md` regenerated; `wiki-readme-index.sh` and the other wiki
      probes pass; `knowledge-impact.sh --verified` reports no `NEEDS-REVIEW`.
- [ ] `CHANGELOG.md` gains an Unreleased entry referencing #943 that states the rename,
      the canonical domain, and the retained compatibility endpoints.
- [ ] `evidence.md` links the web PR(s), the cutover record, the endpoint matrix before and
      after, the dispatch run, the release smoke, the probe fault injections, and the
      classified reference list; `eval-result.json` is written at the final commit.

## Functional Requirements

- FR-1: No default, link, or metadata may name `mifunedev/agro` in a way that is exercised
  by CI **before** the rename exists, except behind a redirect-tolerant check; US-002 lands
  those changes on the branch and US-006 verifies them after the rename.
- FR-2: Every `oh.mifune.dev` executable path returns a script body (directly or via a
  redirect that `curl -fsSL` follows) after the cutover; none returns HTML.
- FR-3: The web build must succeed against both the pre-rename `main` and the post-rename
  `development` of the core repository until the first AGRO release reaches `main`.
- FR-4: The dispatch sender never prints its token and is a no-op without it.
- FR-5: Historical content (changelog, RFCs, blog posts, promos, dated task folders) is not
  rewritten; a classification file names each remaining legacy reference and its reason.
- FR-6: Fork remotes are never rewritten; only an `origin` whose normalized URL equals the
  old canonical repository may be updated, and only by the operator's explicit command.
- FR-7: Legacy GHCR tags, `@mifune/openharness`, `oh`, `get-oh.sh`, `oh.js`, `OH_*`, and
  `~/.oh` remain valid; this phase retires nothing.

## Non-Goals

- Retiring any OpenHarness compatibility surface (Phase 5).
- Migrating `mifunedev/openharness-cloud`, `mifunedev/website`, or other downstream
  consumers (Phase 4); their reference counts are recorded for #944, not changed here.
- Renaming the web repository's own `.oh/` control plane; it is an equipped legacy project
  and keeps resolving through the SLA.
- Renaming generic uses of `harness`, `/home/sandbox/harness`, or `openharness-cron.service`.
- Reversing repository renames as a rollback step.

## Technical Considerations

- **Repository IDs**: core `R_kgDORyBFdg`, web `R_kgDOTHLFeQ`; both recorded again after
  the rename to prove continuity. Neither `mifunedev/agro` nor `mifunedev/agro-web` exists
  today, so the rename cannot collide.
- **Consumers found**: zero `uses: mifunedev/openharness` Action references in the
  organization; `mifunedev/website` has 8 repository and 6 domain references;
  `mifunedev/openharness-cloud` has 164 repository and 38 GHCR references (Phase 4);
  `mifunedev/openharness-web` has 143 repository, 39 domain, 31 GHCR, and 24 `OH_GITHUB_REPO`/
  `OH_SCRIPTS_REF` references.
- **Endpoints today**: `oh.mifune.dev/install.sh` → 302 → raw `main` `.oh/scripts/install.sh`
  (200); `/get-oh.sh` 200 `application/x-sh`; `/oh.js` 200; `/get-agro.sh` and `/agro.js`
  404. `agro.mifune.dev` resolves through Cloudflare and returns 421 (no origin bound).
  Cloudflare fronts GitHub Pages (`server: cloudflare`, `via: 1.1 varnish`).
- **Dispatch**: the core repository sends no `repository_dispatch` today; the web repository
  only receives `openharness-release` and relies on a daily schedule. Sending needs a token
  stored as a core-repo secret; the operator issues it.
- **Pages custom domain**: GitHub Pages holds one custom domain per site, so `oh.mifune.dev`
  compatibility must live in Cloudflare rules, not in Pages.
- **Probe hazard**: several probes pin the product or repository name beside a verb
  (`pattern-evals-product-name-literal-pinning`); each changed pin is fault-injected.
- **Sweep hazard**: any tree-wide replace is followed by the leading-whitespace pair scan
  (`pattern-rename-sweep-collapses-block-scalar-indent`).
- **Guard hazard**: `audit-stale-references.sh`-style guards scan evidence too
  (`pattern-docs-prohibition-by-example`); the classification file names the guard rather
  than restating forbidden literals where a guard exists.

## Success Metrics

- Repository IDs unchanged across the rename; every old URL in the endpoint matrix resolves.
- Ten of ten endpoint/host pairs return a `#!` body after cutover.
- The first post-cutover release produces one green `pages.yml` dispatch run.
- Zero unclassified `mifunedev/openharness` or `oh.mifune.dev` references in current docs.

## Open Questions

- **Cloudflare mechanics for the legacy executable paths** (runbook step 6): the
  recommended default is a per-path 302 to `agro.mifune.dev`, which `curl -fsSL` follows;
  the alternative is an origin-host override so `oh.mifune.dev` keeps serving the bytes
  directly. The operator chooses at cutover; the runbook documents both.
- **Web repository rename**: recommended in place to `mifunedev/agro-web`; the issue allows
  a documented alternative.
- **Timing**: US-001 must merge before the next release to `main`; the rename can wait for
  the operator's window.

## Knowledge Context

- **Base commit**: `a227bbf3` (`git rev-parse HEAD` at plan time; full SHA in `progress.txt`)
- **Queries**: `release install web docs github repository image ghcr compat installer domain` (entity), same `--patterns`
- **Knowledge used**: `[[release-versioning]]`, `[[fresh-machine-setup]]`, `[[pattern-evals-product-name-literal-pinning]]`, `[[pattern-docs-prohibition-by-example]]`, `[[pattern-rename-sweep-collapses-block-scalar-indent]]`
- **Grounded against**: `.github/workflows/release.yml`, `.agro/scripts/reserve-github-release.mjs`, `.agro/scripts/{get-agro,get-oh,install}.sh`, `.devcontainer/Dockerfile`, `.agro/cli/package.json`, `.agro/cli/legacy/package.json`, `README.md`, `docs/agro-compatibility.md`, `.agro/skills/sync/references/topology.md`, `.agro/evals/probes/{get-oh-bootstrap,get-agro-bootstrap,oh-shipped-repo-overridable,oh-sandbox-image-mode,sync-skill-contract,docs-build-fast-path,agents-identity-contract,docs-20260901-followup-artifact-cited}.sh`; in `mifunedev/openharness-web@bd9f104`: `docusaurus.config.ts`, `package.json`, `scripts/{oh-source,build-oh-cli,sync-external-scripts,check-docs-drift,render-blog-banner}.mjs`, `.github/workflows/pages.yml`, `static/CNAME`; GitHub API (`gh repo view`, `gh api repos/.../pages`, `gh search code`); live HTTP (`curl`) and DNS for both hosts; issue #943 body
- **Conflicts discovered**: `release-versioning` says the docs mirror is refreshed by a release ("`get-agro.sh` and `agro update` fetch there") but does not say the core sends no dispatch and the web relies on a daily schedule — an omission, repaired in US-007. `fresh-machine-setup` cites `get-agro.sh` default `mifunedev/openharness`; true until US-006.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `release-versioning`, `fresh-machine-setup`, `oh-cli-portable-lifecycle` (reverify), new `agro-web-pipeline`
- **Affected source paths**: `.github/workflows/release.yml`, `.agro/scripts/{reserve-github-release.mjs,promote-release-latest.sh,get-agro.sh,get-oh.sh}`, `.devcontainer/Dockerfile`, `.agro/cli/package.json`, `.agro/cli/legacy/package.json`, `README.md`, `docs/*.md`, `.agro/skills/{release,sync,git}/**`, and the web repository's `scripts/*.mjs`, `docusaurus.config.ts`, `.github/workflows/pages.yml`
- **Reason**: the external identity, the installer hosts, and the release-to-docs handoff change; every page that names the repository or the site is affected.

## Plan Reconciliation

- **Source plan**: `/home/sandbox/harness/.agro/plans/agro-compatibility-migration/plan.md`
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**:
  - The web repository still assumes the `.oh/` layout on the core `main` branch, and the
    CDN's `/install.sh` rule points at `.oh/scripts/install.sh` on `main`. The next release
    to `main` (the first with the #942 rename) breaks the docs build, the mirror, and the
    endpoint. US-001 is therefore ordered first and is mergeable before the rename; the CDN
    rule is an operator action in the runbook.
  - The plan and issue say "release dispatch receiver from `openharness-release` to
    `agro-release`", but no sender exists in the core repository; US-003 adds one, which
    needs an operator-issued token stored with `gh secret set`.
  - `agro.mifune.dev` already has a proxied Cloudflare DNS record (returns 421); Pages has
    no custom domain for it. The domain switch is a Pages + Cloudflare action, not a code change.
  - GitHub Pages allows one custom domain, so `oh.mifune.dev` compatibility must be Cloudflare
    rules; executable paths need per-path handling to stay shell-safe (open question above).
  - The repository rename, Pages domain, Cloudflare rules, and secrets are operator-only;
    the plan authorizes none of them from a build. US-006 is an explicit operator gate
    recorded in `cutover-record.md`; the build blocks there until the operator reports.
  - Zero `uses:` Action consumers exist; the consumer audit reduces to `website` (Phase 4
    or a small follow-up) and `openharness-cloud` (Phase 4).
  - The web repository is an equipped legacy project with its own `.oh/`; migrating it is
    out of scope here and stays valid through the SLA.
  - Local root checkout: migrated after the #942 merge; a `.oh/.image-seeded` stub remains
    because this sandbox still runs a pre-AGRO image whose entrypoint re-seeds a workspace
    without that marker. Remove the stub when the container is recreated on the new image.
- **Orchestration preserved**: YES — one owner in this session; bounded workers: a
  web-repo worker in a dedicated worktree of `mifunedev/openharness-web` (US-001, US-004),
  a core worker in `.worktrees/feat/943-agro-identity-cutover` (US-002, US-003, US-005),
  a read-only reviewer for the endpoint matrix and classification; the operator performs
  US-006's external actions and the release/permission decisions, as the plan's W4 states.
  No model or thinking-level constraint is named by the plan; `/delegate` defaults apply.
  Evidence gates D1, D6, D10, D13, D14, D16, D17 map to US-002/US-003 (D6), US-005/US-006
  (D10, D16), US-002/US-007 (D14), US-007 (D13), with D17's onboarding prompts unchanged
  and re-verified only where the docs move hosts.
