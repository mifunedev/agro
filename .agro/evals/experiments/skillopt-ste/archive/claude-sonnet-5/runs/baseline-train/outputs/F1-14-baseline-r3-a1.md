---
title: "Runtimes Overview"
---

# Runtimes Overview

A **runtime** is the isolation boundary the sandbox runs *on*. A **harness** is
an agent CLI that runs *inside* the runtime. A runtime and a harness have
separate lifecycles. The runtime catalog lives under `agro sandbox`.
[`agro harness`](../harnesses/overview.md) is a separate command with its own
catalog.

AGRO runs on a **Docker container** today. Nothing on this page changes
that.

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
`${AGRO_HOME:-~/.agro}/sandboxes/<name>/` and boots the container — see
[`agro sandbox install docker`](../deployment-prebuilt-image.md).

`agro sandbox install microsandbox` refuses:

```
agro sandbox install: microsandbox is not a provisionable runtime yet; see
docs/rfcs/rfc-runtime-support.md. Inside a sandbox run `agro tool install microsandbox`.
```

`agro sandbox install` is host-scoped. `agro sandbox install` changes the
sandbox's own Docker configuration. If the operator runs `agro sandbox
install` from inside the sandbox, the command refuses and reports a
host-only error. See
[Lifecycle commands → Where you are standing when you type `agro`](../lifecycle-commands.md#where-you-are-standing-when-you-type-agro).

## What is in the catalog

| Runtime | Tier | State | How you reach it |
|---|---|---|---|
| [Docker container](docker.md) | shared host kernel, namespaces + cgroups | **provisionable** | `agro sandbox install docker` |
| [MicroSandbox](microsandbox.md) | microVM — one real kernel per sandbox, KVM-backed | planned | `agro tool install microsandbox` installs the `msb` binary inside a sandbox; running AGRO *on* msb is a manual host recipe |

The catalog holds two entries, not one, by design. A single-entry catalog
would encode a false singleton. Adding a second runtime would then force a
schema change.

### The two are reached differently

The compose stack drives Docker directly. `agro sandbox install docker`
provisions Docker end to end. MicroSandbox is **not** a Docker runtime.
MicroSandbox is its own VM manager. MicroSandbox cannot plug into the boot
path. Instead, MicroSandbox
[replaces the boot path and runs the published image directly](microsandbox.md#running-agro-on-microsandbox).
Docker and MicroSandbox need different framing because the CLI reaches each
one by a different path.

## Why the CLI selects no substrate key

Two proposals name the selector differently: `sandbox.substrate` (the substrate
plan, [#802](https://github.com/mifunedev/agro/issues/802) P4) and
`sandbox.runtime` (the EPIC [#731](https://github.com/mifunedev/agro/issues/731)
sysbox slice). [The runtime-support RFC](../rfcs/rfc-runtime-support.md) holds
the open decision and the axes taxonomy behind the decision. Settling the
decision outside #731 forks the `ExecutionTarget` seam.

The sandbox entry records only the runtime AGRO provisioned: `runtime:
"docker"` in `agro.json`. The CLI chooses no deeper tier for the operator.

## What the runtime catalog does not do

- The runtime catalog does not change how the sandbox boots. Only `docker` is
  provisionable.
- The runtime catalog adds no Dockerfile build arg. A build arg would bake a
  guaranteed-failing install into every image (see
  [MicroSandbox](microsandbox.md)).
- `agro tool install microsandbox` installs a binary and nothing else.
  `agro tool install microsandbox` rebuilds no image, restarts no sandbox, and
  writes no configuration.

The operator can still run AGRO **on** a different runtime by hand. The CLI
provides no command for running AGRO on a different runtime. See
[Running AGRO on MicroSandbox](microsandbox.md#running-agro-on-microsandbox).
