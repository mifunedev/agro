# PRD: SemVer pre-release publishing

Status: DRAFT

## User Stories

### US-001: Parse and reserve pre-release versions

**Description:** As a maintainer, I want pre-release versions reserved as GitHub pre-releases so that experiments ship safely.

**Acceptance Criteria:**

- [ ] `parseSemVer("0.14.0-minimal.1")` returns `major`, `minor`, `patch`, `version`, and a `prerelease` object with `label: "minimal"` and `number: 1`.
- [ ] `parseSemVer("1.2.3")` returns `prerelease: null`.
- [ ] `parseSemVer` throws `INVALID_SEMVER_VERSION` for `0.1.0-rc`, `0.1.0-rc.01`, `0.1.0-RC.1`, `0.1.0-latest.1`, and `0.1.0-rc.1+build`.
- [ ] For a pre-release version, `reserveGitHubRelease` sends `prerelease: true` in the draft create request.
- [ ] For a stable version, `reserveGitHubRelease` sends `prerelease: false` in the draft create request.
- [ ] For a stable version and a release branch that starts with the prefix experiment/, `reserveGitHubRelease` returns `publishedNoop: true` and sends no tag create request.
- [ ] `pnpm test:scripts` exits 0.

### US-002: Keep pre-releases off every latest channel

**Description:** As a maintainer, I want pre-releases excluded from latest so that stable users never receive an experiment.

**Acceptance Criteria:**

- [ ] `promote-release-latest.sh check` writes `makeLatest=false` when `RELEASE_VERSION` is `0.14.0-minimal.1` on the canonical branch head.
- [ ] `promote-release-latest.sh promote` exits 0 with `RELEASE_VERSION=0.14.0-minimal.1` on the canonical branch head, and the fake docker log stays absent.
- [ ] `promote-release-latest.sh promote` still exits 64 for `2026.8.3-1`, `1.2`, `1.2.3.4`, and `v0.1.0`.
- [ ] The test case for `0.1.0-rc.1` in `.agro/scripts/__tests__/release-latest.test.ts` moves from the rejected list to the skip-latest cases.
- [ ] `pnpm test:scripts` exits 0.

### US-003: Wire the release and CLI workflows

**Description:** As a maintainer, I want experiment pushes to run the release pipeline so that pre-releases publish without manual steps.

**Acceptance Criteria:**

- [ ] The `push.branches` list in `.github/workflows/release.yml` holds `main`, `master`, and `experiment/**`, and the file holds no `tags:` trigger.
- [ ] The reserve step in `.github/workflows/release.yml` passes `RELEASE_BRANCH: ${{ github.ref_name }}` to `.agro/scripts/reserve-github-release.mjs`.
- [ ] The finalize step "Check canonical branch for GitHub latest-release status" passes `RELEASE_VERSION` to `.agro/scripts/promote-release-latest.sh check`.
- [ ] The guard step in `.github/workflows/publish-cli.yml` writes the output `distTag`. The value is the pre-release label for a pre-release version and `latest` for a stable version.
- [ ] The publish step in `.github/workflows/publish-cli.yml` runs `npm publish --access public --provenance --tag "$DIST_TAG"` once.
- [ ] The contract tests in `.agro/scripts/__tests__/release-reservation.test.ts` and `.agro/scripts/__tests__/canonical-publish-contract.test.ts` assert the new trigger and the dist-tag flag.
- [ ] `pnpm test:scripts` exits 0.

### US-004: Document the pre-release path

**Description:** As an operator, I want the release procedure to describe pre-releases so that the version bump is unambiguous.

**Acceptance Criteria:**

- [ ] `.agro/skills/release/SKILL.md` states the `MAJOR.MINOR.PATCH-<label>.<n>` format, the `experiment/**` trigger, the npm dist-tag rule, and the no-latest rule.
- [ ] `CHANGELOG.md` holds an `[Unreleased]` entry for pre-release publishing.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/release/SKILL.md` reports no new finding on the changed lines.

## Summary

Today `.github/workflows/release.yml` triggers only on `main` and `master` pushes. The `reserve` job reads the version from the root `package.json`. The `SEMVER_PATTERN` in `.agro/scripts/release-reservation.mjs` accepts only `MAJOR.MINOR.PATCH`. `.agro/scripts/reserve-github-release.mjs` creates each draft with `prerelease: false`. `.agro/scripts/promote-release-latest.sh` rejects a pre-release version in promote mode. The script derives `makeLatest` from the branch and the SHA only.

An unbumped push already ends as a green no-op. The tag exists on another commit, so the reservation returns `already-released` and sets `publishedNoop: true`. Every later job checks `publishedNoop`.

The plan extends the existing pipeline in four places. First, the parser accepts one pre-release shape, `-<label>.<n>`. Second, the reservation marks a pre-release draft as a GitHub pre-release. Third, the latest decision returns false for each pre-release, which blocks GHCR `latest` and GitHub latest together. Fourth, the CLI workflow derives the npm dist-tag from `.agro/cli/package.json`.

A stable version on an `experiment/**` branch is a green no-op. This rule stops an experiment branch from publishing a stable release.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/release-reservation.mjs` | `SEMVER_PATTERN`, `parseSemVer` | Version grammar and the `prerelease` field |
| `.agro/scripts/reserve-github-release.mjs` | `reserveGitHubRelease`, `ensureDraftRelease`, `main` | Draft `prerelease` flag, `RELEASE_BRANCH` input, stable-on-experiment no-op |
| `.agro/scripts/promote-release-latest.sh` | `make_latest`, `RELEASE_VERSION` check | Forces `makeLatest=false` and skips GHCR `latest` for pre-releases |
| `.github/workflows/release.yml` | `on.push.branches`, `reserve`, `finalize` | Trigger and environment wiring |
| `.github/workflows/publish-cli.yml` | `guard` step, `Publish @mifune/agro to npm` step | npm dist-tag selection |
| `.agro/skills/release/SKILL.md` | Release procedure | Operator documentation |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `package.json` `version` | Extended grammar | Accepts `MAJOR.MINOR.PATCH-<label>.<n>` |
| GitHub Release | Behavior | A pre-release version publishes with `prerelease: true` and `make_latest: false` |
| npm `@mifune/agro` | Behavior | A pre-release version publishes under dist-tag `<label>` |
| GHCR ghcr.io/mifunedev/agro | Behavior | A pre-release version pushes immutable version and SHA tags only |
| `reserve-github-release.mjs` environment | New input | `RELEASE_BRANCH` |
| `promote-release-latest.sh check` environment | New optional input | `RELEASE_VERSION` |

## Storage

N/A. The pipeline stores state only in git tags, GitHub Releases, npm, and GHCR. The plan adds no new store.

## Architectural Decisions

- The root `package.json` version stays the single source of truth for the release version.
- The label regex is `[a-z][a-z0-9]*`, and the number regex is `0|[1-9]\d*`. The parser rejects the label `latest`.
- `parseSemVer` owns the grammar in JavaScript. `promote-release-latest.sh` holds the matching bash regex, as the current code does for stable versions.
- `promote-release-latest.sh` owns the latest decision for GitHub and GHCR. A pre-release sets `make_latest=false` before the branch comparison can set the value to true.
- A pre-release version publishes from any trigger branch. A stable version publishes only from `main` or `master`.
- `publish-cli.yml` derives the dist-tag from `.agro/cli/package.json`, so the `workflow_dispatch` path follows the same rule.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/release-reservation.test.ts` | `parseSemVer` accepts `0.14.0-minimal.1` and `0.14.0-rc.1`; rejects the malformed forms in US-001 | Grammar |
| `.agro/scripts/__tests__/release-reservation.test.ts` | Bridge sends `prerelease: true` for a pre-release draft; stable version on the experiment/minimal-core branch returns `publishedNoop: true` | Reservation |
| `.agro/scripts/__tests__/release-reservation.test.ts` | Workflow contract asserts `experiment/**`, `RELEASE_BRANCH`, and `--tag "$DIST_TAG"` | Workflow wiring |
| `.agro/scripts/__tests__/release-latest.test.ts` | `check` and `promote` with `0.14.0-minimal.1` on the canonical head give `makeLatest=false` and no docker call | No latest promotion |
| `.agro/scripts/__tests__/canonical-publish-contract.test.ts` | Fake registry run publishes `0.14.0-minimal.1` with `--tag minimal` and `0.14.0` with `--tag latest` | npm dist-tag |

Write each case red first. Run `pnpm test:scripts` and `pnpm run typecheck`. Both commands must exit 0.

## Design Principles

- Extend the existing pipeline. Add no second release workflow.
- Keep one latest decision in `promote-release-latest.sh` for GitHub and GHCR.
- Fail closed: a malformed version stops the `reserve` job before any tag exists.
- Add no explanatory comments to tracked code, per the root `AGENTS.md`.

## Out of Scope

- Tag-push triggers.
- A `workflow_dispatch` release path in `.github/workflows/release.yml`.
- Moving GHCR channel tags, such as a `minimal` or `rc` tag.
- Documentation changes in the mifunedev/agro-web repository.
- The first `0.14.0-minimal.1` version bump on the experiment/minimal-core branch.

## Open Questions

1. `.agro/scripts/verify-release-aliases.sh` was not read. Does the script accept an image reference with a pre-release tag? The implementer confirms with a test case in `.agro/scripts/__tests__/verify-release-aliases.test.ts`.
2. The `notify-docs` job dispatches `agro-release` to the mifunedev/agro-web repository for every published release. Does agro-web need to skip pre-releases? This plan keeps the dispatch unchanged.
3. Does a pre-release version on `main` or `master` need a block? This plan permits the version and keeps the release off every latest channel.

## Acceptance Criteria

- [ ] `pnpm test:scripts` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] No file in the diff adds a GHCR `latest` push, a `make_latest: true` literal, or an npm `--tag latest` path for a pre-release version.
- [ ] The diff adds no `tags:` trigger and no `workflow_dispatch` trigger to `.github/workflows/release.yml`.

## Lessons

Filled by the advisor before undraft.
