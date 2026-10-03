---
title: "Runtimes Overview"
---

# Runtimes Overview

A **runtime** is the isolation boundary that the sandbox runs on. A **harness**
is an agent CLI that runs inside the sandbox. `agro sandbox` owns the runtime
catalog. [`agro harness`](../harnesses/overview.md) owns the harness catalog.

AGRO runs on a Docker container. `agro` provisions only the Docker runtime.

## The commands

Run these commands on the host:

```bash
agro sandbox install docker    # create a sandbox on the Docker runtime
agro sandbox list              # every sandbox: name, runtime, status, checkout
agro sandbox --help            # the runtime catalog and the state of each runtime
```

`agro sandbox install docker` writes a registry entry under
`${AGRO_HOME:-~/.agro}/sandboxes/<name>/` and starts the container. See
[`agro sandbox install docker`](../deployment-prebuilt-image.md).

`agro sandbox install` is host-only. Inside a sandbox, the command exits with a
host-only error. See
[Lifecycle commands → Where you are standing when you type `agro`](../lifecycle-commands.md#where-you-are-standing-when-you-type-agro).

## The Docker daemon

The Docker daemon runs on the machine that holds the `agro` binary, not inside
the sandbox. The sandbox does not mount the host Docker socket
(`/var/run/docker.sock`) by default.

> **Warning.** A mounted socket gives the sandbox host root. The
> `agro sandbox install docker` wizard asks about the socket and records the
> answer in `access.dockerSocket` in the `agro.json` of the entry. The default
> answer is no. See [Security considerations](../security-considerations.md).

## The catalog

| Runtime | Isolation | State | Entry point |
|---|---|---|---|
| [Docker container](#the-docker-daemon) | shared host kernel, namespaces and cgroups | provisionable | `agro sandbox install docker` |
| [MicroSandbox](microsandbox.md) | microVM with its own kernel, KVM-backed | planned | `agro tool install microsandbox` installs the `msb` binary only |

`agro sandbox install microsandbox` exits with this error:

```text
agro sandbox install: microsandbox is not a provisionable runtime yet; see
https://github.com/mifunedev/agro/issues/592. Inside a sandbox run `agro tool install microsandbox`.
```

Each registry entry records the runtime that created the entry: `runtime:
"docker"` in its `agro.json`. No configuration field selects another runtime.
