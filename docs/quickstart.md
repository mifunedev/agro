---
title: "Quickstart"
---

# Quickstart

This guide takes you from installation to a small program with observable output inside the sandbox. Use the terminal and Herdr for the primary path. Local hosts and remote VMs are both supported; host requirements are in [Prerequisites](./installation.md#prerequisites).

## Before you start

**Release status — 2026-09-10:** The latest release, `v0.9.0` (published 2026-09-06), has a known fresh-volume bootstrap failure: [#1019](https://github.com/mifunedev/agro/issues/1019). A corrected release image still needs verification and publication. The [recovery guide](./repair-sandbox-boot-advisory.md) repairs existing seeded volumes, not the published image. The commands below describe the intended path, not independently verified clean-release acceptance.

Install [Docker with the Compose plugin](https://docs.docker.com/get-docker/), [Git](https://git-scm.com/), and [Node.js ≥ 20](https://nodejs.org/) on the host. Python, pnpm, and the agent CLIs run inside the container. You need network access and an Anthropic account with Claude Code access for the recommended login path. Provider usage can incur charges.

Leave the host Docker socket disabled for the first task: socket access is effectively host root. The sandbox user has sudo access. Passwordless sudo, if enabled locally, removes the password gate. Shell aliases skip Claude Code and Codex permission prompts. Review [security considerations](./security-considerations.md) before granting credentials or mounts. Worktrees separate checkouts; they are not security boundaries.

## Install

Run this section's commands on the **host**. On a remote VM, use a host shell reached through SSH.

`agro` is the lifecycle entry point. `oh` runs the same bundle under the legacy name, but `update` differs: `agro update` upgrades the CLI; `oh update` vendors project files. See [Compatibility entry point](#compatibility-entry-point-oh).

**1. Get `agro`** — from npm if you already have Node ≥ 20:

```bash
npm install -g @mifune/agro
```

…or with the curl bootstrap, which downloads the prebuilt `agro` artifact from
the latest GitHub release — nothing is cloned or built on your host — and offers
to install nvm + Node 22 when Node is missing:

```bash
curl -fsSL https://agro.mifune.dev/get-agro.sh | bash
```

Review-first, without adding a host dependency:

```bash
curl -fsSL -o get-agro.sh https://agro.mifune.dev/get-agro.sh
# Review get-agro.sh in your editor or pager before running it.
bash get-agro.sh
```

`get-agro.sh` installs to `~/.local/bin/agro` (`AGRO_BIN_DIR` overrides it);
after the piped form, `export PATH="$HOME/.local/bin:$PATH"` puts it on an
already-open shell's PATH. Upgrade later with `agro update`.

### Package and PATH rules

`@mifune/agro` ships only `agro`; `@mifune/openharness` ships only `oh` and
depends on the exact same `@mifune/agro` version. Both may be installed
together, and installing or removing either never removes the other's
executable. `npx @mifune/agro <verb>` works without a global install. A
standalone `get-agro.sh` install and an npm install can coexist, but `agro
update` refuses when another `agro` is earlier on PATH than the one it would
replace. Details: [Installation → Package and PATH rules](./installation.md#package-and-path-rules).

### Compatibility entry point (`oh`)

`oh` runs the same bundle under the legacy name.
From npm it is the deprecated shim `@mifune/openharness`
(`npm install -g @mifune/openharness`, or `npx @mifune/openharness --help`);
`oh update` remains the command that vendors `.agro/` + `crons/` into a checkout.
The curl bootstrap is `get-oh.sh`:

```bash
curl -fsSL https://oh.mifune.dev/get-oh.sh | bash
```

Review-first: `curl -fsSL -o get-oh.sh https://oh.mifune.dev/get-oh.sh`, read
it, then `bash get-oh.sh`. It installs the self-contained `oh` binary to
`~/.local/bin/oh` — no repo clone. `source <(curl -fsSL https://oh.mifune.dev/get-oh.sh)`
installs *and* puts `oh` on the current shell's PATH.

**2. Create the sandbox** — from any directory, with no project checkout:

```bash
agro sandbox install docker   # wizard: name, timezone, git identity, SSH, Docker socket
```

It asks for the sandbox name (default `agro-sbx-<n>`, the lowest unused number),
the timezone, your git identity, whether to run sshd and on which host port, and
whether to mount the host Docker socket. `--yes` keeps every default and asks
nothing. The answers land in a registry entry at
`~/.agro/sandboxes/<name>/agro.json`, together with the compose files and the
wrapper script the CLI regenerates on every lifecycle call — edit only
`agro.json` there. A registry written by an earlier release stays at
`~/.oh/sandboxes/<name>/oh.json` and keeps working; `agro migrate --home` moves
it when you choose.

Without `--repo` the sandbox runs the published image
(`ghcr.io/mifunedev/agro:latest`) and seeds its workspace from the
image's `/opt/agro-seed`, so there is no build and no clone.

Finish by attaching:

```bash
agro sandbox list  # name, runtime, status, repo
agro shell <name>  # zsh in the container, as the sandbox user
```

**3. (Optional, Host) Mount your own project instead.** Use a host shell, not the sandbox shell opened above. Point the new sandbox at an existing checkout:

```bash
cd <your-project>
oh update                                     # vendor .agro/ + crons/ into this checkout
agro sandbox install docker --repo "$PWD" --name <your-project>
```

`oh update` writes `.agro/` and `crons/` and **nothing else** — no `agro.json`, no
`.env`, no `AGENTS.md`, no provider configuration, and no `.gitignore` line
beyond the `.env` line `agro secret set` adds inside a git checkout. Those files
are yours to author. With `--repo` and `image.mode` set to `build`, the sandbox
builds from that checkout's `.devcontainer/Dockerfile` instead of pulling. Build duration depends on the host, network, and cache.

## Enter the sandbox

**Recommended: run `agro shell <name>` on the host, then open Herdr inside the sandbox.** The shell starts as `sandbox` in `/home/sandbox/harness`.

**Optional editor: attach with VS Code's Dev Containers extension.** Provision with `agro sandbox install docker` first. Do not provision with “Reopen in Container”; that path skips [Compose overlays](./lifecycle-commands.md#vs-code-reopen-in-container-applies-no-overlays). For a remote VM, connect to the host with Remote-SSH before attaching.

1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
2. Open the Command Palette with `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) → **Dev Containers: Attach to Running Container...** → select your sandbox name from `agro sandbox list`.
3. When the new VS Code window opens, set the workspace folder to `/home/sandbox/harness`.

> **Optional — DebugMCP (cross-harness debugging).** If you take the VS Code attach route
> above, you can install the `microsoft/DebugMCP` extension to expose a debugging MCP server
> that **any MCP-capable harness** (Claude Code, Codex, …) can drive — breakpoints, stepping,
> variable inspection. It is not tied to one agent and is unnecessary for the terminal path.
> Runbook: [DebugMCP](./integrations/debugmcp.md#confirmed-setup-runbook).

**Host — terminal entry and recovery:**

```bash
agro shell <name>
```
`<name>` is an entry from `agro sandbox list`; omit it when exactly one sandbox is
registered, or when you are standing in the checkout a sandbox was created for.
`agro shell` always attaches as the `sandbox` user; if the target container has no
such user, use `docker exec -it -u <user> <container> zsh` instead. On a stopped
container it tells you to start it with `agro sandbox install docker`.

Either way you're inside the isolated sandbox as the `sandbox` user. Working
directory: `/home/sandbox/harness`.

## Install and start Herdr first

A fresh sandbox requires explicit Herdr installation. Run these commands **inside the sandbox**:

```bash
agro tool install herdr
herdr
```

Herdr creates or reattaches the persistent interactive workspace for this repository.
Complete provider authentication and run interactive work inside its panes. Authenticate GitHub there only before GitHub repository work. Detach with `Ctrl-b q`; run `herdr` again to return while the container
keeps running. A container stop/rebuild restores metadata and layout, not terminated
agent or server processes. Raw shells and direct agent commands remain recovery paths. systemd supervises the cron runtime. Slack gateways, tunnels, and detached cron fires use named tmux sessions.

## Set up Claude Code inside Herdr

Run in a **sandbox Herdr pane**:

```bash
agro harness install claude-code
claude auth login
claude auth status
```

Complete the displayed OAuth instructions in your browser. On a remote sandbox, follow the URL and any code-transfer instructions the CLI displays. Continue only after the status command confirms authentication. See [Claude Code authentication](./harnesses/claude-code.md#authentication) for details.

Coding harnesses and installable tools require explicit installation. The image already includes runtimes and utilities such as Node, Git, and `gh`. Bootstrap can run `pnpm install` for workspace dependencies. Existing harness or tool installations can report `already installed` and skip; repeating the command is not an upgrade guarantee.

## First task: create and verify a program

No GitHub account or repository is needed. In the same **sandbox Herdr pane**, create a unique scratch directory outside the harness checkout:

```bash
TASK_DIR="$(mktemp -d "$HOME/agro-first-task.XXXXXX")" && cd "$TASK_DIR" && pwd && claude
```

The chained command starts Claude only after directory creation and entry succeed. Keep the printed absolute directory path. Send this prompt:

> Work only in the current scratch directory. Create one zero-dependency file named `hello.mjs` that prints exactly `Hello from AGRO!` followed by a newline. Run `node hello.mjs`. Report the absolute file path and actual output. Do not install packages, use the network, run git commands, make commits, or change any other directory. Stop after reporting the result.

Open another **sandbox Herdr pane** for independent verification. Replace `<task-directory>` with the absolute path printed above:

```bash
node "<task-directory>/hello.mjs"
```

Expected output:

```text
Hello from AGRO!
```

The first-task endpoint is the file plus its observed terminal output. Everything below is optional. For another coding harness, use the [harnesses overview](./harnesses/overview.md); authentication methods differ by provider.

## Authenticate GitHub before any repository work

Local sandbox use stays available without a GitHub account. Work that reaches
GitHub — pushing, creating a repository, opening a pull request — does not.
Provider authentication authenticates the model, not GitHub, and grants no
repository access.

Run these five steps in this order, inside a Herdr pane:

1. Authenticate the intended GitHub account with `gh auth login`.
2. Run `gh auth setup-git` to configure Git's credential helper.
3. Run `gh auth status`.
4. Confirm the status output identifies the intended account with authenticated
   access.
5. Only after those checks pass, send either optional prompt below to the
   authenticated coding agent.

```bash
gh auth login
gh auth setup-git
gh auth status
```

The initial login is never delegated to the prompts. Both prompts assume it is
already complete and recheck it before acting. Protocol choice, SSH-key upload,
`GH_TOKEN` at boot, and recovery after a `down -v` are in
[GitHub auth](./integrations/github.md).

### Optional prompt — version-control this sandbox privately

Send this to the authenticated coding agent:

> I have completed `gh auth login` and verified the intended GitHub account inside this sandbox.
> Help me version-control this sandbox workspace in my own private GitHub repository.
> Recheck GitHub authentication before acting, then inspect existing Git history and remotes.
> Preserve my files and existing repository configuration.
> Review ignore rules and the proposed tracked files for credentials, runtime state, logs, and unrelated projects.
> Ask me to confirm the account, repository name, and private visibility before creating the repository.
> Show me the proposed commit contents and ask before pushing.
> Do all work inside this sandbox; do not create a host-side source checkout.

### Optional prompt — prepare an AGRO contribution

Send this instead:

> I have completed `gh auth login` and verified the intended GitHub account inside this sandbox.
> Help me prepare an AGRO contribution from this sandbox.
> Recheck GitHub authentication before acting.
> Inspect existing remotes and check whether this checkout shares history with the canonical AGRO repository.
> If the histories share ancestry, help me configure an upstream remote and a contribution branch without changing my private origin.
> Otherwise, use a separate ordinary upstream checkout inside this sandbox and transfer only the changes I select.
> Keep private configuration, credentials, and unrelated files out of the contribution.
> Confirm the fork, target branch, and diff with me before pushing or opening a pull request.
> Do not replace the live workspace or create a host-side source checkout.

Branch, commit, changelog, and pull-request conventions for the second prompt
live in [Contributing](./contributing.md).

### `agro config repo` is a compatibility helper

`agro config repo` (and `oh config repo`) creates a repository and re-points
`origin` for the retired clone-and-own recipe. It is **not** the canonical onboarding path. See [AGRO compatibility](./agro-compatibility.md) for legacy behavior. Prefer the prompts above, which inspect the workspace
before they change anything.

## Configuration

Configuration lives in **two** files, split by kind. `agro.json` holds every
non-secret setting. A gitignored, mode-`0600` `.env` holds nothing but secrets;
the tracked `.example.env` documents every allow-listed secret key, commented
out, so a fresh copy changes nothing.

Each sandbox keeps its own pair inside its registry entry at
`~/.agro/sandboxes/<name>/` (a registry from an earlier release stays at
`~/.oh/sandboxes/<name>/` until `agro migrate --home` runs). Write them with
`agro config set --sandbox <name> <field> <value>` and `agro secret set
--sandbox <name> <KEY>`; without `--sandbox` both act on the project root
instead. In an equipped checkout, `.devcontainer/.env` is a symlink to that root
`.env`.

The AGRO wrapper renders configuration and passes the secrets file to Compose. VS Code “Reopen in Container” reads the base Compose file directly. Compose still loads the adjacent dotenv symlink, but rendered variables use Compose defaults and [no overlay applies](./lifecycle-commands.md#vs-code-reopen-in-container-applies-no-overlays). The entrypoint separately reads project configuration, including Hermes dashboard settings.
(Before 0.4.0 a
`harness.yaml` layer sat in front of the dotenv and was readable on the first
path only, so a key set there silently did nothing under VS Code. It was
removed; any leftover `harness.yaml` is migrated automatically on the next
lifecycle command.)

```json
// agro.json — non-secret settings (example)
{
  "name": "openharness",
  "timezone": "UTC",
  "git": { "userName": "your-name", "userEmail": "you@example.com" }
}
```

`agro.json` also carries `repo` and `runtime` for a registry entry, plus the SSH,
Docker-socket, Hermes-dashboard, cron, build, and image settings. See
[Configuration](./configuration.md) for the full field reference, and
`agro config set <field> <value>` to edit one field.

**Secrets** — keep in `.env` only (gitignored, `0600`); set one with
`agro secret set <KEY>`, or `agro secret set --sandbox <name> <KEY>` for a registry
entry:

| Var | Purpose |
|-----|---------|
| `GH_TOKEN` | GitHub token for non-interactive auth |
| `SANDBOX_PASSWORD` | The `sandbox` user's login and `sudo` password — **override the weak compose default on any network-reachable deployment** |
| `PI_SLACK_APP_TOKEN` | Slack Socket Mode app token (`xapp-`) |
| `PI_SLACK_BOT_TOKEN` | Slack bot token (`xoxb-`) |

**Non-secret settings** — `agro.json` fields:

| Field | Purpose |
|-----|---------|
| `name` | Container/compose project name |
| `timezone` | Container timezone |
| `git.userName` | Commit author name (spaces OK) |
| `git.userEmail` | Commit author email |

`agro.json` carries no install field. Install a harness or a tool with
`agro harness install <id>` or `agro tool install <id>` instead.

For a registered sandbox, run configuration commands on the **host** with `--sandbox <name>`. Apply the change from the host with `agro stop <name> && agro sandbox install docker --name <name>`.

For additional services (databases, tunnels, reverse proxies), add overlay
paths to `composeOverrides[]` in `agro.json` (last wins).

## Optional messaging

Configure only the integration you intend to use. Follow [Slack](./integrations/slack.md) for Pi or [Hermes](./harnesses/hermes.md) for its native gateway. Each guide covers authentication, trust settings, and sandbox-only startup. Neither integration is required for the first task.

## Stop or destroy

Run these lifecycle commands on the **host**, not in a Herdr pane.

To stop without deleting volumes:

```bash
agro stop <name>
```

Start again with `agro sandbox install docker --name <name>`. Files and saved Herdr metadata remain in the home mount, but stopped agent and server processes need restarting. Volume persistence is not a backup.

**Back up before destructive cleanup.** The next command removes the container, registry entry, and named volumes, including workspace files and provider credentials. Host bind-mounted directories remain. Read the deletion list and confirm the sandbox name only when you intend that loss.

```bash
agro destroy <name>
```

See [Persistent storage](./installation.md#persistent-storage) for the named-volume and host-bind distinction.
