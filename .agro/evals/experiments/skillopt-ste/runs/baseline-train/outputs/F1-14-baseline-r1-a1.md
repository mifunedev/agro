---
title: "Runtimes Overview"
---

# Runtimes Overview

A **runtime** is the isolation boundary that the sandbox runs *on*. A
**harness** is an agent CLI that runs *inside* the sandbox. A runtime and a
harness are different concepts with different lifecycles. For that reason, the
runtime catalog lives under `agro sandbox`. The harness catalog has its own
command, [`agro harness`](../harnesses/overview.md).

AGRO runs on a **Docker container**. This page does not change that runtime.

## The commands

```bash
agro sandbox install docker    # create a sandbox on the only provisionable runtime
agro sandbox list              # every sandbox: name, runtime, status, checkout
agro sandbox --help            # the catalog: which runtimes exist, and their state
```

```
$ agro sandbox --help
...
Runtimes:
  docker        provisionable
  microsandbox  planned
```

`agro sandbox install docker` writes a registry entry under
`${AGRO_HOME:-~/.agro}/sandboxes/<name>/`. The command then boots the
container. See [`agro sandbox install docker`](../deployment-prebuilt-image.md).

`agro sandbox install microsandbox` refuses with this error:

```
agro sandbox install: microsandbox is not a provisionable runtime yet; see
docs/rfcs/rfc-runtime-support.md. Inside a sandbox run `agro tool install microsandbox`.
```

`agro sandbox install` runs on the host only. The command changes the Docker
configuration of the sandbox. For that reason, when you run the command inside
the sandbox, the command refuses with a host-only error. See
[Lifecycle commands → Where you are standing when you type `agro`](../lifecycle-commands.md#where-you-are-standing-when-you-type-agro).

## What is in the catalog

| Runtime | Tier | State | How you reach it |
|---|---|---|---|
| [Docker container](docker.md) | shared host kernel, namespaces + cgroups | **provisionable** | `agro sandbox install docker` |
| [MicroSandbox](microsandbox.md) | microVM — one real kernel per sandbox, KVM-backed | planned | `agro tool install microsandbox` installs the `msb` binary inside a sandbox; running AGRO *on* msb is a manual host recipe |

The catalog holds two entries by design. A single-entry catalog encodes a false
singleton. That catalog also needs a schema change when a second runtime lands.

### The two runtimes use different access paths

Docker Compose already drives the Docker runtime. For that reason,
`agro sandbox install docker` provisions the Docker runtime from end to end.

MicroSandbox is **not** a Docker runtime. MicroSandbox is a separate VM manager.
MicroSandbox cannot plug into the Docker Compose boot path. Instead, MicroSandbox
[replaces that boot path and runs the published image directly](microsandbox.md#running-agro-on-microsandbox).
This difference is the reason that the two runtimes need different framing.

## Why the CLI selects no substrate key

Two proposals give the selector different names:

- `sandbox.substrate`, from the substrate plan
  ([#802](https://github.com/mifunedev/agro/issues/802) P4).
- `sandbox.runtime`, from the sysbox slice of EPIC
  [#731](https://github.com/mifunedev/agro/issues/731).

[The runtime-support RFC](../rfcs/rfc-runtime-support.md) holds the open
decision and the axes taxonomy behind the decision. A decision outside #731
forks the `ExecutionTarget` seam.

For that reason, the registry entry records only the runtime that provisioned
the sandbox: `runtime: "docker"` in the `agro.json` of the entry. The CLI does
not select a deeper tier for you.

## What the runtime catalog does not do

- The runtime catalog does not change how the sandbox boots. Only `docker` is
  provisionable.
- The runtime catalog adds no Dockerfile build arg. A build arg bakes an install
  into every image, and that install always fails. See
  [MicroSandbox](microsandbox.md).
- `agro tool install microsandbox` installs a binary and nothing else. The
  command rebuilds no image, restarts no sandbox, and writes no configuration.

You can still run AGRO **on** a different runtime yourself. The CLI does not
perform that setup. See
[Running AGRO on MicroSandbox](microsandbox.md#running-agro-on-microsandbox).
