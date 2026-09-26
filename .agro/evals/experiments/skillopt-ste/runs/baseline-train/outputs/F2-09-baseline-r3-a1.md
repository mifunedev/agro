---
name: release
description: |
  Release a validated AGRO commit by pushing it to main or master, then
  monitor the automatic SemVer/GHCR/GitHub Release workflow. TRIGGER when:
  asked to release, version, ship, cut a release, or verify release artifacts.
argument-hint: "[--dry-run]"
---

# Release

`.github/workflows/release.yml` owns version allocation and artifact mutation.
The workflow runs on every push to `main`, `master`, or `experiment/**`. The
workflow does these steps in this order:

1. The workflow validates the push.
2. The workflow reserves the `v<version>` tag. Root `package.json` names the
   version.
3. The workflow publishes the GHCR images.
4. The workflow publishes the CLI. If the CLI version already exists, the
   workflow confirms that version instead.
5. The workflow publishes the GitHub Release.

Do not create a release tag, a release draft, or a `release/<version>` branch
before the push.

Root `package.json` holds the release version. To release, the operator bumps
that version. If the version does not change, the run is a green no-op.

## Artifact set

One release uses one commit and one build. The release produces these
artifacts:

- The canonical npm package `@mifune/agro`. This package holds the `agro`
  executable, built from `.agro/cli`.
  - The `@mifune/agro` shim source stays at `.agro/cli/legacy/`.
  - The shim versions that the registry already holds stay on the registry.
  - The release path does not publish the shim, wait for the shim, or deprecate
    the shim.
- Four immutable GHCR tags: `ghcr.io/mifunedev/agro:<version>`, `:sha-<sha>`,
  `ghcr.io/mifunedev/agro:<version>`, and `:sha-<sha>`.
  - `.agro/scripts/verify-release-aliases.sh` verifies that the four tags share
    one manifest digest.
  - After that check, `.agro/scripts/promote-release-latest.sh` moves `latest`
    on both repositories.
- Four GitHub Release assets: `agro.js`, `oh.js`, `get-agro.sh`, and
  `get-agro.sh`.
  - The workflow attaches the assets while the release is still a draft.
  - The workflow then publishes the release. At publication,
    `releases/latest/download/<asset>` resolves.

## Version sites

A release bumps the canonical version in two places:

1. Root `package.json`.
2. `.agro/cli/package.json` and `.agro/cli/package-lock.json`.

If the versions in these two places differ, `version-parity.sh` fails the
build.

The retained shim at `.agro/cli/legacy/package.json` keeps its own `version`.
The shim also keeps an exact `@mifune/agro` pin. The pin equals the shim
version. The shim version can differ from a later canonical version.
`<shim-coherence-probe>` checks that the shim version and the shim pin agree.

## Operator prerequisites this repository cannot verify

The operator owns each of these prerequisites:

- The npm token has publish rights for the `@mifune` scope. These rights
  include the `@mifune/agro` package name.
- After the first push of the GHCR package `mifunedev/agro`, the operator sets
  the package visibility to public. GHCR makes each new package private. Until
  the operator changes the visibility, `agro sandbox install docker` cannot
  pull the package.
- The compatibility SLA clock starts at the first public AGRO release. The
  first public AGRO release is the first release that publishes `@mifune/agro`
  and `ghcr.io/mifunedev/agro`.
- The docs-site dispatch token exists.
  - The `notify-docs` job reads the secret `AGRO_WEB_DISPATCH_TOKEN` from the
    release repository `mifunedev/agro`.
  - The `notify-docs` job sends `repository_dispatch` to the docs repository.
  - If the secret does not exist, the job prints a `::notice::` line. The job
    then exits green and sends no dispatch.

  To create the token, do these steps:

  1. Issue a fine-grained personal access token for the docs repository. Give
     the token the **Contents: Read and write** permission.
     `repository_dispatch` requires `contents: write`. A classic token needs
     the `repo` scope instead.
  2. Write the token to a file. Store the secret from that file. Never put the
     token on the command line:

  ```bash
  gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro < token-file
  ```

- The repository variable `AGRO_WEB_REPO` names the docs repository. The
  default value is `mifunedev/agro-web`. If the operator renames the docs
  repository, the operator sets `AGRO_WEB_REPO` to the new name:

  ```bash
  gh variable set AGRO_WEB_REPO --repo mifunedev/agro --body mifunedev/agro-web
  ```

## Pre-releases

A pre-release version has the form `MAJOR.MINOR.PATCH-<channel>.<n>`. An
example is `0.15.0-minimal.1`.

- `<channel>` matches `[a-z][a-z0-9]*`.
- `<channel>` is not `latest`.
- The `minimal` channel names the `experiment/minimal-core` track.
- Use the `rc` channel only for candidates of the next `main` release.

| Version form | Branches that publish it | GitHub Release | npm dist-tag | GHCR `latest` |
| --- | --- | --- | --- | --- |
| `0.15.0` | `main`, `master` | latest | `latest` | moves |
| `0.15.0-minimal.1` | `main`, `master`, `experiment/**` | pre-release, never latest | `minimal` | never moves |

If an `experiment/**` push carries a stable version, the run is a green no-op
with the reason `stable-off-release-branch`. Thus a stable bump that the
operator merges from `development` never publishes from an experiment branch.

To release a pre-release from an experiment branch, do these steps:

1. Merge `development` into the experiment branch. After the merge, the
   `release.yml` on the experiment branch supports pre-releases.
2. Set the version in root `package.json`, `.agro/cli/package.json`, and
   `.agro/cli/package-lock.json`.
3. Add a dated `## [<version>] - YYYY-MM-DD` heading to `CHANGELOG.md`.
4. Push the experiment branch.
5. Monitor the run as section 4 describes. Use `--branch <experiment-branch>`
   in place of `--branch "$TARGET"`.

To install the pre-release, run these commands:

```bash
npm i -g @mifune/agro@minimal
agro sandbox install docker --version 0.15.0-minimal.1
```

## 1. Resolve the canonical destination

```bash
if git remote get-url upstream >/dev/null 2>&1; then
  REMOTE=upstream
else
  REMOTE=origin
fi
REPO=$(gh repo view "$(git remote get-url "$REMOTE")" --json nameWithOwner -q .nameWithOwner)

if git ls-remote --exit-code --heads "$REMOTE" main >/dev/null 2>&1; then
  TARGET=main
elif git ls-remote --exit-code --heads "$REMOTE" master >/dev/null 2>&1; then
  TARGET=master
else
  echo "No main or master release branch exists on $REMOTE" >&2
  exit 1
fi
SOURCE=$(git branch --show-current)
printf 'Repo: %s · source: %s · release branch: %s\n' "$REPO" "$SOURCE" "$TARGET"
```

## 2. Pre-flight

Before the release push, confirm each of these conditions:

- The working tree is clean.
- The canonical remote holds the source commit.
- CI for the source commit is green.
- Root `package.json` names the version to publish.
- `.agro/cli/package.json` holds the same version. To check, run
  `bash .agro/evals/probes/version-parity.sh`.
- The retained shim version and the shim pin agree. To check, run
  `bash .agro/evals/probes/<shim-coherence-probe>`.
- No `v<version>` tag exists for the version.
- `CHANGELOG.md` has a `## [<version>]` section for the version. If the section
  does not exist, the workflow uses the `[Unreleased]` section.
- The remote release branch is an ancestor of the source commit. This condition
  makes the promotion a fast-forward.

If the operator pushes without a version bump, the run is a green no-op and
publishes nothing. A release does not require a new `@mifune/agro` version.

```bash
test -z "$(git status --porcelain)" || { echo "Working tree is dirty" >&2; exit 1; }
git fetch "$REMOTE" "$SOURCE" "$TARGET" --tags
VERSION=$(node -p "require('./package.json').version")
git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null && {
  echo "v$VERSION is already tagged; bump package.json to cut a new release" >&2
  exit 1
}
grep -q "^## \[$VERSION\]" CHANGELOG.md || {
  echo "CHANGELOG.md has no section for $VERSION" >&2
  exit 1
}
SHA=$(git rev-parse "$REMOTE/$SOURCE")
test "$(git rev-parse HEAD)" = "$SHA" || {
  echo "Local $SOURCE is not identical to $REMOTE/$SOURCE" >&2
  exit 1
}
git merge-base --is-ancestor "$REMOTE/$TARGET" "$SHA" || {
  echo "$TARGET has diverged from $SOURCE; reconcile before release" >&2
  exit 1
}
```

If `$ARGUMENTS` contains `--dry-run`, do these steps:

1. Report the resolved repo, source, target, SHA, clean-tree result, and
   fast-forward result.
2. Stop. Do not push.

## 3. Trigger the release

Promote the exact source SHA that the pre-flight checked. The branch push
starts the release. A manual tag does not start the release.

```bash
git push "$REMOTE" "$SHA:refs/heads/$TARGET"
```

The workflow reads the version from root `package.json` on the pushed commit.
Each retry of the run thus resolves the same version. If a draft or a published
release already exists for the same SHA, the retry uses that release.

If the tag already exists on a different commit, the reserve step reports that
the version is already released. Every publication job then skips, and the run
stays green. To publish again, bump the version.

## 4. Monitor and verify

Do these steps:

1. Find the `release.yml` push run for `$SHA` and `$TARGET`.
2. Watch the run until the run exits.

```bash
gh run list --repo "$REPO" --workflow release.yml --branch "$TARGET" \
  --commit "$SHA" --event push --limit 5 \
  --json databaseId,headSha,status,conclusion,url
# Once the matching run appears:
gh run watch <run-id> --repo "$REPO" --exit-status
```

If the run succeeds, do these steps:

1. Fetch the tags.
2. Find the SemVer tag that points to the exact SHA. The tag has the `v`
   prefix. The image tags do not have the `v` prefix.
3. Verify the four immutable image tags.
4. Verify the canonical npm package.
5. Verify the release assets.
6. Verify the GitHub Release.

A new `@mifune/agro` version is not a release gate. The automatic
`notify-docs` dispatch is not the only path that updates the docs site.

```bash
git fetch "$REMOTE" --tags
TAG=$(git tag --points-at "$SHA" \
  | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
  | sort -V | tail -1)
test -n "$TAG" || { echo "No SemVer tag found for $SHA" >&2; exit 1; }
gh release view "$TAG" --repo "$REPO" --json assets -q '.assets[].name'
.agro/scripts/verify-release-aliases.sh check \
  "ghcr.io/mifunedev/agro:${TAG#v}" "ghcr.io/mifunedev/agro:${TAG#v}"
npm view "@mifune/agro@${TAG#v}" version
printf 'Images: ghcr.io/mifunedev/{agro,agro}:%s and :sha-%s\n' "${TAG#v}" "$SHA"
```

The asset list must name `agro.js`, `oh.js`, `get-agro.sh`, and `get-agro.sh`.

The canonical branch for `latest` is `main`. If `main` does not exist, the
canonical branch is `master`. The workflow moves `latest` in these steps:

1. Directly before promotion, the workflow reads both remote refs again.
2. The workflow promotes the versioned image of the canonical head to `latest`.
   The promotion uses the immutable digest.

If a newer commit replaces the pushed commit at the canonical head, the run
skips `latest`. Every run on a
noncanonical branch also skips `latest`. GitHub's `make_latest` flag uses the
same rule, after a second read of the remote refs.

If `finalize` succeeds on a release that publishes a new version,
`notify-docs` sends `repository_dispatch` to `AGRO_WEB_REPO`. The dispatch
carries `event_type: agro-release` and `client_payload: { ref: <released sha> }`.
The `pages.yml` workflow of the docs site reads `client_payload.ref`. The
workflow then rebuilds the mirrored installers of the docs site from the
released commit. To confirm that the docs repository received the dispatch,
run the command below:

```bash
gh run list --repo "${AGRO_WEB_REPO:-mifunedev/agro-web}" \
  --workflow pages.yml --event repository_dispatch --limit 3 \
  --json databaseId,status,conclusion,createdAt,url
```

If the `notify-docs` step skips and prints the `::notice::` line, the secret
`AGRO_WEB_DISPATCH_TOKEN` does not exist. The daily schedule in `pages.yml`
still refreshes the mirror.
