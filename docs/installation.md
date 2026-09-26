---
title: "Installation"
---

# Installation

AGRO is a portable harness that boots an isolated Docker sandbox. The `agro` CLI is the only front door. The CLI creates a sandbox (`agro sandbox install docker`) and drives the rest of the lifecycle. `agro vendor` equips a checkout with the control plane. Two shapes exist: a sandbox on its own that runs the published image, and a sandbox with a checkout bind-mounted into it. Both shapes use the same commands; `--checkout` selects the second shape. See [lifecycle commands](lifecycle-commands.md) for the verb reference.

Installing this harness never means cloning it onto your host. There is no fork step, no host-side source checkout, and no managed clone directory. You install the CLI, create a sandbox, and work inside it.

The CLI writes only what you ask it to: a registry entry under `~/.agro/sandboxes/<name>/`, and — when you run `agro vendor` — `.agro/` and `crons/` inside a checkout. It writes no `AGENTS.md`, no provider configuration, and no `.gitignore` line beyond the `.env` line `agro secret set` adds inside a git checkout. Those files are yours.

## Prerequisites

| Dependency | Required for | Install |
|---|---|---|
| Docker (with Compose plugin) | Sandbox image | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| git | Cloning a repo, and `agro vendor --from-remote` | [git-scm.com](https://git-scm.com/) |
| Node.js ≥ 20 (22 recommended) | Running the `agro` CLI itself | [nodejs.org](https://nodejs.org/) — or let [`get-agro.sh`](#get-the-cli-agro) install nvm + Node 22 for you |

These three dependencies make up the entire host requirement. Node runs `agro` and nothing else: pnpm, Python, and every AI CLI live inside the sandbox.

## Get the CLI: `agro`

The npm package [`@mifune/agro`](https://www.npmjs.com/package/@mifune/agro) publishes the CLI. With Node.js ≥ 20 on your host, install the package globally or run the package zero-install:

```bash
npm install -g @mifune/agro          # puts `agro` on your PATH
# ...or, without a global install:
npx @mifune/agro sandbox install docker
```

npm does **not** install Node. Without Node, bootstrap with `get-agro.sh`. It downloads the prebuilt single-file `agro` artifact from the latest GitHub release into `~/.local/bin/agro` and never clones or builds on your host. If Node.js ≥ 20 is missing, it offers to install nvm + Node 22:

```bash
curl -fsSL https://agro.mifune.dev/get-agro.sh | bash
```

Review-first (no extra dependency):

```bash
curl -fsSL -o get-agro.sh https://agro.mifune.dev/get-agro.sh
# Review get-agro.sh in your editor or pager before running it.
bash get-agro.sh
```

If the shell cannot find `agro` after the piped form, add the install directory to the current shell's PATH: `export PATH="$HOME/.local/bin:$PATH"`. Environment overrides: `AGRO_BIN_DIR=<dir>` (install location, default `~/.local/bin`), `AGRO_JS_URL=<url>` (artifact URL), `AGRO_NVM_VERSION=<tag>` (nvm version for the Node install), `AGRO_ASSUME_YES=1` (same as `--yes`); `--yes`/`--no` accept or decline the Node-install prompt. Each `AGRO_<NAME>` falls back to the legacy `OH_<NAME>` spelling; when both hold values that differ, the AGRO value wins and a warning names the two keys. There is no source-build fallback, so `get-agro.sh` has no repository or ref override.

Upgrade the installed CLI later with `agro self-upgrade`. The upgrade follows the mechanism that installed the running executable (npm or `get-agro.sh`) and touches no project file. See [lifecycle commands](lifecycle-commands.md#upgrading-the-cli-agro-self-upgrade).

### Package and PATH rules

- `@mifune/agro` ships the single `agro` executable. The retired `@mifune/openharness` shim and its `oh` executable are no longer published.
- `npx @mifune/agro <verb>` runs the CLI without a global install.
- A standalone `get-agro.sh` install (`~/.local/bin/agro`) and an npm install can coexist. `agro update` upgrades the executable that is running, and it refuses when another `agro` is earlier on PATH than the one it would replace; remove or reorder one of them first.
- State is AGRO-native only: `~/.agro/sandboxes/<name>/agro.json`, the `.agro/` control plane, and `AGRO_*` variables. The legacy `~/.oh` registry, `.oh/` control plane, `oh.json` and `OH_*` variables no longer resolve.

### Standalone install (`get-agro.sh`)

Bootstrap with `get-agro.sh`. The script installs the single self-contained `agro` binary to `~/.local/bin/agro`. The script clones no repo and does not touch an existing `~/.agro` checkout. If Node.js ≥ 20 is missing, the script offers to install nvm + Node 22. The script then sources nvm, so `agro` works in the same shell:

```bash
curl -fsSL https://agro.mifune.dev/get-agro.sh | bash
```

`source <(curl -fsSL https://agro.mifune.dev/get-agro.sh)` installs *and* puts `agro` on the running shell's PATH. After the plain piped form, `export PATH="$HOME/.local/bin:$PATH"` does the same. Review-first alternative:

```bash
curl -fsSL -o get-agro.sh https://agro.mifune.dev/get-agro.sh
# Review get-agro.sh in your editor or pager before running it.
bash get-agro.sh
```

Environment overrides:

- `AGRO_BIN_DIR=<dir>`: install location, default `~/.local/bin`.
- `AGRO_JS_URL=<url>`: prebuilt bundle URL.
- `AGRO_GITHUB_REPO=<org>/<fork>` / `AGRO_GITHUB_REF=<ref>`: source for `get-agro.sh`'s build fallback. `get-agro.sh` reads `AGRO_GITHUB_REPO` only to pick the release that hosts its artifacts.
- `AGRO_NVM_VERSION=<tag>`: nvm version for the Node install.
- `--yes`/`--no`: auto-accept or decline the Node-install prompt.

`agro vendor` is the project-payload command, not a self-upgrade. Use `agro self-upgrade` (or its `agro update` alias) to upgrade the installed CLI.

## Create the sandbox

`agro sandbox install docker` is the one command that creates a sandbox. It runs from **any** directory and needs no project checkout:

```bash
agro sandbox install docker
```

The wizard asks for the sandbox name, timezone, git identity, SSH (and its host port), and the host Docker socket, then writes `~/.agro/sandboxes/<name>/agro.json`. `--yes` keeps every default and asks nothing. Edit one field later with `agro config set --sandbox <name> <field> <value>`, and set a secret with `agro secret set --sandbox <name> <KEY>`. See [Configuration](./configuration.md) for the field reference, and the comments in `.example.env` for every allow-listed secret.

`--checkout <dir>` takes a host path. The CLI binds that directory at `/home/sandbox/harness`. Bind an existing checkout when you want the sandbox to work on your own project:

```bash
agro sandbox install docker --checkout "$PWD" --name <your-project>
```

The CLI selects build mode only when `<dir>/.devcontainer/Dockerfile` exists. A `--checkout` path without that file binds the directory and runs the published image. The flag `--repo` and the `agro.json` field `repo` remain supported aliases for `--checkout` and `checkout`.

`--checkout` does not control where the sandbox persists. To persist `/home/sandbox` at a host path, pass `--home-mount <dir>` at create time. See [Persistent storage](#persistent-storage).

### What the sandbox runs

`agro sandbox install docker` materialises the compose files and the wrapper into the entry, then runs `.agro/scripts/docker-compose.sh up -d`, which resolves the compose overlays your `agro.json` selects. Running `docker compose -f .devcontainer/docker-compose.yml up -d --build` by hand skips that resolution and applies **no** overlays.

The CLI sets `image.mode` to `build` only when the `--checkout` path holds `.devcontainer/Dockerfile`. In build mode a cold Docker cache takes around ten minutes; subsequent starts are a few seconds. The default is to pull the published release image instead — see [`agro sandbox install docker`](deployment-prebuilt-image.md) for the image-mode recipe and the `--image` / `--no-build` flags.

Check the sandbox health before attaching:

```bash
docker ps --filter "name=<name>" --format "{{.Names}} {{.Status}}"
docker inspect --format '{{json .State.Health}}' <name>
```

A healthy sandbox reports the systemd units `agro-bootstrap.service` and `agro-cron.service` as active. The healthcheck checks the optional Slack and Hermes dashboard tmux sessions only when you configure those sessions. To debug a failure from inside the container, run `bash /home/sandbox/harness/.agro/scripts/sandbox-healthcheck.sh` for the exact unit or session at fault. For a temporary local escape hatch, add a Compose override with `services.sandbox.healthcheck.disable: true`. Do not commit that override unless you deliberately change the harness health policy.

### Open a shell

```bash
agro shell <name>
```

Omit the name when the registry holds exactly one sandbox, or when you stand in the checkout that a sandbox binds. `agro sandbox list` prints every registered name.

### GitHub authentication and repository work

Creating the sandbox needs no GitHub account, and local sandbox use stays available without one. Pushing, creating a repository, and opening a pull request need one. First, complete the GitHub-login prerequisite inside the sandbox: `gh auth login`, `gh auth setup-git`, `gh auth status`, and an account check. Only then hand the workspace to a coding agent. [Quickstart → Authenticate GitHub before any repository work](./quickstart.md#authenticate-github-before-any-repository-work) holds the five steps and the two optional agent prompts (private versioning; AGRO contribution). [GitHub auth](./integrations/github.md) holds command-level detail and recovery. [Contributing](./contributing.md) holds the contribution workflow.

`agro config repo` (and `agro config repo`) creates a repository and re-points `origin` for the retired clone-and-own recipe. It stays supported through the [AGRO compatibility](./agro-compatibility.md) window and is not the canonical onboarding path.

## Equip an existing repo

A sandbox created above runs the published image and needs no repository of yours. This section covers the other shape. The other shape equips **your existing project repo** with the control plane and drives the sandbox. The other shape still keeps no harness checkout on your host. The host requirements match [Prerequisites](#prerequisites): Docker, git, and Node ≥ 20. The CLI comes from [Get the CLI](#get-the-cli-agro). The published package is one self-contained bundle. The bundle carries the compose files and the wrapper that a sandbox needs. `agro vendor` carries the `.agro/` payload and falls back to an on-demand fetch, with no repo clone.

Then, in any project:

```bash
agro sandbox install docker                  # create a sandbox from the published image
agro sandbox install docker --checkout <dir> # ...or bind a checkout at /home/sandbox/harness
agro sandbox list                            # name, runtime, status, checkout
agro shell <name>                            # zsh in the running container
agro tool install herdr                      # install the terminal workspace — nothing installs at boot
agro harness install pi                      # install an agent CLI the same way
agro gateway status                      # manage messaging client sessions (pi|hermes)
```

To equip your own checkout with the control plane, run `agro vendor` inside it:

```bash
cd <your-project>
agro vendor                            # vendors .agro/ + crons/ from the CLI's bundled payload
agro vendor --from-remote --ref v0.6.0 # ...or shallow-clone a pinned payload instead
agro vendor --from <local-checkout>    # ...or vendor from a built checkout, offline
```

`agro vendor` equips an empty directory and upgrades an equipped one with the same command; a second run reports that the directory is already up to date. It writes only `.agro/` and `crons/` — never `agro.json`, `.env`, `AGENTS.md`, `.gitignore`, `.devcontainer/`, or a provider directory. It never prompts. Payload precedence is `--from` > `--from-remote` > the CLI's bundled payload > a remote fetch announced on one line. `--from-remote` fetches over public HTTPS only — private or credential-prompting remotes fail fast (`GIT_TERMINAL_PROMPT=0`).

A checkout equipped by an earlier release carries `.agro/` and `agro.json`, and both keep resolving. Move that checkout to the AGRO names when you choose:

```bash
cd <your-project>
agro migrate --check   # print the plan, change nothing
agro migrate           # .agro/ -> .agro/, agro.json -> agro.json, provider links re-pointed
```

A checkout bound with `--checkout` mounts at `/home/sandbox/harness`. Without `--checkout` the sandbox runs `ghcr.io/mifunedev/agro:<CLI version>` and seeds its workspace from the image. See [`agro sandbox install docker`](deployment-prebuilt-image.md) for that recipe and the `--image` / `--no-build` flags.

## Next step

Once installed, proceed to the [Quickstart](./quickstart.md) to authenticate inside the sandbox and start an agent.

## What's Installed

The sandbox image ships a complete development environment. The required host dependencies are Docker with the Compose plugin, Git, and Node.js ≥ 20 (see [Prerequisites](#prerequisites)).

Pi loads project-local packages from `.pi/settings.json`. The defaults include:

- `@tintinweb/pi-subagents`
- `@tintinweb/pi-tasks`
- `@narumitw/pi-goal`
- `@narumitw/pi-codex-usage@0.6.2` for `/codex-status` plus fixed statusline usage timers
- `@trevonistrevon/pi-loop` for Monitor/Loop tools
- `@guwidoe/pi-prompt-suggester` for next-prompt suggestions

### Base image

Debian Trixie (slim), the current Debian stable. The `sandbox` user has passwordless sudo.

Docker's apt repository tracks the `trixie` suite. Docker's repository is now the only third-party apt source in the image. cloudflared used to force a `bookworm` suite here, because Cloudflare publishes no Trixie suite (`pkg.cloudflare.com/cloudflared/dists/trixie` returns HTTP 404). AGRO now ships cloudflared as a pinned, checksum-verified binary from its tool catalog, and that move removed the exception.

### AI agent CLIs

The image contains no agent CLI, and nothing installs one at boot. A
harness enters the sandbox only when you run `agro harness install <id>`, which
installs into `~/.local` — inside the home mount — as the `sandbox` user. That
placement is what makes an in-place upgrade possible: a copy in a root-owned
system path is unwritable from a running sandbox. Consequences worth knowing:

- A **fresh sandbox has no agent CLI and no Herdr**. `agro shell` lands you in a
  plain shell, and `tmux` is the fallback multiplexer until you run
  `agro tool install herdr`.
- Every install needs network. Run the verb when you have a link.
- An existing install is never replaced. The verb reports `already installed`
  and exits 0.
- Every download is pinned and `sha256sum`-verified before it is installed.
- npm's cache lives in the home mount at `~/.npm` and grows across upgrades.
  `npm cache clean --force` reclaims it.
- The install persists because the home volume persists. `agro destroy` removes
  the volume, and every install with it.

| Tool | Command | Source | Install |
|------|---------|--------|--------|
| Claude Code | `claude` | Anthropic's coding agent (aliased to `claude --dangerously-skip-permissions`) | `agro harness install claude-code` |
| OpenAI Codex | `codex` | OpenAI's coding agent (aliased to `codex --dangerously-bypass-approvals-and-sandbox`) | `agro harness install codex` |
| Pi | `pi` | `@earendil-works/pi-coding-agent` — local-first coding agent (was `@mariozechner/pi-coding-agent`, now deprecated) | `agro harness install pi` |
| OpenCode | `opencode` | `opencode-ai` — terminal coding agent with OpenAI OAuth support | `agro harness install opencode` |
| Hermes | `hermes` | Nous Research's self-improving agent CLI | `agro harness install hermes` |
| [Muse Code](harnesses/muse-code.md) | `muse` | Meta's native terminal coding agent | `agro harness install muse-code` |
| Grok Build | `grok` | xAI's proprietary Grok Build CLI (`@xai-official/grok@0.2.39`, Node >=20) | `agro harness install grok-build` |
| [Antigravity CLI](harnesses/antigravity-cli.md) | `agy` | Google's terminal coding agent, installed from `https://antigravity.google/cli/install.sh` (aliased to `agy --dangerously-skip-permissions`) | `agro harness install antigravity-cli` |
| T3 Code | `npx t3` | Browser UI over Claude/Codex/OpenCode | on demand, no install |

Tools follow the same rule. `herdr`, `cloudflared`, `agent-browser`,
`tailscale`, and `code-server` are `kind: "installable"` and enter the sandbox only
through `agro tool install <name>`. `gh` and the Docker CLI are `kind: "baked-in"`: they
are in the image, and `agro tool install` refuses them. Every install is
idempotent, and none needs an image rebuild. `agro tool install agent-browser`
downloads about 1 GB, so it asks for confirmation first; `--yes` accepts that
download in a non-interactive run and changes nothing else.

When no sandbox is reachable, `agro tool install` and `agro tool uninstall` act on
the host, with two limits. First, each tool declares whether it installs on the
host. `agent-browser`, `herdr`, `cloudflared`, `microsandbox`, `tailscale`,
`code-server`, `docker-engine`, and `desktop` do. `gh` and the Docker CLI do not, because
the image provides them. Second, a host install needs Linux, because every tool
installer is Debian-specific; on any other platform the command refuses and names
the platform. A host install needs an existing workspace — `--path <dir>`, then
`harnessRoot` in `~/.agro/config.json`, then `~/.agro/workspaces/default` — and
exits 1 when none resolves. It records the installed id under `hostTools` in
`~/.agro/config.json`. `agro tool uninstall` removes only what that record names;
`--force` removes from `~/.local` without a record.

Most host tools install into `~/.local` for the invoking user. `docker-engine`
and `desktop` are root-level: they install system packages as root.
`agro tool list` marks them `(root)`.

| Tool | Host install | Level | Sandbox |
|------|--------------|-------|---------|
| `code-server` | pinned, checksum-verified release in `~/.local/lib/code-server-<version>`, linked from `~/.local/bin/code-server` | invoking user | installs into `~/.local` |
| `docker-engine` | Docker Engine and the Compose plugin from Docker's apt repository for Ubuntu; adds the invoking user to the `docker` group | root | refused; names `access.dockerSocket` |
| `desktop` | XFCE and XRDP, plus system Tailscale from Tailscale's apt repository; serves TCP 3389 only through Tailscale | root | refused |

When you are not root, a root-level install runs its installer through `sudo -n`.
When `sudo -n true` fails, the command exits 1 and changes nothing. The message
names `<id>` and passwordless `sudo`.
`docker-engine` and `desktop` install on the host only. Run
`agro tool install docker-engine --host` or `agro tool install desktop --host`.
`agro tool uninstall` refuses both.
After a `docker-engine` install, log in again to use the `docker` group.

To use the desktop:

1. Run `agro tool install desktop --host`.
2. Run `sudo tailscale up`, and sign in to your tailnet.
3. Run `sudo passwd <user>` to set the password that XRDP asks for.
4. Connect an RDP client to `<tailscale-ip>:3389`. Get the address with
   `tailscale ip -4`.

The desktop install changes no SSH firewall rule and sets no password.

On the host, `agent-browser` installs a pinned release binary into `~/.local/bin`
and never calls the operating system package manager. The installer does not download a
browser. After the binary lands, the installer looks for an existing
Chromium-family browser in this order: `AGENT_BROWSER_EXECUTABLE_PATH`,
`google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser`,
`brave-browser`, `microsoft-edge`. When none is present the install exits
nonzero and names the remedy. Set the browser explicitly with:

```bash
export AGENT_BROWSER_EXECUTABLE_PATH=/path/to/chrome
```

agent-browser drives Chromium over CDP and Safari over WebDriver. Firefox is not
a supported target. In the sandbox, the behavior stays the same: `agro tool install
agent-browser` downloads Chrome for Testing and the browser libraries that Chrome needs,
which is why that path asks to confirm about 1 GB first.

Installing `tailscale` places the `tailscale` and `tailscaled` binaries in
`~/.local/bin` and nothing more. It starts no daemon and joins no tailnet.
Networking activates only when a human starts `tailscaled` in
userspace-networking mode and runs `tailscale up` interactively — see
[Connecting → Mobile access over Tailscale](connecting.md#mobile-access-over-tailscale).
Its node identity and daemon state live in `~/.tailscale`, inside the single
`/home/sandbox` mount, so the node does not re-authenticate on every container
recreate.

### Runtimes & package managers

| Tool | Version |
|------|---------|
| Node.js | 22.x |
| pnpm | latest (via corepack) |
| Bun | latest |
| uv | latest (Python package manager) |

### DevOps & infrastructure

`agro tool list` reports which tools below are present, and `agro tool status <name>`
adds a version where a tool has a verified version flag. Herdr and cloudflared
are `kind: "installable"` — `agro tool install <name>` puts a pinned,
checksum-verified binary into `~/.local/bin`, and upgrades it in place. The image
already contains the rest, so the rest needs no install.

| Tool | Purpose |
|------|---------|
| Herdr (`herdr`) | Multi-agent terminal workspace; run `agro tool install herdr`, after which state and binary both persist in the home mount |
| Docker CLI + Compose | Container management from inside the sandbox (host docker socket bind-mounted by the base compose) |
| GitHub CLI (`gh`) | PRs, issues, releases from the terminal |
| cloudflared | Cloudflare Tunnel client, for exposing a sandbox port (see the `/cloudflared` skill); run `agro tool install cloudflared` |
| tmux | Detachable terminal sessions for long-running agents |
| croner | Markdown-frontmatter cron scheduler for autonomous agent tasks |

### Utilities

| Tool | Purpose |
|------|---------|
| git | Version control |
| jq | JSON processing |
| ripgrep (`rg`) | Fast code search |
| curl, wget | HTTP clients |
| lsof | Inspect open files and the processes using them inside the sandbox |
| htop | Interactive process viewer for the sandbox |
| telnet | Plaintext network diagnostic client supplied by `inetutils-telnet`; not SSH or a secure shell |
| nano | Text editor |
| openssh-client | `ssh-keygen` for GitHub auth flows |
| bash-completion | Tab completion |

### Shell aliases

The sandbox user's `.bashrc` includes convenience aliases:

```
claude  → claude --dangerously-skip-permissions
codex   → codex --dangerously-bypass-approvals-and-sandbox
agy     → agy --dangerously-skip-permissions
```

### Persistent storage

Everything under the sandbox user's home directory — every agent login, the
GitHub CLI token, the SSH keys, shell history, and any state a tool writes
anywhere in `~` — persists through a **single mount at `/home/sandbox`**.

By default Docker manages it as the named volume `<sandbox-name>_workspace`.
Set `storage.homePath` in `agro.json` to an absolute **host** path and the same
mount becomes a bind, so you can back the sandbox home up, inspect it, or move
it between machines:

```bash
agro config set --sandbox <name> storage.homePath /srv/agro-home
```

Set the same path at create time with
`agro sandbox install docker --home-mount <dir>`. After the named volume
`<name>_workspace` exists, `agro config set storage.homePath` refuses the
change. The next start would swap the mount source and orphan every file in
that volume. Pass `--force` to override the refusal.

Leave `storage.homePath` unset to keep the Docker-managed volume. Use a
**dedicated, empty** directory — the sandbox takes ownership of everything in
it, so never point it at your own host `$HOME`.

The repository checkout is bind-mounted at `/home/sandbox/harness`, nested
inside that mount. No setting changes that location.

The image ships its baked home at `/opt/home-seed`. On every boot the entrypoint
copies in each **top-level** entry the mount does not already have, and never
touches an entry the mount has — not even the permissions of that entry. A fresh mount comes up complete;
an image upgrade adds whatever new top-level entries it introduced (a new agent
CLI's `~/.newtool`, say) and leaves everything you already have alone. The entrypoint
does not merge new files into a directory the mount already has; the per-tool
volumes did that merge before.

Hermes differs: when the `hermes` binary is present (after
`agro harness install hermes`), `HERMES_HOME` is the project-local
bind-mounted `~/harness/.hermes/` directory. The entrypoint links `.hermes/skills/agro` to the tracked
shared skill directory (`.agro/skills/`) so Hermes sees the same harness skills as
Claude, Codex, and Pi without copying them into runtime state. `.gitignore` excludes
the project-local runtime contents except `.hermes/README.md`.

`agro destroy` and `docker compose down -v` delete the named volume and everything
in it — provider credentials included; use `agro stop` when you want them to
survive. When `storage.homePath` points at a host bind, `down -v` cannot remove
it, and `agro destroy` says so.

#### Migrating from the per-tool volumes

Releases before this change kept eleven separate volumes (`claude-auth`,
`config-dir`, `ssh-config`, and eight others). AGRO does not migrate those volumes automatically.
**Before** upgrading, copy the old home out of the still-running container:

```bash
mkdir -p /srv/agro-home
docker cp <sandbox-name>:/home/sandbox/. /srv/agro-home
rm -rf /srv/agro-home/harness
agro config set --sandbox <sandbox-name> storage.homePath /srv/agro-home
```

The trailing `/.` matters: without it `docker cp` places the copy at
`/srv/agro-home/sandbox/` instead of unpacking its contents, and the
sandbox comes up freshly seeded as though no migration happened. The `rm -rf`
drops the copy of the repository checkout — `docker cp` reads through the bind
mount, so the archive includes `harness/` with its `.git` and `node_modules`,
which can reach multiple GB. The checkout bind shadows that copy at runtime anyway.

Then rebuild. To stay on a Docker-managed volume instead, copy that directory
into the new volume once:

```bash
docker run --rm -v <sandbox-name>_workspace:/to -v /srv/agro-home:/from \
  alpine cp -a /from/. /to/
```

If you skip this step, you lose every agent login and the SSH keys. Nothing else
breaks, and you sign in again.

Downstream harness packs and Pi extensions can introduce additional volumes or bind-mount overlays by adding paths to `composeOverrides[]` in the tracked `agro.json`. That list is the one place for overlay paths, and only `agro` applies the list. VS Code "Reopen in Container" reads `.devcontainer/docker-compose.yml` alone and applies [no overlays at all](lifecycle-commands.md#vs-code-reopen-in-container-applies-no-overlays).
