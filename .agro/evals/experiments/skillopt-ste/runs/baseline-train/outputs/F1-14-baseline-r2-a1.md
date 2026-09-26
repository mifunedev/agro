---
title: "Runtimes Overview"
---

# Runtimes Overview

A **runtime** is the isolation boundary that the sandbox runs *on*. A
**harness** is an agent CLI that runs *inside* the sandbox. A runtime and a
harness are different concepts with different lifecycles. For this reason, the
runtime catalog lives under `agro sandbox`.
[`agro harness`](../harnesses/overview.md) is a separate command with a separate
catalog.

AGRO runs on a **Docker container** today. This page does not change that
runtime.

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

`agro sandbox install docker` does two actions:

1. The command writes a registry entry under
   `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`.
2. The command boots the sandbox container.

For details, see
[`agro sandbox install docker`](../deployment-prebuilt-image.md).

`agro sandbox install microsandbox` refuses with this error:

```
agro sandbox install: microsandbox is not a provisionable runtime yet; see
docs/rfcs/rfc-runtime-support.md. Inside a sandbox run `agro tool install microsandbox`.
```

`agro sandbox install` is host-scoped. The command changes the Docker
configuration of the sandbox itself. For this reason, when you run the command
inside the sandbox, the command refuses with a host-only error. See
[Lifecycle commands → Where you are standing when you type `agro`](../lifecycle-commands.md#where-you-are-standing-when-you-type-agro).

## What is in the catalog

| Runtime | Tier | State | How you reach it |
|---|---|---|---|
| [Docker container](docker.md) | shared host kernel, namespaces + cgroups | **provisionable** | `agro sandbox install docker` |
| [MicroSandbox](microsandbox.md) | microVM — one real kernel per sandbox, KVM-backed | planned | `agro tool install microsandbox` installs the `msb` binary inside a sandbox; running AGRO *on* msb is a manual host recipe |

The catalog holds two entries on purpose. A single-entry catalog encodes a false
singleton. That catalog needs a schema change when a second runtime arrives.

### The two are reached differently

The compose stack already drives Docker. For this reason,
`agro sandbox install docker` provisions the Docker runtime end to end.
MicroSandbox is **not** a Docker runtime. MicroSandbox is a separate VM manager.
MicroSandbox cannot plug into the Docker boot path. Instead, MicroSandbox
[replaces the boot path and runs the published image directly](microsandbox.md#running-agro-on-microsandbox).
This asymmetry is the reason that the two runtimes need different framing.

## Why the CLI selects no substrate key

Two proposals give the selector key different names:

- `sandbox.substrate`, from the substrate plan
  ([#802](https://github.com/mifunedev/agro/issues/802) P4).
- `sandbox.runtime`, from the sysbox slice of EPIC
  [#731](https://github.com/mifunedev/agro/issues/731).

[The runtime-support RFC](../rfcs/rfc-runtime-support.md) holds the open
decision and the axes taxonomy behind the decision. A decision outside #731
forks the `ExecutionTarget` seam.

For this reason, the registry entry records only the runtime that provisioned
the sandbox: `runtime: "docker"` in the `agro.json` of the entry. The CLI never
selects a deeper tier for you.

## What this does not do

- The runtime catalog does not change how the sandbox boots. Only `docker` is
  provisionable.
- The runtime catalog adds no Dockerfile build arg. A build arg bakes an install
  that always fails into every image. See [MicroSandbox](microsandbox.md).
- `agro tool install microsandbox` installs a binary and nothing else. The
  command rebuilds no image, restarts no sandbox, and writes no configuration.

You can still run AGRO **on** a different runtime yourself. The CLI does not do
that step for you. See
[Running AGRO on MicroSandbox](microsandbox.md#running-agro-on-microsandbox).
