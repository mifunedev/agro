---
title: "Contributing"
---

# Contributing to AGRO

This guide covers the workflow for contributing to AGRO: creating branches, writing commits, updating the changelog, and shipping releases.

For the inbound license terms and the Developer Certificate of Origin (DCO), see the root [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Setup

Prepare each contribution inside a sandbox. Do not prepare a contribution from a host-side source checkout.
The host needs Docker (with `docker compose`), `git`, and Node.js 20 or later to run the `agro` CLI. See
[Installation → Get the CLI](./installation.md#get-the-cli-agro) for install steps.

### Provision the sandbox

Run all lifecycle commands through `agro`:

```bash
agro sandbox install docker   # write the registry entry and start the sandbox
agro shell <name>             # enter the sandbox as the `sandbox` user
agro ps <name>                # show service status
agro logs <name>              # tail compose logs
agro stop <name>              # stop the sandbox, preserving volumes
agro destroy <name>           # stop and remove the sandbox (volumes wiped)
agro restart <name>           # restart the service
agro --help                   # list every verb
```

### Onboard inside the sandbox

After you run `agro shell`, install and start Herdr before any other inside-sandbox setup step.
A fresh sandbox has no agents or tools installed, because nothing installs at boot:

```bash
agro tool install herdr
herdr
```

From the initial Herdr pane, complete GitHub authentication so `git push` and `gh` work
inside the container. Run the checks below in order. Confirm the account before you
continue. See [GitHub auth](./integrations/github.md) for details:

```bash
gh auth login
gh auth setup-git
gh auth status
```

Then install and start agents from Herdr panes. The sandbox image bakes in no agents:

```bash
agro harness install claude-code   # claude
agro harness install codex         # codex
agro harness install pi            # pi
```

### Get the source into the sandbox

In a Herdr pane, clone the repository inside the sandbox:

```bash
git clone --recurse-submodules https://github.com/mifunedev/agro.git
cd agro
```

If this sandbox already holds your own workspace, do not replace it. Check whether the
workspace shares history with the canonical repository (`git merge-base --is-ancestor`
against a fetched upstream ref). When the workspace shares history, add an `upstream`
remote, then branch from `upstream`. Do not change your `origin` remote. When the
workspace does not share history, create a separate clone inside the sandbox, as shown
above. Move only the changes you select into that clone. Keep private configuration,
credentials, and unrelated files out of the contribution. The
[contribution prompt](./quickstart.md#optional-prompt--prepare-an-agro-contribution) walks
an authenticated agent through the same decision.

A checkout created before the AGRO cutover carries `.agro/` and `agro.json`. Both files
still resolve. Run `agro migrate --check` first. Then run `agro migrate` to move the
checkout.

### Local validation

For local development, run the fast harness build:

```bash
pnpm run build          # fast non-docs build
pnpm run test:scripts   # root script + .pi extension tests
bash .agro/skills/eval/run.sh
```

The [`mifunedev/agro-web`](https://github.com/mifunedev/agro-web) repository maintains
the rendered docs site. In this repository, validate docs changes by checking the
Markdown links and the GitHub-readable index at `docs/README.md`. This repository runs
no Docusaurus build.

### Multi-agent messaging (Slack)

The [`pi-messenger-bridge`](https://github.com/tintinweb/pi-messenger-bridge) npm package
bridges Slack and other messengers to a Pi agent. The harness installs
`pi-messenger-bridge` into the gitignored `.pi/bridge/` directory. The harness loads
`pi-messenger-bridge` with `--extension` only inside the dedicated `client-slack-pi`
tmux session, managed by `.agro/scripts/gateway.sh`. Do not run `pi install` yourself.
See [Slack integration](./integrations/slack.md) for full setup: tokens, trust, and the
sibling Hermes gateway.

## Branch Naming

All feature branches follow the format `<prefix>/<issue#>-<short-desc>`.

Prefixes: `feat` · `bug` · `task`

Short description: kebab-case, maximum 5 words.

Example:

```
feat/42-slack-thread-replies
```

If `development` exists, create your branch from `development`. If `development` does
not exist, create your branch from `main`:

```bash
git checkout -b feat/42-slack-thread-replies development
```

## Commit Messages

Commit format: `<type>: <description>`

Types: `feat` · `fix` · `task`

Example:

```
feat: add Slack thread replies for multi-channel mode
```

## CHANGELOG Entries

If your pull request has user-visible impact, add an entry to `CHANGELOG.md` under
`## [Unreleased]` in the same commit as your change.

Categories: `### Added` · `### Changed` · `### Fixed` · `### Removed` · `### Deprecated` · `### Security`

Format: one line, imperative mood, link to your PR or issue.

Example:

```markdown
### Added
- Slack thread replies in multi-channel mode ([#42](https://github.com/mifunedev/agro/pull/42)).
```

Skip the CHANGELOG entry only for a pure chore with no runtime or workflow effect, such
as a refactor, a test fix, or a typo fix. If you are unsure whether a change needs an
entry, add the entry.

## Pull Requests

Target the default branch, `development`, in the pull request. Use the title format
`FROM <source-branch> TO <target-branch>`, written literally.

Example:

```
FROM feat/42-slack-thread-replies TO development
```

Link the issue in the title or the body with a closing keyword:

```
Closes #42
```

The keywords `Closes`, `Fixes`, and `Resolves` all work. Each grammatical variant also
works: `Closed`, `Fixed`, `Resolved`. List every issue that the pull request completes,
one keyword per issue. A bare `#42` links the issue but does not close the issue.

When the pull request merges into `development`, the workflow
[`.github/workflows/close-issues-on-development.yml`](../.github/workflows/close-issues-on-development.yml)
closes each referenced issue as `completed`. If you close the pull request without
merging it, no issue closes. A pull request opened from a fork receives a read-only
GitHub token from the workflow. Close the fork pull request's referenced issue by hand.

Create the PR:

```bash
gh pr create --base development \
  --title "FROM feat/42-slack-thread-replies TO development" \
  --body "Closes #42"
```

## Releases

AGRO uses SemVer versioning: `MAJOR.MINOR.PATCH`, tagged
`vMAJOR.MINOR.PATCH`. Root `package.json` holds the release version.
The canonical CLI package and its lockfile must match that version.

You create a release with a deliberate version bump, not as a side effect of a push.
Every push to `main` or `master` runs `.github/workflows/release.yml`. The workflow
validates the commit, then publishes the version that `package.json` names:

1. The workflow runs validation, boot-path lint, and the eval probe suite. All three
   must pass before the workflow continues.
2. The workflow reads the version from root `package.json`.
3. The workflow creates the tag `refs/tags/v<version>` to reserve the version. Tag
   creation is atomic.
4. The workflow builds the image.
5. The workflow smoke-tests the image.
6. The workflow pushes the GHCR image tags `:<version>` and `:sha-<SHA>`, both without
   the `v` prefix. The `v` prefix belongs to the git tag, not to the registry tag.
7. The workflow promotes `latest` by immutable digest from the canonical branch.
8. The workflow publishes the CLI.
9. The workflow publishes the GitHub Release.

To cut a release:

1. Update root `package.json`, `.agro/cli/package.json`, and the lockfile to the same
   version.
2. Add the matching `## [<version>]` section to `CHANGELOG.md`, in the same pull
   request.
3. Promote `development` to `main`.

If you push to `main` without bumping the version, the workflow run exits green as a
no-op. The reserve step reports the version as already released. Every publication job
skips.

Do not pre-create a release tag or a `release/<version>` branch.

Run the release skill from inside the orchestrator sandbox:

```bash
/release
```

For the full workflow, see the `git` and `release` skills in `.agro/skills/`.

### Release helpers

`.github/workflows/release.yml` drives the release scripts in `.agro/scripts/`.
`reserve-github-release.mjs` uses the GitHub API user agent `agro-release-reservation`.
The smoke sandbox name is `agro-release-smoke-<run id>`.
`promote-release-latest.sh` defaults `IMAGE_REPOSITORIES` to
`ghcr.io/mifunedev/agro ghcr.io/mifunedev/agro`.
The `agro` digest is the reference that the legacy image alias must match.
Set the GHCR package `mifunedev/agro` to public. Otherwise, consumers cannot pull its
tags.

### Documentation notification

After the `finalize` job of a real release succeeds, the `notify-docs` job sends a
`repository_dispatch` event:

| Field | Value |
| --- | --- |
| Repository | `AGRO_WEB_REPO`, default `mifunedev/agro-web`. |
| Event type | `agro-release`. |
| Payload | `{ "ref": "<released sha>" }`, from `needs.reserve.outputs.releaseSha`. |
| Credential | `AGRO_WEB_DISPATCH_TOKEN`, passed as `GH_TOKEN`. |

The token needs Contents read/write access on the docs repository.
A classic token needs the `repo` scope.
If the secret is absent, the `notify-docs` job prints a notice and exits with code 0,
and sends no dispatch.
Set the destination repository variable. Then upload the token from a file:

```bash
gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro < token-file
gh variable set AGRO_WEB_REPO --repo mifunedev/agro --body mifunedev/agro-web
```

Do not place the token value in shell history or logs.

---

For the canonical workflow, see the `git` skill at `.agro/skills/git/SKILL.md`.
