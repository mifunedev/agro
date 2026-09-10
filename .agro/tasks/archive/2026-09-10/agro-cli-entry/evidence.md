# Evidence — agro-cli-entry (Phase 1, #941, PR #990)

Candidate: `07e7399f` (branch `feat/941-agro-cli-entry`, base `origin/development` at `9261d512`, the #987 merge). Ten commits, 53 files, +3791/−652.

## Why this is better

AGRO becomes a public entry point without a second implementation: one esbuild bundle, two executable names, and the product identity resolved from the invoked name. `agro update` upgrades the executable and nothing else; `oh update` keeps its project-payload behaviour. Canonical installation downloads a release artifact and never clones or builds on the host. Both npm packages, all four GHCR tags, and the four release assets come from one build and one workflow, with digest equality verified before `latest` moves. No persisted-state default changed.

## What the plan asked for

Plan step S2 / wave W2 (DoD D5, D6, D13, D14, D15, D16), issue #941 acceptance criteria, and the Q1–Q3 decisions recorded on #941: `agro` + `@mifune/agro` + `dist/agro.js`, `oh` and `@mifune/openharness` retained through the SLA with a deprecation path, canonical GHCR version/SHA refs from the same content as the legacy tags, AGRO-named bootstrap artifacts testable before the Phase 3 cutover, `AGRO_*` installer aliases, `agro update` as CLI self-upgrade, no `init`, no `agro project update`, no source checkout or host build in canonical installation.

## What was built

| Story | Commit | Delivered |
|---|---|---|
| US-001 | 7bde8cde | `product.ts` (`resolveProduct(argv1)`), `cli.ts` threads `bin`; `build.mjs` emits `dist/agro.js` and a byte-identical `dist/oh.js`; `.oh/cli` is `@mifune/agro` (bin `agro`); `.oh/cli/legacy` is the `@mifune/openharness` shim (`bin/oh.js` = one import of the agro bundle, exact pin); Dockerfile links `/usr/local/bin/agro`; `verify-sandbox-image.sh` checks both versions agree; probes `oh-npm-package.sh` (updated), `agro-legacy-shim.sh` (new), `version-parity.sh` (four sites) |
| US-003 | d7dfd568 | `get-agro.sh` artifact-only installer (`agro_env` alias resolver, `--resolve` hook, no clone/build), 20 tests over the shared env vectors and file:// fixtures, probe `get-agro-bootstrap.sh` |
| US-002 | e5736830, 4982b88e | `self-upgrade.ts` (`classifyInstallation`, `runSelfUpgrade`, injectable deps), `agro update` dispatch, payload-flag rejection, product-specific help; 47 tests incl. manifest-identity before/after, interrupted rename, ambiguous PATH, foreign target, downgrade, unwritable dir |
| US-004 | c4787782 | `release.yml` four tags from one build, `agro --version == oh --version == RELEASE_VERSION` smoke, `verify-release-aliases.sh check`, `promote-release-latest.sh` `IMAGE_REPOSITORIES` fail-closed, OCI labels, `publish-cli.yml` agro → shim (guards, wait loop, `npm deprecate`), four release assets uploaded before undraft; 42 release tests; release/git skill docs |
| US-005 | 17bc5379, 16a39922 | installation, quickstart, README, lifecycle reference, agro-compatibility Phase 1 section, inventory notes, changelog, RFC pointer; `AGRO_GITHUB_REPO` selects the release repository (probe `oh-shipped-repo-overridable`) |
| US-006 | d631ae61, 07e7399f, this commit | knowledge pages updated (`release-versioning`, `oh-cli-portable-lifecycle`, `fresh-machine-setup`) and reverified (`compose-env-boundary`); two patterns compiled; probe `tool-catalog-boundary.sh` accepts the templated usage line |

Orchestration: the owner delegated implementation to five bounded workers in three waves with disjoint file ownership (ledger `delegate-graph.json`, `delegate-log.txt`); workers never committed. The owner re-ran each worker's verification before committing. The US-002 worker was terminated by a provider rate limit after implementation and before its report; the owner completed that verification (see progress.txt).

### Gate observations (owner-run, candidate 07e7399f unless noted)

| Check | Result |
|---|---|
| `npm --prefix .oh/cli run typecheck` / `typecheck:build` | exit 0 / 0 |
| `npm --prefix .oh/cli run build`; `cmp dist/agro.js dist/oh.js` | exit 0; identical |
| `pnpm test` | 70 files, 1168 tests, 0 failed |
| `uvx --from shellcheck-py shellcheck -S warning <every changed .sh>` | exit 0 |
| `bash .oh/scripts/link-providers.sh --check` | exit 0 |
| `git diff --check` | clean |
| `bash .oh/skills/eval/run.sh` (run 1 at d631ae61) | runnerExit 1: `tool-catalog-boundary` REGRESSION (probe pinned literal `oh tool <args...>`); `skills-vendored` persistent red |
| `bash .oh/skills/eval/run.sh` (run 2 at 07e7399f, `eval-result.json`) | runnerExit 0; `tool-catalog-boundary` REGRESSION→PASS; new-pass `agro-legacy-shim`, `get-agro-bootstrap`; only pre-existing red `skills-vendored` (cc-safety-net binary absent here) |
| `implementation-gates.sh slop-metrics` | netAdded 3788, netRemoved 649, tsOverCcn [] after one simplicity round (`simplify-rounds.json`) |
| `implementation-gates.sh gate1 agro-cli-entry` | see progress.txt final entry |
| Built-bundle smoke | `node dist/agro.js --help` → `agro — AGRO CLI (v0.8.0)`; `node dist/oh.js --help` ends with the compatibility line; `agro update --from x` → rejection text; `agro update --dry-run` from the checkout → `source installation … rebuild from the checkout` exit 1 |
| CI on 07e7399f | Lint/Typecheck/Build/Test pass; Eval Probe Regression Gate pass; Boot Path Lint pass; Node/pnpm parity pass; compose+image build pass; harness-install pass (see PR checks at undraft time) |

Probe fault-injection transitions (worker-run, owner re-ran the PASS side): `oh-npm-package.sh` (bin.oh added → REGRESSION; name reverted → REGRESSION), `agro-legacy-shim.sh` (caret pin, extra code line, `agro` bin, `dist` in files, version drift → REGRESSION each), `version-parity.sh` (pin `^0.8.0`, legacy 0.7.9 → REGRESSION), `get-agro-bootstrap.sh` (`git clone` line, `echo JS_URL`, chmod 0644 → REGRESSION each; sha256 restored). Earlier CI on 17bc5379 was itself the fault case for `oh-lifecycle-surface.sh` and `oh-shipped-repo-overridable.sh` (REGRESSION), fixed in 16a39922 (PASS).

### Actual knowledge impact

`knowledge-impact.sh --changed <diff>` flagged four pages: `release-versioning` UPDATED (pipeline, four version sites, prerequisites), `oh-cli-portable-lifecycle` UPDATED (product split, `agro update` vs `oh update` correction), `fresh-machine-setup` UPDATED (`get-agro.sh`, `AGRO_GITHUB_REPO`), `compose-env-boundary` REVERIFIED; all four FRESH at 16a39922. Patterns: `pattern-evals-product-name-literal-pinning`, `pattern-delegate-worker-terminated-before-report`. Index regenerated; `wiki-readme-index.sh` PASS. Pre-existing NEEDS-REVIEW pages unrelated to this diff (`audit-architecture`, `document-ingestion`, `managed-agents`, `plan-vs-built-reconciliation`) were not touched. `knowledge-source-freshness.sh` is red on the base as well (pre-existing pins); this branch adds no new red beyond what its own pattern pins resolve.

### Benchmark

Floor: runnerExit 0, no new regression. Ceiling: capability suite score 1.44 on base and head (no capability task covers CLI packaging or release work). Verdict: **BENEFICIAL (justified hold)** — the change delivers the operator-approved D5/D15/D16 mechanics with a green floor; the instrument was not groomed this cycle. No `REDIRECT-FLAG`.

## Where it diverged from the plan, and why

- Product identity is resolved from the invoked executable name rather than a build-time define, so the two bundles are byte-identical and every existing test keeps its `oh` strings (parsers default to the legacy bin).
- `@mifune/openharness` is a delegation shim (exact pin on `@mifune/agro`) rather than a second bundle; the issue prefers this where practical, and it makes "one implementation" structural. Consequence: a release cut bumps four version sites (documented in the release skill).
- GitHub release assets are the transitional host for `agro.js` and `get-agro.sh`; nothing in this repository publishes to `oh.mifune.dev`, so `AGRO_JS_URL` defaults to `releases/latest/download`. Phase 3 can repoint.
- `AGRO_GITHUB_REPO` is implemented as "the repository whose latest release hosts the artifacts" (the shipped-repo probe requires the repository to stay overridable); `AGRO_GITHUB_REF` stays unimplemented because no source is checked out.
- Canonical GHCR `agro` tags ship in Phase 1 (per plan/#941) while the inventory keeps the default image ref switch at Phase 3; the inventory note says so.
- Per the operator's instruction for this session, implementation was delegated to bounded workers and the owner orchestrated, reconciled, verified, and committed; the plan's default was owner-written core changes.

## What remains unverified

- Actual publication: npm publish of both packages, `npm deprecate`, GHCR pushes and `imagetools` digest checks, `gh release upload`, and the first public AGRO release run only on the release runner when the operator cuts a release. Operator prerequisites: npm rights for `@mifune/agro`; GHCR package `mifunedev/agro` visibility after first push.
- `agro update` against a real registry and a real published `agro.js` (tests use fakes; the real `defaultDeps` path was exercised only for the `source` refusal).
- `verify-sandbox-image.sh`'s `agro --version` check against a locally built image (covered by fixture tests and by the sandbox-boot-guard CI job on the PR).
- `skills-vendored` stays red in this environment (pre-existing); `knowledge-source-freshness.sh` pre-existing red on base.
- Web repository (`mifunedev/openharness-web`) copy for the new install path is a follow-up outside this repository.

## Gate 3

Independent read-only review target: commit `07e7399f` plus the evidence commit that follows it; run the table above from a clean worktree.
