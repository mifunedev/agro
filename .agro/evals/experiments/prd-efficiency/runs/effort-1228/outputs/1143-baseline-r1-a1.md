# PRD: SemVer pre-releases through release.yml

Status: DRAFT

## User Stories

### US-001: Parse pre-release versions and reserve pre-release drafts

**Description:** As the operator, I want the release scripts to accept `MAJOR.MINOR.PATCH-<label>.<n>` so that a pre-release version reserves a GitHub pre-release draft.

**Acceptance Criteria:**

- [ ] `parseSemVer("0.14.0-minimal.1")` returns `{ major: 0, minor: 14, patch: 0, label: "minimal", number: 1, prerelease: true, version: "0.14.0-minimal.1" }`.
- [ ] `parseSemVer("0.14.0")` returns `prerelease: false` and `label: null`.
- [ ] `parseSemVer` throws `INVALID_SEMVER_VERSION` for `0.14.0-minimal`, `0.14.0-minimal.01`, `0.14.0-Minimal.1`, `0.14.0-.1`, and `0.14.0-latest.1`.
- [ ] `reserveGitHubRelease` posts the draft with `prerelease: true` for `0.14.0-minimal.1` and `prerelease: false` for `0.14.0`.
- [ ] `githubOutputLines` writes `prerelease=<true|false>` and `prereleaseLabel=<label or empty>`.
- [ ] If `RELEASE_BRANCH` starts with `experiment/` and the version has no pre-release label, `reserveGitHubRelease` returns `publishedNoop: true` and sends no GitHub request.
- [ ] `pnpm test:scripts` exits 0.

### US-002: Keep pre-release images off GHCR latest

**Description:** As the operator, I want `promote-release-latest.sh` to refuse `latest` for a pre-release version so that GHCR `latest` and GitHub latest always name a stable release.

**Acceptance Criteria:**

- [ ] In `check` mode on the canonical branch head, `RELEASE_VERSION=0.14.0-minimal.1` writes `makeLatest=false` to `GITHUB_OUTPUT`.
- [ ] In `promote` mode on the canonical branch head, `RELEASE_VERSION=0.14.0-minimal.1` exits 0 and invokes no `docker` command.
- [ ] `check` mode exits 64 when `RELEASE_VERSION` is unset.
- [ ] The existing stable-version cases in `.agro/scripts/__tests__/release-latest.test.ts` pass unchanged, apart from the added `RELEASE_VERSION` in `check` mode.
- [ ] `pnpm test:scripts` exits 0.

### US-003: Publish pre-release CLI versions under the label dist-tag

**Description:** As the operator, I want `publish-cli.yml` to publish a pre-release CLI under the dist-tag `<label>` so that `npm install @mifune/agro` never resolves to a pre-release.

**Acceptance Criteria:**

- [ ] `publish-cli.yml` derives the dist-tag from `.agro/cli/package.json` through `parseSemVer` in `.agro/scripts/release-reservation.mjs`.
- [ ] For a pre-release version, the publish step runs `npm publish --access public --provenance --tag <label>`.
- [ ] For a stable version, the publish step runs `npm publish --access public --provenance --tag latest`.
- [ ] No path in `publish-cli.yml` runs `npm publish` with `--tag latest` for a pre-release version.
- [ ] `.agro/scripts/__tests__/canonical-publish-contract.test.ts` still finds exactly one `npm publish` run step.
- [ ] `pnpm test:scripts` exits 0.

### US-004: Run release.yml on experiment branches as pre-releases

**Description:** As the operator, I want `release.yml` to run on `experiment/**` pushes so that `experiment/minimal-core` publishes `0.14.0-minimal.1` through the existing pipeline.

**Acceptance Criteria:**

- [ ] `release.yml` `on.push.branches` lists `main`, `master`, and `experiment/**`.
- [ ] The reserve step passes `RELEASE_BRANCH: ${{ github.ref_name }}` to `reserve-github-release.mjs`.
- [ ] The finalize check step passes `RELEASE_VERSION` to `promote-release-latest.sh check`.
- [ ] The finalize `updateRelease` call sets `prerelease` from `needs.reserve.outputs.prerelease`.
- [ ] The finalize script throws when `prerelease` is `true` and `MAKE_LATEST` is `true`.
- [ ] The workflow contract tests in `.agro/scripts/__tests__/release-reservation.test.ts` assert each item above.
- [ ] `pnpm test:scripts` exits 0.

## Summary

The operator wants SemVer pre-releases, such as `0.14.0-minimal.1` and later `0.14.0-rc.1`. The first source is `experiment/minimal-core`. The existing `release.yml` pipeline publishes them. The input is `work/issue-1143.md`.

Verified current state:

- `release.yml` triggers only on pushes to `main` and `master`.
- The root `package.json` sets the release version. The current value is `0.14.0`.
- `SEMVER_PATTERN` in `.agro/scripts/release-reservation.mjs` accepts only `MAJOR.MINOR.PATCH`.
- `reserve-github-release.mjs` creates each draft with `prerelease: false`.
- A tag on a foreign SHA gives the `already-released` outcome. The workflow then skips publication and stays green. An unbumped push to an experiment branch takes this path when the tag exists.
- `promote-release-latest.sh` sets `make_latest=true` only on the canonical branch head. Its `promote` mode rejects any version that is not `MAJOR.MINOR.PATCH`.
- `publish-cli.yml` runs `npm publish --access public --provenance` with no `--tag`. npm then applies the dist-tag `latest`.
- The finalize job passes `make_latest` to `updateRelease` and sets no `prerelease` field.

Selected approach:

1. Extend `parseSemVer` to accept one optional `-<label>.<n>` suffix. It returns the label and the pre-release flag.
2. Make `parseSemVer` the one source of the pre-release decision for the reserve job, the CLI job, and the finalize job.
3. Add a version guard to `promote-release-latest.sh`. A pre-release version never gets `latest`, on any branch.
4. On an `experiment/**` branch, treat a stable version as a no-op. This keeps an unbumped push green before the first pre-release tag exists.

The operator bumps both `package.json` and `.agro/cli/package.json` to `0.14.0-minimal.1`. The image smoke step compares `agro --version` to the root version. Assumption: `agro --version` reads `.agro/cli/package.json`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/release-reservation.mjs` | `SEMVER_PATTERN`, `parseSemVer` | Version grammar and pre-release label |
| `.agro/scripts/reserve-github-release.mjs` | `reserveGitHubRelease`, `ensureDraftRelease`, `githubOutputLines`, `main` | Draft `prerelease` flag, experiment-branch no-op, job outputs |
| `.agro/scripts/promote-release-latest.sh` | `make_latest`, `check` and `promote` modes | GHCR `latest` and GitHub latest decision |
| `.github/workflows/publish-cli.yml` | `guard` step, `Publish @mifune/agro to npm` step | npm dist-tag |
| `.github/workflows/release.yml` | `on.push.branches`, `reserve` outputs, `finalize` steps | Trigger, output wiring, `updateRelease` fields |
| `.agro/scripts/__tests__/release-reservation.test.ts` | `SemVer reservation`, `GitHub reservation bridge`, `release workflow contract`, `CLI publication workflow contract` | Unit and workflow contract tests |
| `.agro/scripts/__tests__/release-latest.test.ts` | `promote-release-latest.sh` suite | Latest-promotion tests |
| `.agro/scripts/__tests__/canonical-publish-contract.test.ts` | `canonical publish-cli contract` | Single `npm publish` invariant |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `release.yml` trigger | Extended | Adds `experiment/**` to `on.push.branches` |
| `reserve` job outputs | Added | Adds `prerelease` and `prereleaseLabel` |
| `reserve-github-release.mjs` environment | Added | Reads `RELEASE_BRANCH` |
| `promote-release-latest.sh check` | Changed | Requires `RELEASE_VERSION` |
| GitHub Release | Changed | Sets `prerelease: true` and `make_latest: "false"` for a pre-release |
| npm `@mifune/agro` | Changed | Publishes a pre-release under dist-tag `<label>` |
| GHCR `ghcr.io/mifunedev/agro` | Unchanged for stable versions | Pushes `<version>` and `sha-<sha>` for a pre-release, never `latest` |

## Storage

N/A. The task adds no persistence. Git tags, GitHub Releases, GHCR tags, and npm dist-tags keep their current roles.

## Architectural Decisions

- The root `package.json` stays the source of truth for the release version.
- `parseSemVer` owns the version grammar. The reserve job, the CLI job, and the finalize job read the pre-release flag from `parseSemVer`.
- The accepted grammar is `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-([a-z][a-z0-9]*)\.(0|[1-9]\d*))?$`. The label `latest` is rejected, because the label becomes an npm dist-tag.
- `promote-release-latest.sh` keeps a bash copy of the grammar. The script already holds a bash copy of the stable grammar.
- The canonical-branch rule for `latest` stays. The version guard adds a second condition. The rule never relaxes.
- Scope: the task changes the push-triggered path only. Tag-push triggers and a `workflow_dispatch` release path stay out of scope.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/release-reservation.test.ts` | accepts `0.14.0-minimal.1` and `0.14.0-rc.1`; rejects malformed and `latest` labels | US-001 grammar |
| `.agro/scripts/__tests__/release-reservation.test.ts` | draft POST body has `prerelease: true` for a pre-release | US-001 draft flag |
| `.agro/scripts/__tests__/release-reservation.test.ts` | `experiment/minimal-core` with `0.14.0` returns `publishedNoop: true` and calls no `fetchImpl` | US-001 no-op |
| `.agro/scripts/__tests__/release-reservation.test.ts` | `githubOutputLines` includes `prerelease` and `prereleaseLabel` | US-001 outputs |
| `.agro/scripts/__tests__/release-latest.test.ts` | pre-release on canonical head gives `makeLatest=false`; `promote` calls no `docker` | US-002 |
| `.agro/scripts/__tests__/release-latest.test.ts` | `check` without `RELEASE_VERSION` exits 64 | US-002 |
| `.agro/scripts/__tests__/release-reservation.test.ts` | CLI workflow passes `--tag` from `parseSemVer` | US-003 |
| `.agro/scripts/__tests__/canonical-publish-contract.test.ts` | exactly one `npm publish` run step | US-003 invariant |
| `.agro/scripts/__tests__/release-reservation.test.ts` | trigger lists `experiment/**`; finalize sets `prerelease`; finalize rejects pre-release with latest | US-004 |

Run each case with `pnpm test:scripts`. Write each test first and confirm it fails before the change.

## Design Principles

- Keep one source of truth for the version grammar.
- Fail closed: a pre-release never reaches GHCR `latest`, GitHub latest, or npm `latest`.
- Keep every no-op push green.
- Extend the existing pipeline. Add no second release workflow.
- Add no explanatory comments to tracked code.

## Out of Scope

- Tag-push triggers.
- A `workflow_dispatch` release path.
- Moving GHCR channel tags.
- Documentation in `mifunedev/agro-web`.
- The version bump on `experiment/minimal-core`. The operator owns that commit.

## Open Questions

1. Does the label allow a hyphen, for example `0.14.0-minimal-core.1`? The plan allows only `[a-z][a-z0-9]*`.
2. Does `.agro/skills/release/SKILL.md` get a pre-release section in this task? The plan excludes it.
3. Does `agro --version` read `.agro/cli/package.json`? The plan assumes a yes answer. The implementation owner confirms the source before US-004.

## Acceptance Criteria

- [ ] `pnpm test:scripts` exits 0 with the new cases from each story.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `release.yml` runs on a push to `experiment/minimal-core`.
- [ ] A push of `0.14.0-minimal.1` creates GitHub Release `v0.14.0-minimal.1` with `prerelease: true`, and the release is not latest.
- [ ] `npm view @mifune/agro dist-tags` shows `minimal: 0.14.0-minimal.1` and an unchanged `latest`.
- [ ] GHCR `ghcr.io/mifunedev/agro:latest` keeps its digest from before the pre-release.
- [ ] A second push without a version bump ends green with `publishedNoop=true`.

## Lessons

Filled by the advisor before undraft.
