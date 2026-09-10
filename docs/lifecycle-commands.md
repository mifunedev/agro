---
title: "Lifecycle commands"
---

# Lifecycle commands (`agro`)

`agro` is the only front door to the sandbox lifecycle. This page is the single
source of truth for the verbs; every other document links here rather than
restating them.

Every `agro <verb>` is also available as `oh <verb>`. `oh` is the compatibility
alias: the same executable, invoked under its legacy name, for the window the
[AGRO compatibility contract](agro-compatibility.md) defines. The one verb whose
meaning depends on the name is `update` — see
[`agro update`](#upgrading-the-cli-agro-update) and
[`oh update`](#equipping-a-checkout-oh-update) below.

Every compose verb runs `.agro/scripts/docker-compose.sh`, which owns overlay
resolution, project naming, and env plumbing. `agro` is the surface; the script
is the mechanism.

A sandbox is a **registry entry** under `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`.
`agro sandbox install docker` writes it, and every later verb finds it by name
from any directory — no project checkout required. A registry created by an
earlier release stays at `${OH_HOME:-~/.oh}/sandboxes/<name>/` and still
resolves; `agro migrate --home` moves it. Details:
[Configuration → the two `agro.json` files](configuration.md#the-two-agrojson-files).

Host prerequisites: **Docker** (with the Compose plugin), **Git**, and
**Node.js ≥ 20**. Node runs `agro` itself; `get-agro.sh` installs it for you
when it is missing. Everything else — pnpm, Python, the agent CLIs — lives inside the
sandbox.

## The verbs

| Verb | Runs |
|---|---|
| `agro sandbox install <runtime> [--name <name>] [--repo <dir>] [--yes] [--image[=<ref>]] [--no-build]` | write the registry entry, then `docker-compose.sh up -d` inside it |
| `agro sandbox list [--json]` | every registry entry: name, runtime, status, repo |
| `agro shell [name]` | an interactive `zsh` in the sandbox container |
| `agro stop [name]` | `docker-compose.sh stop` — containers down, volumes kept |
| `agro restart [name]` | `docker-compose.sh restart` |
| `agro logs [name]` | `docker-compose.sh logs -f` |
| `agro ps [name]` | `docker-compose.sh ps` |
| `agro destroy [name] [--yes]` | `docker-compose.sh down -v`, then remove the registry entry — see below |
| `agro compose config` | `docker-compose.sh config` — the resolved compose file |
| `agro update [--dry-run]` | upgrade the installed `agro` executable through the mechanism that installed it — see below |
| `agro migrate [--check] [--home] [--json]` | move a legacy `.oh/` project or `~/.oh` registry to the AGRO names — see below |
| `oh update [--from <dir> \| --from-remote [--ref <ref>]] [--dry-run] [--force]` | equip an empty checkout with `.agro/` + `crons/`, and upgrade an equipped one (compatibility window) |
| `agro config show [--sandbox <name>]` · `agro config set <field> <value> [--sandbox <name>]` | read and write `agro.json` |
| `agro config repo` · `agro config <integration>` | GitHub-remote and integration wizards |
| `agro secret set <KEY> [--sandbox <name>]` · `agro secret list [--sandbox <name>]` | read and write the gitignored `.env` |
| `agro gateway <pi\|hermes>` · `agro gateway status` | `.agro/scripts/gateway.sh` |
| `agro harness` · `agro tool` | install and inspect harnesses and tooling |
| `agro cloud` | manage OpenHarness Cloud nodes |
| `agro --help` · `agro --version` | usage and version |

`agro <verb> -- <args>` forwards extra arguments to `docker compose`, e.g.
`agro logs -- --tail 50`.

## Creating a sandbox

`agro sandbox install docker` is the one command that creates a sandbox. It runs
from **any** directory:

```bash
agro sandbox install docker      # wizard: name, timezone, git identity, SSH, Docker socket
agro shell <name>                # attach as the sandbox user
```

- The entry lands in `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`, holding its own
  `agro.json`, its `.env`, and the compose files plus the wrapper script the CLI
  re-materialises on every lifecycle call. Edit `agro.json`; the rest is generated.
- The default name is `agro-sbx-<n>`, the lowest unused number. `--yes` prompts
  zero times and keeps every default.
- Without `--repo` the sandbox runs the prebuilt image and the image's
  `/opt/agro-seed` seeds the workspace volume. With `--repo <dir>` that checkout
  is bind-mounted at `/home/sandbox/harness` and can be built locally. Recipes:
  [`agro sandbox install docker`](deployment-prebuilt-image.md).
- `docker` is the only provisionable runtime today. `agro sandbox install
  microsandbox` refuses and points at
  [the runtime RFC](rfcs/rfc-runtime-support.md); inside a sandbox,
  `agro tool install microsandbox` installs the `msb` binary.

`agro sandbox` with no subcommand prints help and exits non-zero.

## How a verb finds your sandbox

`agro shell|stop|restart|logs|ps|destroy [name]` resolve in this order:

1. the `name` you passed;
2. the single registered entry, when exactly one exists;
3. the entry whose `repo` contains the current directory;
4. otherwise an error listing every registered name.

`agro sandbox list` prints that list, with the container status of each.

## Upgrading the CLI: `agro update`

`agro update` upgrades exactly one thing: the `agro` executable that is running.
It writes no project file — no `.agro/`, no `agro.json`, no `.env` — and it never
asks for `sudo`. The upgrade follows whichever mechanism installed the
executable:

| Installation | Detected as | What `agro update` does |
|---|---|---|
| `npm install -g @mifune/agro` | realpath under `node_modules/@mifune/agro/` | reads the registry version with `npm view`, then runs `npm install -g --prefix <owning prefix> @mifune/agro@<version>` |
| `get-agro.sh` | a plain file | downloads `AGRO_JS_URL` (falls back to `OH_JS_URL`; default `https://github.com/mifunedev/agro/releases/latest/download/agro.js`) into the same directory, checks its shebang and `--version`, renames it over the executable, and keeps `<path>.prev` until the new file verifies |

It refuses, and prints the supported procedure, when the executable is shipped
by the sandbox image (`/opt/oh`), is a source checkout's `dist/`, belongs to the
legacy `@mifune/openharness` package, cannot be resolved, sits in a read-only
directory, is shadowed by another `agro` earlier on PATH, or does not report the
running version. Downgrades are refused. When the installed version is already
current it changes nothing. `--dry-run` reports the installation kind, target,
and versions without changing anything.

`agro update` rejects the payload flags `--from`, `--from-remote`, `--ref`, and
`--force` and points at `oh update`.

## Equipping a checkout: `oh update`

During the compatibility window, `oh update` is the command that vendors the
`.agro/` control plane and `crons/` into the current directory. An empty directory
is equipped from scratch; an equipped one is upgraded. Payload precedence:
`--from <dir>`, then `--from-remote [--ref <ref>]`, then the CLI's own bundled
payload, then a remote fetch announced on one line. `--dry-run` previews the
changes; `--force` overrides the up-to-date and downgrade gate.

It writes **nothing else** — no `agro.json`, no `.env`, no `AGENTS.md`, no
`.gitignore` line, no `.devcontainer/`, no provider configuration. Those files
are yours. It never prompts. It does not upgrade the CLI itself; that is
`agro update`.

## Migrating to the AGRO names: `agro migrate`

`agro migrate` moves an installation created under the legacy names to the AGRO
names. It renames `.oh/` to `.agro/` and `oh.json` to `agro.json` wholesale,
and re-points three active provider links from `../.oh/…` to `../.agro/…`:
`.claude/skills`, `.claude/hooks`, and `.agents/skills`.
The retired links are `.pi/skills` and `.codex/skills`.
If a retired link resolves to the Open Harness pack and `.agents/skills` independently links to that pack, migration moves the retired link to `<path>.migrated`.
Otherwise, migration preserves the retired path. Migration re-points a preserved
`../.oh/skills` link to `../.agro/skills` so discovery survives the pack rename.
Custom directories and foreign links remain unchanged. An existing retirement
marker blocks retirement without overwriting the marker.
Byte-identical legacy copies move to `<name>.migrated` instead of deletion.
`oh migrate` dispatches to the same command.

`bash .agro/scripts/link-providers.sh --init` repairs active links before retirement.
Unlike CLI migration, this script refuses custom retired paths and unresolved collisions.
Its `--check` mode reports retired links without changing files.
Fresh clones omit both retired links; `.codex/` and `.pi/` retain provider configuration.

Project mode is the default: it starts at the current directory and walks up to
the nearest ancestor holding `.oh/`, `.agro/`, `oh.json`, or `agro.json`.

| Flag | Effect |
|---|---|
| `--check` | print the plan and change nothing |
| `--home` | migrate the sandbox registry `~/.oh/sandboxes` → `~/.agro/sandboxes` instead of a project |
| `--json` | emit the plan (`--check`) or `{plan, result}` as JSON on stdout |

```bash
agro migrate --check   # plan the project in this directory
agro migrate           # apply it
agro migrate --home    # move the registry instead
```

| Exit code | Meaning |
|---|---|
| `0` | applied, or nothing to do |
| `2` | refused: a conflict, or the `.agro-migrate.lock` is held |
| `1` | failure |

It is idempotent: a second run is a no-op. It never merges and has no force
option — divergent `.oh/` and `.agro/` (or `oh.json` and `agro.json`) copies are
refused with the differing entries named, and you keep exactly one copy or make
them identical. It preserves unknown files, permission bits, and symlink targets,
and it never touches `~/.openharness`, `.env`, or git history.

## Where you are standing when you type `agro`

`agro` runs on the host **and** inside the sandbox, and it resolves a different
execution target for each. On the host it drives the container through Docker
Compose. Inside the sandbox it runs commands directly, because the sandbox *is*
the environment those commands target.

Detection is automatic: `agro` treats itself as in-sandbox when `/.dockerenv`
exists **and** `SANDBOX_NAME` is set. Override it with
`AGRO_EXECUTION_TARGET=local` or `AGRO_EXECUTION_TARGET=docker-compose`; the
legacy `OH_EXECUTION_TARGET` spelling still applies when the AGRO one is unset.

| Verb | On the host | Inside the sandbox |
|---|---|---|
| `agro harness install` · `agro tool install` | installs into the running container over Docker Compose | installs live, in place |
| `agro harness list/status` · `agro tool list/status` | reports `?` when the container is not reachable | reports the real state of this environment |
| `agro sandbox install` | provisions the sandbox | refuses with a host-only error |
| `agro shell` | `docker exec` into the container | opens a local `zsh` |

`agro sandbox install` changes the sandbox's own Docker configuration, so it stays
host-only rather than failing halfway.

`agro harness install <id>` and `agro tool install <id>` are the only way a harness
or a tool enters the sandbox. Nothing installs at boot, so a fresh sandbox has
no `herdr` until you run `agro tool install herdr`. Each install lands in
`~/.local` in the persistent home volume; `agro destroy` removes it. See
[Harnesses Overview](harnesses/overview.md#installing-a-harness).

## `agro destroy` and its confirmation policy

`down -v` wipes the sandbox home volume, and that volume holds provider
authentication. `agro destroy` is therefore the only lifecycle verb that asks
before it runs. It names the volumes it is about to delete — read from
`.devcontainer/docker-compose.yml`, not hardcoded — then requires you to type
the sandbox name. A blank line, a wrong name, or anything else aborts with a
non-zero exit and removes nothing.

Once `down -v` succeeds the registry entry under
`${AGRO_HOME:-~/.agro}/sandboxes/<name>/` is removed too, so the name becomes
free again.

When `storage.homePath` points the home mount at a host path, `down -v` cannot
delete it. `agro destroy` says so and leaves the directory in place; remove it
yourself if you want it gone.

Non-interactive use is gated on an explicit flag. When stdin is not a terminal
and `--yes` is absent, `agro destroy` refuses outright rather than assume consent.

## `agro compose config`, not `agro config`

`agro config` already means *"read, write, or configure configuration"*
(`agro config show`, `agro config set`, `agro config <integration>`), so the
resolved-compose printer lives under its own namespace: `agro compose config`.
That leaves room for further `agro compose <passthrough>` verbs without ever
colliding with the config and integration verbs.

## VS Code "Reopen in Container" applies no overlays

Attaching VS Code to a container that `agro sandbox install docker` already
started is safe and is the recommended editor path — see
[Connecting to the sandbox](connecting.md).

**Provisioning** from VS Code is different. *Dev Containers: Reopen in
Container* reads `.devcontainer/devcontainer.json`, whose `dockerComposeFile`
lists `docker-compose.yml` and nothing else. It never runs
`.agro/scripts/docker-compose.sh`, so **no overlay applies on that path**:

- `access.ssh` → no `docker-compose.ssh.yml`, so no sshd and no published SSH port
- `access.dockerSocket` → no `docker-compose.docker-sock.yml`, so no host Docker socket
- `composeOverrides[]` → every extra overlay path is ignored

Secrets still reach that container: compose auto-loads the `.devcontainer/.env`
beside the compose file, and that file is a symlink to the root `.env`.
Non-secret `agro.json` settings only reach compose when `oh` renders them, so on
this path each variable falls back to its default in
`.devcontainer/docker-compose.yml`.

:::danger `storage.homePath` is ignored on this path
`AGRO_HOME_MOUNT` is one of those rendered-only variables, so *Reopen in
Container* falls back to the Docker-managed `<name>_workspace` volume even when
`storage.homePath` points the sandbox home at a host directory. That is a
**second, separate home**: agent logins made through `agro sandbox install docker` are not there,
and the two diverge silently from then on.

If you set `storage.homePath`, always provision with `agro sandbox install
docker` and attach.
:::

If you need any overlay, provision with `agro sandbox install docker` and then use
*Dev Containers: Attach to Running Container* instead of *Reopen in Container*.
