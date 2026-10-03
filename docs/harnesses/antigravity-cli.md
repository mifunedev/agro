---
title: "Antigravity CLI"
---

# Antigravity CLI

Antigravity CLI is Google's terminal coding agent, shipped as the `agy` binary. AGRO installs Antigravity CLI with Google's official installer from `https://antigravity.google/cli/install.sh`. The sandbox image contains no Antigravity CLI; install Antigravity CLI only when you want `agy` in the sandbox.

## Install

```bash
agro harness install antigravity-cli
```

Nothing installs Antigravity CLI at boot, and no configuration key selects it. See [Harnesses Overview](./overview.md#installing-a-harness) for what the verb does and what happens when the sandbox is not running.

AGRO runs the upstream installer as the `sandbox` user, with the binary directed into the home mount:

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash -s -- --dir "$HOME/.local/bin"
```

The installer writes `agy` into `~/.local/bin`. It reads a SHA-512 checksum from an upstream manifest, compares the downloaded artifact against that checksum, and aborts on a mismatch.

Verify the install:

```bash
agy --version
```

## Uninstall

```bash
agro harness uninstall antigravity-cli
```

## Authentication

Antigravity CLI reads credentials from the OS keyring. When the keyring holds no credential, Antigravity CLI falls back to Google Sign-In. On a local machine, Google Sign-In opens a browser. On a remote or SSH session, Google Sign-In prints an authorization URL and waits for a pasted code. Open the URL on any device, complete the sign-in, then paste the returned code into the terminal.

Run `/logout` inside the Antigravity CLI terminal UI to clear saved credentials.

:::warning Not yet verified in AGRO
AGRO has not verified:

- how Antigravity CLI stores or persists credentials inside the sandbox
- whether skill discovery works across AGRO's directory-per-skill layout
- login end to end through `agro harness install antigravity-cli`

Treat each item as pending, not as supported behavior.
:::

## Context and skills

Antigravity CLI reads `GEMINI.md` or `AGENTS.md` at the workspace root on startup. AGRO owns the checkout-root `AGENTS.md`, so an AGRO checkout already supplies project instructions.

Antigravity CLI reads workspace skills from `.agents/skills/` and global skills from `~/.gemini/antigravity-cli/skills/`. AGRO exposes its canonical skill pack at the workspace path:

```text
.agents/skills -> ../.agro/skills
```

## Headless use

```bash
agy -p "Summarize the changes on this branch"
agy --print "Summarize the changes on this branch" --output-format json
```

`-p`, `--print`, and `--prompt` name the same option. `--output-format` accepts `text`, `json`, and `stream-json`. A headless run reads cached credentials; an unauthenticated headless run returns an error instead of waiting for a sign-in.

Run interactive sessions in Herdr so the terminal survives a disconnect.

## Permissions and zero-confirmation mode

Docker is the isolation boundary in AGRO, so Antigravity CLI runs in zero-confirmation mode by default inside the sandbox:

- The sandbox shell alias defines `alias agy='agy --dangerously-skip-permissions'`.
- `agro harness install antigravity-cli` prints the launch line with `--dangerously-skip-permissions`.
- Sandbox provisioning pre-seeds `~/.gemini/antigravity-cli/settings.json` with `{"defaultPermissionMode": "bypassPermissions"}`.

This lets unattended tasks and cron jobs run with no interactive prompt blocks.

`--mode` accepts three values: `default` (ask for approval before an edit), `accept-edits` (accept file edits with no prompt), and `plan` (plan the work with no edit).

## State persistence

Antigravity CLI keeps its settings at `~/.gemini/antigravity-cli/settings.json` and global skills under `~/.gemini/antigravity-cli/skills/`. The single `/home/sandbox` mount persists `~/.gemini/antigravity-cli` across a container rebuild.

:::warning Volume removal deletes Antigravity CLI state
`agro destroy` and `docker compose down -v` delete the sandbox home volume, `~/.gemini/antigravity-cli` included. Use `agro stop` when you want that state to survive.
:::

## Upstream documentation

- [CLI overview](https://antigravity.google/docs/cli/overview)
- [Getting started](https://antigravity.google/docs/cli/getting-started)
- [Official installer](https://antigravity.google/cli/install.sh)
- [Repository](https://github.com/google-antigravity/antigravity-cli)
