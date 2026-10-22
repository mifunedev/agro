---
title: "Prime Agent"
---

# Prime Agent

Prime Agent is a coding agent CLI from Prime Intellect. AGRO installs the `prime-agent` binary with the official installer from `https://app.primeintellect.ai/prime-agent/install.sh`. AGRO bakes no Prime Agent binary into the sandbox image.

## Install

Run the install command on the host or in the sandbox:

```bash
agro harness install prime-agent
```

The command runs the upstream installer as the `sandbox` user. AGRO pins Prime Agent to version `0.10.0`:

```bash
curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | PRIME_AGENT_VERSION=0.10.0 PRIME_AGENT_RUST_PREFIX="$HOME/.local" PRIME_AGENT_UV_BIN_DIR="$HOME/.local/bin" sh
```

The installer writes the binary to `~/.local/bin/prime-agent` and the runtime files to `~/.local/share/prime-agent` in the persistent home volume.

Verify the install:

```bash
prime-agent --version
agro harness status prime-agent
```

The `prime-agent --version` command prints `0.10.0`. See [Harnesses Overview](./overview.md#installing-a-harness) for the behavior of the verb when the sandbox is not running.
