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

Start with the quickstart below. See the [documentation](docs/README.md) for more guidance.

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

### 6. Configure messaging (optional)

Run setup inside the sandbox from a Herdr pane. Use a separate Slack app and
configuration for each gateway. We recommend opening another Herdr pane to
attach to its tmux session; detach with `Ctrl-b d` to leave the gateway running.

#### Hermes

```bash
# Install Hermes and configure its provider
agro harness install hermes
hermes setup

# Generate the Slack app manifest and print its location
hermes slack manifest --agent-view --write
```

Open [Slack Apps](https://api.slack.com/apps), choose **Create New App → From an
app manifest**, and paste the generated JSON. Review its permissions, then
install the app to your workspace. Collect the bot token (`xoxb-`) and an
app-level token (`xapp-`) with `connections:write` scope.

```bash
# Enter the Slack tokens and configure access rules
hermes gateway setup

# Start the Hermes gateway and check its status
gateway hermes
gateway status

# Attach read-only from a Herdr pane; detach with Ctrl-b d
tmux attach -r -t client-slack-hermes
```

Send the bot a message and confirm a reply. See the
[Hermes Slack setup guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/slack.md)
and [gateway documentation](docs/harnesses/hermes.md#model-and-gateway).

#### Pi

In [Slack Apps](https://api.slack.com/apps), create an app **From an app
manifest** using [Pi's manifest](.pi/install/slack-manifest.json). It configures
Socket Mode, events, and admin commands. Review permissions, install the app,
and collect its own `xapp-` (`connections:write`) and `xoxb-` tokens.

```bash
# Install Pi, then use /login in Pi and exit back to the shell
agro harness install pi
pi

# Save Pi's Slack tokens using hidden input prompts
cd /home/sandbox/harness
agro secret set PI_SLACK_APP_TOKEN
agro secret set PI_SLACK_BOT_TOKEN

# Start the Pi bridge and check its status
gateway pi
gateway status

# Attach read-only from a Herdr pane; detach with Ctrl-b d
tmux attach -r -t client-slack-pi
```

Message the bot and complete the trust challenge shown in the bridge. See the
[Pi Slack setup guide](docs/integrations/slack.md) for token locations and access
configuration.

### 7. Open the sandbox in VS Code (optional)

For a sandbox running on your local machine:

1. Install VS Code's [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
2. Check that your sandbox is running with `agro sandbox list` on the host.
3. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), choose **Dev Containers: Attach to Running Container**, and select your sandbox.
4. Choose **File → Open Folder** and open `/home/sandbox/harness` — the sandbox user's `~/harness` folder.

Use **Attach to Running Container**, not **Reopen in Container**.

<details>
<summary>Remote sandbox: connect over SSH, then attach</summary>

Complete the sandbox setup on your remote host first. Then, from VS Code on
your local machine:

1. Install the [Remote - SSH extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) alongside Dev Containers.
2. Run **Remote-SSH: Connect to Host** and connect to your Docker host using `user@host`.
3. In the SSH-connected window, run **Dev Containers: Attach to Running Container** and select the sandbox on that host.
4. Choose **File → Open Folder** and open `/home/sandbox/harness` (`~/harness` for the sandbox user).

Connect over SSH to the host, not directly to the container. See the
[connection guide](docs/connecting.md) for more options.

</details>

### 8. Ask your agent to clone a project

From your agent session in `~/harness`, ask:

```text
Clone <owner>/<repo> into projects.
```

Example agent response after a successful clone:

> Cloned `<owner>/<repo>` to `~/harness/projects/<owner>/<repo>`.
> This is a separate repository with its own history and remote.

Then ask for an isolated workspace:

```text
Create a worktree in <owner>/<repo> for issue #123.
```

Example agent response:

> Created branch `task/123-my-change` and a worktree at
> `~/harness/projects/<owner>/<repo>/.worktrees/task/123-my-change`.

Worktrees share the project's Git history but keep separate checked-out files.
Each parallel agent gets its own branch and worktree, so agents do not overwrite
each other's work. The agent manages these folders; you do not need to configure
them manually.

When the work is merged, ask:

```text
Clean up the merged worktree for issue #123 in <owner>/<repo>.
Keep any uncommitted work.
```

## 📚 Table of Contents

Browse the [documentation](docs/README.md) or jump to a topic below.

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

Contributions, bug reports, and feedback are welcome.

[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues)

[![Slack](https://img.shields.io/badge/-Join_our_Slack-4A154B?style=flat-square&logo=slack&logoColor=white)](https://join.slack.com/t/mifunedev/shared_invite/zt-3l2lnevo6-hOe5ZeoAz~xj7CFAJk2bzg)
[![X: mifunedev](https://img.shields.io/badge/-mifunedev-000000?style=flat-square&logo=x&logoColor=white)](https://x.com/mifunedev)
[![Instagram: mifune.dev](https://img.shields.io/badge/-mifune.dev-E4405F?style=flat-square&logo=instagram&logoColor=white)](https://www.instagram.com/mifune.dev)
[![LinkedIn: Mifune Dev](https://img.shields.io/badge/-Mifune_Dev-0077B5?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/mifune-dev)

## 📄 License

[Apache License 2.0](LICENSE) — copyright Ryan Eggleston, d/b/a Mifune Dev (mifune.dev). Prior MIT releases remain available under MIT; this change governs new code and future releases and does not revoke past grants.

Apache-2.0 covers the runtime, the `oh` CLI, container definitions, and the harness spec. The Mifune Console, the provisioning and fleet-management control plane, and billing / enterprise policy / RBAC / hosted operations are proprietary — see the [open-core boundary](docs/open-core.md).

## Trademarks

Apache-2.0 §6 grants no permission to use the Mifune or Open Harness names, logos, or trade dress (reasonable, customary use in describing the origin of the work is fine). Fork it, modify it, sell it — just don't present your fork as Mifune.

---

[Documentation](docs/README.md) · [Docs website](https://agro.mifune.dev) · [Docs site source](https://github.com/mifunedev/agro-web)
