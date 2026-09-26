# PRD: SemVer pre-release publishing

Status: DRAFT

## User Stories

### US-001: Accept and reserve pre-release versions

**Description:** As a maintainer, I want pre-release versions accepted so that experiment branches reserve their own tags.

**Acceptance Criteria:**

- [ ] `parseSemVer` in `.agro/scripts/release-reservation.mjs` accepts `0.14.0-minimal.1` and `0.14.0-rc.1`.
- [ ] `parseSemVer` rejects `0.14.0-minimal`, `0.14.0-.1`, `0.14.0-Minimal.1`, and `0.14.0-minimal.01`.
- [ ] `parseSemVer` still accepts each strict `MAJOR.MINOR.PATCH` version that the current tests accept.
- [ ] For a pre-release version, `.agro/scripts/reserve-github-release.mjs` creates the draft with `prerelease: true`.
- [ ] For a plain `MAJOR.MINOR.PATCH` version, the draft keeps `prerelease: false`.
- [ ] New cases in `.agro/scripts/__tests__/release-reservation.test.ts` fail before the change and pass after the change.

### US-002: Publish pre-releases without touching latest

**Description:** As a maintainer, I want experiment pushes to publish pre-releases so that stable channels stay unchanged.

**Acceptance Criteria:**

- [ ] The `push.branches` list in `.github/workflows/release.yml` contains `main`, `master`, and `experiment/**`.
- [ ] If the version is a pre-release, the finalize step sends `prerelease: true` and `make_latest: "false"` to GitHub.
- [ ] If the version is a pre-release, `.github/workflows/publish-cli.yml` runs `npm publish` with `--tag <label>`.
- [ ] If the version is a plain `MAJOR.MINOR.PATCH` version, `npm publish` runs without `--tag`, as today.
- [ ] If the version is a pre-release, the "Promote latest from the canonical branch by digest" step does not move GHCR `latest`.
- [ ] If the version is a pre-release, `.agro/scripts/promote-release-latest.sh` exits 0 and reports no promotion, on any branch.
- [ ] An unbumped push to an experiment branch ends as the existing `publishedNoop` path, and the run is green.
- [ ] Workflow contract cases in `.agro/scripts/__tests__/release-reservation.test.ts` and `.agro/scripts/__tests__/canonical-publish-contract.test.ts` cover each criterion above.
- [ ] `pnpm test:scripts` exits 0.

## Summary

`.github/workflows/release.yml` runs only on `main` and `master` pushes. The root `package.json` version is the single release version. `SEMVER_PATTERN` at line 12 of `.agro/scripts/release-reservation.mjs` accepts only `MAJOR.MINOR.PATCH`. `.agro/scripts/reserve-github-release.mjs` creates each draft with `prerelease: false`. `.github/workflows/publish-cli.yml` line 79 runs `npm publish --access public --provenance`, which publishes to the `latest` dist-tag. `.agro/scripts/promote-release-latest.sh` promotes GHCR and GitHub `latest` only when the release SHA is the canonical branch head.

The change extends the version grammar to `MAJOR.MINOR.PATCH-<label>.<n>`. The parser derives one pre-release flag and one label. Each publish step reads that flag. A pre-release never reaches a `latest` channel, whatever the branch.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/release-reservation.mjs` | `SEMVER_PATTERN`, `parseSemVer` | Version grammar and label extraction |
| `.agro/scripts/reserve-github-release.mjs` | draft create call, `RELEASE_VERSION` | Draft release `prerelease` flag |
| `.github/workflows/release.yml` | `on.push.branches`, `reserve`, `publish-image`, `publish-cli`, `finalize` jobs | Trigger, job outputs, `make_latest` decision |
| `.github/workflows/publish-cli.yml` | `npm publish` step | npm dist-tag selection |
| `.agro/scripts/promote-release-latest.sh` | `promote` and `check` modes | GHCR and GitHub `latest` guard |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Release workflow trigger | Extended | Pushes to experiment branches start `release.yml`. |
| `package.json` version | Extended | The field accepts `MAJOR.MINOR.PATCH-<label>.<n>`. |
| GitHub Release | Changed | Pre-release versions publish as pre-releases and never become latest. |
| npm registry | Changed | Pre-release versions publish under the dist-tag `<label>`. |
| GHCR image tags | Unchanged for stable | Pre-release versions push immutable tags only and never move `latest`. |

## Storage

N/A. The change adds no persistent state. Git tags and GitHub Releases stay the only release record.

## Architectural Decisions

- The root `package.json` version stays the single source of truth. The branch name never sets the version or the label.
- `parseSemVer` owns the pre-release decision. The `reserve` job exports `prerelease` and `distTag` outputs, and later jobs read those outputs.
- The version decides the `latest` guard, in addition to the existing canonical-branch guard. A pre-release pushed to `main` still skips `latest`.
- The `reserve` job keeps the per-push run model. The workflow adds no shared concurrency group.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/release-reservation.test.ts` | pre-release grammar accept and reject cases | US-001 grammar |
| `.agro/scripts/__tests__/release-reservation.test.ts` | draft create sends `prerelease: true` for a pre-release | US-001 reservation |
| `.agro/scripts/__tests__/release-reservation.test.ts` | trigger includes `experiment/**`; finalize never sets latest for a pre-release | US-002 workflow contract |
| `.agro/scripts/__tests__/canonical-publish-contract.test.ts` | fake registry sees `--tag minimal` for `0.14.0-minimal.1` and no `--tag` for `0.14.0` | US-002 npm dist-tag |
| `.agro/evals/probes/version-parity.sh` | existing probe stays green | Version parity regression floor |

Run `pnpm test:scripts` and `bash .agro/skills/eval/run.sh` inside the sandbox.

## Design Principles

- Keep one version source and one parser. Derive every channel decision from the parser output.
- Fail closed. An invalid pre-release version stops the `reserve` job before any GitHub call.
- Keep the stable path byte-identical in behavior for plain `MAJOR.MINOR.PATCH` versions.
- Add no tracked code comments.

## Out of Scope

- Tag-push triggers.
- A `workflow_dispatch` release path.
- Moving GHCR channel tags.
- Documentation changes in the mifunedev/agro-web repository.
- Build metadata such as `+sha` and multi-segment pre-release identifiers.

## Open Questions

1. The `notify-docs` job sends the agro-release `repository_dispatch`. Must the job skip a pre-release? The plan assumes the job skips a pre-release.
2. Does `.agro/scripts/promote-release-latest.sh` read the version, or does the workflow skip the promote and check steps for a pre-release? The plan assumes the workflow skips both steps.
3. The release-notes step falls back to a generic body when `CHANGELOG.md` lacks a version section. Is a CHANGELOG section required for a pre-release? The plan assumes the fallback is acceptable.

## Acceptance Criteria

- [ ] Each US-001 and US-002 criterion passes.
- [ ] `pnpm test:scripts` exits 0 inside the sandbox.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] A plain `MAJOR.MINOR.PATCH` release on `main` produces the same GitHub, npm, and GHCR results as before the change.

## Lessons

Filled by the advisor before undraft.
