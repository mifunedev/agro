---
title: "Lifecycle commands"
---

# Lifecycle commands (`agro`)

`agro` is the only front door to the sandbox lifecycle. This page is the single
source of truth for the verbs; every other document links here rather than
restating them.

`agro self-upgrade` upgrades the installed CLI.
[`agro vendor`](#equipping-a-checkout-agro-vendor) writes the `.agro/` control
plane into a checkout. Do not confuse the two.

Every compose verb runs `.agro/scripts/docker-compose.sh`. That script owns
overlay resolution, project naming, and env plumbing.

A sandbox is a **registry entry** under `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`.
`agro sandbox install docker` writes it. Every later verb finds it by name from
any directory. See
[Configuration → the two `agro.json` files](configuration.md#the-two-agrojson-files).

Host prerequisites and the CLI install are in [Installation](installation.md).

## The verbs

| Verb | Runs |
|---|---|
| `agro sandbox install <runtime> [--name <name>] [--checkout <dir>] [--home-mount <dir>] [--yes] [--version <X.Y.Z>] [--image[=<ref>]] [--no-build]` | write the registry entry, then `docker-compose.sh up -d` inside it |
| `agro sandbox list [--json]` | every registry entry: name, runtime, status, checkout |
| `agro sandbox upgrade <name> --version <X.Y.Z>` | recreate one image-mode sandbox with the specified official release image; keep its home and named volumes |
| `agro shell [name]` | an interactive `zsh` in the sandbox container |
| `agro stop [name]` | `docker-compose.sh stop` — containers down, volumes kept |
| `agro restart [name]` | `docker-compose.sh restart` |
| `agro logs [name]` | `docker-compose.sh logs -f` |
| `agro ps [name]` | `docker-compose.sh ps` |
| `agro destroy [name] [--yes]` | `docker-compose.sh down -v`, then remove the registry entry — see below |
| `agro compose config` | `docker-compose.sh config` — the resolved compose file |
| `agro self-upgrade [--dry-run]` (alias `agro update`) | upgrade the installed `agro` executable through the mechanism that installed it — see below |
| `agro vendor [--from <dir> \| --from-remote [--ref <ref>]] [--dry-run] [--force]` | equip an empty checkout with `.agro/` + `crons/`, and upgrade an equipped one |
| `agro config show [--sandbox <name>]` · `agro config set <field> <value> [--sandbox <name>]` | read and write `agro.json` |
| `agro config repo` · `agro config <integration>` | create a GitHub repo and point `origin` at it; run an integration wizard |
| `agro secret set <KEY> [--sandbox <name>]` · `agro secret list [--sandbox <name>]` | read and write the gitignored `.env` |
| `agro config langfuse` | the interactive Langfuse tracing wizard — see below |
| `agro langfuse apply` · `agro langfuse status` · `agro langfuse disable` | render, check, or remove the Langfuse tracing files — see below |
| `agro gateway <pi\|hermes>` · `agro gateway status` | `.agro/scripts/gateway.sh` |
| `agro harness` · `agro tool` | install and inspect harnesses and tooling |
| `agro workspace create [<name>] [--path <dir>] [--ref <ref>] [--json]` · `agro workspace list [--json]` | create and list host AGRO workspaces under `~/.agro/workspaces/` — see below |
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
  re-materialises on every lifecycle call. Edit `agro.json`; the CLI generates the rest.
- The default name is `agro-sbx-<n>`, the lowest unused number. `--yes` prompts
  zero times and keeps every default.
- Without `--checkout` the sandbox runs the prebuilt image and the image's
  `/opt/agro-seed` seeds the workspace volume. With `--checkout <dir>`, the CLI
  bind-mounts that checkout at `/home/sandbox/harness`, and the sandbox can build
  locally.
  `--repo <dir>` is a deprecated alias. Recipes:
  [Creating a sandbox](deployment-prebuilt-image.md).
- `docker` is the only provisionable runtime. `agro sandbox install
  microsandbox` refuses. Inside a sandbox, `agro tool install microsandbox`
  installs the `msb` binary.

`agro sandbox` with no subcommand prints help and exits non-zero.

## How a verb finds your sandbox

`agro shell|stop|restart|logs|ps|destroy [name]` resolve in this order:

1. the `name` you passed;
2. the single registered entry, when exactly one exists;
3. the entry whose `checkout` contains the current directory, under either that
   field or the alias `repo`;
4. otherwise an error listing every registered name.

`agro sandbox list` prints that list, with the container status of each.

`agro sandbox list --json` prints the same entries as JSON. Each entry carries the
bound directory under the key `checkout`. The JSON output keeps the key `repo` as
a deprecated key. It holds the identical value and stays present for existing consumers. Read
`checkout`.

## Upgrading a sandbox image: `agro sandbox upgrade`

Run `agro sandbox upgrade <name> --version X.Y.Z` on the host to apply a specific
AGRO release image to a registered image-mode sandbox. The command also accepts
a leading `v` or a release prerelease suffix. The command requires an explicit
version and never selects `latest`. The command refuses build-mode sandboxes
and missing entries.

**The command recreates the container immediately. Every active agent session,
server, and job inside that container stops.** Choose a time when the interruption
is acceptable. The new container keeps the sandbox home mount, named volumes,
checkout, `.env`, and unrelated configuration. The command does not use `down -v`.

The command records `image.ref` only after a successful start. On a failure it
keeps the old `image.ref` and tries to restore the old image. If the restore
fails, inspect the sandbox with `agro ps <name>` and repair it.

The command holds `.sandbox-upgrade.lock` in the entry while it runs. A crash or
`SIGKILL` can leave the lock, and the next upgrade of that entry refuses and
prints the lock path. To recover on the host:

1. Confirm that no upgrade process owns the entry.
2. Remove the exact lock path that the command printed.
3. Run `agro sandbox upgrade <name> --version X.Y.Z` again.

A conflicting `AGRO_SANDBOX_IMAGE` in the host shell or entry `.env` causes a
refusal before recreation.

`agro sandbox upgrade` changes the sandbox image, not the installed host CLI.
Use `agro update` to upgrade the installed CLI without changing a sandbox.

## Upgrading the CLI: `agro self-upgrade`

`agro self-upgrade` (alias: `agro update`) upgrades exactly one thing: the running `agro` executable.
The upgrade writes no project file — no `.agro/`, no `agro.json`, no `.env` — and
the upgrade never asks for `sudo`. The upgrade follows whichever mechanism installed the
executable:

| Installation | Detected as | What `agro self-upgrade` does |
|---|---|---|
| `npm install -g @mifune/agro` | realpath under `node_modules/@mifune/agro/` | reads the registry version with `npm view`, then runs `npm install -g --prefix <owning prefix> @mifune/agro@<version>` |
| `install.sh` | a plain file | downloads `AGRO_JS_URL` (default `https://github.com/mifunedev/agro/releases/latest/download/agro.js`) into the same directory, checks its shebang and `--version`, renames it over the executable, and keeps `<path>.prev` until the new file verifies |

`agro self-upgrade` refuses, and prints the supported procedure, in each of these
cases: the sandbox image ships the executable (`/opt/agro`); the executable is a
source checkout's `dist/`; the CLI cannot resolve the executable; the executable
sits in a read-only directory; another `agro` earlier on PATH shadows the
executable; or the executable does not report the running version. For the
image-shipped CLI, refresh the image from the host with `agro stop <name>`, then
`agro sandbox install docker --name <name>`. The upgrade
refuses a downgrade. When the installed version is already current, the upgrade
changes nothing. `--dry-run` reports the installation kind, target, and versions
without a change.

`agro self-upgrade` rejects the payload flags `--from`, `--from-remote`, `--ref`,
and `--force` and points at `agro vendor`.

## Equipping a checkout: `agro vendor`

`agro vendor` is the command that vendors the
`.agro/` control plane and `crons/` into the current directory. `agro vendor`
equips an empty directory from scratch and upgrades an equipped directory. Payload precedence:
`--from <dir>`, then `--from-remote [--ref <ref>]`, then the CLI's own bundled
payload, then a remote fetch announced on one line. `--dry-run` previews the
changes; `--force` overrides the up-to-date and downgrade gate.

It writes **nothing else** — no `agro.json`, no `.env`, no `AGENTS.md`, no
`.gitignore` line, no `.devcontainer/`, no provider configuration. Those files
are yours. `agro vendor` never prompts. `agro vendor` does not upgrade the CLI
itself; `agro update` does.

## Where you are standing when you type `agro`

`agro` runs on the host **and** inside the sandbox, and it resolves a different
execution target for each. On the host it drives the container through Docker
Compose. Inside the sandbox it runs commands directly, because the sandbox *is*
the environment those commands target.

Detection is automatic. `agro` treats itself as in-sandbox when the image marker
`/etc/agro/sandbox` exists. When the marker is absent, `agro` uses the fallback
rule: `/.dockerenv` exists **and** `SANDBOX_NAME` holds a value. The fallback
covers a newer CLI that runs on an older image. When only the fallback rule
matches, `agro` prints one warning line on stderr that names `/etc/agro/sandbox`.
Upgrade the sandbox image to remove the warning. Override the detection with
`AGRO_EXECUTION_TARGET=local` or `AGRO_EXECUTION_TARGET=docker-compose`.

| Verb | On the host | Inside the sandbox |
|---|---|---|
| `agro harness install` | installs into the running container over Docker Compose; offers a host install when the container is not reachable | installs live, in place |
| `agro harness uninstall` | removes from the running container over Docker Compose; removes the recorded host install when the container is not reachable | removes live, in place |
| `agro tool install` | installs into the running container over Docker Compose; offers a host install when the container is not reachable and the catalog entry allows one | installs live, in place |
| `agro tool uninstall` | removes from the running container over Docker Compose; removes the recorded host install when the container is not reachable | removes live, in place |
| `agro harness list/status` | probes the host install prefix `~/.local` when the container is not reachable; reports `?` when neither a harness root nor that prefix exists | reports the real state of this environment |
| `agro tool list/status` | probes the host install prefix `~/.local` when the container is not reachable; reports `?` when neither a harness root nor that prefix exists | reports the real state of this environment |
| `agro sandbox install` | provisions the sandbox | refuses with a host-only error |
| `agro sandbox upgrade` | recreates one image-mode sandbox with an explicit release image | refuses with a host-only error |
| `agro shell` | `docker exec` into the container | opens a local `zsh` |

`agro harness` and `agro tool` treat an unspawnable container runtime as an
unreachable sandbox. On a host with no Docker, `install`, `uninstall`, `list` and
`status` all use the host path instead of failing.

`agro sandbox install` changes the sandbox's own Docker configuration, so it stays
host-only rather than failing halfway.

`agro harness install <id>` and `agro tool install <id>` are the only way a harness
or a tool enters the sandbox. Nothing installs at boot, so a fresh sandbox has
no `herdr` until you run `agro tool install herdr`. Each install lands in
`~/.local` in the persistent home volume; `agro destroy` removes it.

`agro harness install <id>` also installs on the host. When the sandbox is not
running it uses an existing AGRO workspace as the harness root — `--workspace <name>` or
`--path <dir>`, then `harnessRoot` in `~/.agro/config.json`, then the registry entry
`~/.agro/workspaces/harness` — and installs the harness
into `~/.local` for the invoking user. The install prefix is never derived from
the harness root, so the clone stays clean. A non-interactive run needs `--host`
or `--path`; without either it keeps the refusal. See
[Harnesses Overview](harnesses/overview.md#installing-a-harness).

A harness or tool counts as installed only after a complete install. In the
sandbox, `agro harness install` writes
`~/.local/share/agro/harnesses/<id>.installed` and `agro tool install` writes
`~/.local/share/agro/tools/<id>.installed` after the full install command
succeeds. On the host, each command records a receipt in `~/.agro/config.json`.
If an install fails after the binary appears, the next install runs the full
install again. The uninstall command removes the record. A host binary outside
`~/.local` still counts as installed. A root-level host tool, such as
`docker-engine` or `desktop`, also counts as installed when its check passes.

`agro tool install <id>` uses the same host path. The host tools, their install
levels, and the root-level tools are in
[Installation → Host tools](installation.md#host-tools).

## Host workspaces: `agro workspace`

A **host workspace** is an AGRO checkout under
`${AGRO_HOME:-~/.agro}/workspaces/<name>/`. It carries the control plane that a
harness on the host reads: `AGENTS.md`, `.agro/skills/`, the hooks, and task
state. `agro workspace` is the only verb that creates one.

```bash
agro workspace create                     # clone into ~/.agro/workspaces/harness
agro workspace create default             # clone into ~/.agro/workspaces/default
agro workspace create acme                # clone into ~/.agro/workspaces/acme
agro workspace create --path /srv/agro    # clone into /srv/agro, outside the registry
agro workspace create --ref v0.15.0       # clone tag v0.15.0 into ~/.agro/workspaces/harness
agro workspace list                       # every workspace, with the default marked
agro workspace list --json                # the same rows as JSON
```

- `agro workspace create [<name>]` clones
  `https://github.com/mifunedev/agro.git` into the target directory. The command
  reuses a target that already holds a `.git` checkout, and clones nothing.
- The implicit name is `harness`. Pass `default` to create a workspace named
  `default`. The name becomes a path segment, so it obeys the sandbox name rule:
  lowercase letters, digits and dashes, starting with a letter or a digit. The
  command refuses any other name and creates nothing.
- `--path <dir>` creates the workspace outside the registry. Pass a name or
  `--path <dir>`, never both.
- `--ref <ref>` clones the branch or tag `<ref>` instead of the default branch.
  A tag gives a detached checkout. If `<ref>` does not exist, the command exits
  1, names the ref, and leaves no target directory. The command reuses a target
  that already holds a `.git` checkout and does not change its ref. `list`
  refuses `--ref`.
- `create` records no default. The command leaves `harnessRoot` in
  `~/.agro/config.json` unchanged. Only a host install writes that key.
- `agro workspace list` reports every child of `~/.agro/workspaces/` that obeys
  the name rule and holds a `.git` marker. The `DEFAULT` column marks the
  workspace that `harnessRoot` names. An empty registry prints one hint that
  names `agro workspace create`.
- `create` refuses a target directory equal to the state home `~/.agro`.

`agro harness install --host` and `agro tool install --host` create no workspace.
Each verb resolves an existing workspace and exits 1 when none resolves. The
refusal lists every workspace that exists and names `agro workspace create`. See
[Harnesses Overview](harnesses/overview.md#installing-a-harness).

## Langfuse tracing: `agro config langfuse` and `agro langfuse`

`agro config langfuse` is the interactive wizard. It writes the non-secret
fields to the `langfuse` section of `agro.json` and both keys to `.env`, then
applies the configuration. Without a TTY it runs `agro langfuse apply`.

| Verb | Runs |
|---|---|
| `agro langfuse apply` | render the credential fragment and one tracing file per harness |
| `agro langfuse status` | print the settings and the state of every generated file; exit non-zero on drift |
| `agro langfuse disable` | set `langfuse.enabled=false` and delete the credential fragment |

The generated files live in the sandbox home, so run these verbs in the
sandbox. Full reference: [Langfuse](integrations/langfuse.md).

## `agro destroy` and its confirmation policy

`down -v` wipes the sandbox home volume, and that volume holds provider
authentication. `agro destroy` is therefore the only lifecycle verb that asks
before it runs. `agro destroy` names the volumes to delete, as read
from `.devcontainer/docker-compose.yml`, not hardcoded. Next, `agro destroy`
requires you to type the sandbox name. Any other input, including a blank line or
a wrong name, aborts with a non-zero exit and removes nothing.

After `down -v` succeeds, `agro destroy` also removes the registry entry under
`${AGRO_HOME:-~/.agro}/sandboxes/<name>/`, so the name becomes free again.

When `storage.homePath` points the home mount at a host path, `down -v` cannot
delete the host directory. `agro destroy` says so and leaves the directory in place.
To delete the directory, remove the directory yourself.

Non-interactive use requires an explicit flag. When stdin is not a terminal
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
Non-secret `agro.json` settings only reach compose when `agro` renders them, so
on this path each variable falls back to its default in
`.devcontainer/docker-compose.yml`.

:::danger This path ignores `storage.homePath`
`AGRO_HOME_MOUNT` is one of those rendered-only variables, so *Reopen in
Container* falls back to the Docker-managed `<name>_workspace` volume even when
`storage.homePath` points the sandbox home at a host directory. The volume becomes a
**second, separate home**: agent logins made through `agro sandbox install docker` are not there,
and the two diverge silently from then on.

If you set `storage.homePath`, always provision with `agro sandbox install
docker` and attach.
:::

If you need any overlay, provision with `agro sandbox install docker`. Then use
*Dev Containers: Attach to Running Container* instead of *Reopen in Container*.
