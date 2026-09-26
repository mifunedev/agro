# PRD: Publish SemVer pre-releases through release.yml

Status: DRAFT

## User Stories

### US-001: Parse and reserve pre-release versions

**Description:** As a maintainer, I want the release reservation to accept `MAJOR.MINOR.PATCH-<label>.<n>` versions so that a pre-release gets a tag and a pre-release draft.

**Acceptance Criteria:**

- [ ] `parseSemVer("0.14.0-minimal.1")` returns `major: 0`, `minor: 14`, `patch: 0`, `prerelease: { label: "minimal", number: 1 }`, and `version: "0.14.0-minimal.1"`.
- [ ] `parseSemVer("0.14.0")` returns `prerelease: null`.
- [ ] `parseSemVer` throws `INVALID_SEMVER_VERSION` for each of `0.14.0-rc`, `0.14.0-rc.01`, `0.14.0-RC.1`, `0.14.0-1.1`, `0.14.0-latest.1`, `0.14.0-rc.1+build`, and `v0.14.0-rc.1`.
- [ ] Each existing rejection case in `release-reservation.test.ts` still throws `INVALID_SEMVER_VERSION`.
- [ ] For `0.14.0-minimal.1`, `reserveGitHubRelease` creates `refs/tags/v0.14.0-minimal.1` and then a draft whose POST body has `prerelease: true`.
- [ ] For `0.14.0`, the draft POST body still has `prerelease: false`.
- [ ] If `RELEASE_BRANCH` is neither `main` nor `master` and the version has no pre-release part, the script writes `publishedNoop=true` and `reservationKind=stable-on-prerelease-branch`. The script sends no GitHub API request. A test with a recording `fetchImpl` proves zero requests.
- [ ] The script writes a `releasePrerelease=<true|false>` line to `GITHUB_OUTPUT` for each reservation.
- [ ] `pnpm test:scripts .agro/scripts/__tests__/release-reservation.test.ts` exits 0.

### US-002: Keep pre-releases off `latest` in GHCR and GitHub

**Description:** As a user, I want `latest` to point only at stable releases so that a pre-release never reaches a user who pulls `latest`.

**Acceptance Criteria:**

- [ ] `promote-release-latest.sh promote` with `RELEASE_VERSION=0.14.0-rc.1` on the canonical branch head exits 0, prints a `Skipping latest` line that names the version, and invokes no `docker` command.
- [ ] `promote-release-latest.sh check` with `RELEASE_VERSION=0.14.0-rc.1` on the canonical branch head writes `makeLatest=false` to `GITHUB_OUTPUT`.
- [ ] `promote-release-latest.sh check` with a stable `RELEASE_VERSION` on the canonical branch head still writes `makeLatest=true`.
- [ ] `promote-release-latest.sh promote` exits 64 for each malformed version: `2026.8.3-1`, `2026.08.03`, `1.2`, `1.2.3.4`, `v0.1.0`, `0.1.0-rc`, and `0.1.0-RC.1`.
- [ ] The `0.1.0-rc.1` entry leaves the rejection list in `release-latest.test.ts`. A new case asserts the skip for that version.
- [ ] `pnpm test:scripts .agro/scripts/__tests__/release-latest.test.ts` exits 0.

### US-003: Publish npm pre-releases under the `<label>` dist-tag

**Description:** As a maintainer, I want `publish-cli.yml` to publish `@mifune/agro@0.14.0-minimal.1` under the dist-tag `minimal` so that `npm install @mifune/agro` still installs the stable version.

**Acceptance Criteria:**

- [ ] The guard step in `.github/workflows/publish-cli.yml` writes `distTag=<label>` to `GITHUB_OUTPUT` when `.agro/cli/package.json` holds a pre-release version, and `distTag=latest` when the version is stable.
- [ ] The guard step derives the label from `parseSemVer` in `.agro/scripts/release-reservation.mjs`. The step holds no second copy of the version pattern.
- [ ] The guard step exits non-zero for a malformed version and runs no `npm publish`.
- [ ] The publish step runs `npm publish --access public --provenance --tag "$DIST_TAG"`, with `DIST_TAG` set from the guard output.
- [ ] A `canonical-publish-contract.test.ts` case runs the extracted guard and publish bodies against the fake `npm` with version `0.14.0-minimal.1`. The npm log shows `publish --access public --provenance --tag minimal` and no `latest`.
- [ ] A case with version `0.14.0` shows `publish --access public --provenance --tag latest`.
- [ ] `bash .agro/evals/probes/agro-npm-package.sh` exits 0.
- [ ] `pnpm test:scripts .agro/scripts/__tests__/canonical-publish-contract.test.ts` exits 0.

### US-004: Run release.yml on `experiment/**` and mark GitHub pre-releases

**Description:** As a maintainer, I want a push to `experiment/minimal-core` to run the release pipeline so that a version bump there publishes a pre-release.

**Acceptance Criteria:**

- [ ] The `on.push.branches` list in `.github/workflows/release.yml` is `main`, `master`, and `"experiment/**"`. The workflow has no `tags:` trigger, no `workflow_dispatch:` trigger, and no top-level `concurrency:` key.
- [ ] The reserve step passes `RELEASE_BRANCH: ${{ github.ref_name }}` to `reserve-github-release.mjs`.
- [ ] The `reserve` job exposes the `releasePrerelease` output.
- [ ] The `Check canonical branch for GitHub latest-release status` step passes `RELEASE_VERSION` to `promote-release-latest.sh check`.
- [ ] The `Publish the draft after image and CLI publication` step sets `prerelease` from `needs.reserve.outputs.releasePrerelease` in the `updateRelease` call, and the step throws for a value other than `true` or `false`.
- [ ] The `release workflow contract` tests in `release-reservation.test.ts` assert each of the five criteria above.
- [ ] `docs/contributing.md` section `## Releases` and `.agro/skills/release/SKILL.md` state the `experiment/**` trigger, the `MAJOR.MINOR.PATCH-<label>.<n>` form, the npm dist-tag rule, and the rule that a pre-release never becomes `latest`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/contributing.md` reports no new finding in the changed lines.
- [ ] `pnpm test:scripts` exits 0 and `bash .agro/skills/eval/run.sh` reports no REGRESSION.

## Summary

Verified current state:

- `.github/workflows/release.yml` runs on pushes to `main` and `master` only. Jobs run in the order `validate`, `boot-lint`, `eval-probes`, `reserve`, `publish-image`, `publish-cli`, `finalize`, `notify-docs`.
- The `reserve` job reads the version from root `package.json` and runs `.agro/scripts/reserve-github-release.mjs`.
- `parseSemVer` in `.agro/scripts/release-reservation.mjs` accepts only `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$`. A pre-release version fails the `reserve` job today.
- `reserve-github-release.mjs` creates each draft with `prerelease: false`.
- A tag on another commit gives `already-released`, and the script then writes `publishedNoop=true`. Four jobs skip on that output. An unbumped push on any branch therefore stays green after the change without extra work.
- `promote-release-latest.sh` already skips GHCR `latest` and sets `makeLatest=false` for a noncanonical branch. On the canonical branch head, `promote` rejects a pre-release version with exit 64, and `check` ignores the version.
- `publish-cli.yml` runs `npm publish --access public --provenance` with no `--tag`. npm applies the dist-tag `latest` by default.
- `version-parity.sh` requires equal versions in `package.json` and `.agro/cli/package.json`, plus a dated `## [<version>] - YYYY-MM-DD` heading in `CHANGELOG.md`. The heading pattern accepts a pre-release version.
- The `finalize` job extracts release notes with a literal `index()` match. A pre-release heading works without change.

Selected approach: extend `parseSemVer` to one strict pre-release form and make it the single parser. Pass the pre-release flag through the existing job outputs. Add a pre-release skip to the two existing `latest` decisions. Select the npm dist-tag in the existing guard step. Add one branch pattern to the trigger.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/release-reservation.mjs` | `SEMVER_PATTERN`, `parseSemVer` | Single version parser; adds the `prerelease` field |
| `.agro/scripts/reserve-github-release.mjs` | `reserveGitHubRelease`, `ensureDraftRelease`, `githubOutputLines`, `main` | Draft `prerelease` flag, stable-on-branch no-op, `releasePrerelease` output |
| `.agro/scripts/promote-release-latest.sh` | `check` and `promote` modes | Pre-release skip for GHCR `latest` and GitHub `make_latest` |
| `.github/workflows/publish-cli.yml` | `guard` step, `Publish @mifune/agro to npm` step | npm dist-tag selection |
| `.github/workflows/release.yml` | `on.push.branches`, `reserve` job outputs, `finalize` steps | Trigger and GitHub pre-release flag |
| `.agro/scripts/__tests__/release-reservation.test.ts` | `SemVer reservation`, `GitHub reservation bridge`, `release workflow contract` | Parser, bridge, and workflow contract tests |
| `.agro/scripts/__tests__/release-latest.test.ts` | `promote-release-latest.sh` | `latest` skip tests |
| `.agro/scripts/__tests__/canonical-publish-contract.test.ts` | `canonical publish-cli contract` | npm dist-tag tests with the fake `npm` |
| `docs/contributing.md` | `## Releases` | Contributor release documentation |
| `.agro/skills/release/SKILL.md` | Release procedure | Canonical release skill text |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `release.yml` push trigger | Extended | Adds `experiment/**` |
| Release version format | Extended | Accepts `MAJOR.MINOR.PATCH-<label>.<n>` |
| GitHub Release | Changed | Sets `prerelease: true` and `make_latest: false` for a pre-release |
| npm `@mifune/agro` | Changed | Publishes a pre-release under the dist-tag `<label>`, and a stable version under `latest` |
| GHCR `ghcr.io/mifunedev/agro` | Unchanged tags | Pushes `:<version>` and `:sha-<sha>` for a pre-release; never moves `:latest` for a pre-release |
| `reserve` job outputs | Added | `releasePrerelease` |

## Storage

N/A. The change keeps release state in the existing git tags, GitHub Releases, GHCR tags, and npm dist-tags. The change adds no persistent store.

## Architectural Decisions

- Root `package.json` stays the single source of the release version. A pre-release is a deliberate version bump, the same as a stable release.
- `parseSemVer` in `release-reservation.mjs` is the single version parser for JavaScript callers, including the `publish-cli.yml` guard. `promote-release-latest.sh` keeps one bash pattern, and `release-latest.test.ts` pins that pattern to the same accept and reject cases.
- The pre-release form is `MAJOR.MINOR.PATCH-<label>.<n>`. `<label>` matches `[a-z][a-z0-9-]*` and is not `latest`. `<n>` matches `0|[1-9][0-9]*`. Build metadata is rejected. Open question 1 covers the label pattern.
- A branch other than `main` or `master` publishes only a pre-release version. A stable version on such a branch is a green no-op, so an experiment branch can never publish npm `latest`. Open question 2 covers this rule.
- A pre-release never moves GHCR `latest` and never becomes the GitHub latest release, on any branch. `main` and `master` can publish a later `rc` pre-release.
- The `latest` decision stays in `promote-release-latest.sh`. The `finalize` job keeps its existing fresh `check` call.
- The workflow keeps `permissions`, secrets, and job order unchanged.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/release-reservation.test.ts` | Accepts `0.14.0-minimal.1` and `0.14.0-rc.1`; rejects each malformed pre-release form | US-001 parser |
| `.agro/scripts/__tests__/release-reservation.test.ts` | Draft POST body has `prerelease: true` for a pre-release and `prerelease: false` for a stable version | US-001 draft flag |
| `.agro/scripts/__tests__/release-reservation.test.ts` | Stable version on `experiment/minimal-core` gives `publishedNoop=true` with zero fetch calls | US-001 branch rule |
| `.agro/scripts/__tests__/release-latest.test.ts` | `promote` skips a pre-release on the canonical head with no docker call; `check` writes `makeLatest=false` | US-002 |
| `.agro/scripts/__tests__/canonical-publish-contract.test.ts` | Fake `npm` log shows `--tag minimal` for `0.14.0-minimal.1` and `--tag latest` for `0.14.0` | US-003 |
| `.agro/scripts/__tests__/release-reservation.test.ts` | Trigger lists `experiment/**`; no tag or dispatch trigger; `releasePrerelease` wired to `finalize` | US-004 |
| `.agro/evals/probes/agro-npm-package.sh`, `.agro/evals/probes/version-parity.sh` | Existing probes | No probe regression |

Write each failing test before the matching change. Run `pnpm test:scripts` at the end of each story.

## Design Principles

- Follow the root `AGENTS.md`: no explanatory comments in tracked code, one source of truth per policy, and delete obsolete paths. Remove the stale workflow comments that the change contradicts.
- Fail closed: a malformed version stops the run before any tag, image, or npm mutation.
- Keep the change inside the existing pipeline. Add no new workflow, job, or script file.
- Keep `latest` safe by construction: every `latest` decision reads the pre-release flag.

## Out of Scope

- A tag-push trigger.
- A `workflow_dispatch` release path in `release.yml`.
- Moving GHCR channel tags, such as `:minimal` or `:rc`.
- Documentation changes in `mifunedev/agro-web`.
- The version bump to `0.14.0-minimal.1` on `experiment/minimal-core`. That bump is a separate release cut after this change merges.
- Changes to `agro` CLI image selection for pre-release versions.

## Open Questions

1. Is `[a-z][a-z0-9-]*` the correct `<label>` pattern? The plan rejects uppercase labels, numeric-only labels, and the label `latest`. Default: accept the pattern as written.
2. Must a stable version on an `experiment/**` branch be a green no-op? The alternative is a red failure. Default: green no-op, because the issue asks for green unbumped pushes.
3. Must `notify-docs` send `agro-release` for a pre-release? The job today sends the dispatch for each finalized release. Default: keep the current behavior, because agro-web changes are out of scope. The agro-web owner confirms whether a pre-release dispatch is safe.

## Acceptance Criteria

- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `grep -n 'experiment/\*\*' .github/workflows/release.yml` prints one line inside `on.push.branches`.
- [ ] `grep -c -- '--tag "\$DIST_TAG"' .github/workflows/publish-cli.yml` prints `1`.
- [ ] No code path in `release.yml`, `publish-cli.yml`, or `promote-release-latest.sh` moves GHCR `latest`, sets GitHub `make_latest: true`, or publishes npm `latest` for a pre-release version. The tests in US-002 and US-003 prove each path.
- [ ] After merge, the first push of `0.14.0-minimal.1` to `experiment/minimal-core` gives a GitHub pre-release `v0.14.0-minimal.1`, npm dist-tag `minimal` at `0.14.0-minimal.1`, GHCR tag `:0.14.0-minimal.1`, and an unchanged GHCR `:latest` digest. The advisor records `gh release view`, `npm dist-tag ls @mifune/agro`, and `docker buildx imagetools inspect` output.

## Lessons

Filled by the advisor before undraft.
