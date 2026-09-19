---
title: "Antigravity CLI"
---

# Antigravity CLI

Antigravity CLI is Google's terminal coding agent, shipped as the `agy` binary. AGRO installs it with Google's official installer from `https://antigravity.google/cli/install.sh`.

Google retired Gemini CLI for consumer subscriptions on 2026-06-18. Google names Antigravity CLI as the replacement.

The sandbox image contains no Antigravity CLI. Install Antigravity CLI only when you want the `agy` CLI in the sandbox.

## Install

`agro harness install <id>` is the only door. It installs Antigravity CLI into the
already-running sandbox without a rebuild:

```bash
agro harness install antigravity-cli
```

Nothing installs Antigravity CLI at boot, and no configuration key selects it. See
[Harnesses Overview](./overview.md#installing-a-harness) for what the verb does
and what happens when the sandbox is not running.

### What the door runs

AGRO runs the upstream installer as the `sandbox` user, with the binary directed into the home mount:

```bash
set -o pipefail
curl -fsSL https://antigravity.google/cli/install.sh | bash -s -- --dir "$HOME/.local/bin"
```

The installer writes `agy` into `~/.local/bin` by default. It accepts `-d` or `--dir` to select another target directory, and AGRO passes that flag to keep the target explicit. It reads a SHA-512 checksum from an upstream manifest, compares the downloaded artifact against that checksum, and aborts on a mismatch. It accepts no version argument, so it installs the current manifest version. The manifest named version 1.2.2 and served the artifact from `storage.googleapis.com` on the day AGRO verified it.

Review-first equivalent for manual inspection:

```bash
curl -fsSL -o agy-install.sh https://antigravity.google/cli/install.sh
# Review agy-install.sh in your editor or pager before running it.
bash agy-install.sh --dir "$HOME/.local/bin"
```

`~/.local/bin` lives in the persistent home volume. A fresh home volume holds no `agy` until you run the verb again.

## Authentication

Antigravity CLI reads credentials from the OS keyring. When the keyring holds no credential, it falls back to Google Sign-In.

On a local machine, Google Sign-In opens a browser. On a remote or SSH session, Google Sign-In prints an authorization URL and waits for a pasted code. Open the printed URL in a browser on any device, complete the sign-in, then paste the returned code into the terminal.

`/logout` is an interactive slash command inside the Antigravity CLI terminal UI. It clears the saved credentials.

On Linux, Antigravity CLI stores credentials through Secret Service over D-Bus.

:::warning The AGRO sandbox ships no Secret Service provider
AGRO has not verified how Antigravity CLI stores credentials inside the sandbox, or whether those credentials survive a container restart. See [Not yet verified in AGRO](#not-yet-verified-in-agro).
:::

## Supported plans

Google offers Antigravity CLI under three consumer plans:

- Individual (free)
- Google AI Pro
- Google AI Ultra

AGRO has tested none of these plans against the sandbox. Quota, model access, and eligibility follow Google's current service rules.

## Context and skills

Antigravity CLI reads `GEMINI.md` or `AGENTS.md` at the workspace root on startup. AGRO owns the checkout-root `AGENTS.md`, so an AGRO checkout already supplies project instructions.

Antigravity CLI reads workspace skills from `.agents/skills/` and global skills from `~/.gemini/antigravity-cli/skills/`. Google's documentation shows flat `.md` files that carry `name` and `description` frontmatter.

AGRO exposes its canonical skill pack at the same workspace path:

```text
.agents/skills -> ../.agro/skills
```

AGRO ships each skill as a directory that holds a `SKILL.md` file. That layout differs from the flat `.md` files in Google's documentation. Read [Not yet verified in AGRO](#not-yet-verified-in-agro) before you rely on skill discovery.

## Headless use

```bash
agy -p "Summarize the changes on this branch"
agy --print "Summarize the changes on this branch" --output-format json
```

`-p`, `--print`, and `--prompt` name the same option. `--output-format` accepts `text`, `json`, and `stream-json`.

A headless run reads the cached credentials. An unauthenticated headless run returns an error instead of waiting for a sign-in.

Run interactive sessions in Herdr so the terminal survives a disconnect.

## Permissions and zero-confirmation mode

In AGRO, Docker is the isolation boundary. Antigravity CLI runs in zero-confirmation mode by default inside the sandbox:

- The sandbox shell alias defines `alias agy='agy --dangerously-skip-permissions'`.
- `agro harness install antigravity-cli` outputs the launch line with `--dangerously-skip-permissions`.
- Sandbox provisioning pre-seeds `~/.gemini/antigravity-cli/settings.json` with:

```json
{
  "defaultPermissionMode": "bypassPermissions"
}
```

This allows unattended tasks and cron jobs to operate without interactive prompt blocks.

## Execution modes

`--mode` accepts three values:

| Value | Effect |
|---|---|
| `default` | Ask for approval before an edit |
| `accept-edits` | Accept file edits without a prompt |
| `plan` | Plan the work without an edit |

## Command sandbox

Antigravity CLI ships its own command sandbox. That sandbox uses kernel namespaces and needs no Docker image. Antigravity CLI disables it by default.

## State persistence

Antigravity CLI keeps its settings at `~/.gemini/antigravity-cli/settings.json` and its global skills under `~/.gemini/antigravity-cli/skills/`. AGRO persists `/home/sandbox` in one mount, so `~/.gemini/antigravity-cli` survives a container rebuild.

:::warning Volume removal deletes Antigravity CLI state
`agro destroy` and `docker compose down -v` delete the sandbox home volume, `~/.gemini/antigravity-cli` included. Use `agro stop` when you want that state to survive.
:::

## Source and licence

Google publishes no source tree and no licence for Antigravity CLI. Treat the `agy` binary as closed proprietary software, and audit its network behavior yourself before you trust it with private code.

## Data collection

Google collects interaction data by default. A setting in `~/.gemini/antigravity-cli/settings.json` turns the collection off. Google's documentation does not name the setting key on the pages AGRO verified. Read the current upstream privacy documentation, then set the key named there.

## Not yet verified in AGRO

AGRO documents Antigravity CLI from Google's first-party sources. The following items wait for operator validation in a running sandbox:

- **Install through the verb.** No operator has run `agro harness install antigravity-cli` end to end.
- **Login.** No operator has completed the browser flow or the remote URL-and-code flow inside the sandbox.
- **Subscription coverage.** No operator has run Antigravity CLI on the Individual, Google AI Pro, or Google AI Ultra plan from the sandbox.
- **Skill discovery.** AGRO ships each skill as a directory that holds `SKILL.md`. Google documents flat `.md` files with `name` and `description` frontmatter. Whether Antigravity CLI discovers the AGRO `.agents/skills` pack across that layout difference is an open question. AGRO promises no compatibility here.
- **Credential persistence.** The AGRO sandbox ships no Secret Service provider. Whether credentials survive a container restart is unknown.

Treat every item above as pending, not as supported behavior.

## Upstream documentation

- [CLI overview](https://antigravity.google/docs/cli/overview)
- [Getting started](https://antigravity.google/docs/cli/getting-started)
- [Pricing and plans](https://antigravity.google/pricing)
- [Official installer](https://antigravity.google/cli/install.sh)
- [Repository](https://github.com/google-antigravity/antigravity-cli)
