---
title: "Muse Code"
---

# Muse Code

Muse Code is Meta's terminal coding agent. AGRO installs the native `muse` CLI through Meta's official installer.

## Install and verify

```bash
agro harness install muse-code
muse --version
agro harness status muse-code
```

Installation runs as `sandbox` and writes into `~/.local/bin` in the persistent home volume. Repeated installation skips the installer when `muse --version` succeeds.

`MUSE_NO_MODIFY_PATH=1` prevents the upstream installer from editing your shell profile, because AGRO already puts `~/.local/bin` on `PATH`. `MUSE_LOGIN=0` prevents interactive authentication during the download; authentication for model use is a separate step.

## Uninstall

```bash
agro harness uninstall muse-code
```

The command removes `~/.local/bin/muse` and its versioned binaries and metadata, through the same host/sandbox resolution every other harness uses. See [Harnesses Overview → Removing a harness](./overview.md#removing-a-harness).

## Authentication

```bash
muse login
```

`muse login` opens a browser code flow for a Meta account. Starting `muse` with no stored credentials also offers sign-in. Use `/login` inside Muse to reopen authentication choices.

For automation, store `META_API_KEY` in the checkout's gitignored `.env`:

```bash
agro secret set META_API_KEY
agro secret list
```

An existing process environment takes precedence over the `.env` file. `META_API_KEY` takes precedence over stored Muse credentials. Run `muse logout` to remove stored Muse credentials; logout preserves a key stored by `agro secret set`.

## Context and skills

Muse reads the existing repository `AGENTS.md`. Do not run `muse init` over an AGRO checkout; AGRO owns project instructions and the canonical `.agro/skills` pack through:

```text
.agents/skills -> ../.agro/skills
```

Sandbox bootstrap creates and repairs this link. To equip another checkout, run `agro vendor`, then `bash .agro/scripts/link-providers.sh --init`.

Muse loads project rules and skills only for trusted workspaces:

```bash
muse skills list --source project --workspace "$PWD" --trust-workspace
```

Run interactive `muse` sessions in Herdr so the terminal survives a disconnect.

## Persistence

The `/home/sandbox` volume preserves the launcher, native binaries, and home-local Muse state across a normal restart and recreate. Credentials live under `~/.config/muse` by default; `MUSE_AUTH_PATH` overrides the credential file. `agro destroy` removes the entire sandbox home volume, including Muse and its credentials.

## Upstream documentation

- [Official installer](https://dev.meta.ai/install.sh)
- [Authentication](https://dev.meta.ai/docs/muse-code/auth.md)
- [Configuration and instruction discovery](https://dev.meta.ai/docs/muse-code/configuration.md)
- [Skill discovery](https://dev.meta.ai/docs/muse-code/extending.md)
