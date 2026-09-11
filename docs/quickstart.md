---
title: "Quickstart"
---

# Quickstart

This guide takes you from zero to a running sandbox with an interactive shell in under five minutes. Required host dependencies are [Docker](https://docs.docker.com/get-docker/) with the Compose plugin, [Git](https://git-scm.com/), and [Node.js](https://nodejs.org/) ≥ 20 — the full list with install commands is in [Prerequisites](./installation.md#prerequisites).

## Before you start

Install Docker with the Compose plugin ([docs.docker.com/get-docker](https://docs.docker.com/get-docker/)), Git ([git-scm.com](https://git-scm.com/)), and Node.js ≥ 20 ([nodejs.org](https://nodejs.org/)) — Node runs the `agro` CLI, and `get-agro.sh` below installs it for you if you skip it. Python, pnpm, and the agent CLIs run inside the container.

## Install

`agro` is the only front door. Get it, then create a sandbox. Every `agro` verb
is also available as `oh <verb>` — `oh` is the compatibility alias for the same
executable (see [Compatibility entry point](#compatibility-entry-point-oh)).

**1. Get `agro`** — from npm if you already have Node ≥ 20:

```bash
npm install -g @mifune/agro   # or, zero-install: npx @mifune/agro --help
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

`oh` keeps working for the whole compatibility window and runs the same bundle.
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

Without `--checkout` the sandbox runs the published image
(`ghcr.io/mifunedev/agro:latest`) and seeds its workspace from the
image's `/opt/agro-seed`, so there is no build and no clone. To persist
`/home/sandbox` at a host path instead of the Docker-managed volume, pass
`--home-mount <dir>`.

Finish by attaching:

```bash
agro sandbox list  # name, runtime, status, checkout
agro shell <name>  # zsh in the container, as the sandbox user
```

**3. (Optional) Mount your own project.** Point the sandbox at a checkout and it
is bind-mounted at `/home/sandbox/harness`:

```bash
cd <your-project>
oh update                                     # vendor .agro/ + crons/ into this checkout
agro sandbox install docker --checkout "$PWD" --name <your-project>
```

`oh update` writes `.agro/` and `crons/` and **nothing else** — no `agro.json`, no
`.env`, no `AGENTS.md`, no provider configuration, and no `.gitignore` line
beyond the `.env` line `agro secret set` adds inside a git checkout. Those files
are yours to author. `--checkout` takes a host path. The CLI selects build mode
only when that path holds `.devcontainer/Dockerfile`. In build mode the sandbox
builds from that file instead of pulling (~10 min cold, ~30s warm). A
`--checkout` path without `.devcontainer/Dockerfile` binds the directory and runs
the published image. The flag `--repo` and the `agro.json` field `repo` remain
supported aliases for `--checkout` and `checkout`.

## Enter the sandbox

**Recommended: attach with VS Code's Dev Containers extension.** Works identically whether the sandbox is on your laptop or on a remote host you're SSH'd into (with VS Code's Remote-SSH extension). One window, your normal editor, integrated terminal, file tree — the most consistent and productive setup across environments.

1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
2. Open the Command Palette with `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) → **Dev Containers: Attach to Running Container...** → select your sandbox name from `agro sandbox list`.
3. When the new VS Code window opens, set the workspace folder to `/home/sandbox/harness`.

> **Optional — DebugMCP (cross-harness debugging).** If you take the VS Code attach route
> above, you can install the `microsoft/DebugMCP` extension to expose a debugging MCP server
> that **any MCP-capable harness** (Claude Code, Codex, …) can drive — breakpoints, stepping,
> variable inspection. It is not tied to one agent and is unnecessary for the terminal path.
> Runbook: [DebugMCP](./integrations/debugmcp.md#confirmed-setup-runbook).

**Terminal fallback** for when VS Code isn't available or you just need a shell:

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

A fresh sandbox has no `herdr`. Nothing installs at boot. Your first two commands
inside a fresh sandbox should be:

```bash
agro tool install herdr
herdr
```

Herdr creates or reattaches the persistent interactive workspace for this repository.
Complete GitHub and provider authentication, launch agents, and run tests and servers
inside its panes. Detach with `Ctrl-b q`; run `herdr` again to return while the container
keeps running. A container stop/rebuild restores metadata and layout, not terminated
agent or server processes. Raw shells and direct agent commands remain recovery paths. Cron, Slack, and gateway infrastructure
continue to run independently under tmux.

## Set up agents inside Herdr

No agent CLI and no tool is baked into the image, and nothing installs one at
boot. Install what you need through the one door:

```bash
agro harness install claude-code   # or codex, pi, opencode, hermes, grok-build, muse-code
agro tool install cloudflared      # or herdr, agent-browser, tailscale
```

Each install lands in `~/.local` inside the persistent home volume, not in the
image, so `agro harness install <id>` also upgrades in place without a rebuild. An
install needs network access. T3 Code is on demand: it has no install, and the
`/t3` skill (or direct `npx`) fetches it at each run. Authenticate at least one
harness before use.

> **Simplest cross-provider login — device mode via `/login`.** The most straightforward path
> that works the same across most harnesses: launch the agent in **interactive mode**, run
> **`/login`**, and choose **device mode** (device-auth). You get a short code + a URL to open
> in a browser on *any* device — no local browser on the host required, so it works cleanly on
> a **headless or remote sandbox** (e.g. a cloud VM you SSH into). Browser-redirect OAuth
> assumes a local browser and often fails there; device mode doesn't. The per-harness commands
> below are equivalents for when you prefer a one-liner — several expose an explicit
> `--device-auth` flag (e.g. `codex login --device-auth`, `grok login --device-auth`).

- **[Claude Code](./harnesses/claude-code.md)**: `claude auth login` (or `/login` in an interactive session), then `claude auth status` to verify
- **[Codex](./harnesses/codex.md)**: `codex login --device-auth` (device mode; or `/login` in-session)
- **[OpenCode](./harnesses/opencode.md)**: `agro harness install opencode`, then run `opencode auth login`
- **[Pi](./harnesses/pi.md)**: configure provider keys via environment variables
- **[Hermes](./harnesses/hermes.md)**: `agro harness install hermes`, then run `hermes setup`
- **[Muse Code](./harnesses/muse-code.md)**: `agro harness install muse-code`, verify `muse --version`, then run `muse login`
- **[Grok Build](./harnesses/grok-build.md)**: `agro harness install grok-build`, verify `grok --version`, then run `grok login --device-auth` (headless/remote) or `grok login`
- **[T3 Code](./harnesses/t3code.md)**: authenticate one of Claude / Codex / OpenCode, then `/t3` or `npx t3` (browser UI on port 3773)

Claude Code remains the documented default. See
[the harnesses overview](./harnesses/overview.md) for the full list and
per-harness setup.

[Connecting to the Sandbox](/docs/connecting)

An installed and authenticated harness inside Herdr is already a working
sandbox. Everything below is optional.

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
`origin` for the retired clone-and-own recipe. It stays supported through the
[AGRO compatibility](./agro-compatibility.md) window and is **not** the
canonical onboarding path. Prefer the prompts above, which inspect the workspace
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

Both work on **every** path. `agro ...` renders `agro.json` and passes it plus the
secrets file to compose with `--env-file`; the VS Code "Reopen in Container"
path loads `.devcontainer/docker-compose.yml` directly, and compose auto-loads
the `.devcontainer/.env` symlink sitting beside it — so secrets arrive, every
non-secret falls back to its compose default, and
[no overlay applies](./lifecycle-commands.md#vs-code-reopen-in-container-applies-no-overlays).
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

`agro.json` also carries `checkout` and `runtime` for a registry entry, plus the SSH,
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

Set one field with `agro config set <field> <value>` and one secret with
`agro secret set <KEY>`, then apply with
`agro stop <name> && agro sandbox install docker --name <name>`.

For additional services (databases, tunnels, reverse proxies), add overlay
paths to `composeOverrides[]` in `agro.json` (last wins).

## End-to-end setup walkthrough

The full path from a bare host to a working sandbox. Steps 1–5 are the whole
required path; everything after them is optional and can wait. Steps 4 onward run
**inside the sandbox** (`agro shell <name>`).

1. **Install host prerequisites** — Docker (+ Compose), Git, and Node.js ≥ 20
   ([details](./installation.md#prerequisites)):
   ```bash
   curl -fsSL -o get-agro.sh https://agro.mifune.dev/get-agro.sh   # review it first
   bash get-agro.sh                                          # installs `agro`, and Node if missing
   ```

   To skip the review step: `curl -fsSL https://agro.mifune.dev/get-agro.sh | bash`. `npm install -g @mifune/agro` is the npm equivalent when Node is already present.
2. **Create the sandbox** — the wizard asks for the name, timezone, git identity,
   SSH, and the Docker socket, then writes `~/.agro/sandboxes/<name>/`:
   ```bash
   agro sandbox install docker
   ```
   Add `--checkout "$PWD" --name <your-project>` to bind an existing checkout at
   `/home/sandbox/harness` instead of running the published image.
3. **Enter the sandbox**:
   ```bash
   agro shell <name>   # attach as the sandbox user
   ```
4. **Install and start Herdr** — a fresh sandbox has none; all remaining setup runs in its panes:
   ```bash
   agro tool install herdr
   herdr
   ```
5. **Install and authenticate one harness** — Claude Code is the documented
   default ([Claude Code](./harnesses/claude-code.md)):
   ```bash
   agro harness install claude-code
   claude auth login && claude auth status
   ```
   That is a working sandbox. Stop here until you need more.

Optional, in any order:

6. **Authenticate GitHub** before any repository work — the five checks in
   [Authenticate GitHub before any repository work](#authenticate-github-before-any-repository-work),
   then either optional prompt.
7. **Add more harnesses** — `agro harness install codex`
   ([Codex](./harnesses/codex.md)), `agro harness install pi` ([Pi](./harnesses/pi.md)),
   `agro harness install hermes && hermes setup` ([Hermes](./harnesses/hermes.md)).
   The simplest cross-provider method is `/login` → **device mode** inside each
   agent's interactive session (see [Set up agents inside Herdr](#set-up-agents-inside-herdr));
   the explicit commands are equivalents.
   > Optional: DebugMCP (cross-harness debugging over MCP) is available if you attached via
   > VS Code — see [Enter the sandbox](#enter-the-sandbox) above.
8. **Configure Slack** for Pi (and Hermes) — create the Slack app, add tokens, set trust
   ([Slack](./integrations/slack.md); Hermes uses `hermes gateway setup`).
9. **Run and verify the gateways** (sandbox-only; watch read-only so you can't kill them —
   [Slack § Run and verify](./integrations/slack.md), [Hermes § Run and verify](./harnesses/hermes.md#run-and-verify-read-only)):
   ```bash
   gateway pi && gateway hermes        # start the client-slack-* sessions
   gateway status                      # both sessions + state
   tmux attach -r -t client-slack-pi   # read-only view; detach with Ctrl-b d
   ```

> Shortcut: if `GH_TOKEN` was set at install, the entrypoint already ran `gh auth login`
> + `gh auth setup-git` and generated/uploaded an SSH key for you. Verify with
> `gh auth status` before you rely on it.

## Tear down

When you're finished, exit the shell and clean up from the host:

```bash
agro destroy <name>
```

This stops the container, removes its volumes, and drops the registry entry, so
the name becomes free again. To keep auth credentials across rebuilds, stop
without removing volumes:

```bash
agro stop <name>
```

Bring it back later with `agro sandbox install docker --name <name>`.
