---
title: "NVIDIA OpenShell"
---

# NVIDIA OpenShell

[NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) runs the published AGRO
image as a non-root workload under a default-deny policy. The `openshell`
runtime is **provisionable**.

> **Experimental.** The `openshell` runtime is experimental in v1. The runtime
> is **interactive-only**: no cron runtime and no unattended schedule run in an
> OpenShell sandbox. The runtime supports **Claude Code only**: the policy gives
> network access to Anthropic hosts and to no other model provider.

V1 proves one loop: install, shell, list, and destroy. Every other lifecycle
verb prints the equivalent `openshell` command and exits 1.

## Host prerequisites

The operator prepares the host before the first `agro sandbox install openshell`.
Every `openshell` command runs on the host. `agro` never installs OpenShell.

| Prerequisite | Value |
|---|---|
| OpenShell CLI | `v0.1.2` or later |
| Docker | 28.0 or later |
| Linux kernel | Landlock ABI 3 (Linux 6.2 or later), with seccomp user notification |
| Gateway | the user service `openshell-gateway` on `https://127.0.0.1:17670`, with status `connected` |
| WSL 2 | upstream marks WSL 2 as experimental |

If the `openshell` binary is not on `PATH`, `agro sandbox install openshell`
exits 1 and prints this text:

```text
agro sandbox install: install the OpenShell CLI on the host, then run the command again:
  curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | OPENSHELL_VERSION=v0.1.2 sh
review-first alternative — download the script, inspect it, then run it:
  curl -LsSf -o openshell-install.sh https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh
  less openshell-install.sh
  OPENSHELL_VERSION=v0.1.2 sh openshell-install.sh
```

Use the review-first alternative. Read `openshell-install.sh` before you run the script.

If `openshell status -o json` exits non-zero or reports a `status` other than
`connected`, the command exits 1 and prints this text:

```text
agro sandbox install: the OpenShell gateway is not connected; start the local gateway and register it:
  systemctl --user restart openshell-gateway
  openshell gateway add https://127.0.0.1:17670 --local --name openshell
then confirm with: openshell status
```

## Create a sandbox

Run `agro sandbox install openshell` on the host:

```bash
agro sandbox install openshell [--name <name>] [--image=<ref>] [--print-argv] [--yes]
```

The command never prompts. The name, the timezone, and the git identity come
from the flags and the defaults. The default name is the lowest free
`agro-sbx-<n>`. The command runs the official release image, or the
`--image=<ref>` value.

`--print-argv` prints the `openshell sandbox create` argv and writes no registry
entry:

```text
$ agro sandbox install openshell --name os-demo --print-argv
openshell sandbox create --name os-demo --from ghcr.io/mifunedev/agro:0.15.0 --policy /home/<user>/.agro/sandboxes/os-demo/openshell-policy.yaml --env AGRO_EXECUTION_TARGET=local --env SANDBOX_NAME=os-demo --detach -- /usr/local/bin/openshell-main.sh
```

A successful run writes `agro.json` with `runtime: "openshell"` and
`image.mode: "image"`, then prints `next: agro shell <name>`. If
`openshell sandbox create` exits non-zero, the command exits with the same code
and removes the new registry entry.

The command refuses three options. Each refusal exits 1 and names the
`openshell` runtime:

| Option | Message |
|---|---|
| `--checkout <dir>` | `agro sandbox install: --checkout is not supported on the openshell runtime` |
| `--home-mount <dir>` | `agro sandbox install: --home-mount is not supported on the openshell runtime` |
| `image.mode: "build"` in `agro.json`, without `--image` | `agro sandbox install: image.mode "build" is not supported on the openshell runtime` |

`agro sandbox --help` lists the runtime:

```text
Runtimes:
  docker        provisionable
  microsandbox  planned
  openshell     provisionable
```

## The verb table

Each `agro` verb routes to OpenShell or refuses. A refusal exits 1 and prints
the `openshell` command to run.

| agro verb | V1 behavior |
|---|---|
| `agro shell <name>` | runs `openshell sandbox exec -n <name> --tty --workdir /home/sandbox/harness -- zsh -l` |
| `agro sandbox list` | reads the status from `openshell sandbox get <name> -o json` |
| `agro destroy <name>` | asks for confirmation, runs `openshell sandbox delete <name>`, then removes the registry entry |
| `agro stop <name>` | refuses; prints `openshell sandbox stop <name>` |
| `agro restart <name>` | refuses; prints `openshell sandbox stop <name> && openshell sandbox start <name>` |
| `agro logs <name>` | refuses; prints `openshell logs <name>` |
| `agro ps <name>` | refuses; prints `openshell sandbox get <name>` |
| `agro compose config` | refuses; prints `openshell policy get <name>` |
| `agro sandbox upgrade <name>` | refuses; prints `agro destroy <name>, then agro sandbox install openshell --name <name> --image=<ref>` |

This example shows one refusal:

```text
$ agro stop os-demo
agro stop: the openshell runtime does not support stop; run: openshell sandbox stop os-demo
```

`agro sandbox list` maps the OpenShell phase to a status:

| OpenShell phase | Status |
|---|---|
| `Ready` | `ready` |
| `Provisioning`, `Starting` | `starting` |
| `Stopping`, `Stopped`, `Deleting`, `Completed` | `stopped` |
| `Error`, `Unknown`, `Unspecified`, or an unlisted value | `failed` |
| `sandbox not found` | `absent` |

## Name resolution

An OpenShell entry takes the sandbox name from the `name` field in the entry
`agro.json`. If the field is empty, the entry takes the name of the entry
directory. The CLI never reads `SANDBOX_NAME` for an OpenShell entry.

## The policy

The canonical policy is `.devcontainer/openshell-policy.yaml`. The CLI writes a
copy to `<entry>/openshell-policy.yaml` on every lifecycle call. Edit the
canonical file, not the entry copy. The next lifecycle call replaces the entry
copy.

The policy sets `process.run_as_user: sandbox` and
`process.run_as_group: sandbox`. The policy denies all egress by default. The
policy holds three network rules. Each rule names the binaries that the rule
lets through:

| Rule | Hosts | Binaries | Access |
|---|---|---|---|
| `github` | `github.com`, `api.github.com`, `release-assets.githubusercontent.com` | `/usr/bin/git`, `/usr/bin/gh`, `/usr/bin/curl` | read and write on `github.com` and `api.github.com`; read-only on `release-assets.githubusercontent.com` |
| `npm` | `registry.npmjs.org` | `/usr/local/bin/node` | read-only |
| `anthropic` | `api.anthropic.com` | `/home/sandbox/.local/lib/node_modules/@anthropic-ai/claude-code/bin/*` | read and write |

The `github` rule permits `git push` over HTTPS. The operator approved agent
`git push` on 2026-09-28. The `github` rule also permits the release downloads
that `agro tool install herdr` uses.

Claude Code tools, for example WebFetch, reach only the `anthropic` hosts. A
Claude Code tool cannot fetch a page from any other host.

The Claude Code sign-in can need more hosts than `api.anthropic.com`. The list
of `<claude login hosts>` waits for a live observation. If the sign-in fails on
a denied host, add the host to the `anthropic` rule in the live policy.

Network rules reload while the sandbox runs. Filesystem and process fields apply
only when OpenShell creates the sandbox. To change the live network policy, run
this command on the host:

```bash
openshell policy set <name> --policy <file> --wait
```

## Process model

1. OpenShell replaces the image `ENTRYPOINT`, `CMD`, and `USER` with its
   supervisor.
2. The supervisor starts `/usr/local/bin/openshell-main.sh` as the main process.
3. `openshell-main.sh` runs the non-root steps of `entrypoint.sh`: home seed,
   workspace seed, provider links, and git identity.
4. `openshell-main.sh` then runs `exec sleep infinity`.

No systemd runs in an OpenShell sandbox, and no cron runtime runs in v1.

> **Warning.** A gateway restart or a host reboot stops every process in the
> sandbox. `openshell sandbox start <name>` starts a new main process in the
> kept container. Processes from before the restart do not come back.

Run interactive agents in Herdr. Inside the sandbox, run
`agro tool install herdr`, then `herdr`. To sign in to GitHub, run
`gh auth login && gh auth setup-git` inside the sandbox.

## Storage

The registry entry stays at `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`. The entry
holds `agro.json`, `.env`, and `openshell-policy.yaml`. The entry holds no
compose file.

The OpenShell gateway keeps the sandbox record. The Docker driver keeps the
container and its writable layer. The home directory and the workspace are in
that layer. `agro destroy <name>` deletes both through
`openshell sandbox delete <name>`.

## Out of scope in v1

V1 does not include these items. Each item gets one follow-up issue.

- The cron runtime and every unattended schedule. A gateway restart stops every
  process, so the design waits for live evidence.
- Routed `stop`, `restart`, `logs`, and `ps` verbs. V1 prints the `openshell`
  command instead.
- The interactive install wizard and a minimum-version check.
- Network rules for PyPI and OpenAI, and support for Python tooling and Codex.
- The `--checkout` bind mount. Bind mounts bypass the OpenShell filesystem
  policy and need three gateway settings.
- The Docker socket, sshd, and Docker inside the sandbox. The workload has no
  capabilities and no inbound network.
- Root tool installs inside the sandbox. `no_new_privs` blocks `sudo`, so each
  `installUser: "root"` tool fails.
- OpenShell provider credential injection and the upstream provider profiles.
- The MicroVM and Kubernetes drivers. The manual review covers the Docker driver
  only.
- Host install of the `openshell` binary by `agro`.
- The public page in `mifunedev/agro-web`.
