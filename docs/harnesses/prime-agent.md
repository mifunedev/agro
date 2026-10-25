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

Do not run `prime-agent update`. The `prime-agent update` command moves Prime Agent off the AGRO pin. To change the version, change the pin in `.agro/cli/src/lib/harnesses/catalog.ts`, then run `agro harness install prime-agent`.

## Uninstall

```bash
agro harness uninstall prime-agent
```

The command deletes `~/.local/bin/prime-agent` and `~/.local/share/prime-agent`. Prime Agent keeps its state in `~/.prime/agent`. This directory holds `auth.json`, the `kernel-venv` directory, and the saved sessions. The command does not delete `~/.prime/agent`. See [Harnesses Overview → Removing a harness](./overview.md#removing-a-harness).

To delete the Prime Agent state, stop the daemon first, then delete the directory:

```bash
prime-agent shutdown
rm -rf ~/.prime/agent
```

## Authentication

Sign in from a Herdr pane inside the sandbox. Start `prime-agent`, then type `/login` in the interactive session. Prime Agent writes the credential to `~/.prime/agent/auth.json`.

Prime Agent also reads provider API keys from environment variables, for example:

| Variable | Provider |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic |
| `OPENAI_API_KEY` | OpenAI |
| `PRIME_API_KEY` | Prime Intellect |

To select a provider or a model for one run, use `--provider`, `--model`, or `--api-key`. AGRO stores no Prime Agent credential.

The Prime Agent daemon keeps the environment that it started with. After you change a provider environment variable, stop the daemon:

```bash
prime-agent shutdown
```

The next `prime-agent` command starts a new daemon with the new environment.

## Common usage

```bash
prime-agent                                                # start an interactive session
prime-agent -p "explain the changes in this repository"    # run a one-shot prompt
prime-agent -c                                             # continue the last session
prime-agent -r                                             # select a session to resume
prime-agent doctor                                         # examine the installation
prime-agent prompt                                         # print the assembled system prompt
```

Use `--mode <text|json|rpc|acp|daemon>` to select the output mode. These commands manage the daemon and its sessions: `agents`, `list`, `sessions`, `attach`, `stop`, `send`, `schedule`, `status`, and `shutdown`.

With a ChatGPT subscription, a `prime-agent -p` run without `--provider` and `--model` exited with code 1 and the error `Codex error: The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.` The interactive session showed `gpt-6.1-sol`. To select the model for a `-p` run, use `--provider` and `--model`. Run `prime-agent model list` to see the provider and model names:

```bash
prime-agent -p --provider openai-codex --model gpt-6.1-sol "<prompt>"
```

Run interactive sessions in Herdr, so that a session survives a disconnect. Run `agro tool install herdr`, then run `herdr`, then start `prime-agent` in a pane.

## AGRO integration

### Project instructions

Prime Agent loads the root `AGENTS.md` from the start directory. Run `prime-agent prompt` in `/home/sandbox/harness`. The output shows `/home/sandbox/harness/AGENTS.md` under "AGENTS.md discovery". AGRO adds no Prime Agent instruction file.

The `-nc` (`--no-context-files`) flag disables the discovery of `AGENTS.md` and `CLAUDE.md`.

### Skills

Prime Agent discovers AGRO skills through `.agents/skills`. The link resolves to `.agro/skills`:

```text
.agents/skills -> ../.agro/skills
```

The `prime-agent prompt` output lists each skill at `/home/sandbox/harness/.agents/skills/<name>/SKILL.md`. Prime Agent does not list a skill that sets `disable-model-invocation: true`.

The `-ns` (`--no-skills`) flag disables skill discovery. The `--skill <path>` flag loads one skill.

`.agro/scripts/link-providers.sh` creates and repairs the `.agents/skills` link. AGRO adds no Prime Agent skill link.

### MCP servers

Manage user MCP servers with `prime-agent mcp`. AGRO does not configure MCP servers for Prime Agent.

### Hooks and guards

AGRO hooks in `.agro/hooks/` do not run under Prime Agent. The `cc-safety-net` command hook also does not run under Prime Agent. These AGRO guards are absent under Prime Agent:

- `deny-env-dump.sh`
- `deny-secret-paths.sh`
- `warn-devtcp.sh`
- `notify_slack.sh`
- `cc-safety-net`

:::warning Absent guards
Under Prime Agent, no AGRO guard examines a command or a file path before Prime Agent runs the command or reads the file. The Prime Agent worker and kernel processes are not a security sandbox. The Docker sandbox is the security boundary.
:::

### Herdr

Start `prime-agent` in a Herdr pane. Herdr is the primary workspace for interactive Prime Agent sessions. AGRO adds no Herdr configuration for Prime Agent.

The Prime Agent daemon is secondary to Herdr. A daemon-backed session survives a terminal detach. The daemon socket is under `${TMPDIR:-/tmp}`, so the daemon does not survive a container restart. The saved sessions in `~/.prime/agent` survive a container restart. Use `prime-agent -r` to resume a saved session.

## References

- [Prime Agent repository](https://github.com/PrimeIntellect-ai/prime-agent)
- [Prime Agent releases](https://github.com/PrimeIntellect-ai/prime-agent/releases)
- [Prime Agent installer](https://app.primeintellect.ai/prime-agent/install.sh)
