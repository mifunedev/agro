---
title: "Contributing"
---

# Contributing to AGRO

This guide covers the workflow for contributing to AGRO: creating branches, writing commits, updating the changelog, and shipping releases.

For the inbound license terms and the Developer Certificate of Origin (DCO), see the root [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Setup

The operator prepares contributions inside a sandbox, not from a host-side source checkout.
Host requirements are the same as any other install: Docker (with `docker compose`),
`git`, and Node.js ≥ 20 to run the `agro` CLI. See
[Installation → Get the CLI](./installation.md#get-the-cli-agro).

### Provision the sandbox

`agro` drives the lifecycle entirely:

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

After you run `agro shell`, install and start Herdr before any other inside-sandbox setup.
A fresh sandbox has no tools installed, because nothing installs at boot:

```bash
agro tool install herdr
herdr
```

From the initial Herdr pane, complete GitHub authentication so `git push` and `gh` work
from within the container. Run the checks in order. Confirm the account before you
continue — details in [GitHub auth](./integrations/github.md):

```bash
gh auth login
gh auth setup-git
gh auth status
```

Then install and start agents from Herdr panes. The image bakes in no agents:

```bash
agro harness install claude-code   # claude
agro harness install codex         # codex
agro harness install pi            # pi
```

### Get the source into the sandbox

Inside the sandbox, in a Herdr pane, clone the repository:

```bash
git clone --recurse-submodules https://github.com/mifunedev/agro.git
cd agro
```

If this sandbox already holds your own workspace, do not replace it. Follow these steps
instead:

1. Check whether the workspace shares history with the canonical repository. Run
   `git merge-base --is-ancestor` against a fetched upstream ref.
2. When the workspace shares history with the canonical repository, add an `upstream`
   remote. Branch from `upstream` without touching your private `origin`.
3. When the workspace does not share history with the canonical repository, create a
   separate ordinary clone inside the sandbox, as shown above. Move only the changes
   you select into that clone.
4. Keep private configuration, credentials, and unrelated files out of the contribution.

The [contribution prompt](./quickstart.md#optional-prompt--prepare-an-agro-contribution)
walks an authenticated agent through the same decision.

A checkout created before the AGRO cutover contains `.agro/` and `agro.json`. Both paths
still resolve. Run `agro migrate --check`, then run `agro migrate` to migrate the checkout.

### Local validation

Use the fast harness build for routine development:

```bash
pnpm run build          # fast non-docs build
pnpm run test:scripts   # root script + .pi extension tests
bash .agro/skills/eval/run.sh
```

The [`mifunedev/agro-web`](https://github.com/mifunedev/agro-web) repository maintains
the rendered docs site. In this core repository, validate docs by checking the Markdown
links and the GitHub-readable index at `docs/README.md`. No Docusaurus build runs in
this repository.

### Multi-agent messaging (Slack)

Slack, and other messengers, bridge to a Pi agent through the
[`pi-messenger-bridge`](https://github.com/tintinweb/pi-messenger-bridge) npm package.
The harness installs the package into a gitignored `.pi/bridge/` directory. The harness
loads the package with `--extension`, only inside the dedicated `client-slack-pi` tmux
session, which `.agro/scripts/gateway.sh` manages. You do not run `pi install` yourself.
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

Create the branch from the default target branch: `development` if it exists, otherwise
`main`.

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

For every pull request with user-visible impact, add an entry to `CHANGELOG.md` under
`## [Unreleased]`, in the same commit as the change.

Categories: `### Added` · `### Changed` · `### Fixed` · `### Removed` · `### Deprecated` · `### Security`

Format: one line, imperative mood, link to your PR or issue.

Example:

```markdown
### Added
- Slack thread replies in multi-channel mode ([#42](https://github.com/mifunedev/agro/pull/42)).
```

Skip the CHANGELOG entry only for a pure chore with no runtime or workflow effect, such
as a refactor, a test fix, or a typo correction. If the change does not clearly qualify
as a pure chore, add an entry.

## Pull Requests

Target the default branch, `development`. The pull request title uses the literal format
`FROM <source-branch> TO <target-branch>`.

Example:

```
FROM feat/42-slack-thread-replies TO development
```

In the title or the body, link the issue with a closing keyword:

```
Closes #42
```

`Closes`, `Fixes`, and `Resolves` all work. Each grammatical variant also works:
`Closed`, `Fixed`, `Resolved`. List every issue the pull request completes, one keyword
per issue. A bare `#42` links the issue. A bare `#42` does not close the issue.

When the pull request merges into `development`, the workflow
[`.github/workflows/close-issues-on-development.yml`](../.github/workflows/close-issues-on-development.yml)
closes each referenced issue as `completed`. Closing the pull request without merging it
closes no issue. A pull request opened from a fork gets a read-only token. For a
fork-opened pull request, close the referenced issue by hand.

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

A release is a deliberate bump, not a side effect of a push. Every push to
`main` or `master` runs `.github/workflows/release.yml`, which validates the
commit, then publishes the version `package.json` names:

1. Validation, boot-path lint, and the eval probe suite must pass first
2. The workflow reads the version from root `package.json`
3. Creating `refs/tags/v<version>` reserves the version — this act is atomic
4. Build and smoke-test the image
5. Push the GHCR image tags `:<version>` and `:sha-<SHA>`, both bare — the `v`
   prefix belongs to the git tag, not to the registry
6. Promote `latest` by immutable digest from the canonical branch
7. Publish the CLI
8. Publish the GitHub Release

To cut a release, follow these steps:

1. Update root `package.json`, `.agro/cli/package.json`, and its lockfile to the same
   version.
2. Add the matching `## [<version>]` section to `CHANGELOG.md`, in the same PR.
3. Promote `development` to `main`.

If you push to `main` without bumping the version, the run is a clean, **green** no-op:
the reserve step reports the version as already released, and every publication job
skips.

Do **not** manually pre-create a release tag or a `release/<version>` branch.

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
The GHCR package `mifunedev/agro` must be public before consumers can pull its tags.

### Documentation notification

After a real release's `finalize` succeeds, `notify-docs` sends `repository_dispatch`:

| Field | Value |
| --- | --- |
| Repository | `AGRO_WEB_REPO`, default `mifunedev/agro-web`. |
| Event type | `agro-release`. |
| Payload | `{ "ref": "<released sha>" }`, from `needs.reserve.outputs.releaseSha`. |
| Credential | `AGRO_WEB_DISPATCH_TOKEN`, passed as `GH_TOKEN`. |

The token needs Contents read/write access on the docs repository.
A classic token needs the `repo` scope.
If the secret is absent, the `notify-docs` job prints a notice. The job then exits with
code 0 without dispatching.
Set the destination and upload the token from a file:

```bash
gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro < token-file
gh variable set AGRO_WEB_REPO --repo mifunedev/agro --body mifunedev/agro-web
```

Do not place the token value in shell history or logs.

---

Need to dive deeper? See the `git` skill (`.agro/skills/git/SKILL.md`)
in the repo for the canonical workflow.
