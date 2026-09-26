---
title: "Runtimes Overview"
---

# Runtimes Overview

A **runtime** is the isolation boundary that the sandbox runs on. A **harness**
is an agent CLI that runs inside the sandbox. The runtime and the harness have
different lifecycles. The runtime catalog lives under `agro sandbox`.
[`agro harness`](../harnesses/overview.md) is a separate command with its own
catalog.

AGRO runs on a **Docker container** today. This page does not change the
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

`agro sandbox install docker` writes a registry entry under
`${AGRO_HOME:-~/.agro}/sandboxes/<name>/`. `agro sandbox install docker` then
boots the container. See
[`agro sandbox install docker`](../deployment-prebuilt-image.md).

`agro sandbox install microsandbox` refuses:

```
agro sandbox install: microsandbox is not a provisionable runtime yet; see
docs/rfcs/rfc-runtime-support.md. Inside a sandbox run `agro tool install microsandbox`.
```

`agro sandbox install` is host-scoped. The command changes the sandbox's own
Docker configuration. If the operator runs `agro sandbox install` inside the
sandbox, the command refuses with a host-only error. See
[Lifecycle commands → Where you are standing when you type `agro`](../lifecycle-commands.md#where-you-are-standing-when-you-type-agro).

## What is in the catalog

| Runtime | Tier | State | How you reach it |
|---|---|---|---|
| [Docker container](docker.md) | shared host kernel, namespaces + cgroups | **provisionable** | `agro sandbox install docker` |
| [MicroSandbox](microsandbox.md) | microVM — one real kernel per sandbox, KVM-backed | planned | `agro tool install microsandbox` installs the `msb` binary inside a sandbox; running AGRO *on* msb is a manual host recipe |

The catalog holds two entries, not one, by design. A single-entry catalog
would encode a false singleton. A single-entry catalog would need a schema
change the moment a second runtime arrives.

### The two are reached differently

The compose stack already drives Docker. `agro sandbox install docker`
therefore provisions Docker end to end. MicroSandbox is not a Docker runtime.
MicroSandbox is its own VM manager. MicroSandbox cannot plug into the boot
path. MicroSandbox instead
[replaces the boot path, running the published image directly](microsandbox.md#running-agro-on-microsandbox).
Docker and MicroSandbox need different framing because of this asymmetry.

## Why the CLI selects no substrate key

Two proposals name the selector differently: `sandbox.substrate` in the
substrate plan ([#802](https://github.com/mifunedev/agro/issues/802) P4), and
`sandbox.runtime` in the EPIC
([#731](https://github.com/mifunedev/agro/issues/731) sysbox slice).
[The runtime-support RFC](../rfcs/rfc-runtime-support.md) holds the open
decision and the axes taxonomy behind the decision. Settling the decision
outside #731 forks the `ExecutionTarget` seam.

The registry entry records only the runtime that provisioned the sandbox:
`runtime: "docker"` in `agro.json`. No component chooses a deeper
tier for the operator.

## What this does not do

- This runtime catalog does not change how the sandbox boots. Only `docker`
  is provisionable.
- This runtime catalog adds no Dockerfile build arg. A build arg would bake a
  guaranteed-failing install into every image. See
  [MicroSandbox](microsandbox.md).
- `agro tool install microsandbox` installs a binary and nothing else.
  `agro tool install microsandbox` rebuilds no image. `agro tool install
  microsandbox` restarts no sandbox. `agro tool install microsandbox` writes
  no configuration.

The operator can still run AGRO on a different runtime manually. The AGRO CLI
does not perform that manual step. See
[Running AGRO on MicroSandbox](microsandbox.md#running-agro-on-microsandbox).
