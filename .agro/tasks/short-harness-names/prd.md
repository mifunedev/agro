# PRD: Short canonical names for Grok, Antigravity, and Muse harnesses

Status: DRAFT

## User Stories

### US-001: Make `grok`, `antigravity`, and `muse` the canonical harness ids

**Description:** As an operator, I want to run `agro harness install grok`, `agro harness install antigravity`, and `agro harness install muse` so that each short name installs its harness.

**Acceptance Criteria:**

- [ ] `HARNESS_CATALOG` in `.agro/cli/src/lib/harnesses/catalog.ts` holds the ids `grok`, `antigravity`, and `muse`. The catalog holds no id `grok-build`, `antigravity-cli`, or `muse-code`.
- [ ] One alias map in `catalog.ts` maps `grok-build` to `grok`, `agy` and `antigravity-cli` to `antigravity`, `muse-code` to `muse`, and `claude-code` to `claude`. Only the `claude-code` entry carries the removal version `0.29.0`.
- [ ] `findHarness` returns the canonical entry for each alias. `harnessIds()` returns no alias.
- [ ] `agro harness install grok-build`, `agro harness install agy`, `agro harness install antigravity-cli`, and `agro harness install muse-code` act on the canonical entry and write no deprecation line.
- [ ] `agro harness install claude-code` still writes `agro harness: "claude-code" is a deprecated alias for "claude"; the alias stops working in 0.29.0` to stderr.
- [ ] `readHostConfig` moves a receipt under any alias key to the canonical key. The sandbox marker check, install, and uninstall treat `<alias>.installed` as the canonical marker for every alias in the map.
- [ ] Each `docsPath` stays unchanged: `docs/harnesses/grok-build.md`, `docs/harnesses/antigravity-cli.md`, and `docs/harnesses/muse-code.md`.
- [ ] A red test in `harness-catalog.test.ts` fails before the change and passes after the change. The test resolves `grok-build`, `agy`, `antigravity-cli`, and `muse-code`.
- [ ] `pnpm run typecheck` exits 0. `pnpm test:scripts` exits 0.

### US-002: Update the banner, documentation, and changelog to the short names

**Description:** As an operator, I want every printed hint and every document to name the short ids so that I type the canonical name.

**Acceptance Criteria:**

- [ ] `.agro/install/banner.sh` prints `harness install grok` and `harness install antigravity`.
- [ ] `README.md`, `docs/harnesses/overview.md`, `docs/harnesses/grok-build.md`, `docs/harnesses/antigravity-cli.md`, and `docs/harnesses/muse-code.md` name `grok`, `antigravity`, and `muse` in each `agro harness install`, `agro harness uninstall`, `agro harness status`, and harness-id table cell.
- [ ] Each of the three harness pages states the supported alternative names in one sentence: `grok-build` for Grok Build, `agy` and `antigravity-cli` for Antigravity CLI, and `muse-code` for Muse Code.
- [ ] `git grep -nE 'harness (install|uninstall|status) (grok-build|antigravity-cli|muse-code)'` returns matches only in `CHANGELOG.md` entries for released versions, in `.agro/tasks/`, and in the alias sentences.
- [ ] `.agro/scripts/__tests__/boot-banner.test.ts` expects the short names.
- [ ] `CHANGELOG.md` `## [Unreleased]` `### Changed` holds an entry that names the new canonical ids `grok`, `antigravity`, and `muse`, and the supported names `grok-build`, `agy`, `antigravity-cli`, and `muse-code`.
- [ ] `pnpm test:scripts` exits 0.

### US-003: Record the manual review transcript

**Description:** As the advisor, I want a command transcript of the short names so that the PR `## Manual review` section shows the observed behavior.

**Acceptance Criteria:**

- [ ] `pnpm run build:harness` exits 0.
- [ ] `.agro/tasks/short-harness-names/evidence/manual-review.md` holds the command and output of `node .agro/cli/dist/agro.js harness list`. The output shows `grok`, `antigravity`, and `muse`.
- [ ] The transcript holds `node .agro/cli/dist/agro.js harness status <name>` for `grok-build`, `agy`, `antigravity-cli`, and `muse-code`. Each output shows the canonical row and no deprecation line.
- [ ] The transcript holds `node .agro/cli/dist/agro.js harness status claude-code` with the deprecation line.
- [ ] The advisor creates no live resource and runs no lifecycle verb.

## Summary

PR #1526 made `claude` the canonical id and added `DEPRECATED_HARNESS_ALIASES` with one removal version, `HARNESS_ALIAS_REMOVAL_VERSION`. The host receipt migration in `host-config.ts` and the sandbox marker migration in `harness.ts` read the deprecated alias map.

The operator wants short canonical ids for three more harnesses: `grok` (binary `grok`), `antigravity` (binary `agy`), and `muse` (binary `muse`). The old ids stay supported names with no deprecation. `agy` becomes a supported name for Antigravity.

The plan replaces the deprecated-only map with one alias map. Each entry names its canonical id and an optional removal version. A deprecation line prints only for an entry with a removal version. The receipt and marker migrations read the same map, so an install under an old id keeps working.

`mifunedev/agro-web` syncs `docs/agro/` from the latest agro release tag at build time (`scripts/sync-agro-docs.mjs`). The agro-web hand-written pages change in a separate PR in that repository.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/harnesses/catalog.ts` | `HARNESS_CATALOG`, `DEPRECATED_HARNESS_ALIASES`, `HARNESS_ALIAS_REMOVAL_VERSION`, `findHarness` | Canonical ids and the alias map |
| `.agro/cli/src/commands/harness.ts` | `resolveHarness`, `legacySandboxMarkerPaths` | Deprecation line and marker migration |
| `.agro/cli/src/lib/host-config.ts` | `withCanonicalHarnessIds` | Receipt migration |
| `.agro/install/banner.sh` | `grok_detail`, `antigravity_detail` | Printed install hints |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install|uninstall|status <name>` | Changed | `grok`, `antigravity`, and `muse` are canonical. The old ids and `agy` resolve with no warning. |
| `agro harness list [--json]` | Changed | The `id` field shows the short names. |
| `~/.agro/config.json` and sandbox markers | Migrated | Records under an alias move to the canonical id. |
| Banner, docs, README | Changed | Each command names the short id. |

## Storage

The host receipt key and the sandbox marker file name follow the canonical id. The migrations from PR #1526 read the unified alias map, so records under `grok-build`, `antigravity-cli`, and `muse-code` move to the short ids. No schema change occurs.

## Architectural Decisions

- `catalog.ts` holds one alias map. Each entry holds `canonical` and an optional `removedIn`. A separate deprecated map does not exist.
- `harness.ts` prints the deprecation line only for an entry with `removedIn`.
- The supported aliases have no removal version. The operator asked for them as supported names.
- The doc file names stay unchanged, so agro-web links and redirects keep working.
- `.devcontainer` paths under `~/.gemini/antigravity-cli/` stay unchanged. Those paths belong to the Antigravity product, not to the harness id.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | canonical ids; each alias resolves; `harnessIds()` excludes aliases; only `claude-code` has a removal version | US-001 |
| `.agro/cli/src/__tests__/harness.test.ts` | no deprecation line for supported aliases; deprecation line for `claude-code`; marker migration for `grok-build` | US-001 |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | receipt under `muse-code` moves to `muse` | US-001 |
| `.agro/scripts/__tests__/boot-banner.test.ts` | banner hints name `grok` and `antigravity` | US-002 |

Run `pnpm run typecheck`, `pnpm test:scripts`, and `pnpm run build:harness`.

## Design Principles

- Keep one source of truth: one alias map serves resolution, warnings, and migrations.
- Add no explanatory comments to tracked code.
- Change the doc pages, not their file names.

## Out of Scope

- The Langfuse trace source list in `.agro/skills/behavioral-training/scripts/lib/inventory.mjs`.
- The `~/.gemini/antigravity-cli/` settings paths in `.devcontainer/`.
- Doc file renames.
- The agro-web pages. A separate task in `mifunedev/agro-web` owns them.
- Released `CHANGELOG.md` entries and `.agro/tasks/` history.

## Open Questions

None.

## Acceptance Criteria

- [ ] `agro harness install grok`, `agro harness install antigravity`, and `agro harness install muse` resolve to their harnesses.
- [ ] `grok-build`, `agy`, `antigravity-cli`, and `muse-code` resolve with no warning.
- [ ] `pnpm run typecheck`, `pnpm test:scripts`, and `pnpm run build:harness` exit 0.
- [ ] `.agro/tasks/short-harness-names/evidence/manual-review.md` exists.

## Lessons

1. Claim: the advisor ran two setup commands in parallel with relative `cd` paths, and one command ran in the wrong repository. Evidence: the command created the worktree `feat/82-short-harness-names` inside the AGRO checkout and pushed that branch to `mifunedev/agro`. Outcome: dropped, because the finding is a process observation. The advisor deleted the stray worktree, the local branch, and the remote branch, and restored the plan files.
2. Claim: `withCanonicalHarnessIds` keeps the first alias receipt when two aliases of one id hold receipts. Evidence: the review found that `agy` wins over `antigravity-cli` by map order. Outcome: dropped, because no AGRO release recorded a receipt under `agy`.
3. Claim: `.agro/skills/behavioral-training/scripts/lib/inventory.mjs` keeps the old ids. Evidence: the list matches Langfuse trace source names. Outcome: dropped, because the plan puts the trace source list out of scope.
