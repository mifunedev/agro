---
title: "Roder"
---

# Roder

Roder is a Rust coding agent with an interactive terminal interface and a non-TTY execution command. AGRO installs the published [`@roderai/roder`](https://www.npmjs.com/package/@roderai/roder) npm package. It bundles native binaries and needs no install scripts or Rust compiler.

## Install and update

Run on the host with a running sandbox, or inside the sandbox:

```bash
agro harness install roder
```

In the sandbox, AGRO runs `npm --prefix /home/sandbox/.local install -g --ignore-scripts @roderai/roder@0.3.26` as the `sandbox` user. The package and `~/.local/bin/roder` launcher live in the persistent home volume and survive a container recreate. AGRO pins a tested Roder version. Run the same command again to reinstall that pinned version. A maintainer pull request bumps the pin to a newer release.

The bundled binaries support linux-x64, linux-arm64, and darwin-arm64, and need glibc 2.35 or newer. The package requires Node.js 18 or newer; AGRO already requires Node.js 22 or newer.

Verify the installation inside the sandbox:

```bash
roder --version
agro harness status roder
```

See [Harnesses overview](./overview.md#installing-a-harness) for host installation when the sandbox is not running.

## Authentication and configuration

Run authentication in a Herdr pane inside the sandbox:

```bash
roder auth login codex
roder auth status
```

Follow Roder's login prompts. AGRO adds no callback port forwarding or authentication flags. Other providers can use their supported API keys, such as `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`; see the [Roder provider quickstart](https://github.com/RoderAI/roder#provider-quickstart).

Roder stores user configuration in `~/.roder/config.toml`. Select a provider and model in the terminal interface or edit that file. The sandbox's persistent home volume keeps `~/.roder` across container recreates. AGRO does not write Roder configuration or credentials.

## Launch

Start Herdr inside the sandbox, then launch Roder from a pane:

```bash
agro tool install herdr
herdr
```

In the pane, move to the project checkout and run:

```bash
roder
```

AGRO shows `roder` as the launch hint. Run `roder --mode bypass` to explicitly select Roder's bypass policy for a session. The bypass mode skips Roder permission prompts. Reserve the bypass mode for a session that runs without permission prompts.

For a non-TTY task using the same configuration and authentication:

```bash
roder exec "Explain the changes in this repository"
printf 'Summarize this repository\n' | roder exec --json -
```

Keep interactive sessions in Herdr. Run persistent unattended services in named tmux sessions, as described in [Harnesses overview](./overview.md).

## Uninstall

```bash
agro harness uninstall roder
```

AGRO runs `npm --prefix /home/sandbox/.local uninstall -g @roderai/roder` as the `sandbox` user, then removes its own install marker. npm removes the package and its launcher. AGRO preserves `~/.roder`, including configuration and credentials.

## Upstream

- [Roder repository](https://github.com/RoderAI/roder)
- [Non-TTY execution](https://github.com/RoderAI/roder/blob/master/docs/roder-exec.md)
