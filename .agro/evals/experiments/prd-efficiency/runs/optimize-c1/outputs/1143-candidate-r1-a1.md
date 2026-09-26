# PRD: SemVer pre-release publishing

Status: DRAFT

## User Stories

### US-001: Parse and reserve pre-release versions

**Description:** As an operator, I want the release reservation to accept `MAJOR.MINOR.PATCH-<label>.<n>` versions so that an experiment branch can reserve a pre-release tag and draft.

**Acceptance Criteria:**

- [ ] `parseSemVer("0.14.0-minimal.1")` returns `major: 0`, `minor: 14`, `patch: 0`, `prereleaseLabel: "minimal"`, and `prereleaseNumber: 1`.
- [ ] `parseSemVer("0.14.0")` returns `prereleaseLabel: ""`.
- [ ] `parseSemVer` throws `INVALID_SEMVER_VERSION` for `0.14.0-minimal`, `0.14.0-minimal.01`, `0.14.0-Minimal.1`, `0.14.0-latest.1`, and `0.14.0-a.b.1`.
- [ ] For `0.14.0-rc.1`, `reserveGitHubRelease` sends `"prerelease": true` in the draft create request body.
- [ ] For `0.14.0`, `reserveGitHubRelease` sends `"prerelease": false` in the draft create request body.
- [ ] `githubOutputLines` writes a `prereleaseLabel=<label>` line, and the line is `prereleaseLabel=` for a stable version.
- [ ] A red test for each criterion above fails before the change and passes after the change.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/release-reservation.test.ts` exits 0.

### US-002: Never promote a pre-release to latest

**Description:** As an operator, I want `promote-release-latest.sh` to refuse `latest` for each pre-release so that each `latest` pointer names a stable version.

**Acceptance Criteria:**

- [ ] In `check` mode with `RELEASE_VERSION=0.14.0-rc.1` on the canonical branch head, the script writes `makeLatest=false` to `GITHUB_OUTPUT`.
- [ ] In `promote` mode with `RELEASE_VERSION=0.14.0-rc.1` on the canonical branch head, the script exits 0 and never invokes `docker`.
- [ ] In `promote` mode with `RELEASE_VERSION=0.14.0` on the canonical branch head, the script still promotes `latest` by digest.
- [ ] The existing cases in `.agro/scripts/__tests__/release-latest.test.ts` pass unchanged.
- [ ] `shellcheck -S warning .agro/scripts/promote-release-latest.sh` exits 0.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/release-latest.test.ts` exits 0.

### US-003: Publish a pre-release CLI under its label dist-tag

**Description:** As an operator, I want `publish-cli.yml` to publish a pre-release `@mifune/agro` under the dist-tag `<label>` so that `npm install @mifune/agro` keeps the stable version.

**Acceptance Criteria:**

- [ ] The guard step derives the dist-tag from the `.agro/cli/package.json` version through `parseSemVer` in `.agro/scripts/release-reservation.mjs`.
- [ ] For the CLI version `0.14.0-minimal.1`, the publish step runs `npm publish --access public --provenance --tag minimal`.
- [ ] For the CLI version `0.14.0`, the publish step runs `npm publish --access public --provenance --tag latest`.
- [ ] The workflow never passes `--tag latest` for a version that has a pre-release suffix.
- [ ] The fake-registry harness in `.agro/scripts/__tests__/canonical-publish-contract.test.ts` covers both versions.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/canonical-publish-contract.test.ts` exits 0.

### US-004: Run the release pipeline on experiment branches

**Description:** As an operator, I want `release.yml` to publish non-latest pre-releases from experiment branches so that `experiment/minimal-core` ships `0.14.0-minimal.1`.

**Acceptance Criteria:**

- [ ] The `on.push.branches` list in `.github/workflows/release.yml` holds `main`, `master`, and `experiment/**`.
- [ ] The finalize step "Check canonical branch for GitHub latest-release status" passes `RELEASE_VERSION` to `promote-release-latest.sh check`.
- [ ] The finalize `updateRelease` call sends `prerelease: true` when `needs.reserve.outputs.prereleaseLabel` is not empty.
- [ ] The `reserve` job exposes `prereleaseLabel` as a job output.
- [ ] The workflow contract test "triggers for main and master without dropping intermediate pushes" also asserts the `experiment/**` entry.
- [ ] A workflow contract test asserts that an unbumped push stays a no-op: a foreign-SHA tag gives `publishedNoop=true`, and each publish job keeps its `publishedNoop != 'true'` guard.
- [ ] `.agro/skills/release/SKILL.md` and `docs/contributing.md` describe the pre-release version form, the dist-tag rule, and the no-latest rule.
- [ ] `CHANGELOG.md` has an `Unreleased` entry for pre-release publishing.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

## Summary

Verified current state:

- `.github/workflows/release.yml` triggers only on `main` and `master` pushes.
- The `reserve` job reads the version from the root `package.json`, which holds `0.14.0`.
- `parseSemVer` in `.agro/scripts/release-reservation.mjs` accepts only `MAJOR.MINOR.PATCH`.
- `ensureDraftRelease` in `.agro/scripts/reserve-github-release.mjs` always sends `prerelease: false`.
- A tag on another commit gives the `already-released` outcome and `publishedNoop=true`. Each publish job then skips. An unbumped push therefore stays a green no-op today.
- `promote-release-latest.sh` sets `make_latest=false` for each noncanonical branch. An `experiment/**` run therefore skips GHCR `latest` and GitHub latest today. No rule refuses a pre-release version on the canonical branch.
- In `promote` mode, the `RELEASE_VERSION` check accepts only `MAJOR.MINOR.PATCH`. The check runs after the noncanonical skip.
- `publish-cli.yml` runs `npm publish --access public --provenance` with no `--tag`. npm assigns the `latest` dist-tag.
- The finalize job extracts notes by the literal heading `## [<version>] - `. A pre-release heading such as `## [0.14.0-minimal.1] - <date>` needs no change.
- `.agro/evals/probes/version-parity.sh` requires equal versions in `package.json` and `.agro/cli/package.json`, plus a dated `CHANGELOG.md` heading. The probe accepts a pre-release version as written.

Selected approach: extend the existing pipeline. Add no new workflow. `parseSemVer` is the one version parser. Each consumer derives the pre-release state from the version string.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/release-reservation.mjs` | `SEMVER_PATTERN`, `parseSemVer` | Accept `-<label>.<n>` and return the label and number. |
| `.agro/scripts/reserve-github-release.mjs` | `ensureDraftRelease`, `reserveGitHubRelease`, `githubOutputLines` | Create the draft with the pre-release flag and write `prereleaseLabel`. |
| `.agro/scripts/promote-release-latest.sh` | `make_latest`, `RELEASE_VERSION` check | Force `make_latest=false` for each pre-release version in both modes. |
| `.github/workflows/publish-cli.yml` | job `publish-npm`, steps `guard` and "Publish @mifune/agro to npm" | Derive the dist-tag and pass `--tag`. |
| `.github/workflows/release.yml` | `on.push.branches`, job `reserve` outputs, job `finalize` | Add the trigger, expose the label, and finalize as a pre-release. |
| `.agro/skills/release/SKILL.md` | release procedure | Document the pre-release rules. |
| `docs/contributing.md` | releases section | Document the pre-release rules. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `release.yml` push trigger | Extended | Add `experiment/**`. |
| `reserve` job outputs | Added | Add `prereleaseLabel`, empty for a stable version. |
| GitHub Release | Changed | A pre-release version publishes with `prerelease: true` and `make_latest: "false"`. |
| npm dist-tag | Changed | A pre-release version publishes under `<label>`. A stable version publishes under `latest`. |
| GHCR tags | Unchanged for stable | A pre-release version pushes `<version>` and `sha-<sha>` tags and never `latest`. |
| Version string | Extended | The root and CLI `package.json` versions accept `MAJOR.MINOR.PATCH-<label>.<n>`. |

## Storage

N/A. The pipeline keeps no new state. Git tags, GitHub Releases, GHCR tags, and npm dist-tags hold the release state, as they do today.

## Architectural Decisions

- The root `package.json` version stays the single source of truth for the release version.
- `parseSemVer` is the only version parser. `publish-cli.yml` imports `parseSemVer` through `node`. The shell script uses one pre-release regex that matches the `parseSemVer` grammar, and a shared test case set covers both.
- The label grammar is `[a-z][a-z0-9]*`, and the number grammar is `0|[1-9][0-9]*`. The label `latest` is invalid, because `latest` is the npm stable dist-tag.
- The pre-release rule lives in `promote-release-latest.sh` for both GHCR `latest` and GitHub `make_latest`. The rule applies on every branch, including `main`.
- The workflow derives the npm dist-tag from the CLI version, not from a workflow input. A manual `workflow_dispatch` therefore cannot publish a pre-release under `latest`.
- An `experiment/**` push with a stable version that has no tag yet publishes a stable release that is not latest. Open question 1 asks whether to refuse this case.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/release-reservation.test.ts` | Accept `0.14.0-minimal.1` and `0.14.0-rc.1`; reject the malformed forms in US-001 | US-001 grammar |
| `.agro/scripts/__tests__/release-reservation.test.ts` | Draft body has `prerelease: true` for a pre-release and `false` for a stable version; output has `prereleaseLabel` | US-001 reservation |
| `.agro/scripts/__tests__/release-latest.test.ts` | `check` and `promote` with a pre-release version on the canonical head give `makeLatest=false` and no `docker` call | US-002 |
| `.agro/scripts/__tests__/canonical-publish-contract.test.ts` | Fake registry: pre-release publishes with `--tag <label>`; stable publishes with `--tag latest` | US-003 |
| `.agro/scripts/__tests__/release-reservation.test.ts` | Trigger holds `experiment/**`; finalize sends `prerelease`; publish jobs keep the no-op guard | US-004 |
| `.agro/evals/probes/version-parity.sh` | Existing probe through `bash .agro/skills/eval/run.sh` | Version parity for a pre-release version |

Run the whole suite with `pnpm test:scripts`.

## Design Principles

- Extend the existing pipeline. Do not add a second release path.
- Keep one version parser and one latest-promotion rule.
- Fail closed: an unknown version form stops the reservation before any GitHub call.
- Keep stable releases on `main` byte-for-byte equal in behavior.
- Add no explanatory comments to tracked code.

## Out of Scope

- A tag-push trigger.
- A `workflow_dispatch` release path in `release.yml`.
- Movable GHCR channel tags, such as `minimal` or `rc`.
- Documentation changes in `mifunedev/agro-web`.
- The version bump to `0.14.0-minimal.1` on `experiment/minimal-core`.

## Open Questions

1. Must the `reserve` job fail for an experiment branch push with an untagged stable version? The recommendation is yes. A stable npm `latest` publish from an experiment branch contradicts the intent of the issue.
2. Must the `notify-docs` job send the `agro-release` dispatch for a pre-release? The plan keeps the dispatch unchanged. Agro-web docs are out of scope, so `mifunedev/agro-web` owns the filter.

## Acceptance Criteria

- [ ] Each US-001 through US-004 criterion passes.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `shellcheck -S warning .agro/scripts/promote-release-latest.sh` exits 0.
- [ ] A stable version on `main` gives the same GitHub Release, GHCR, and npm results as before the change.

## Lessons

Filled by the advisor before undraft.
