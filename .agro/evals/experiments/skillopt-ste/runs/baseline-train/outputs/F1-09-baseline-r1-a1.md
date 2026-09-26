---
title: "Contributing"
---

# Contributing to AGRO

This guide covers the AGRO contribution workflow. The workflow has four parts: branches, commits, changelog entries, and releases.

The root [`CONTRIBUTING.md`](../CONTRIBUTING.md) holds the inbound license terms and the Developer Certificate of Origin (DCO).

## Setup

Prepare each contribution **inside a sandbox**. Do not prepare a contribution from a host-side source checkout.
The host needs the same tools as any other install: Docker (with `docker compose`),
`git`, and Node.js ≥ 20. Node.js runs the `agro` CLI. For CLI installation, read
[Installation → Get the CLI](./installation.md#get-the-cli-agro).

### Provision the sandbox

Run every lifecycle command through `agro` on the host:

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

A fresh sandbox contains no Herdr, because the sandbox installs nothing at boot.
After `agro shell`, install and start Herdr. Do this step before any other setup inside the sandbox:

```bash
agro tool install herdr
herdr
```

Next, complete GitHub authentication from the first Herdr pane. Authentication lets `git push` and `gh` work
inside the container. Run the three commands in order. Before you continue, confirm that `gh auth status` shows the correct account.
[GitHub auth](./integrations/github.md) gives the full procedure:

```bash
gh auth login
gh auth setup-git
gh auth status
```

Next, install each agent from a Herdr pane. The image contains no agent:

```bash
agro harness install claude-code   # claude
agro harness install codex         # codex
agro harness install pi            # pi
```

### Get the source into the sandbox

In a Herdr pane inside the sandbox, clone the repository:

```bash
git clone --recurse-submodules https://github.com/mifunedev/agro.git
cd agro
```

If the sandbox already holds your own workspace, do not replace the workspace. Follow these steps:

1. Fetch an upstream ref from the canonical repository.
2. Run `git merge-base --is-ancestor` against the fetched upstream ref. The result shows whether your workspace shares history with the canonical repository.
3. If the workspace shares history, add an `upstream` remote. Create your branch from `upstream`. Do not change your private `origin`.
4. If the workspace does not share history, make a separate ordinary clone inside the sandbox, as shown above. Move only the changes that you select into the new clone.

Keep private configuration, credentials, and unrelated files out of the contribution. The
[contribution prompt](./quickstart.md#optional-prompt--prepare-an-agro-contribution) walks
an authenticated agent through the same decision.

A checkout from before the AGRO cutover carries `.agro/` and `agro.json`. The `.agro/` directory and the `agro.json` file still resolve. To migrate the checkout, do these steps in order:

1. Run `agro migrate --check`.
2. Run `agro migrate`.

### Local validation

For routine development, use the fast harness build:

```bash
pnpm run build          # fast non-docs build
pnpm run test:scripts   # root script + .pi extension tests
bash .agro/skills/eval/run.sh
```

The [`mifunedev/agro-web`](https://github.com/mifunedev/agro-web) repository maintains the rendered docs site. No Docusaurus build runs in this core repository. To validate docs here, check the Markdown links and the GitHub-readable index at `docs/README.md`.

### Multi-agent messaging (Slack)

The [`pi-messenger-bridge`](https://github.com/tintinweb/pi-messenger-bridge) npm package connects Slack and other messengers to a Pi agent.
The harness installs the package into the gitignored `.pi/bridge/` directory.
The harness loads the package with `--extension` only in the dedicated `client-slack-pi` tmux session.
The script `.agro/scripts/gateway.sh` manages that tmux session.
Do not run `pi install` yourself. [Slack integration](./integrations/slack.md) gives the full setup: tokens, trust, and the sibling Hermes gateway.

## Branch Naming

Name each feature branch in the format `<prefix>/<issue#>-<short-desc>`.

Prefixes: `feat` · `bug` · `task`

Short description: kebab-case, 5 words or fewer.

Example:

```
feat/42-slack-thread-replies
```

Create your branch from the default branch. If the `development` branch exists, the default branch is `development`. If `development` does not exist, the default branch is `main`:

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

If a pull request has user-visible impact, the pull request must add an entry to `CHANGELOG.md` under `## [Unreleased]`. Put the entry in the same commit as your change.

Categories: `### Added` · `### Changed` · `### Fixed` · `### Removed` · `### Deprecated` · `### Security`

Format: one line, imperative mood, with a link to your PR or issue.

Example:

```markdown
### Added
- Slack thread replies in multi-channel mode ([#42](https://github.com/mifunedev/agro/pull/42)).
```

Skip the CHANGELOG entry only for a pure chore with no runtime effect and no workflow effect. Refactors, test fixes, and typo fixes are chores. If you cannot decide, add an entry.

## Pull Requests

Target the default branch (`development`). Use the literal title format `FROM <source-branch> TO <target-branch>`.

Example:

```
FROM feat/42-slack-thread-replies TO development
```

Link the issue with a closing keyword in the title or in the body:

```
Closes #42
```

The keywords `Closes`, `Fixes`, and `Resolves` all work. Their grammatical variants also work:
`Closed`, `Fixed`, and `Resolved`. List every issue that the pull request completes.
Write one keyword for each issue. A bare `#42` links the issue but does not close the issue.

When the pull request merges into `development`, the workflow
[`.github/workflows/close-issues-on-development.yml`](../.github/workflows/close-issues-on-development.yml)
closes each referenced issue as `completed`. If you close the pull request without
a merge, no issue closes. A pull request from a fork gets a read-only
token. For a fork pull request, close each linked issue by hand.

Create the PR:

```bash
gh pr create --base development \
  --title "FROM feat/42-slack-thread-replies TO development" \
  --body "Closes #42"
```

## Releases

AGRO uses SemVer versions in the format `MAJOR.MINOR.PATCH`. Each release tag has the format
`vMAJOR.MINOR.PATCH`. The root `package.json` holds the release version.
The canonical CLI package and the CLI lockfile must match that version.

A release comes only from a deliberate version bump. A push alone does not make a release. Every push to
`main` or `master` runs `.github/workflows/release.yml`. The workflow validates the
commit. Then the workflow publishes the version that `package.json` names. The workflow runs these steps in order:

1. The workflow runs validation, boot-path lint, and the eval probe suite. All three must pass before the next step.
2. The workflow reads the version from the root `package.json`.
3. The workflow creates `refs/tags/v<version>`. This atomic step reserves the version.
4. The workflow builds the image.
5. The workflow smoke-tests the image.
6. The workflow pushes the GHCR image tags `:<version>` and `:sha-<SHA>`. Both tags are bare. The `v`
   prefix belongs to the git tag, not to the registry.
7. The workflow promotes `latest` by immutable digest from the canonical branch.
8. The workflow publishes the CLI.
9. The workflow publishes the GitHub Release.

To cut a release, do these steps in order:

1. Set the same version in the root `package.json`, in `.agro/cli/package.json`, and in `<CLI lockfile path>`.
2. In the same PR, add the matching `## [<version>]` section to `CHANGELOG.md`.
3. Promote `development` to `main`.

If you push to `main` without a version bump, the run is a clean, **green** no-op. The reserve step reports the version as already
released, and the workflow skips every publication job.

Do **not** manually create a release tag or a `release/<version>` branch in advance.

Inside the orchestrator sandbox, run the release skill:

```bash
/release
```

For the full workflow, read the `git` and `release` skills in `.agro/skills/`.

### Release helpers

`.github/workflows/release.yml` drives the release scripts in `.agro/scripts/`.
`reserve-github-release.mjs` uses the GitHub API user agent `agro-release-reservation`.
The smoke sandbox name is `agro-release-smoke-<run id>`.
`promote-release-latest.sh` sets the default of `IMAGE_REPOSITORIES` to
`ghcr.io/mifunedev/agro ghcr.io/mifunedev/agro`.
The legacy image alias must match the `agro` digest.
The GHCR package `mifunedev/agro` must be public. Until the package is public, consumers cannot pull its tags.

### Documentation notification

After the `finalize` job of a real release succeeds, the `notify-docs` job sends `repository_dispatch`:

| Field | Value |
| --- | --- |
| Repository | `AGRO_WEB_REPO`, default `mifunedev/agro-web`. |
| Event type | `agro-release`. |
| Payload | `{ "ref": "<released sha>" }`, from `needs.reserve.outputs.releaseSha`. |
| Credential | `AGRO_WEB_DISPATCH_TOKEN`, passed as `GH_TOKEN`. |

The token needs Contents read/write access on the docs repository.
A classic token needs the `repo` scope.
If the secret is absent, the `notify-docs` job prints a notice and exits 0. The job sends no dispatch.
Do not place the token value in shell history or logs.
To configure the notification, run these commands. The first command uploads the token from a file. The second command sets the destination repository:

```bash
gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro < token-file
gh variable set AGRO_WEB_REPO --repo mifunedev/agro --body mifunedev/agro-web
```

---

For the canonical workflow, read the `git` skill (`.agro/skills/git/SKILL.md`)
in the repository.
