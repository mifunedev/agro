<h1 align="center">AGRO</h1>

<p align="center"><strong>Agent Governance Runtime Orchestrator</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/License-Apache--2.0-D4AF37?style=plastic&labelColor=0B1220"></a>
  <a href="https://github.com/mifunedev/agro/actions/workflows/ci-harness.yml"><img alt="CI: Harness" src="https://img.shields.io/github/actions/workflow/status/mifunedev/agro/ci-harness.yml?branch=main&style=plastic&label=CI&labelColor=0B1220&color=D4AF37"></a>
  <a href="https://github.com/mifunedev/agro/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/mifunedev/agro?style=plastic&logo=github&logoColor=white&labelColor=0B1220&color=D4AF37"></a>
  <img alt="Docker required" src="https://img.shields.io/badge/Docker-required-D4AF37?style=plastic&logo=docker&logoColor=white&labelColor=0B1220">
</p>

<p align="center">
  <img src=".github/assets/mifune-banner.jpg" alt="AGRO" width="100%">
</p>

**AGRO gives your chosen coding harness a durable workspace and shared control plane, locally or on a remote VM.** You own the workspace. AGRO surrounds Claude Code, Codex, Pi, and other coding harnesses without replacing them.

- **Keep your working environment.** Store tools, project state, schedules, and communication settings together across sessions.
- **Share a way of working.** Use common procedures, bounded delegation, and evidence checks across coding harnesses.
- **Separate parallel changes.** Give workers separate git worktrees inside the sandbox instead of sharing one checkout.

Here, governance means shared procedures and reviewable evidence, not a hosted enterprise policy platform. Provider capabilities and enforcement differ. The open `.agro/` control plane owns those procedures; `.devcontainer/` defines the Docker runtime.

[Quickstart](docs/quickstart.md) · [Docs index](docs/README.md) · [Searchable docs](https://agro.mifune.dev)

## First task: make a program print a result

Use this terminal-first path for one small task with Claude Code. You need no fork, project clone, GitHub account, private repository, or Slack setup.

### Before you start

**Release status — 2026-09-10:** The latest release, `v0.9.0` (published 2026-09-06), has a known fresh-volume bootstrap failure: [#1019](https://github.com/mifunedev/agro/issues/1019). A corrected release image still needs verification and publication. The [recovery guide](docs/repair-sandbox-boot-advisory.md) repairs existing seeded volumes, not the published image. The commands below describe the intended path, not independently verified clean-release acceptance.

On your **host** (laptop or remote VM), install Docker with the Compose plugin, Git, and Node.js 20 or newer. You also need network access and an Anthropic account with Claude Code access for the login path below. Provider usage can incur charges. See [Installation](docs/installation.md#prerequisites) and [Claude Code authentication](docs/harnesses/claude-code.md#authentication).

**Choose the trust boundary before setup.** Leave the host Docker socket disabled for this task. Socket access is effectively host root. The sandbox user can elevate through `sudo`; passwordless sudo, if enabled locally, removes the password gate. Sandbox shell aliases skip Claude Code and Codex permission prompts. Review [security considerations](docs/security-considerations.md) before giving agents credentials or sensitive mounts. Worktrees separate checkouts. Worktrees are not security boundaries.

### 1. Host — install AGRO and create a sandbox

Run these commands on the host:

```bash
npm install -g @mifune/agro
agro sandbox install docker
```

The wizard asks for a name, timezone, git identity, SSH, and Docker socket access. Keep SSH and Docker socket access off for this task. Git identity fields do not authenticate GitHub. The sandbox starts from the published image without a project checkout.

Replace `<name>` below with the sandbox name from the wizard:

```bash
agro ps <name>
agro shell <name>
```

The second command opens a shell as `sandbox`. If startup fails, inspect `agro logs <name>` on the host. See [Installation](docs/installation.md#what-the-sandbox-runs) for health diagnostics.

### 2. Sandbox — install and open Herdr

Run inside the sandbox:

```bash
agro tool install herdr
herdr
```

[Herdr](docs/integrations/herdr.md) is the primary interactive workspace. Run the remaining steps in a Herdr pane. Fresh sandboxes require explicit Herdr and coding-harness installation. Bootstrap can install workspace dependencies separately from these tools.

### 3. Sandbox — install and authenticate Claude Code

```bash
agro harness install claude-code
claude auth login
claude auth status
```

Complete the displayed OAuth instructions in your browser. On a remote sandbox, follow the URL and any code-transfer instructions the CLI displays. Continue only after the status command confirms authentication. Authentication methods vary by provider; there is no universal device-login command.

### 4. Sandbox — create a new scratch directory and start the agent

In the same Herdr pane:

```bash
TASK_DIR="$(mktemp -d "$HOME/agro-first-task.XXXXXX")" && cd "$TASK_DIR" && pwd && claude
```

Keep the printed absolute directory path for verification. This new directory is outside the harness checkout. Send Claude this bounded prompt:

> Work only in the current scratch directory. Create one zero-dependency file named `hello.mjs` that prints exactly `Hello from AGRO!` followed by a newline. Run `node hello.mjs`. Report the absolute file path and actual output. Do not install packages, use the network, run git commands, make commits, or change any other directory. Stop after reporting the result.

### 5. Sandbox — verify independently in a terminal

Open another Herdr pane. Replace `<task-directory>` with the absolute path from step 4, then run:

```bash
node "<task-directory>/hello.mjs"
```

Expected output:

```text
Hello from AGRO!
```

You now have a file and a terminal result to inspect, not only an authentication status.

## Keep working, reconnect, or stop

While the host and container stay running, detach from Herdr with `Ctrl-b q`. Reconnect with `agro shell <name>` on the host, then `herdr` inside the sandbox. Scheduled work also needs its configured provider access and runtime to remain available.

Files under `/home/sandbox` persist in the home mount. A container stop or recreation ends running agents, tests, and servers. Saved Herdr metadata and layout do not preserve those processes. Back up important data; a volume is not a backup.

### Host — stop or destroy

To stop without deleting volumes, run on the host:

```bash
agro stop <name>
```

Start again with `agro sandbox install docker --name <name>`. Restart the agent or server processes you need.

**Destructive cleanup:** `agro destroy` removes the container, registry entry, and named volumes, including workspace files and provider credentials. Back up first. Host bind-mounted directories remain. Read the displayed deletion list before confirming the sandbox name.

```bash
agro destroy <name>
```

Details: [storage](docs/installation.md#persistent-storage) and [lifecycle commands](docs/lifecycle-commands.md).

## Optional next steps

- **GitHub:** Manually run `gh auth login`, `gh auth setup-git`, and `gh auth status` inside Herdr before GitHub repository work. Confirm the intended account. [Quickstart](docs/quickstart.md#authenticate-github-before-any-repository-work) contains the private-versioning and contribution prompts; [GitHub auth](docs/integrations/github.md) covers recovery.
- **Other harnesses or editors:** See [harness choices](docs/harnesses/overview.md) and [connecting](docs/connecting.md). Provision with AGRO, then attach VS Code to the running container; do not provision with “Reopen in Container.”
- **Communication and configuration:** Add [Slack](docs/integrations/slack.md), [Hermes messaging](docs/harnesses/hermes.md), or [configuration](docs/configuration.md) when needed.
- **Updates:** `agro update` upgrades the CLI itself. `oh update` instead vendors the project payload. See [Installation](docs/installation.md#compatibility-entry-point-oh) for the legacy `oh` entry point and `get-oh.sh`.
- **Contribute:** Follow [Contributing](docs/contributing.md). Use [DeepWiki](https://deepwiki.com/mifunedev/agro) for generated navigation. The rendered site source lives in [mifunedev/agro-web](https://github.com/mifunedev/agro-web).

## License and trademarks

[Apache License 2.0](LICENSE) — copyright Ryan Eggleston, d/b/a Mifune Dev (mifune.dev). Prior MIT releases remain available under MIT. The change governs new code and future releases without revoking past grants.

Apache-2.0 covers the runtime, CLI, container definitions, and harness spec, including the shared `.agro/` control plane. The Mifune Console and hosted provisioning, fleet management, billing, enterprise policy, RBAC, and hosted operations are proprietary. See the [open-core boundary](docs/open-core.md).

Apache-2.0 §6 grants no general trademark rights to the Mifune or Open Harness names, logos, or trade dress. Section 6 of the [license](LICENSE) defines the limited exceptions for origin descriptions and NOTICE reproduction. You can fork, modify, and sell the software; do not present your fork as Mifune.
