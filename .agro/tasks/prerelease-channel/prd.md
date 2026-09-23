# PRD: Pre-release channel for experiment branches

Issue: [#1143](https://github.com/mifunedev/agro/issues/1143)

## Introduction

`release.yml` publishes only stable releases from `main` or `master`. The operator
runs a long-lived comparison track, `experiment/minimal-core`, and needs an
installable, versioned build of that track without touching the stable channel.

This feature adds SemVer pre-releases to the existing pipeline. A version such as
`0.14.0-minimal.1` publishes a tag, a GitHub pre-release, an npm version under a
non-`latest` dist-tag, and immutable GHCR tags. Stable users never receive it.

The label after the hyphen names the channel. `minimal` names the experiment
track. `rc` is reserved for real candidates of the next `main` release.

## Goals

- Publish an installable build of `experiment/minimal-core` from one version bump.
- Keep one release pipeline and one version source (root `package.json`).
- Guarantee that no pre-release becomes `latest` on GitHub, npm, or GHCR.
- Support any future channel label (`rc`, another experiment) with no new code.

## User Stories

### US-001: Accept pre-release versions

**Description:** As the operator, I want the reservation step to accept
`MAJOR.MINOR.PATCH-<label>.<n>` so that a pre-release bump can reserve a tag.

**Acceptance Criteria:**

- [ ] `parseSemVer("0.14.0-minimal.1")` and `parseSemVer("0.14.0-rc.2")` succeed.
- [ ] Malformed forms (`0.14.0-`, `0.14.0-Minimal.1`, `0.14.0-minimal`, `0.14.0+b1`) are rejected.
- [ ] The parsed result exposes the channel label (`minimal`, `rc`), or `null` for a stable version.
- [ ] Unit tests cover each case; `pnpm test:scripts` passes.

### US-002: Mark the GitHub Release as a pre-release

**Description:** As a user, I want a pre-release to be labeled as one on GitHub so
that `releases/latest` keeps pointing at the stable release.

**Acceptance Criteria:**

- [ ] The draft reservation sends `prerelease: true` for a pre-release version and `false` for a stable one.
- [ ] `promote-release-latest.sh check` reports `make_latest=false` for a pre-release, even on `main`.
- [ ] Unit tests cover both flags.

### US-003: Publish npm under the channel dist-tag

**Description:** As a tester, I want `npm i -g @mifune/agro@minimal` to install the
pre-release so that `npm i -g @mifune/agro` still installs the stable release.

**Acceptance Criteria:**

- [ ] `publish-cli.yml` passes `--tag <label>` when the version has a pre-release label.
- [ ] A stable version publishes with no `--tag` (npm default `latest`).
- [ ] The workflow contract test asserts both paths.

### US-004: Never promote a pre-release image to `latest`

**Description:** As a user, I want `ghcr.io/mifunedev/agro:latest` to stay stable so
that `agro sandbox install docker` never boots an experiment by default.

**Acceptance Criteria:**

- [ ] `promote-release-latest.sh promote` skips promotion for a pre-release version.
- [ ] The immutable `:<version>` and `:sha-<sha>` tags still publish.
- [ ] `release-latest.test.ts` covers the skip.

### US-005: Trigger releases from experiment branches

**Description:** As the operator, I want a push to `experiment/**` to run the
release workflow so that bumping the version on the experiment branch publishes it.

**Acceptance Criteria:**

- [ ] `release.yml` triggers on `main`, `master`, and `experiment/**` pushes.
- [ ] An unbumped push remains a green no-op (existing reservation behavior).
- [ ] The workflow contract test asserts the trigger list.

### US-006: Document the channel

**Description:** As the operator, I want the `/release` skill to state how to cut a
pre-release so that the procedure is repeatable.

**Acceptance Criteria:**

- [ ] `/release` has a "Pre-releases" section: version form, label meaning, install commands.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry that links #1143.

## Functional Requirements

- FR-1: A release version must match `MAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH-<label>.<n>`, where `<label>` is `[a-z][a-z0-9]*` and `<n>` is a non-negative integer without leading zeros.
- FR-2: The channel label is the `<label>` segment; a stable version has no label.
- FR-3: The GitHub draft reservation must set `prerelease` to true exactly when a label exists.
- FR-4: `make_latest` must be false for any version with a label, on every branch.
- FR-5: The GHCR `latest` tag must not move for any version with a label.
- FR-6: `npm publish` must use `--tag <label>` for any version with a label.
- FR-7: `release.yml` must run on pushes to `main`, `master`, and `experiment/**`.
- FR-8: Version sources stay unchanged: root `package.json` and `.agro/cli/package.json` must agree, and `CHANGELOG.md` must carry a dated heading for the version.

## Non-Goals

- No tag-push trigger and no `workflow_dispatch` release path.
- No moving GHCR channel tags (`:minimal`, `:rc`); the immutable version tag is enough.
- No change to `get-agro.sh`; it keeps installing the latest stable release.
- No public documentation in `agro-web` until a pre-release is in real use.
- No change to the release gates of any branch.

## Technical Considerations

- `release.yml` runs the workflow file of the pushed commit. The experiment branch
  must merge `development` after this lands before its first pre-release push.
- `experiment/minimal-core` removed the eval-probe gate from its own `release.yml`.
  Its pre-releases run with the lighter gate. The operator accepted this.
- Docker tags and npm versions accept `0.14.0-minimal.1` unchanged.
- The CHANGELOG notes extractor matches `## [<version>] - ` literally, so a
  pre-release heading works without change.

## Success Metrics

- One version bump on `experiment/minimal-core` produces `v0.14.0-minimal.1`,
  `@mifune/agro@minimal`, and `ghcr.io/mifunedev/agro:0.14.0-minimal.1`.
- `@mifune/agro@latest`, GHCR `:latest`, and GitHub's latest release are unchanged afterward.

## Open Questions

- None. Version base `0.14.0-minimal.N`, the lighter gate, and no public docs were
  confirmed by the operator.
