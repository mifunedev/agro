# PRD: Publish SemVer pre-releases through release.yml

Status: BLOCKED

## User Stories

### US-001: Accept pre-release versions in the reservation

**Description:** As a maintainer, I want the release reservation to accept `MAJOR.MINOR.PATCH-<label>.<n>` versions so that `0.14.0-minimal.1` reserves the tag `v0.14.0-minimal.1`.

**Acceptance Criteria:**

- [ ] `parseSemVer("0.14.0-minimal.1")` returns `major: 0`, `minor: 14`, `patch: 0`, `label: "minimal"`, and `n: 1`.
- [ ] `parseSemVer("0.14.0")` returns `label: null` and `n: null`.
- [ ] `parseSemVer` throws `INVALID_SEMVER_VERSION` for `0.14.0-minimal`, `0.14.0-minimal.01`, `0.14.0-Minimal.1`, `0.14.0-minimal.1.2`, `0.14.0-latest.1`, and `0.14.0+build.1`.
- [ ] `reserveGitHubRelease` sends `prerelease: true` in the draft-create request body for a pre-release version.
- [ ] `reserveGitHubRelease` sends `prerelease: false` in the draft-create request body for a stable version.
- [ ] `githubOutputLines` writes `prerelease=true` for a pre-release version and `prerelease=false` for a stable version.
- [ ] `pnpm test:scripts` exits 0.

### US-002: Keep pre-releases off GHCR `latest` and GitHub latest

**Description:** As a user, I want a pre-release never to become `latest` so that `ghcr.io/mifunedev/agro:latest` and the GitHub latest release stay on stable versions.

**Acceptance Criteria:**

- [ ] `promote-release-latest.sh promote` exits 0 and runs no `docker buildx imagetools create` command when `RELEASE_VERSION` is `0.14.0-minimal.1`, including a run on the canonical branch head.
- [ ] `promote-release-latest.sh check` writes `makeLatest=false` to `GITHUB_OUTPUT` when `RELEASE_VERSION` is `0.14.0-minimal.1`, including a run on the canonical branch head.
- [ ] `promote-release-latest.sh check` exits 64 when `RELEASE_VERSION` is unset.
- [ ] The existing stable-version cases in `.agro/scripts/__tests__/release-latest.test.ts` pass without change to their expected output.
- [ ] The `Check canonical branch for GitHub latest-release status` step in `release.yml` passes `RELEASE_VERSION`.
- [ ] The `Publish the draft after image and CLI publication` step sends `prerelease: true` and `make_latest: "false"` for a pre-release version.

### US-003: Publish pre-release npm versions under the label dist-tag

**Description:** As a user, I want `npm install @mifune/agro` to keep the stable version so that only `npm install @mifune/agro@<label>` installs a pre-release.

**Acceptance Criteria:**

- [ ] For `.agro/cli/package.json` version `0.14.0-minimal.1`, the publish step in `publish-cli.yml` runs `npm publish --access public --provenance --tag minimal`.
- [ ] For a stable version, the publish step runs `npm publish --access public --provenance --tag latest`.
- [ ] No path in `publish-cli.yml` publishes a pre-release version with the dist-tag `latest`.
- [ ] `.agro/scripts/__tests__/canonical-publish-contract.test.ts` covers both cases with the fake `npm` binary and passes.

### US-004: Trigger release.yml on experiment branches

**Description:** As a maintainer, I want `release.yml` to run on `experiment/**` pushes so that a version bump on `experiment/minimal-core` publishes a pre-release. An unbumped push ends green with no publication.

**Acceptance Criteria:**

- [ ] `release.yml` triggers on push to `main`, `master`, and `experiment/**`, and on no tag push.
- [ ] `release.yml` has no `workflow_dispatch` trigger.
- [ ] The `release workflow contract` tests in `.agro/scripts/__tests__/release-reservation.test.ts` assert the three branch patterns.
- [ ] If a push to `experiment/**` carries a version whose tag exists on another commit, the `reserve` job outputs `publishedNoop=true` and the publish jobs are skipped.
- [ ] If a push to `experiment/**` carries a stable version, the workflow behaves as the open question 1 decision states, and a test asserts that behavior.
- [ ] If a pre-release is published, the `notify-docs` job behaves as the open question 2 decision states, and a test asserts that behavior.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION` for `version-parity.sh` on a tree whose versions are `0.14.0-minimal.1`.

### US-005: Document the pre-release path

**Description:** As a maintainer, I want the release skill to describe the pre-release path so that the next release follows one written procedure.

**Acceptance Criteria:**

- [ ] `.agro/skills/release/SKILL.md` names the `experiment/**` trigger, the `MAJOR.MINOR.PATCH-<label>.<n>` format, the npm dist-tag `<label>`, and the rule that a pre-release never becomes `latest`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/release/SKILL.md` exits 0.

## Summary

Verified current state:

- `release.yml` triggers only on push to `main` and `master`.
- The `reserve` job reads the version from the root `package.json`. That version is `0.14.0`.
- `parseSemVer` in `.agro/scripts/release-reservation.mjs` accepts only `MAJOR.MINOR.PATCH`.
- `reserveGitHubRelease` creates each draft release with `prerelease: false`.
- If the version tag exists on another commit, the reservation returns `already-released`. The workflow then sets `publishedNoop=true` and skips `publish-image`, `publish-cli`, `finalize`, and `notify-docs`. An unbumped push is already a green no-op on any branch that triggers the workflow.
- `promote-release-latest.sh` promotes GHCR `latest` only for the canonical branch head. In `promote` mode, the script rejects a non-`MAJOR.MINOR.PATCH` version with exit 64. A pre-release on the canonical head fails the job today.
- The `finalize` job sets `make_latest` from `promote-release-latest.sh check`. The `check` mode does not read the version.
- `publish-cli.yml` runs `npm publish --access public --provenance` with no `--tag`. npm assigns the dist-tag `latest` by default.
- The probe `.agro/evals/probes/version-parity.sh` requires equal versions in `package.json` and `.agro/cli/package.json`, and a dated `CHANGELOG.md` heading for that version.

Selected approach: extend the existing pipeline. Do not add a second workflow. `parseSemVer` becomes the single parser for the version format. Each downstream step derives the pre-release state from the version string. A branch name never decides the pre-release state.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/release-reservation.mjs` | `SEMVER_PATTERN`, `parseSemVer` | Accept and parse `MAJOR.MINOR.PATCH-<label>.<n>` |
| `.agro/scripts/reserve-github-release.mjs` | `ensureDraftRelease`, `githubOutputLines` | Set `prerelease` on the draft, and output `prerelease` |
| `.agro/scripts/promote-release-latest.sh` | `check` and `promote` modes | Refuse `latest` for a pre-release version |
| `.github/workflows/release.yml` | `on.push.branches`, `reserve.outputs`, `finalize`, `notify-docs` | Add the trigger, pass `RELEASE_VERSION` to `check`, send `prerelease` on undraft |
| `.github/workflows/publish-cli.yml` | `Publish @mifune/agro to npm` step | Select the dist-tag from the version |
| `.agro/skills/release/SKILL.md` | release procedure | Document the pre-release path |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `release.yml` push trigger | Modify | Add `experiment/**` |
| GitHub Release | Modify | A pre-release version publishes with `prerelease: true` and `make_latest: "false"` |
| npm `@mifune/agro` | Modify | A pre-release version publishes under the dist-tag `<label>` |
| GHCR `ghcr.io/mifunedev/agro` | Modify | A pre-release version gets `<version>` and `sha-<sha>` tags, and never `latest` |
| `.agro/skills/release/SKILL.md` | Modify | Document the pre-release path |

## Storage

N/A. The task adds no persistent state. The git tag, the GitHub Release, the GHCR tags, and the npm dist-tag already hold the release state.

## Architectural Decisions

- **Source of truth:** The root `package.json` version decides the pre-release state. `parseSemVer` is the only parser for that decision in JavaScript. `promote-release-latest.sh` applies the same pattern in bash, and a test asserts that both parsers agree on the fixture list in US-001.
- **State management:** None beyond the existing reservation. The `reserve` job outputs `prerelease`, and downstream jobs read that output or the version string.
- **Auth / scoping:** No change. The workflow keeps the existing `GITHUB_TOKEN` and `NPM_TOKEN` permissions.
- **Dist-tag guard:** The label `latest` fails `parseSemVer`, so a pre-release cannot publish to the npm dist-tag `latest`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/release-reservation.test.ts` | pre-release parse, rejected forms, `prerelease` draft body, `prerelease` output line | US-001 |
| `.agro/scripts/__tests__/release-reservation.test.ts` | trigger branches, no tag trigger, no `workflow_dispatch`, `RELEASE_VERSION` on the `check` step, `prerelease` on undraft | US-002, US-004 |
| `.agro/scripts/__tests__/release-latest.test.ts` | pre-release on canonical head skips `promote`, `check` writes `makeLatest=false`, `check` without `RELEASE_VERSION` exits 64 | US-002 |
| `.agro/scripts/__tests__/canonical-publish-contract.test.ts` | stable version publishes `--tag latest`, pre-release publishes `--tag <label>` | US-003 |
| `.agro/scripts/__tests__/version-parity-contract.test.ts` | pre-release versions pass the probe | US-004 |

Run `pnpm test:scripts` and `bash .agro/skills/eval/run.sh`. Each command must exit 0.

## Design Principles

- Extend the existing pipeline. Do not add a parallel release path.
- Derive the pre-release state from the version string, not from the branch name.
- Fail closed. A malformed version stops the `reserve` job before any tag write.
- Add no explanatory comments to tracked code, per `AGENTS.md`.

## Out of Scope

- A tag-push trigger.
- A `workflow_dispatch` release path.
- Moved GHCR channel tags, for example `minimal` or `rc`.
- Changes in `mifunedev/agro-web`.
- The version bump on `experiment/minimal-core` and the first pre-release publication.

## Open Questions

1. What does a push to `experiment/**` do when the version is stable and untagged?
   A. Fail the `reserve` job. An experiment branch publishes only pre-releases. (Recommended.)
   B. Publish the stable version with the `main` behavior.
2. Does `notify-docs` dispatch `agro-release` for a pre-release?
   A. Skip the dispatch for a pre-release. (Recommended: agro-web changes are out of scope.)
   B. Dispatch for every release.
3. Does the `finalize` job attach `get-agro.sh` and `agro.js` to a pre-release? The release skill states that `releases/latest/download/<asset>` resolves on publication. A pre-release never becomes latest, so that URL keeps the stable asset.
   A. Attach both assets. (Recommended: no change to the job.)
   B. Skip the upload for a pre-release.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION`.
- [ ] `shellcheck -S warning .agro/scripts/*.sh` exits 0.
- [ ] Open questions 1, 2, and 3 have recorded operator decisions.

## Lessons

Filled by the advisor before undraft.
