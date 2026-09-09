---
name: release
description: |
  Release a validated Open Harness commit by pushing it to main or master, then
  monitor the automatic SemVer/GHCR/GitHub Release workflow. TRIGGER when:
  asked to release, version, ship, cut a release, or verify release artifacts.
argument-hint: "[--dry-run]"
---

# Release

`.github/workflows/release.yml` owns version allocation and artifact mutation.
The workflow validates every push to `main` or `master` first, then reserves the
`v<version>` tag for the version root `package.json` names, publishes GHCR and
the CLI (or confirms the CLI version already exists), and finally publishes the
GitHub Release. Do not pre-create a release tag, draft, or `release/<version>`
branch.

Root `package.json` holds the release version. A release is a deliberate bump:
an unchanged version gives a clean, green no-op run.

## Artifact set

One release produces, from one build and one commit:

- The canonical npm package `@mifune/agro` (the `agro` executable, from `.agro/cli`).
  The `@mifune/openharness` shim source remains at `.agro/cli/legacy/` and
  already-published shim versions remain on the registry. The release path does
  not publish, wait for, or deprecate the shim.
- Four immutable GHCR tags: `ghcr.io/mifunedev/openharness:<version>`,
  `:sha-<sha>`, `ghcr.io/mifunedev/agro:<version>`, and `:sha-<sha>`, verified to
  share one manifest digest (`.agro/scripts/verify-release-aliases.sh`), then
  `latest` on both repositories (`.agro/scripts/promote-release-latest.sh`).
- Four GitHub Release assets: `agro.js`, `oh.js`, `get-agro.sh`, and `get-oh.sh`,
  attached before the release is undrafted so
  `releases/latest/download/<asset>` resolves on publication.

## Version sites

A release cut bumps the canonical version in two places, and `version-parity.sh`
fails the build when they drift:

1. `package.json` (root).
2. `.agro/cli/package.json` and `.agro/cli/package-lock.json`.

The retained shim at `.agro/cli/legacy/package.json` keeps its own `version` and
an exact `@mifune/agro` pin that equals that shim version. The shim version does
not have to match a later canonical version. `agro-legacy-shim.sh` checks that
internal coherence.

## Operator prerequisites this repository cannot verify

- The npm token has publish rights for the `@mifune` scope, including the
  `@mifune/agro` package name.
- The GHCR package `mifunedev/agro` is set to public after its first push. A new
  GHCR package is private by default, so `agro sandbox install docker` cannot
  pull it until the operator changes the visibility.
- The compatibility SLA clock starts at the first public AGRO release, that is,
  the first release that publishes `@mifune/agro` and `ghcr.io/mifunedev/agro`.
- The docs-site dispatch token exists. The `notify-docs` job reads the secret
  `AGRO_WEB_DISPATCH_TOKEN` from the release repository (`mifunedev/agro`) and sends
  `repository_dispatch` to the docs repository. When the secret is absent the job
  prints a `::notice::` line and exits green without a dispatch. Issue a fine-grained
  personal access token for the docs repository with **Contents: Read and write**
  (`repository_dispatch` requires `contents: write`; a classic token needs the
  `repo` scope), then store it from a file, never from the command line:

  ```bash
  gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro < token-file
  ```

- The docs repository target is the repository variable `AGRO_WEB_REPO`, default
  `mifunedev/openharness-web`. After the docs repository is renamed, point it at
  the new name:

  ```bash
  gh variable set AGRO_WEB_REPO --repo mifunedev/agro --body mifunedev/agro-web
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

Require all of the following before a release push:

- The working tree is clean.
- The source commit is pushed to the canonical remote.
- CI for the source commit is green.
- Root `package.json` names the version to publish, `.agro/cli/package.json`
  matches it (`bash .agro/evals/probes/version-parity.sh`), the retained shim
  stays internally coherent (`bash .agro/evals/probes/agro-legacy-shim.sh`), and
  no `v<version>` tag exists yet. An unbumped push is a green no-op that publishes
  nothing. A newly published `@mifune/openharness` version is not required.
- `CHANGELOG.md` has a `## [<version>]` section matching that version (the
  workflow falls back to `[Unreleased]` when the section is absent).
- The remote release branch is an ancestor of the source commit, so promotion is
  a fast-forward.

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

If `$ARGUMENTS` contains `--dry-run`, report the resolved repo, source, target,
SHA, clean-tree result, and fast-forward result, then stop without pushing.

## 3. Trigger the release

Promote the exact checked source SHA. The branch push—not a manually created
tag—is the release trigger.

```bash
git push "$REMOTE" "$SHA:refs/heads/$TARGET"
```

The workflow reads the version from root `package.json` on the pushed commit, so
retries always resolve the same version. A retry reuses a same-SHA draft or
published release. When the tag already exists on a different commit, the reserve
step reports the version as already released and every publication job skips —
the run stays green. Bump the version to publish again.

## 4. Monitor and verify

Find the `release.yml` push run for `$SHA` and `$TARGET`, then watch it:

```bash
gh run list --repo "$REPO" --workflow release.yml --branch "$TARGET" \
  --commit "$SHA" --event push --limit 5 \
  --json databaseId,headSha,status,conclusion,url
# Once the matching run appears:
gh run watch <run-id> --repo "$REPO" --exit-status
```

After success, fetch tags and identify the SemVer tag pointing to the exact SHA,
then verify the four immutable image tags, the canonical npm package, the release
assets, and the GitHub Release. The tag carries the `v` prefix; the image tags
do not. A newly published `@mifune/openharness` version is not a release gate.
Automatic `notify-docs` dispatch is not the only documentation acceptance path.

```bash
git fetch "$REMOTE" --tags
TAG=$(git tag --points-at "$SHA" \
  | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
  | sort -V | tail -1)
test -n "$TAG" || { echo "No SemVer tag found for $SHA" >&2; exit 1; }
gh release view "$TAG" --repo "$REPO" --json assets -q '.assets[].name'
.agro/scripts/verify-release-aliases.sh check \
  "ghcr.io/mifunedev/openharness:${TAG#v}" "ghcr.io/mifunedev/agro:${TAG#v}"
npm view "@mifune/agro@${TAG#v}" version
printf 'Images: ghcr.io/mifunedev/{openharness,agro}:%s and :sha-%s\n' "${TAG#v}" "$SHA"
```

The asset list must name `agro.js`, `oh.js`, `get-agro.sh`, and `get-oh.sh`.

The canonical mutable/latest branch is `main` when it exists, otherwise
`master`. Immediately before promotion, the workflow freshly reads both remote
refs and promotes the canonical head's versioned image to `latest` by immutable
digest. Stale canonical runs and every noncanonical-branch run skip `latest`;
GitHub's `make_latest` flag uses the same rule after a second fresh check.

After `finalize` succeeds on a real release, `notify-docs` sends
`repository_dispatch` with `event_type: agro-release` and
`client_payload: { ref: <released sha> }` to `AGRO_WEB_REPO`. The docs site's
`pages.yml` reads `client_payload.ref` and rebuilds its mirrored installers from
that commit. Confirm the dispatch landed:

```bash
gh run list --repo "${AGRO_WEB_REPO:-mifunedev/openharness-web}" \
  --workflow pages.yml --event repository_dispatch --limit 3 \
  --json databaseId,status,conclusion,createdAt,url
```

A skipped `notify-docs` step with the `::notice::` line means the secret is not
set; the daily schedule in `pages.yml` still refreshes the mirror.
