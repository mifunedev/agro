# PRD: SemVer pre-release publishing

Status: DRAFT

## User Stories

### US-001: Accept pre-release versions in the reservation

**Description:** As an operator, I want the release reservation to accept `MAJOR.MINOR.PATCH-<label>.<n>` versions so that `0.14.0-minimal.1` reserves a draft release.

**Acceptance Criteria:**

- [ ] `parseSemVer("0.14.0-minimal.1")` returns `major`, `minor`, `patch`, `version`, `label: "minimal"`, and `prerelease: 1`.
- [ ] `parseSemVer("0.14.0")` returns `label: null` and `prerelease: null`.
- [ ] `parseSemVer` throws `INVALID_SEMVER_VERSION` for `0.14.0-minimal`, `0.14.0-.1`, `0.14.0-minimal.01`, `0.14.0-Minimal.1`, and `0.14.0+build.1`.
- [ ] `reserve-github-release.mjs` sends `prerelease: true` in the draft-create body when the version has a label, and sends `prerelease: false` otherwise.
- [ ] A test in `.agro/scripts/__tests__/release-reservation.test.ts` fails before the change and passes after the change.

### US-002: Trigger the release pipeline on experiment branches

**Description:** As an operator, I want `release.yml` to run on `experiment/**` pushes so that a bumped experiment branch publishes a pre-release.

**Acceptance Criteria:**

- [ ] `release.yml` lists `experiment/**` under `on.push.branches`, next to `main` and `master`.
- [ ] A push whose root `package.json` version is already tagged on another commit ends with `publishedNoop=true`, and the `publish-image`, `publish-cli`, `finalize`, and `notify-docs` jobs skip.
- [ ] A workflow-contract test asserts the `experiment/**` trigger.

### US-003: Keep pre-releases off every latest channel

**Description:** As an operator, I want each pre-release kept off GitHub latest, npm `latest`, and GHCR `latest` so that stable users never get an experiment build.

**Acceptance Criteria:**

- [ ] `promote-release-latest.sh check` prints `make_latest=false` for a version with a pre-release label, on every branch.
- [ ] `promote-release-latest.sh promote` exits 0 without a `docker buildx imagetools create` call for a version with a pre-release label.
- [ ] `promote-release-latest.sh` accepts `0.14.0-minimal.1` and rejects `0.14.0-minimal` with exit code 64.
- [ ] The `finalize` job sends `make_latest: "false"` and `prerelease: true` for a pre-release version.
- [ ] `publish-cli.yml` runs `npm publish --access public --provenance --tag <label>` when the `.agro/cli/package.json` version has a pre-release label.
- [ ] `publish-cli.yml` runs `npm publish --access public --provenance` without `--tag` for a stable version.
- [ ] Tests in `.agro/scripts/__tests__/release-latest.test.ts` and `.agro/scripts/__tests__/canonical-publish-contract.test.ts` cover each case above.

## Summary

The current pipeline publishes only stable releases from `main` or `master`. Verified facts:

- `release.yml` triggers on `push` to `main` and `master` only.
- The root `package.json` version (now `0.14.0`) sets the release version.
- `release-reservation.mjs` defines `SEMVER_PATTERN` as `MAJOR.MINOR.PATCH` only.
- `reserve-github-release.mjs` creates the draft with `prerelease: false`.
- A version tagged on another commit gives `already-released` and `publishedNoop=true`. This path already makes an unbumped push a green no-op.
- `promote-release-latest.sh` sets `make_latest=true` only when the release SHA is the canonical `main` or `master` head. The script rejects a non-`MAJOR.MINOR.PATCH` version with exit code 64.
- `publish-cli.yml` reads the version from `.agro/cli/package.json` and runs `npm publish` with no `--tag`. npm then applies the `latest` dist-tag.

The selected approach extends the one existing pipeline. The approach adds no second workflow. The pre-release label comes from the version string. The label then sets the npm dist-tag, the GitHub `prerelease` flag, and the latest-promotion decision.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/workflows/release.yml` | `on.push.branches`, `finalize` job, `updateRelease` call | Trigger and GitHub Release finalization |
| `.agro/scripts/release-reservation.mjs` | `SEMVER_PATTERN`, `parseSemVer`, `reserveReleaseVersion` | Version grammar |
| `.agro/scripts/reserve-github-release.mjs` | `ensureDraftRelease`, `prerelease` field | Draft release creation |
| `.agro/scripts/promote-release-latest.sh` | `make_latest`, `RELEASE_VERSION` check | GitHub and GHCR latest decision |
| `.github/workflows/publish-cli.yml` | `guard` step, `Publish @mifune/agro to npm` step | npm dist-tag |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `release.yml` trigger | Extend | Add `experiment/**` push branches |
| Root `package.json` `version` | Extend grammar | Accept `MAJOR.MINOR.PATCH-<label>.<n>` |
| GitHub Release | Behavior | Pre-release flag set, never latest |
| npm `@mifune/agro` | Behavior | Pre-release publishes under dist-tag `<label>` |
| GHCR `ghcr.io/mifunedev/agro` | Behavior | Pre-release pushes the version and `sha-` tags only |

## Storage

N/A. The pipeline keeps no new state. Git tags, GitHub Releases, npm, and GHCR stay the stores of record.

## Architectural Decisions

- The root `package.json` version stays the single source of truth for the release version.
- `parseSemVer` owns the version grammar in JavaScript. `promote-release-latest.sh` keeps one matching Bash regex, and a test pins both to the same accepted and rejected cases.
- The pre-release label, not the branch name, decides pre-release behavior. A labeled version on `main` also stays off every latest channel.
- The label grammar is `[a-z][a-z0-9]*`. The counter grammar is `0|[1-9][0-9]*`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/release-reservation.test.ts` | Accepted and rejected pre-release strings; `prerelease` field in the create body | US-001 |
| `.agro/scripts/__tests__/release-reservation.test.ts` | `experiment/**` trigger present in `release.yml` | US-002 |
| `.agro/scripts/__tests__/release-latest.test.ts` | `check` and `promote` with a labeled version | US-003 |
| `.agro/scripts/__tests__/canonical-publish-contract.test.ts` | `--tag <label>` for a labeled version; no `--tag` for a stable version | US-003 |

Run `pnpm test:scripts` from the repository root in the sandbox. The command exits 0.

## Design Principles

- Extend the existing pipeline. Add no second release path.
- Keep one source of truth for the version and one for the grammar.
- Fail closed: an unrecognized version shape exits nonzero before any publish step.
- Add no explanatory comments to tracked code.

## Out of Scope

- Tag-push triggers.
- A `workflow_dispatch` release path.
- Moving GHCR channel tags.
- `mifunedev/agro-web` documentation.

## Open Questions

1. The npm version comes from `.agro/cli/package.json`, and the release version comes from the root `package.json`. Must a pre-release bump both files to the same version, and must the pipeline fail when the labels differ?
2. Must `notify-docs` skip a pre-release? The issue puts agro-web docs out of scope but does not name the dispatch.
3. Must the `validate` and `eval-probes` jobs run unchanged on `experiment/**` pushes? This plan assumes yes.

## Acceptance Criteria

- [ ] `pnpm test:scripts` exits 0 in the sandbox.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] A push of `0.14.0-minimal.1` to `experiment/minimal-core` creates a GitHub pre-release `v0.14.0-minimal.1` that is not latest.
- [ ] After that push, `npm view @mifune/agro dist-tags` shows the pre-release under `minimal` and an unchanged `latest`.
- [ ] After that push, the `ghcr.io/mifunedev/agro:latest` digest is unchanged.

## Lessons

Filled by the advisor before undraft.
