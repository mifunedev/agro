---
title: "OpenClaw"
---

# OpenClaw

OpenClaw is a gateway-first personal agent runtime.
AGRO installs OpenClaw alongside the other coding harnesses.

## Install

Run the installation command inside the sandbox:

```bash
agro harness install openclaw
```

Nothing installs OpenClaw at boot.
See [Harnesses Overview](./overview.md#installing-a-harness) for host installation options.

AGRO installs the pinned version `2026.9.9` with npm.
The package goes to `~/.local/lib/node_modules/openclaw`.
The launcher is `~/.local/bin/openclaw`.

OpenClaw requires Node `24.16.0` or later.
The sandbox image meets this requirement.
