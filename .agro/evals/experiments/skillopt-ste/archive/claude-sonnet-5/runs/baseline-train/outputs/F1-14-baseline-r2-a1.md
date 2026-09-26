---
title: "Runtimes Overview"
---

# Runtimes Overview

A **runtime** is the isolation boundary that the sandbox runs on. A
**harness** is an agent CLI that runs inside the runtime. The runtime and the
harness have different lifecycles. The runtime catalog lives under
`agro sandbox`. The harness catalog lives under its own command,
[`agro harness`](../harnesses/overview.md).

AGRO runs on a **Docker container** now. This document does not change that
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
starts the container. See
[`agro sandbox install docker`](../deployment-prebuilt-image.md) for the full
procedure.

`agro sandbox install microsandbox` refuses:

```
agro sandbox install: microsandbox is not a provisionable runtime yet; see
docs/rfcs/rfc-runtime-support.md. Inside a sandbox run `agro tool install microsandbox`.
```

The command changes the sandbox's own Docker configuration, so
`agro sandbox install` runs only on the host. If the operator runs
`agro sandbox install` inside the sandbox, the command refuses with a
host-only error. See
[Lifecycle commands → Where you are standing when you type `agro`](../lifecycle-commands.md#where-you-are-standing-when-you-type-agro).

## What is in the catalog

| Runtime | Tier | State | How you reach it |
|---|---|---|---|
| [Docker container](docker.md) | shared host kernel, namespaces + cgroups | **provisionable** | `agro sandbox install docker` |
| [MicroSandbox](microsandbox.md) | microVM — one real kernel per sandbox, KVM-backed | planned | `agro tool install microsandbox` installs the `msb` binary inside a sandbox. Running AGRO on `msb` is a manual host procedure. |

The catalog holds two entries by design, not one. A single-entry catalog
would wrongly imply that only one runtime exists. The single-entry catalog
would then need a schema change when a second runtime arrives.

### The two are reached differently

The Compose stack already drives Docker. `agro sandbox install docker`
therefore provisions Docker end to end. MicroSandbox is not a Docker runtime.
MicroSandbox is its own VM manager, so MicroSandbox cannot connect to the
Docker boot path. MicroSandbox instead
[replaces the boot path, running the published image directly](microsandbox.md#running-agro-on-microsandbox).
Docker and MicroSandbox reach the sandbox through different procedures for
this reason.

## Why the CLI selects no substrate key

Two proposals name the selector differently. Proposal `sandbox.substrate`
comes from the substrate plan in issue
[#802](https://github.com/mifunedev/agro/issues/802) P4. Proposal
`sandbox.runtime` comes from the sysbox slice of EPIC
[#731](https://github.com/mifunedev/agro/issues/731).
[The runtime-support RFC](../rfcs/rfc-runtime-support.md) holds the open
decision and the axes taxonomy behind the decision. If the operator settles
the decision outside issue #731, that decision creates a second, conflicting
`ExecutionTarget` seam.

The entry therefore records only the runtime that provisioned it:
`runtime: "docker"` in the sandbox's `agro.json`. No mechanism chooses a
deeper tier for the operator.

## What this does not do

- The missing substrate key does not change how the sandbox boots. Only the
  `docker` runtime is provisionable.
- The missing substrate key adds no Dockerfile build arg. A build arg would
  add a guaranteed-failing install to every image (see
  [MicroSandbox](microsandbox.md)).
- `agro tool install microsandbox` installs a binary and nothing else. The
  command rebuilds no image, restarts no sandbox, and writes no
  configuration.

These limits do not stop the operator from running AGRO on a different
runtime. The limits only mean the CLI does not provision that runtime. See
[Running AGRO on MicroSandbox](microsandbox.md#running-agro-on-microsandbox)
for the manual procedure.
