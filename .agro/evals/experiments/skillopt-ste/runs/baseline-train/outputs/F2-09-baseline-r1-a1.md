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
A push to `main`, `master`, or `experiment/**` starts the workflow. The workflow
runs these stages in order:

1. Validate the push.
2. Reserve the `v<version>` tag. Root `package.json` names `<version>`.
3. Publish the GHCR images.
4. Publish the CLI. If the registry already holds that CLI version, the workflow
   confirms the version instead.
5. Publish the GitHub Release.

Do not create a release tag, a release draft, or a `release/<version>` branch
before the push.

Root `package.json` holds the release version. Bump that version deliberately to
cut a release. If the version does not change, the run is a green no-op.

## Artifact set

One release builds one commit once. That build produces these artifacts:

- The canonical npm package `@mifune/agro`. The package holds the `agro`
  executable from `.agro/cli`.
- No shim release. The `@mifune/agro` shim source stays at `.agro/cli/legacy/`.
  Shim versions that the registry already holds stay on the registry. The release
  path does not publish the shim. The release path does not wait for the shim.
  The release path does not deprecate the shim.
- Four immutable GHCR tags: `ghcr.io/mifunedev/agro:<version>`, `:sha-<sha>`,
  `ghcr.io/mifunedev/agro:<version>`, and `:sha-<sha>`.
  `.agro/scripts/verify-release-aliases.sh` verifies that the four tags share one
  manifest digest. After that check, `.agro/scripts/promote-release-latest.sh`
  moves `latest` on both repositories.
- Four GitHub Release assets: `agro.js`, `oh.js`, `get-agro.sh`, and
  `get-agro.sh`. The workflow attaches the assets before the workflow undrafts
  the release. As a result, `releases/latest/download/<asset>` resolves at
  publication.

## Version sites

A release cut bumps the canonical version at two version sites:

1. `package.json` (root).
2. `.agro/cli/package.json` and `.agro/cli/package-lock.json`.

If the two version sites drift, `version-parity.sh` fails the build.

The retained shim at `.agro/cli/legacy/package.json` keeps its own `version`.
The shim also pins `@mifune/agro` to an exact version. That pin equals the shim
`version`. The shim version does not have to match a later canonical version.
The probe `<shim-coherence-probe>` checks this internal coherence.

## Operator prerequisites this repository cannot verify

- The npm token has publish rights for the `@mifune` scope. These rights include
  the `@mifune/agro` package name.
- The operator sets the GHCR package `mifunedev/agro` to public after the first
  push. GHCR creates each new package as private. Until the operator changes the
  visibility, `agro sandbox install docker` cannot pull the image.
- The compatibility SLA clock starts at the first public AGRO release. That
  release is the first release that publishes `@mifune/agro` and
  `ghcr.io/mifunedev/agro`.
- The docs-site dispatch token exists. The `notify-docs` job reads the secret
  `AGRO_WEB_DISPATCH_TOKEN` from the release repository (`mifunedev/agro`). The
  job then sends `repository_dispatch` to the docs repository. If the secret is
  absent, the job prints a `::notice::` line and exits green without a dispatch.
  To create the secret, the operator does these steps:

  1. Issue a fine-grained personal access token for the docs repository with
     **Contents: Read and write**. `repository_dispatch` requires
     `contents: write`. A classic token needs the `repo` scope instead.
  2. Store the token from a file. Never pass the token on the command line.

  ```bash
  gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro < token-file
  ```

- The repository variable `AGRO_WEB_REPO` names the docs repository target. The
  default value is `mifunedev/agro-web`. If the operator renames the docs
  repository, the operator sets `AGRO_WEB_REPO` to the new name:

  ```bash
  gh variable set AGRO_WEB_REPO --repo mifunedev/agro --body mifunedev/agro-web
  ```

## Pre-releases

A pre-release version has the form `MAJOR.MINOR.PATCH-<channel>.<n>`. An
example is `0.15.0-minimal.1`. `<channel>` is lowercase (`[a-z][a-z0-9]*`).
`<channel>` is never `latest`. The `minimal` channel names the
`experiment/minimal-core` track. Use `rc` only for candidates of the next `main`
release.

| Version form | Branches that publish it | GitHub Release | npm dist-tag | GHCR `latest` |
| --- | --- | --- | --- | --- |
| `0.15.0` | `main`, `master` | latest | `latest` | moves |
| `0.15.0-minimal.1` | `main`, `master`, `experiment/**` | pre-release, never latest | `minimal` | never moves |

If an `experiment/**` push carries a stable version, the run is a green no-op
(`stable-off-release-branch`). As a result, a stable bump from a `development`
merge never publishes from an experiment branch.

To cut a pre-release on an experiment branch, do these steps:

1. Merge `development` into the experiment branch. The merge brings in the
   `release.yml` that supports pre-releases.
2. Set the version in root `package.json`.
3. Set the same version in `.agro/cli/package.json` and
   `.agro/cli/package-lock.json`.
4. Add a dated `## [<version>] - YYYY-MM-DD` heading to `CHANGELOG.md`.
5. Push the experiment branch.
6. Monitor the run with the procedure in section 4, "Monitor and verify". Pass
   `--branch <experiment-branch>` to `gh run list`.

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

Before a release push, confirm each of these conditions:

- The working tree is clean.
- The canonical remote holds the source commit.
- CI for the source commit is green.
- Root `package.json` names the version to publish.
- `.agro/cli/package.json` matches the root version.
  `bash .agro/evals/probes/version-parity.sh` checks this match.
- The retained shim stays internally coherent.
  `bash .agro/evals/probes/<shim-coherence-probe>` checks the shim.
- No `v<version>` tag exists yet. If the version is not bumped, the push is a
  green no-op and publishes nothing.
- The release does not require a newly published `@mifune/agro` version.
- `CHANGELOG.md` has a `## [<version>]` section for that version. If the section
  is absent, the workflow uses the `[Unreleased]` section instead.
- The remote release branch is an ancestor of the source commit. This condition
  makes the promotion a fast-forward.

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

If `$ARGUMENTS` contains `--dry-run`, report these values: the resolved repo,
source, target, SHA, clean-tree result, and fast-forward result. Then stop. Do
not push.

## 3. Trigger the release

Push the exact source SHA that the pre-flight checked. The branch push starts the
release. A manually created tag does not start the release.

```bash
git push "$REMOTE" "$SHA:refs/heads/$TARGET"
```

The workflow reads the version from root `package.json` on the pushed commit. As
a result, every retry resolves the same version. A retry reuses a draft release
or a published release for the same SHA. If the tag already exists on a
different commit, the reserve step reports the version as already released.
Every publication job then skips, and the run stays green. To publish again,
bump the version.

## 4. Monitor and verify

1. Find the `release.yml` push run for `$SHA` and `$TARGET`.
2. After the matching run appears, watch the run by its `<run-id>`.

```bash
gh run list --repo "$REPO" --workflow release.yml --branch "$TARGET" \
  --commit "$SHA" --event push --limit 5 \
  --json databaseId,headSha,status,conclusion,url
# Once the matching run appears:
gh run watch <run-id> --repo "$REPO" --exit-status
```

After the run succeeds, do these steps:

1. Fetch the tags.
2. Find the SemVer tag that points to the exact SHA.
3. Verify the GitHub Release and the release assets.
4. Verify the four immutable image tags.
5. Verify the canonical npm package.

The tag carries the `v` prefix. The image tags do not carry the `v` prefix. A
newly published `@mifune/agro` version is not a release gate. The automatic
`notify-docs` dispatch is not the only path that updates the documentation. The
daily schedule in `pages.yml` also refreshes the mirror.

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

If `main` exists, `main` is the canonical branch for `latest`. Otherwise,
`master` is the canonical branch. Immediately before promotion, the workflow
reads both remote refs again. The workflow then promotes the versioned image of
the canonical head to `latest` by immutable digest. A stale canonical run skips
`latest`. Every run from a noncanonical branch also skips `latest`. GitHub's
`make_latest` flag follows the same rule after a second fresh read of the refs.

After `finalize` succeeds on a real release, `notify-docs` sends
`repository_dispatch` to `AGRO_WEB_REPO`. The dispatch carries
`event_type: agro-release` and `client_payload: { ref: <released sha> }`. The
`pages.yml` workflow of the docs site reads `client_payload.ref`. The `pages.yml`
workflow then rebuilds the mirrored installers from the released commit. To
confirm the dispatch, run the `gh run list` command below:

```bash
gh run list --repo "${AGRO_WEB_REPO:-mifunedev/agro-web}" \
  --workflow pages.yml --event repository_dispatch --limit 3 \
  --json databaseId,status,conclusion,createdAt,url
```

If the `notify-docs` step skips and prints the `::notice::` line, the secret is
not set. The daily schedule in `pages.yml` still refreshes the mirror.
