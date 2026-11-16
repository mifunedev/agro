---
title: "Runtimes Overview"
---

# Runtimes Overview

A **runtime** is the isolation boundary that the sandbox runs on. A **harness**
is an agent CLI that runs inside the sandbox. `agro sandbox` owns the runtime
catalog. [`agro harness`](../harnesses/overview.md) owns the harness catalog.

AGRO runs on a Docker container. Docker is the only provisionable runtime.

## The commands

Run these commands on the host:

```bash
agro sandbox install docker    # create a sandbox on the Docker runtime
agro sandbox list              # every sandbox: name, status, checkout
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

`agro sandbox install` with any runtime other than `docker` exits 1 with this
error:

```text
agro sandbox install: unknown runtime "microsandbox" — the only runtime is docker
```

A new registry entry does not record a runtime. The `runtime` field in
`agro.json` is a legacy field, and its only accepted value is `docker`. See
[Configuration → Identity](../configuration.md#identity).
