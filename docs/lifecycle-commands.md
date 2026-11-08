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
| `agro run [--isolation container\|microvm] [--image <ref>] [--sandbox <name>] -- <command...>` | run one command in a disposable container or microVM, or in an existing sandbox, on the host — see below |
| `agro egress log [name]` | print the last 1000 lines of the proxy access log; mark each denied line `DENIED` — needs `access.egress: "allowlist"` |
| `agro egress reload [name]` | rewrite `egress-allow.txt` and send the proxy `squid -k reconfigure`; the sandbox container keeps running — needs `access.egress: "allowlist"` |
| `agro self-upgrade [--dry-run]` (alias `agro update`) | upgrade the installed `agro` executable through the mechanism that installed it — see below |
| `agro vendor [--from <dir> \| --from-remote [--ref <ref>]] [--dry-run] [--force]` | equip an empty checkout with `.agro/`, and upgrade an equipped one |
| `agro config show [--sandbox <name>]` · `agro config set <field> <value> [--sandbox <name>]` | read and write `agro.json` |
| `agro config repo` · `agro config <integration>` | create a GitHub repo and point `origin` at it; run an integration wizard |
| `agro secret set <KEY> [--sandbox <name>]` · `agro secret list [--sandbox <name>]` | read and write the gitignored `.env` |
| `agro config langfuse` | the interactive Langfuse tracing wizard — see below |
| `agro langfuse apply` · `agro langfuse status` · `agro langfuse disable` | render, check, or remove the Langfuse tracing files — see below |
| `agro gateway <pi\|hermes>` · `agro gateway status` | `.agro/scripts/gateway.sh` |
| `agro harness` · `agro tool` | install and inspect harnesses and tooling |
| `agro tool setup t3-mobile <enable\|pair\|disable\|status>` | reach T3 Code from a phone over Tailscale Serve — see below |
| `agro workspace create [<name>] [--path <dir>] [--ref <ref>] [--json]` · `agro workspace list [--json]` | create and list host AGRO workspaces under `~/.agro/workspaces/` — see below |
| `agro auth login [--url <url>]` · `agro auth status` · `agro auth logout` · `agro auth token` | sign in to agro-console and manage the console token — see below |
| `agro node create --spec <spec> [--profile agro\|sandbox] [--docker] [--t3] [--code-server] [--ssh-key <uuid>]... [--name <name>] [--free-tier] [--json]` · `agro node list [--json]` · `agro node delete <id> [--yes]` · `agro node check [--free-tier] [--ssh-key <uuid>]...` | create, list, delete, and check remote agro-console sandbox nodes — see below |
| `agro --help` · `agro --version` | usage and version |

`agro <verb> -- <args>` forwards extra arguments to `docker compose`, e.g.
`agro logs -- --tail 50`.

![The editor terminal runs agro ps for one sandbox and shows its running container.](img/lifecycle-commands-ps.png)
Callouts: 1 is the command. 2 is the running sandbox container.

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
- `docker` and `openshell` are the provisionable runtimes. `openshell` is
  experimental and interactive-only: `agro sandbox install openshell` never
  prompts, refuses `--checkout` and `--home-mount`, and needs the host
  `openshell` CLI. See [NVIDIA OpenShell](runtimes/openshell.md). On an
  `openshell` entry, `agro stop`, `restart`, `logs`, `ps`, `compose config`,
  and `sandbox upgrade` exit 1 and print the `openshell` command to run.
- `agro sandbox install microsandbox` refuses. Inside a sandbox,
  `agro tool install microsandbox` installs the `msb` binary.

`agro sandbox` with no subcommand prints help and exits non-zero.

## How a verb finds your sandbox

`agro shell|stop|restart|logs|ps|destroy [name]` resolve in this order:

1. the `name` you passed;
2. the single registered entry, when exactly one exists;
3. the entry whose `checkout` contains the current directory, under either that
   field or the alias `repo`;
4. otherwise an error listing every registered name.

`agro sandbox list` prints that list, with the container status of each.

![The editor terminal runs agro sandbox list and shows one registry entry.](img/lifecycle-commands-sandbox-list.png)
Callouts: 1 is the command. 2 is name, runtime, status, and checkout.

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
`.agro/` control plane into the current directory. `agro vendor`
equips an empty directory from scratch and upgrades an equipped directory. Payload precedence:
`--from <dir>`, then `--from-remote [--ref <ref>]`, then the CLI's own bundled
payload, then a remote fetch announced on one line. `--dry-run` previews the
changes; `--force` overrides the up-to-date and downgrade gate.

It writes **nothing else** — no `agro.json`, no `.env`, no `AGENTS.md`, no
`.gitignore` line, no `.devcontainer/`, no provider configuration. Those files
are yours. `agro vendor` never prompts. `agro vendor` does not upgrade the CLI
itself; `agro update` does.

## Running a command in a disposable container: `agro run`

Run `agro run [--image <ref>] -- <command...>` on the host. The command refuses
inside a sandbox and exits 1. `agro run` runs `docker run --rm` with the command and
removes the container when the command stops.

The image is `--image <ref>`, else `image.ref` in `agro.json`, else the official
image for the CLI version.

The container gets these limits:

- The container mounts only the git repository root at the same path. Outside a repository,
  the container mounts only the current directory at the same path.
- The container runs the command in the current directory as the host uid and gid, with
  `HOME=/tmp`.
- The container gets no host environment variables, no home directory, and no Docker socket.
- When `access.egress` is `open`, the container uses the default Docker network if
  `agro.json` declares no services. The container then has open egress.

### Services: `run.services` and `run.env`

Declare services in `run.services` of `agro.json`. Each key is the service name. Each
service has these fields:

- `image`: the image of the service container. Each service must have an `image`.
- `env`: environment variables for the service container. This field is optional.
- `ready`: a shell command that `agro run` executes in the service container with
  `sh -c`. Exit code 0 means that the service is ready. This field is optional.

`run.env` holds environment variables for the command container. `run.env` applies
only when `run.services` declares at least one service.

This example starts PostgreSQL for a test command:

```json
{
  "run": {
    "services": {
      "postgres": {
        "image": "postgres:17-alpine",
        "env": { "POSTGRES_PASSWORD": "agro" },
        "ready": "pg_isready -U postgres"
      }
    },
    "env": {
      "TEST_DATABASE_URL": "postgres://postgres:agro@postgres:5432/postgres"
    }
  }
}
```

When services exist, each `agro run` does these steps:

1. Create one Docker network with the name `agro-run-<id>`, where `<id>` is new for each invocation.
2. Start a new container for each service on that network. The container name is
   `agro-run-<id>-<service>`, and the network alias is the service name. The command
   reaches the service at the host name `postgres` in the example.
3. Execute the `ready` command of each service one time each second, for a maximum of
   60 s. If a service is not ready after 60 s, `agro run` exits 1 and names the service.
4. Run the command on the same network with the variables from `run.env`.
5. Remove the service containers and the network after the command stops. `agro run`
   also removes them after a failure.

### Egress allowlist: `access.egress: "allowlist"`

When `agro.json` sets `access.egress` to `allowlist`, `agro run` removes the direct
route out. This applies with or without services. Each `agro run` does these steps:

1. Create the network `agro-run-<id>` with `--internal`. The network has no route to
   the internet. The command and the services use this network.
2. Create the network `agro-run-<id>-out` for the proxy.
3. Start the squid proxy container `agro-run-<id>-proxy` on `agro-run-<id>-out`. The
   proxy uses the same pinned image and `squid.conf` as the sandbox egress overlay.
   `agro run` writes `squid.conf` and the host list to a temporary directory and mounts
   them read-only.
4. Connect the proxy to `agro-run-<id>` with the network alias `proxy`.
5. Start the services as described above.
6. Wait for the proxy to accept connections on port 3128, for a maximum of 60 s. If the
   proxy is not ready after 60 s, `agro run` exits 1. Then wait for the services and run
   the command on `agro-run-<id>`.

The proxy permits the OpenShell policy hosts plus the hosts in `access.egressAllow`.
The command gets these environment variables in addition to `run.env`:

- `HTTPS_PROXY`, `HTTP_PROXY`, `https_proxy`, and `http_proxy`: `http://proxy:3128`.
- `NO_PROXY` and `no_proxy`: `localhost`, `127.0.0.1`, and each service name.
- `NODE_USE_ENV_PROXY`: `1`.

A client that ignores the proxy variables cannot reach the internet.

After the command stops, `agro run` removes the proxy container, the service
containers, both networks, and the temporary directory. `agro run` also removes them
after a failure.

`agro.json` is a tracked file. Do not put secrets in `run.services` or `run.env`.

### MicroVM isolation

Run `agro run --isolation microvm -- <command...>` on the host to run the command in
an msb microVM. The microVM has its own kernel. The default is `--isolation container`.

Before the run, `agro run` does these checks. If a check fails, `agro run` exits 1 and
prints the remedy:

- `msb --version` must report exactly `0.7.13`. Remedy: install msb 0.7.13 with
  `agro tool install microsandbox` and keep it pinned at 0.7.13.
- `/dev/kvm` must open for read and write. Remedy: add the user to the `kvm` group
  (`sudo usermod -aG kvm $USER`) and start a new login session.

The image is `--image <ref>`, else `run.microvm.image` in `agro.json`, else
`ghcr.io/mifunedev/agro:<version>-msb` for the CLI version. Each release builds the
`agro-msb` target of `.devcontainer/Dockerfile` and publishes the `<version>-msb` and
`sha-<commit>-msb` tags.

```json
{
  "run": {
    "microvm": { "image": "ghcr.io/mifunedev/agro:0.31.0-msb" }
  }
}
```

The microVM gets these limits:

- The microVM mounts only the git repository root at the same path. Outside a
  repository, the microVM mounts only the current directory at the same path.
- The microVM runs the command in the current directory as the guest user `sandbox`.
- The microVM gets no host environment variables, no host home directory, and no
  Docker socket.

Each run has the sandbox name `agro-run-<id>`, where `<id>` is new for each
invocation. `agro run` removes the sandbox with `msb rm --force` after the command
stops, also after a failure. If the removal fails, `agro run` prints a warning.

After each run, `agro run` appends one JSON line to
`${AGRO_HOME:-~/.agro}/runs/microvm.jsonl`. Each line has these fields:

- `time`: the start time in ISO 8601 format.
- `image`: the image reference.
- `digest`: the image digest from `msb image inspect`, or `null`.
- `bootToExitMs`: the time from the start of `msb run` to the exit of the command, in
  milliseconds.
- `exitCode`: the exit code of the command.

If `agro run` cannot write the log, it prints a warning and keeps the exit code of the
command.

With a cached image, the boot-to-exit time on a KVM host is about 1.4 s.

The microVM mode does not support `run.services` or `access.egress: "allowlist"` yet.
With either setting, `agro run --isolation microvm` exits 1.

Known caveat: a file that the guest creates in the mount has mode 600 on the host, and
a directory has mode 700. The host file loses the executable bit. msb keeps the guest
owner and mode in the extended attribute `user.msb.override_stat`.

The exit code of `agro run` is the exit code of the command. The decision is
[ADR #1575](https://github.com/mifunedev/agro/issues/1575).

### Existing sandbox: `--sandbox`

Add `--sandbox <name>` to run the command in an existing sandbox. `agro run` does not
create a disposable target. `--isolation` selects the runtime:

- `agro run --sandbox <name> -- <command...>` runs the command in the registered AGRO
  sandbox `<name>`, as `agro shell <name>` does. `agro run` runs
  `docker exec -u sandbox`.
- `agro run --isolation microvm --sandbox <name> -- <command...>` runs the command in
  the running msb microVM `<name>`. `agro run` runs `msb exec -u sandbox`. Before the
  run, `agro run` checks that `msb --version` reports exactly `0.7.13`. `agro run`
  does not check `/dev/kvm`.

In both modes, these rules apply:

- The command runs as the user `sandbox` in the default working directory of the
  sandbox. The command uses the workspace of the sandbox, not the host checkout.
- `agro run` mounts no host path.
- `agro run` never starts, stops, or removes the sandbox.
- `agro run` does not apply `run.services`, `run.env`, or `access.egress`.
- `agro run` writes no line to `microvm.jsonl`.
- The exit code of `agro run` is the exit code of the command.
- `agro run` runs only on the host. Inside a sandbox, `agro run` exits 1.

If the sandbox is not running, `agro run` runs no command and exits 1 with one of these
messages:

```text
agro run: sandbox <name> is not running — start it with `agro restart <name>`
agro run: microVM <name> is not running — start it with `msb start <name>`
```

If no registered AGRO sandbox has the name `<name>`, `agro run` prints the registry
error and exits 1.

`--image` and `--sandbox` together are a usage error, because the sandbox sets the
image. `agro run` prints `agro run: --image cannot be combined with --sandbox` and exits
1.

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
| `agro tool setup t3-mobile` | acts on the host | acts in the sandbox |
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

## Phone access to T3 Code: `agro tool setup t3-mobile`

`agro tool setup t3-mobile` connects T3 Code to a phone over Tailscale Serve. The
verb acts on the machine that runs the verb. Each action passes the upstream
output and exit status through.

| Action | Effect |
|---|---|
| `enable` | installs Tailscale when Tailscale is missing. Starts one userspace `tailscaled`: the systemd unit `agro-tailscaled.service` when systemd runs and `sudo -n true` succeeds, else the tmux session `agent-tailscaled`. Debug the unit with `journalctl -u agro-tailscaled.service`, or the session with `tmux capture-pane -pt agent-tailscaled`. Then runs `tailscale up`, `tailscale serve --bg --https=443 http://127.0.0.1:3773`, and the pair command |
| `pair` | runs the pair command only: `t3 pair --tailscale`, or `npx --yes t3@latest pair --tailscale` when `t3` is not on `PATH` |
| `disable` | runs `tailscale serve --https=443 off` |
| `status` | runs `tailscale status`, then `tailscale serve status` |

The verb has no `update` action. Run `t3 update` to update T3 Code. The full
procedure is in
[Connecting → Mobile access over Tailscale](connecting.md#mobile-access-over-tailscale).

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

## Console sign-in: `agro auth`

`agro auth` signs in to the agro-console API and manages the console token.
Run `agro auth` on the host that runs `agro node`.

```bash
agro auth login     # sign in through the browser, store the token
agro auth status    # show the signed-in identity
agro auth logout    # revoke the token, delete the credentials file
agro auth token     # print the token
```

- `agro auth login` starts a device authorization. The command prints
  `Open <url> and enter the code <code>`. Open the URL in a browser and approve
  the code. After the approval, the command writes the credentials file, prints
  `logged in to <url> as <login>`, and exits 0. If the operator denies the code
  or the code expires, the command writes no file and exits 1.
- `agro auth login --url <url>` signs in to that console. Without `--url`, the
  command uses `AGRO_CONSOLE_URL`, then `https://console.mifune.dev`.
- The credentials file is `$XDG_CONFIG_HOME/agro/console.json`. When
  `XDG_CONFIG_HOME` is not set, the file is `~/.config/agro/console.json`. The
  file has mode `0600`. The CLI does not read a console token from the project
  `.env`.
- `agro auth status` prints the URL, the login, the role, the org, the token
  source (`env` or `file`), and the token prefix. The command never prints the
  full token. When no token resolves or the console rejects the token, the
  command exits 1.
- `agro auth logout` revokes the token in the console, deletes the credentials
  file, and exits 0. If the console reports that the token is already revoked,
  the command deletes the credentials file, prints
  `token was already revoked; removed local credentials`, and exits 0.
- `agro auth token` prints the token on stdout. When no token resolves, the
  command exits 1.
- If the environment sets `AGRO_CONSOLE_TOKEN`, the CLI uses that token with
  `AGRO_CONSOLE_URL`, then `https://console.mifune.dev`. The CLI does not read
  the credentials file in this case. Use the environment variables in CI.
- If the environment does not set `AGRO_CONSOLE_TOKEN`, the CLI uses the token
  and the URL from the credentials file. `AGRO_CONSOLE_URL` does not change the
  URL of a token from the credentials file. When the file has no URL, the CLI
  uses `https://console.mifune.dev`.
- When the token comes from `AGRO_CONSOLE_TOKEN`, `agro auth logout` exits 1
  and prints `token comes from AGRO_CONSOLE_TOKEN; unset it to log out`.

## Remote console nodes: `agro node`

`agro node` manages remote VMs through the agro-console API. `agro node` does not manage
local Docker sandboxes. Use `agro sandbox` for a local sandbox.

```bash
agro node create --spec <spec>   # create a sandbox node, wait for running
agro node create --spec n4 --profile agro --t3   # create an agro-profile node with T3
agro node list                   # every node: id, name, profile, status, IPv4
agro node delete <id>            # destroy one node after a confirmation
agro node check --free-tier      # check the SSH key and the free tier, create nothing
```

- Each verb finds the token and the URL in the same order as `agro auth`. If
  the environment sets `AGRO_CONSOLE_TOKEN`, the verb uses that token with
  `AGRO_CONSOLE_URL`. Otherwise the verb uses the token and the URL from the
  credentials file that `agro auth login` writes.
- The console URL is `https://console.mifune.dev` by default. If no token
  resolves, the verb exits 1 and prints
  `not logged in to agro-console: run agro auth login`.
- `agro node create` creates a node with the profile `sandbox` by default.
  `--profile agro` creates a node with the profile `agro`. If `--profile` has
  another value, the command exits 1 and prints this error:

  ```text
  --profile must be agro or sandbox
  ```

  `--spec` is mandatory. `--free-tier` requests the agro-console free tier and
  sets the default spec to `n4`. `--name` sets the node name.
- `--docker`, `--t3`, and `--code-server` require `--profile agro`. If the
  profile is `sandbox`, the command exits 1 before it calls the console and
  prints `<flag> requires --profile agro`. Each given flag turns on its app.
  If you do not give an app flag, the console default applies: Docker on, T3
  off, code-server off.
- If the console turns off runtime settings, `--code-server` makes the command
  exit 1 and print
  `HTTP 422 RUNTIME_SETTINGS_DISABLED: Runtime settings are disabled`.
- `--ssh-key <uuid>` is optional. When you give one or more `--ssh-key` flags,
  the command uses only those console SSH keys. When you give no `--ssh-key`,
  the command reads `~/.ssh/id_ed25519.pub`. The command reuses the console SSH
  key that matches this public key. If no console key matches, the command
  registers the public key with the name `agro-cli@<hostname>`. If
  `~/.ssh/id_ed25519.pub` does not exist, the command exits 1 and prints
  `no --ssh-key given and ~/.ssh/id_ed25519.pub not found`.
- `agro node create` waits up to 15 minutes for the status `running`, then
  prints the node id, the status, and the SSH command. If the node fails or does
  not reach `running` in 15 minutes, the command exits 1 and prints the last
  status.
- `agro node list` prints one row for each node. If no node exists, the command
  prints `no nodes`.
- `agro node delete <id>` asks for a confirmation. `--yes` skips the
  confirmation. Destroy needs the admin role in agro-console. If the console
  returns HTTP 403, the command exits 1 and prints
  `destroy needs the admin role in agro-console`.
- `agro node check` sends only `GET` requests and creates nothing. Without
  `--ssh-key`, the command finds `~/.ssh/id_ed25519.pub` among the console SSH
  keys by key identity. With `--ssh-key <uuid>`, the command finds each id among
  the console SSH keys. `--free-tier` also reads the free tier eligibility of
  the console account. The command prints one line for each check, for example
  `ok ssh-key <id>` or `fail free-tier: ...`. Each failure line names a remedy.
  The command exits 0 only when each check passes. Otherwise it exits 1.
- `--json` on `create` and `list` prints JSON instead of text.

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
