---
title: "Grok Build"
---

# Grok Build

Grok Build is xAI's terminal coding agent, shipped as the `grok` CLI. AGRO installs Grok Build with xAI's official installer from `https://x.ai/cli/install.sh`. Grok Build is never baked into the sandbox image; install Grok Build only when you want the `grok` CLI available in the sandbox.

## Install

```bash
agro harness install grok-build
```

Nothing installs Grok Build at boot, and no configuration key selects it. See [Harnesses Overview](./overview.md#installing-a-harness) for what the verb does and what happens when the sandbox is not running.

AGRO uses the upstream installer as the `sandbox` user, pinned to a verified version, with the binary directed into the home mount:

```bash
curl -fsSL https://x.ai/cli/install.sh | GROK_BIN_DIR="$HOME/.local/bin" bash -s 0.2.39
```

Verify the install:

```bash
grok --version
```

## Uninstall

```bash
agro harness uninstall grok-build
```

## Authentication

Use one of the Grok Build auth flows inside the sandbox:

```bash
grok login --device-auth   # recommended for headless/remote sandboxes
grok login                 # interactive OAuth flow
```

For service-account or automation-style setup, store an xAI API key with AGRO's secret store:

```bash
agro secret set XAI_API_KEY
```

`XAI_API_KEY` is in AGRO's secret allow-list, so `agro secret set` writes it to the gitignored root `.env` at mode `0600`.

:::warning Auth precedence
Cached OAuth/session state in `~/.grok/auth.json` takes precedence over `XAI_API_KEY`. If Grok Build appears to ignore a new API key, run `grok logout` or delete `~/.grok`, then try again.
:::

## Common usage

```bash
grok                                              # start an interactive session
grok -p "Summarize the changes on this branch"    # run a one-shot prompt
grok agent stdio                                  # ACP stdio mode
```

Run interactive sessions in Herdr so the session survives a disconnect: `agro tool install herdr`, then `herdr`, then start `grok` in a pane.

## State persistence

AGRO persists `~/.grok` in the single `/home/sandbox` mount, alongside every other agent's state: auth and cached sessions (`auth.json`), config, sessions, memory, skills/plugins, and logs.

:::warning Volume removal deletes Grok state
`agro destroy` and `docker compose down -v` delete the sandbox home volume, `~/.grok` included. Use `agro stop` when you want Grok Build state to survive.
:::

## Dangerous flags

Grok Build exposes flags that bypass approval or permission prompts, including `--always-approve`, `--yolo`, and `--permission-mode bypassPermissions`.

:::warning Use only for trusted tasks
These flags allow broad tool use inside the sandbox. Use them only when you understand and accept the risk for the specific task and repository.
:::

## Upstream documentation

- [Grok CLI](https://x.ai/cli)
- [xAI Build overview](https://docs.x.ai/build/overview)
