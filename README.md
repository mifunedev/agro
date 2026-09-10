<h1 align="center">🏗️ AGRO</h1>

<p align="center"><strong>Agent Governance Runtime Orchestrator</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/License-Apache--2.0-D4AF37?style=plastic&labelColor=0B1220"></a>
  <a href="https://github.com/mifunedev/agro/actions/workflows/ci-harness.yml"><img alt="CI: Harness" src="https://img.shields.io/github/actions/workflow/status/mifunedev/agro/ci-harness.yml?branch=main&style=plastic&label=CI&labelColor=0B1220&color=D4AF37"></a>
  <a href="https://github.com/mifunedev/agro/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/mifunedev/agro?style=plastic&logo=github&logoColor=white&labelColor=0B1220&color=D4AF37"></a>
  <a href="https://github.com/mifunedev/agro/issues"><img alt="Issues" src="https://img.shields.io/github/issues/mifunedev/agro?style=plastic&labelColor=0B1220&color=D4AF37"></a>
  <img alt="Docker required" src="https://img.shields.io/badge/Docker-required-D4AF37?style=plastic&logo=docker&logoColor=white&labelColor=0B1220">
</p>

<p align="center">
  <img src=".github/assets/mifune-banner.jpg" alt="AGRO" width="100%">
</p>

**AGRO gives AI coding agents a workspace you control.** It packages a Docker sandbox and shared agent procedures around the coding harness you choose—Claude Code, Codex, Pi, or another.

Develop on your laptop or a remote VM. Install tools and harnesses on demand, organize parallel changes in separate git worktrees, and use shared skills and evidence checks to guide the work.

Start with the quickstart below. See the [docs](https://agro.mifune.dev) and [Start Here hub](docs/README.md) for more guidance.

## 📦 Quickstart

AGRO runs one project in one Docker sandbox, and **`agro` is the only
front door**. Host prerequisites: Docker (with the Compose plugin), Git, and
Node.js ≥ 20.

### 1. Get `agro`

**npm** — you already have Node ≥ 20:

```bash
# Install globally
npm install -g @mifune/agro

# Or run without a global install
npx @mifune/agro --help
```

Use `npx @mifune/agro` in place of `agro` in later commands.

**curl**

```bash
# Install AGRO to ~/.local/bin; offers Node.js setup if needed
curl -fsSL https://agro.mifune.dev/get-agro.sh | bash
```

For a download-and-review alternative, see [Installation](docs/installation.md).

Check the installed version, update AGRO, or see available commands:

```bash
# Check the installed version
agro --version

# Update AGRO
agro update

# Show available commands
agro --help
```

### 2. Create the sandbox

`agro sandbox install docker` runs from **any** directory — it needs no project
checkout:

Choose either setup option, then enter the sandbox:

```bash
# Create a sandbox with the setup wizard
agro sandbox install docker

# Or mount an existing project at /home/sandbox/harness
agro sandbox install docker --repo ~/my-project --name my-project

# Enter the sandbox; replace <name> with your sandbox name
agro shell <name>
```

### 3. Install tools

Inside the sandbox, start with [Herdr](docs/integrations/herdr.md), the terminal
workspace for your agents and development tools:

```bash
# Install and open Herdr
agro tool install herdr
herdr
```

Run the remaining commands in a Herdr pane. Install only the tools you need:

| Tool | Purpose | Availability |
| --- | --- | --- |
| `herdr` | Interactive terminal workspace | Install on demand |
| `agent-browser` | Browser automation | Install on demand |
| `cloudflared` | Public tunnels for local apps | Install on demand |
| `microsandbox` | MicroVM runtime CLI | Install on demand |
| `tailscale` | Private network connectivity | Install on demand |
| `gh` | GitHub CLI | Included |
| `docker-cli` | Docker client and Compose | Included |

```bash
# List tools and check availability
agro tool list

# Install an optional tool
agro tool install <id>
```

**GitHub (optional):** authenticate before repository work that uses GitHub.
Confirm that the status output shows your intended account.

```bash
# Sign in and configure Git credentials
gh auth login
gh auth setup-git

# Verify your account
gh auth status
```

See [GitHub authentication](docs/integrations/github.md) for help.

### 4. Install a coding harness

Choose one harness to start. In a Herdr pane, install and authenticate it:

```bash
# List available harnesses
agro harness list

# Install Claude Code
agro harness install claude-code

# Sign in and verify authentication
claude auth login
claude auth status

# Start Claude Code
claude
```

| Harness | ID | Availability |
| --- | --- | --- |
| [Claude Code](docs/harnesses/claude-code.md) | `claude-code` | Install on demand |
| [Codex](docs/harnesses/codex.md) | `codex` | Install on demand |
| [Pi](docs/harnesses/pi.md) | `pi` | Install on demand |
| [OpenCode](docs/harnesses/opencode.md) | `opencode` | Install on demand |
| [Grok Build](docs/harnesses/grok-build.md) | `grok-build` | Install on demand |
| [Hermes](docs/harnesses/hermes.md) | `hermes` | Install on demand |
| [Muse Code](docs/harnesses/muse-code.md) | `muse-code` | Install on demand |
| [T3 Code](docs/harnesses/t3code.md) | `t3code` | Run on demand via `npx` |

Use `agro harness install <id>` for other installable harnesses. Follow the linked
guides for authentication and launch commands. T3 Code requires an authenticated
Claude Code, Codex, or OpenCode provider.

### 5. Track your harness changes (optional)

With your coding harness and GitHub CLI configured, ask the agent to create a
repository for your harness changes. We recommend **private visibility by
default**, with `origin` pointing to your repository:

```text
Create a private GitHub repo for my harness changes and set it as origin.
Verify my account, exclude secrets and runtime files, and preserve existing work.
Confirm the repo name, files, and any remote replacement before creating or pushing.
```

<details>
<summary>Contribute back to AGRO (optional)</summary>

```text
Configure https://github.com/mifunedev/agro.git as upstream, preserving my origin.
Check shared history; if unrelated, use a separate checkout inside the sandbox.
Include only my selected changes, exclude private data, and confirm before pushing or opening a PR.
```

See the [contributing guide](docs/contributing.md) for the full workflow.

</details>

### 6. Slack and scheduled work (optional)

Configure Slack ([docs/integrations/slack.md](docs/integrations/slack.md),
[docs/harnesses/hermes.md](docs/harnesses/hermes.md)), then run and verify the
gateways from inside the sandbox:

```bash
gateway pi && gateway hermes
gateway status
tmux attach -r -t client-slack-pi   # read-only view; detach with Ctrl-b d
```

## 📚 Table of Contents

Explore the [searchable docs](https://agro.mifune.dev) or [full docs index](docs/README.md).

| Topic | Documentation |
| --- | --- |
| Getting started | [Quickstart](docs/quickstart.md) · [Installation](docs/installation.md) |
| Sandbox setup | [Create a sandbox](docs/deployment-prebuilt-image.md) · [VS Code and SSH](docs/connecting.md) |
| Daily operation | [Lifecycle commands, stopping, and cleanup](docs/lifecycle-commands.md) |
| Terminal workspace | [Herdr](docs/integrations/herdr.md) |
| Coding harnesses | [Harness overview and setup guides](docs/harnesses/overview.md) |
| Configuration | [Settings and secrets](docs/configuration.md) |
| Agent procedures | [Shared skills and hooks](docs/README.md#how-the-primitive-pack-ships) · [Directory layout](docs/oh-directory-layout.md) |
| Integrations | [GitHub](docs/integrations/github.md) · [Slack](docs/integrations/slack.md) · [Langfuse](docs/integrations/langfuse.md) |
| Debugging and testing | [DebugMCP](docs/integrations/debugmcp.md) · [Property testing](docs/property-testing.md) |
| Security | [Permissions and trust boundaries](docs/security-considerations.md) |
| Contributing | [Contribution workflow](docs/contributing.md) · [Docs site source](https://github.com/mifunedev/agro-web) |

## 🤝 Contributing & community

Open Harness is maintained under the [`mifunedev`](https://github.com/mifunedev) org — the canonical repo is [github.com/mifunedev/agro](https://github.com/mifunedev/agro). Contribute from a running sandbox: complete the GitHub-login prerequisite above, then use the contribution prompt or the workflow in [Contributing](docs/contributing.md). Issues and PRs welcome; if Open Harness is useful to you, please [give us a star](https://github.com/mifunedev/agro/stargazers).

## 📄 License

[Apache License 2.0](LICENSE) — copyright Ryan Eggleston, d/b/a Mifune Dev (mifune.dev). Prior MIT releases remain available under MIT; this change governs new code and future releases and does not revoke past grants.

Apache-2.0 covers the runtime, the `oh` CLI, container definitions, and the harness spec. The Mifune Console, the provisioning and fleet-management control plane, and billing / enterprise policy / RBAC / hosted operations are proprietary — see the [open-core boundary](docs/open-core.md).

## Trademarks

Apache-2.0 §6 grants no permission to use the Mifune or Open Harness names, logos, or trade dress (reasonable, customary use in describing the origin of the work is fine). Fork it, modify it, sell it — just don't present your fork as Mifune.

---

[Read the docs](https://agro.mifune.dev) · [Docs index](docs/README.md) · [Docs site source](https://github.com/mifunedev/agro-web)
