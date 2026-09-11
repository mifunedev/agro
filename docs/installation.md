---
title: "Installation"
---

# Installation

Open Harness is a portable harness that boots an isolated Docker sandbox. The `agro` CLI is the only front door: it creates a sandbox (`agro sandbox install docker`) and drives the rest of the lifecycle; `oh update` equips a checkout with the control plane during the compatibility window. Two shapes exist — a sandbox on its own, running the published image, or a sandbox with a checkout bind-mounted into it (`--checkout`) — and both use the same commands. See [lifecycle commands](lifecycle-commands.md) for the verb reference.

Installing this harness never means cloning it onto your host. There is no fork step, no host-side source checkout, and no managed clone directory. You install the CLI, create a sandbox, and work inside it.

Every `agro` verb is also available as `oh <verb>`: `oh` is the compatibility alias for the same executable, and the [AGRO compatibility contract](agro-compatibility.md) states how long it stays. This page writes `agro`.

The CLI writes only what you ask it to: a registry entry under `~/.agro/sandboxes/<name>/`, and — when you run `oh update` — `.agro/` and `crons/` inside a checkout. It writes no `AGENTS.md`, no provider configuration, and no `.gitignore` line beyond the `.env` line `agro secret set` adds inside a git checkout. Those files are yours.

## Prerequisites

| Dependency | Required for | Install |
|---|---|---|
| Docker (with Compose plugin) | Sandbox image | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| git | Cloning a repo, and `oh update --from-remote` | [git-scm.com](https://git-scm.com/) |
| Node.js ≥ 20 (22 recommended) | Running the `agro` CLI itself | [nodejs.org](https://nodejs.org/) — or let [`get-agro.sh`](#get-the-cli-agro) install nvm + Node 22 for you |

That is the entire host requirement. Node runs `agro` and nothing else: pnpm, Python, and every AI CLI live inside the sandbox.

## Get the CLI: `agro`

The CLI is published as [`@mifune/agro`](https://www.npmjs.com/package/@mifune/agro). With Node.js ≥ 20 on your host, install it globally or run it zero-install:

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

If `agro` is not found after the piped form, add the install directory to the current shell's PATH: `export PATH="$HOME/.local/bin:$PATH"`. Environment overrides: `AGRO_BIN_DIR=<dir>` (install location, default `~/.local/bin`), `AGRO_JS_URL=<url>` (artifact URL), `AGRO_NVM_VERSION=<tag>` (nvm version for the Node install), `AGRO_ASSUME_YES=1` (same as `--yes`); `--yes`/`--no` accept or decline the Node-install prompt. Each `AGRO_<NAME>` falls back to the legacy `OH_<NAME>` spelling; when both are set and differ, the AGRO value wins and a warning names the two keys. There is no source-build fallback, so `get-agro.sh` has no repository or ref override.

Upgrade the installed CLI later with `agro update`; it upgrades the running executable through the mechanism that installed it (npm or `get-agro.sh`) and touches no project file. See [lifecycle commands](lifecycle-commands.md#upgrading-the-cli-agro-update).

### Package and PATH rules

- `@mifune/agro` ships only the `agro` executable. `@mifune/openharness` ships only the `oh` executable and depends on the exact same `@mifune/agro` version.
- Both packages may be installed together. Installing or removing either never removes the other's executable.
- `npx @mifune/agro <verb>` runs the CLI without a global install.
- A standalone `get-agro.sh` install (`~/.local/bin/agro`) and an npm install can coexist. `agro update` upgrades the executable that is running, and it refuses when another `agro` is earlier on PATH than the one it would replace; remove or reorder one of them first.
- `agro` and `oh` read and write the same state, and fresh state is AGRO-native: `~/.agro/sandboxes/<name>/agro.json`, the `.agro/` control plane, and `AGRO_*` variables. Legacy `~/.oh/sandboxes/<name>/oh.json`, `.oh/`, and `OH_*` keep resolving under either name; `agro migrate` moves them when you choose.

### Compatibility entry point (`oh`)

`oh` remains installable for the whole compatibility window and runs the same bundle as `agro`. Get it from npm as [`@mifune/openharness`](https://www.npmjs.com/package/@mifune/openharness) — a shim that contains no CLI code and pins the exact `@mifune/agro` version it delegates to:

```bash
npm install -g @mifune/openharness   # puts `oh` on your PATH
# ...or, without a global install:
npx @mifune/openharness sandbox install docker
```

Or bootstrap with `get-oh.sh`, which installs the single self-contained `oh` binary to `~/.local/bin/oh` — no repo clone, and it does not touch an existing `~/.openharness` checkout. If Node.js ≥ 20 is missing, it offers to install nvm + Node 22 and sources it so `oh` works in the same shell:

```bash
curl -fsSL https://oh.mifune.dev/get-oh.sh | bash
```

`source <(curl -fsSL https://oh.mifune.dev/get-oh.sh)` installs *and* puts `oh` on the running shell's PATH. After the plain piped form, `export PATH="$HOME/.local/bin:$PATH"` does the same. Review-first alternative:

```bash
curl -fsSL -o get-oh.sh https://oh.mifune.dev/get-oh.sh
# Review get-oh.sh in your editor or pager before running it.
bash get-oh.sh
```

Environment overrides: `OH_BIN_DIR=<dir>` (install location, default `~/.local/bin`), `OH_JS_URL=<url>` (prebuilt bundle URL), `OH_GITHUB_REPO=<org>/<fork>` / `OH_GITHUB_REF=<ref>` (source for `get-oh.sh`'s build fallback; `get-agro.sh` reads `AGRO_GITHUB_REPO`/`OH_GITHUB_REPO` only to pick the release that hosts its artifacts), `OH_NVM_VERSION=<tag>` (nvm version for the Node install), `--yes`/`--no` (auto-accept/decline the Node-install prompt). `oh update` is the project-payload command, not a self-upgrade: to upgrade the `oh` shim, run `npm install -g @mifune/openharness` again or re-run `get-oh.sh`, or move to `@mifune/agro` and use `agro update`.

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

A registry entry written by an earlier release stays at `~/.oh/sandboxes/<name>/oh.json` and keeps working under both `agro` and `oh`. Move it when you choose:

```bash
agro migrate --home --check   # print the plan, change nothing
agro migrate --home           # ~/.oh/sandboxes -> ~/.agro/sandboxes
```

### What the sandbox runs

`agro sandbox install docker` materialises the compose files and the wrapper into the entry, then runs `.agro/scripts/docker-compose.sh up -d`, which resolves the compose overlays your `agro.json` selects. Running `docker compose -f .devcontainer/docker-compose.yml up -d --build` by hand skips that resolution and applies **no** overlays.

The CLI sets `image.mode` to `build` only when the `--checkout` path holds `.devcontainer/Dockerfile`. In build mode a cold Docker cache takes around ten minutes; subsequent starts are a few seconds. The default is to pull the published release image instead — see [`agro sandbox install docker`](deployment-prebuilt-image.md) for the image-mode recipe and the `--image` / `--no-build` flags.

Check the sandbox health before attaching:

```bash
docker ps --filter "name=<name>" --format "{{.Names}} {{.Status}}"
docker inspect --format '{{json .State.Health}}' <name>
```

A healthy sandbox reports the systemd units `openharness-bootstrap.service` and `openharness-cron.service` as active; optional Slack and Hermes dashboard tmux sessions are checked only when configured. To debug a failure from inside the container, run `bash /home/sandbox/harness/.agro/scripts/sandbox-healthcheck.sh` for the exact unit or session at fault. For a temporary local escape hatch, add a Compose override with `services.sandbox.healthcheck.disable: true`; do not commit that override unless you are deliberately changing the harness health policy.

### Open a shell

```bash
agro shell <name>
```

Omit the name when exactly one sandbox is registered, or when you are standing in the checkout it was created for. `agro sandbox list` prints every registered name.

### GitHub authentication and repository work

Creating the sandbox needs no GitHub account, and local sandbox use stays available without one. Pushing, creating a repository, and opening a pull request need one. Complete the GitHub-login prerequisite inside the sandbox first — `gh auth login`, `gh auth setup-git`, `gh auth status`, then confirm the account — and only then hand the workspace to a coding agent. The five steps and the two optional agent prompts (private versioning; AGRO contribution) are in [Quickstart → Authenticate GitHub before any repository work](./quickstart.md#authenticate-github-before-any-repository-work); command-level detail and recovery are in [GitHub auth](./integrations/github.md), and the contribution workflow is in [Contributing](./contributing.md).

`agro config repo` (and `oh config repo`) creates a repository and re-points `origin` for the retired clone-and-own recipe. It stays supported through the [AGRO compatibility](./agro-compatibility.md) window and is not the canonical onboarding path.

## Equip an existing repo

A sandbox created above runs the published image and needs no repository of yours. This section is the other shape: it equips **your existing project repo** with the control plane and drives the sandbox, still without keeping a harness checkout on your host. The host requirements are the same [Prerequisites](#prerequisites) — Docker, git, and Node ≥ 20 — and the CLI comes from [Get the CLI](#get-the-cli-agro). The published package is one single self-contained bundle: it carries the compose files and the wrapper a sandbox needs, and `oh update` carries the `.agro/` payload (falling back to an on-demand fetch, no repo clone).

Then, in any project:

```bash
agro sandbox install docker                  # create a sandbox from the published image
agro sandbox install docker --checkout <dir> # ...or bind a checkout at /home/sandbox/harness
agro sandbox list                            # name, runtime, status, repo
agro shell <name>                            # zsh in the running container
agro tool install herdr                      # install the terminal workspace — nothing installs at boot
agro harness install pi                      # install an agent CLI the same way
agro gateway status                      # manage messaging client sessions (pi|hermes)
```

To equip your own checkout with the control plane, run `oh update` inside it:

```bash
cd <your-project>
oh update                            # vendors .agro/ + crons/ from the CLI's bundled payload
oh update --from-remote --ref v0.6.0 # ...or shallow-clone a pinned payload instead
oh update --from <local-checkout>    # ...or vendor from a built checkout, offline
```

`oh update` equips an empty directory and upgrades an equipped one with the same command; a second run reports it is already up to date. It writes only `.agro/` and `crons/` — never `agro.json`, `.env`, `AGENTS.md`, `.gitignore`, `.devcontainer/`, or a provider directory. It never prompts. Payload precedence is `--from` > `--from-remote` > the CLI's bundled payload > a remote fetch announced on one line. `--from-remote` fetches over public HTTPS only — private or credential-prompting remotes fail fast (`GIT_TERMINAL_PROMPT=0`).

A checkout equipped by an earlier release carries `.oh/` and `oh.json`, and both keep resolving. Move that checkout to the AGRO names when you choose:

```bash
cd <your-project>
agro migrate --check   # print the plan, change nothing
agro migrate           # .oh/ -> .agro/, oh.json -> agro.json, provider links re-pointed
```

A checkout bound with `--checkout` mounts at `/home/sandbox/harness`. Without `--checkout` the sandbox runs `ghcr.io/mifunedev/agro:latest` and seeds its workspace from the image — see [`agro sandbox install docker`](deployment-prebuilt-image.md) for that recipe and the `--image` / `--no-build` flags.

## Next step

Once installed, proceed to the [Quickstart](./quickstart.md) to authenticate inside the sandbox and start an agent.

## What's Installed

The sandbox image ships a complete development environment. The required host dependencies are Docker with the Compose plugin, Git, and Node.js ≥ 20 (see [Prerequisites](#prerequisites)).

Project-local Pi packages are loaded from `.pi/settings.json`; the defaults include `@tintinweb/pi-subagents`, `@tintinweb/pi-tasks`, `@narumitw/pi-goal`, `@narumitw/pi-codex-usage@0.6.2` for `/codex-status` plus fixed statusline usage timers, `@tifan/pi-recap` for `/recap` plus automatic idle/resume session summaries, `@trevonistrevon/pi-loop` for Monitor/Loop tools, `@guwidoe/pi-prompt-suggester` for next-prompt suggestions, and `pi-dynamic-workflows` for workflow-script fan-out through isolated Pi subagents.

### Base image

Debian Trixie (slim), the current Debian stable. The `sandbox` user has passwordless sudo.

Docker's apt repository tracks the `trixie` suite, and it is now the only third-party apt source in the image. cloudflared used to force a `bookworm` suite here because Cloudflare publishes no Trixie suite (`pkg.cloudflare.com/cloudflared/dists/trixie` returns HTTP 404); moving it to a pinned, checksum-verified binary in the tool catalog removed that exception.

### AI agent CLIs

No agent CLI is baked into the image, and nothing installs one at boot. A
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
| T3 Code | `npx t3` | Browser UI over Claude/Codex/OpenCode | on demand, no install |

Tools follow the same rule. `herdr`, `cloudflared`, `agent-browser`, and
`tailscale` are `kind: "installable"` and enter the sandbox only through
`agro tool install <name>`. `gh` and the Docker CLI are `kind: "baked-in"`: they
are in the image, and `agro tool install` refuses them. Every install is
idempotent, and none needs an image rebuild. `agro tool install agent-browser`
downloads about 1 GB, so it asks for confirmation first; `--yes` accepts that
download in a non-interactive run and changes nothing else.

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

`agro tool list` reports which of these are present, and `agro tool status <name>`
adds a version where the tool has a verified version flag. Herdr and cloudflared
are `kind: "installable"` — `agro tool install <name>` puts a pinned,
checksum-verified binary into `~/.local/bin`, and upgrades it in place. The rest
are baked into the image, so there is nothing to install.

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
agro config set --sandbox <name> storage.homePath /srv/openharness-home
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
inside that mount. Its location is fixed, not configurable.

The image ships its baked home at `/opt/home-seed`. On every boot the entrypoint
copies in each **top-level** entry the mount does not already have, and never
touches one it does — not even its permissions. A fresh mount comes up complete;
an image upgrade adds whatever new top-level entries it introduced (a new agent
CLI's `~/.newtool`, say) and leaves everything you already have alone. It does
not merge new files into a directory the mount already has, which is what the
per-tool volumes did before.

Hermes is split: when the `hermes` binary is present (after
`agro harness install hermes`), `HERMES_HOME` is the project-local
bind-mounted `~/harness/.hermes/` directory. The entrypoint links `.hermes/skills/openharness` to the tracked
shared skill directory (`.agro/skills/`) so Hermes sees the same harness skills as
Claude, Codex, and Pi without copying them into runtime state. Project-local
runtime contents are gitignored except `.hermes/README.md`.

`agro destroy` and `docker compose down -v` delete the named volume and everything
in it — provider credentials included; use `agro stop` when you want them to
survive. When `storage.homePath` points at a host bind, `down -v` cannot remove
it, and `agro destroy` says so.

#### Migrating from the per-tool volumes

Releases before this change kept eleven separate volumes (`claude-auth`,
`config-dir`, `ssh-config`, and so on). They are not migrated automatically.
**Before** upgrading, copy the old home out of the still-running container:

```bash
mkdir -p /srv/openharness-home
docker cp <sandbox-name>:/home/sandbox/. /srv/openharness-home
rm -rf /srv/openharness-home/harness
agro config set --sandbox <sandbox-name> storage.homePath /srv/openharness-home
```

The trailing `/.` matters: without it `docker cp` places the copy at
`/srv/openharness-home/sandbox/` instead of unpacking its contents, and the
sandbox comes up freshly seeded as though nothing was migrated. The `rm -rf`
drops the copy of the repository checkout — `docker cp` reads through the bind
mount, so the archive includes `harness/` with its `.git` and `node_modules`,
which can be several GB and is shadowed by the checkout bind at runtime anyway.

Then rebuild. To stay on a Docker-managed volume instead, copy that directory
into the new volume once:

```bash
docker run --rm -v <sandbox-name>_workspace:/to -v /srv/openharness-home:/from \
  alpine cp -a /from/. /to/
```

Skipping this loses every agent login and the SSH keys; nothing else breaks, and
you simply sign in again.

Downstream harness packs and Pi extensions can introduce additional volumes or bind-mount overlays by adding paths to `composeOverrides[]` in the tracked `agro.json`. That list is the one place overlay paths live, and only `oh` applies it: VS Code "Reopen in Container" reads `.devcontainer/docker-compose.yml` alone and applies [no overlays at all](lifecycle-commands.md#vs-code-reopen-in-container-applies-no-overlays).
