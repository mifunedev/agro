---
title: "Runtimes Overview"
---

# Runtimes Overview

A **runtime** is the isolation boundary under the sandbox. A **harness** is an
agent CLI inside the sandbox. Runtimes and harnesses are different components with
different lifecycles. For that reason, the runtime catalog lives under
`agro sandbox`. The harness catalog has its own command:
[`agro harness`](../harnesses/overview.md).

Today, AGRO runs on a **Docker container**. This page does not change that
fact.

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

`agro sandbox install docker` performs two actions, in this order:

1. The command writes a registry entry under
   `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`.
2. The command starts the container.

For details, see
[`agro sandbox install docker`](../deployment-prebuilt-image.md).

`agro sandbox install microsandbox` refuses with this error:

```
agro sandbox install: microsandbox is not a provisionable runtime yet; see
docs/rfcs/rfc-runtime-support.md. Inside a sandbox run `agro tool install microsandbox`.
```

`agro sandbox install` runs only on the host. The command changes the Docker
configuration of the sandbox. For that reason, inside the sandbox, the command
refuses with a host-only error. See
[Lifecycle commands → Where you are standing when you type `agro`](../lifecycle-commands.md#where-you-are-standing-when-you-type-agro).

## What is in the catalog

| Runtime | Tier | State | How you reach it |
|---|---|---|---|
| [Docker container](docker.md) | shared host kernel, namespaces + cgroups | **provisionable** | `agro sandbox install docker` |
| [MicroSandbox](microsandbox.md) | microVM — one real kernel per sandbox, KVM-backed | planned | `agro tool install microsandbox` installs the `msb` binary inside a sandbox; running AGRO *on* msb is a manual host recipe |

The catalog has two entries by design. A catalog with one entry states a false
singleton. That catalog then needs a schema change when a second runtime
arrives.

### The two runtimes use different paths

The Compose stack already drives Docker. For that reason,
`agro sandbox install docker` provisions the Docker runtime from start to end.

MicroSandbox is **not** a Docker runtime. MicroSandbox is a separate VM
manager. For that reason, MicroSandbox cannot connect to the Docker boot path.
MicroSandbox replaces the boot path and
[runs the published image directly](microsandbox.md#running-agro-on-microsandbox).
This difference is the reason that the two runtimes need different framing.

## Why the CLI selects no substrate key

Two proposals give the selector different names:

- `sandbox.substrate`, from the substrate plan
  ([#802](https://github.com/mifunedev/agro/issues/802) P4).
- `sandbox.runtime`, from the sysbox slice of the EPIC
  [#731](https://github.com/mifunedev/agro/issues/731).

[The runtime-support RFC](../rfcs/rfc-runtime-support.md) holds the open
decision and the axes taxonomy behind the decision. A decision outside #731
forks the `ExecutionTarget` seam.

For that reason, the registry entry records only the runtime that provisioned
the sandbox: `runtime: "docker"` in the `agro.json` of the entry. The CLI does
not select a deeper tier for you.

## What this does not do

- The catalog does not change how the sandbox boots. Only `docker` is
  provisionable.
- The catalog adds no Dockerfile build arg. A build arg puts an install into
  every image, and that install always fails. See
  [MicroSandbox](microsandbox.md).
- `agro tool install microsandbox` installs a binary and nothing else. The
  command rebuilds no image. The command restarts no sandbox. The command
  writes no configuration.

You can still run AGRO **on** a different runtime yourself. The CLI is not the
tool for that task. See
[Running AGRO on MicroSandbox](microsandbox.md#running-agro-on-microsandbox).
