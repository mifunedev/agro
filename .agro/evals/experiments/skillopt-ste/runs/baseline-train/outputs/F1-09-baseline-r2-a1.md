---
title: "Contributing"
---

# Contributing to AGRO

This guide covers the contribution workflow for AGRO. The workflow has four parts: create a branch, write commits, update the changelog, and ship a release.

The root [`CONTRIBUTING.md`](../CONTRIBUTING.md) holds the inbound license terms and the Developer Certificate of Origin (DCO).

## Setup

Prepare each contribution **inside a sandbox**, not in a source checkout on the host.
The host needs the same software as any other install: Docker (with `docker compose`),
`git`, and Node.js ≥ 20 to run the `agro` CLI. See
[Installation → Get the CLI](./installation.md#get-the-cli-agro).

### Provision the sandbox

The `agro` CLI controls the full sandbox lifecycle. Run these commands on the host:

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

A fresh sandbox has no Herdr, because the sandbox installs nothing at boot.
After `agro shell`, install and start Herdr before any other setup inside the sandbox:

```bash
agro tool install herdr
herdr
```

Next, authenticate with GitHub from the first Herdr pane.
This step lets `git push` and `gh` work inside the container.
Run the three commands in order.
Before you continue, confirm that `gh auth status` shows the correct account.
[GitHub auth](./integrations/github.md) gives the details:

```bash
gh auth login
gh auth setup-git
gh auth status
```

The image contains no coding agent.
Install each agent from a Herdr pane:

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

If this sandbox already holds your own workspace, do not replace that workspace.
Follow these steps instead:

1. Fetch an upstream ref from the canonical repository.
2. Run `git merge-base --is-ancestor` against the fetched ref.
   The result shows whether your workspace shares history with the canonical repository.
3. If the workspace shares history, add an `upstream` remote and branch from `upstream`.
   Do not change your private `origin`.
4. If the workspace does not share history, make a separate ordinary clone inside the sandbox, as shown above.
   Move only the changes that you select into the new clone.

Keep private configuration, credentials, and unrelated files out of the contribution.
The [contribution prompt](./quickstart.md#optional-prompt--prepare-an-agro-contribution)
guides an authenticated agent through the same decision.

A checkout that you set up before the AGRO cutover carries `.agro/` and `agro.json`.
Both paths still resolve. To migrate the checkout:

1. Run `agro migrate --check`.
2. Run `agro migrate`.

### Local validation

For routine development, use the fast harness build:

```bash
pnpm run build          # fast non-docs build
pnpm run test:scripts   # root script + .pi extension tests
bash .agro/skills/eval/run.sh
```

The [`mifunedev/agro-web`](https://github.com/mifunedev/agro-web) repository maintains the rendered docs site.
This core repository runs no Docusaurus build.
To validate docs here, check the Markdown links and the GitHub-readable index at `docs/README.md`.

### Multi-agent messaging (Slack)

The [`pi-messenger-bridge`](https://github.com/tintinweb/pi-messenger-bridge) npm package
connects Slack and other messengers to a Pi agent.
The harness installs the package into the gitignored `.pi/bridge/` directory.
The harness loads the package with `--extension` only in the dedicated `client-slack-pi` tmux session.
`.agro/scripts/gateway.sh` manages that session.
Do not run `pi install` yourself.
[Slack integration](./integrations/slack.md) gives the full setup: tokens, trust, and the sibling Hermes gateway.

## Branch Naming

Every feature branch uses the format `<prefix>/<issue#>-<short-desc>`.

Prefixes: `feat` · `bug` · `task`

Short description: kebab-case, 5 words at most.

Example:

```
feat/42-slack-thread-replies
```

Create your branch from the default target.
The default target is `development` if that branch exists. Otherwise, the default target is `main`:

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

If a pull request has user-visible impact, the pull request must add an entry to `CHANGELOG.md` under `## [Unreleased]`.
Add the entry in the same commit as your change.

Categories: `### Added` · `### Changed` · `### Fixed` · `### Removed` · `### Deprecated` · `### Security`

Format: one line, imperative mood, with a link to your pull request or issue.

Example:

```markdown
### Added
- Slack thread replies in multi-channel mode ([#42](https://github.com/mifunedev/agro/pull/42)).
```

Skip the CHANGELOG entry only for a pure chore with no runtime or workflow effect: a refactor, a test fix, or a typo fix.
If you cannot decide, add an entry.

## Pull Requests

Target the default branch (`development`).
Use the literal title format `FROM <source-branch> TO <target-branch>`.

Example:

```
FROM feat/42-slack-thread-replies TO development
```

To link the issue, put a closing keyword in the title or the body:

```
Closes #42
```

The keywords `Closes`, `Fixes`, and `Resolves` all work.
Each grammatical variant also works: `Closed`, `Fixed`, `Resolved`.
List every issue that the pull request completes, with one keyword for each issue.
A bare `#42` links the issue but does not close the issue.

When the pull request merges into `development`, the workflow
[`.github/workflows/close-issues-on-development.yml`](../.github/workflows/close-issues-on-development.yml)
closes each referenced issue as `completed`.
If you close the pull request without a merge, no issue closes.
A pull request from a fork gets a read-only token.
After a fork pull request merges, close each linked issue by hand.

Create the pull request:

```bash
gh pr create --base development \
  --title "FROM feat/42-slack-thread-replies TO development" \
  --body "Closes #42"
```

## Releases

AGRO uses SemVer versioning: `MAJOR.MINOR.PATCH`, with the git tag
`vMAJOR.MINOR.PATCH`. The root `package.json` holds the release version.
The canonical CLI package and its lockfile must match that version.

A release comes from a deliberate version bump, not from a side effect of a push.
Every push to `main` or `master` runs `.github/workflows/release.yml`.
The workflow validates the commit, then publishes the version that `package.json` names.
The workflow runs these steps in order:

1. The workflow runs validation, the boot-path lint, and the eval probe suite. All three must pass before the next step.
2. The workflow reads the version from the root `package.json`.
3. The workflow creates `refs/tags/v<version>`. This atomic act reserves the version.
4. The workflow builds the image and runs a smoke test on the image.
5. The workflow pushes the GHCR image tags `:<version>` and `:sha-<SHA>`.
   Both tags are bare: the `v` prefix belongs to the git tag, not to the registry.
6. The workflow promotes `latest` by immutable digest from the canonical branch.
7. The workflow publishes the CLI.
8. The workflow publishes the GitHub Release.

To cut a release:

1. Set the same version in the root `package.json`, `.agro/cli/package.json`, and `.agro/cli/package-lock.json`.
2. In the same pull request, add the matching `## [<version>]` section to `CHANGELOG.md`.
3. Promote `development` to `main`.

If you push to `main` without a version bump, the run is a clean, **green** no-op.
The reserve step reports the version as already released, and every publication job skips.

Do **not** create a release tag or a `release/<version>` branch by hand before the release.

From inside the orchestrator sandbox, run the release skill:

```bash
/release
```

The `git` and `release` skills in `.agro/skills/` hold the full workflow.

### Release helpers

`.github/workflows/release.yml` runs the release scripts in `.agro/scripts/`.
`reserve-github-release.mjs` uses the GitHub API user agent `agro-release-reservation`.
The smoke sandbox name is `agro-release-smoke-<run id>`.
`promote-release-latest.sh` sets `IMAGE_REPOSITORIES` to
`ghcr.io/mifunedev/agro` by default.
The legacy image alias must match the `agro` digest.
Before consumers can pull the image tags, the GHCR package `mifunedev/agro` must be public.

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
If the secret is absent, the job prints a notice and exits 0 with no dispatch.

Do not put the token value in shell history or in logs.
Set the destination repository, and upload the token from a file:

```bash
gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro < token-file
gh variable set AGRO_WEB_REPO --repo mifunedev/agro --body mifunedev/agro-web
```

---

For the canonical workflow, read the `git` skill at `.agro/skills/git/SKILL.md`.
