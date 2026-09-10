#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: promote-release-latest.sh <check|promote>" >&2
  exit 64
}

MODE=${1:-}
case "$MODE" in
  check|promote) ;;
  *) usage ;;
esac

: "${RELEASE_BRANCH:?RELEASE_BRANCH is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"

if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "RELEASE_SHA must be a full lowercase 40-character commit SHA" >&2
  exit 64
fi

REMOTE=${RELEASE_REMOTE:-origin}
REFS=$(git ls-remote --heads "$REMOTE" refs/heads/main refs/heads/master)
main_sha=""
master_sha=""
while IFS=$'\t' read -r sha ref; do
  case "$ref" in
    refs/heads/main)
      [[ -z "$main_sha" ]] || { echo "duplicate main ref returned by $REMOTE" >&2; exit 1; }
      main_sha=$sha
      ;;
    refs/heads/master)
      [[ -z "$master_sha" ]] || { echo "duplicate master ref returned by $REMOTE" >&2; exit 1; }
      master_sha=$sha
      ;;
    "") ;;
    *) echo "unexpected ref returned by $REMOTE: $ref" >&2; exit 1 ;;
  esac
done <<< "$REFS"

if [[ -n "$main_sha" ]]; then
  canonical_branch=main
  canonical_sha=$main_sha
elif [[ -n "$master_sha" ]]; then
  canonical_branch=master
  canonical_sha=$master_sha
else
  echo "neither main nor master exists on $REMOTE" >&2
  exit 1
fi

if [[ ! "$canonical_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "$REMOTE returned an invalid $canonical_branch SHA: $canonical_sha" >&2
  exit 1
fi

make_latest=false
if [[ "$RELEASE_BRANCH" == "$canonical_branch" && "$RELEASE_SHA" == "$canonical_sha" ]]; then
  make_latest=true
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'canonicalBranch=%s\n' "$canonical_branch"
    printf 'canonicalSha=%s\n' "$canonical_sha"
    printf 'makeLatest=%s\n' "$make_latest"
  } >> "$GITHUB_OUTPUT"
fi

if [[ "$MODE" == check ]]; then
  printf 'canonical=%s head=%s release_branch=%s release_sha=%s make_latest=%s\n' \
    "$canonical_branch" "$canonical_sha" "$RELEASE_BRANCH" "$RELEASE_SHA" "$make_latest"
  exit 0
fi

if [[ "$make_latest" != true ]]; then
  printf 'Skipping latest: canonical=%s head=%s release_branch=%s release_sha=%s\n' \
    "$canonical_branch" "$canonical_sha" "$RELEASE_BRANCH" "$RELEASE_SHA"
  exit 0
fi

: "${RELEASE_VERSION:?RELEASE_VERSION is required for promote mode}"
if [[ ! "$RELEASE_VERSION" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "RELEASE_VERSION must be a SemVer version (MAJOR.MINOR.PATCH)" >&2
  exit 64
fi

IMAGE_REPOSITORIES=${IMAGE_REPOSITORIES:-ghcr.io/mifunedev/agro ghcr.io/mifunedev/openharness}
read -r -a repositories <<< "$IMAGE_REPOSITORIES"
if (( ${#repositories[@]} == 0 )); then
  echo "IMAGE_REPOSITORIES must name at least one image repository" >&2
  exit 64
fi

version_digest() {
  local version_image=$1 inspection digest="" line
  inspection=$(docker buildx imagetools inspect "$version_image")
  while IFS= read -r line; do
    if [[ "$line" =~ ^Digest:[[:space:]]+(sha256:[0-9a-f]{64})[[:space:]]*$ ]]; then
      [[ -z "$digest" ]] || { echo "multiple top-level digests returned for $version_image" >&2; return 1; }
      digest=${BASH_REMATCH[1]}
    fi
  done <<< "$inspection"
  if [[ -z "$digest" ]]; then
    echo "docker did not return one valid top-level digest for $version_image" >&2
    return 1
  fi
  printf '%s\n' "$digest"
}

digests=()
for repository in "${repositories[@]}"; do
  digests+=("$(version_digest "${repository}:${RELEASE_VERSION}")")
done

for index in "${!repositories[@]}"; do
  if [[ "${digests[$index]}" != "${digests[0]}" ]]; then
    echo "refusing to promote latest: ${repositories[0]}:${RELEASE_VERSION} is ${digests[0]} but ${repositories[$index]}:${RELEASE_VERSION} is ${digests[$index]}" >&2
    exit 1
  fi
done

for index in "${!repositories[@]}"; do
  version_image="${repositories[$index]}:${RELEASE_VERSION}"
  latest_image="${repositories[$index]}:latest"
  docker buildx imagetools create --tag "$latest_image" "${version_image}@${digests[$index]}"
  printf 'Promoted %s@%s to %s from canonical %s\n' \
    "$version_image" "${digests[$index]}" "$latest_image" "$canonical_branch"
done
