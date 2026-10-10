---
title: "Contributing"
---

# Contributing to AGRO

This guide gives the branch, commit, changelog, and pull-request rules for an
AGRO contribution. The license terms and the Developer Certificate of Origin
are in the root [`CONTRIBUTING.md`](../CONTRIBUTING.md). The full git workflow is
in `.agro/skills/git/SKILL.md`.

## Setup

Prepare a contribution inside a sandbox, not in a checkout on the host. To
create the sandbox, follow [Installation](./installation.md#get-the-cli-agro) and
the [Quickstart](./quickstart.md). After `agro shell <name>`, start Herdr first:

```bash
agro tool install herdr
herdr
```

In a Herdr pane, authenticate GitHub and confirm the account:

```bash
gh auth login
gh auth setup-git
gh auth status
```

Clone the repository in a Herdr pane:

```bash
git clone https://github.com/mifunedev/agro.git
cd agro
```

When the sandbox already holds your own workspace, keep that workspace. The
[contribution prompt](./quickstart.md#optional-prompt--prepare-an-agro-contribution)
tells an agent how to add an `upstream` remote or how to use a separate clone.

## Local validation

Run the build and the full test suite from the repository root:

```bash
pnpm run build
pnpm test
```

`docs/` is the documentation source. Check the Markdown links and the index
at `docs/README.md`.

## Property Tests

Property tests use the `*.property.test.ts` naming convention and live in
`.agro/scripts/__tests__/` beside the example tests for the same module. They
assert an invariant over generated inputs, with [fast-check](https://fast-check.dev)
as the generator library. Run the full suite, including property tests, with
`pnpm test` from the repo root.

## Branch names

Name a branch `<prefix>/<issue#>-<short-desc>`. The prefix is `feat`, `bug`, or
`task`. The description is kebab-case, with five words or fewer. Branch from
`development`:

```bash
git checkout -b feat/42-slack-thread-replies development
```

## Commit messages

Write `<type>: <description>`. The type is `feat`, `fix`, or `task`:

```
feat: add Slack thread replies for multi-channel mode
```

## CHANGELOG entries

When a pull request changes runtime or workflow behavior, add one line to
`CHANGELOG.md` under `## [Unreleased]`, in the same commit. Use the categories
`### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Deprecated`, and
`### Security`. Write the line in the imperative mood, with a link to the pull
request or the issue.

## Pull requests

Target `development`. Write the title as `FROM <source-branch> TO <target-branch>`.
Close each issue with its own keyword in the body:

```bash
gh pr create --base development \
  --title "FROM feat/42-slack-thread-replies TO development" \
  --body "Closes #42"
```

`Closes`, `Fixes`, and `Resolves` work. A bare `#42` links the issue and does not
close the issue. When the pull request merges into `development`,
[`close-issues-on-development.yml`](../.github/workflows/close-issues-on-development.yml)
closes each linked issue. A pull request from a fork gets a read-only token, so
close its issue by hand.

## Releases

A release is a version bump that merges to `main`. The `release` skill
(`.agro/skills/release/SKILL.md`) owns the procedure, and
`.github/workflows/release.yml` publishes the image, the CLI, and the GitHub
Release. Do not create a release tag or a `release/<version>` branch by hand.
