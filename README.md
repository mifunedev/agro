<h1 align="center">🏗️ AGRO</h1>

<p align="center"><strong>Agent Governance Runtime Orchestrator</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/License-Apache--2.0-D4AF37?style=plastic&labelColor=0B1220"></a>
  <a href="https://github.com/mifunedev/agro/actions/workflows/ci-harness.yml"><img alt="CI: Harness" src="https://img.shields.io/github/actions/workflow/status/mifunedev/agro/ci-harness.yml?branch=main&style=plastic&label=CI&labelColor=0B1220&color=D4AF37"></a>
  <a href="https://github.com/mifunedev/agro/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/mifunedev/agro?style=plastic&logo=github&logoColor=white&labelColor=0B1220&color=D4AF37"></a>
  <a href="https://github.com/mifunedev/agro/issues"><img alt="Issues" src="https://img.shields.io/github/issues/mifunedev/agro?style=plastic&labelColor=0B1220&color=D4AF37"></a>
  <img alt="Docker required" src="https://img.shields.io/badge/Docker-required-D4AF37?style=plastic&logo=docker&logoColor=white&labelColor=0B1220">
  <a href="https://deepwiki.com/mifunedev/agro"><img alt="Ask DeepWiki" src="https://img.shields.io/badge/DeepWiki-ask-D4AF37?style=plastic&labelColor=0B1220"></a>
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

```bash
agro sandbox install docker   # wizard: name, timezone, git identity, SSH, Docker socket
agro shell <name>             # attach as the sandbox user
```

The wizard's answers land in a registry entry at
`~/.agro/sandboxes/<name>/agro.json`, beside the compose files and the wrapper
script the CLI regenerates on every lifecycle call. The default name is
`agro-sbx-<n>`; `--yes` keeps every default and asks nothing. Without `--repo`
the sandbox runs the published image and seeds its workspace from it. A sandbox
created by an earlier release keeps its `~/.oh/sandboxes/<name>/oh.json` entry
and keeps working; `agro migrate --home` moves the registry when you choose.

**Mount a project instead.** Point the sandbox at a checkout and it is
bind-mounted at `/home/sandbox/harness`:

```bash
agro sandbox install docker --repo ~/my-project --name my-project
```

Equip that checkout with the control plane first — `cd ~/my-project && oh
update` writes `.agro/` and `crons/` and **nothing else**: no `AGENTS.md`, no
provider configuration, no `.gitignore` line beyond the `.env` line
`agro secret set` adds. Those files stay yours.

Then, inside the sandbox, install and open the persistent interactive workspace
first — a fresh sandbox has no `herdr`, because nothing installs at boot:

```bash
agro tool install herdr
herdr
```

Run the remaining setup, authentication, agents, tests, and servers from its
panes.

### 3. Authenticate one coding harness

Install and authenticate one harness from a Herdr pane. That is a complete first
session — no fork, no clone, no private repository, no Slack, and no upstream
contribution:

```bash
agro harness install claude-code && claude auth login
# ...or pick another one — you need exactly one to start:
#   agro harness install codex && codex login --device-auth
#   agro harness install pi && pi           # first run walks provider auth
#   agro harness install hermes && hermes setup
```

Every CLI arrives only through `agro harness install <id>` — nothing installs at
boot. The simplest cross-provider login is `/login` inside the agent, then
**device mode**, which works on a headless or remote sandbox. Per-harness detail:
[harnesses overview](docs/harnesses/overview.md).

### 4. Authenticate GitHub before any repository work (optional)

Local sandbox use stays available without a GitHub account. Work that reaches
GitHub — pushing, creating a repository, opening a pull request — does not.
Provider authentication authenticates the model, not GitHub, and grants no
repository access.

Run these five steps in this order, inside a Herdr pane:

1. Authenticate the intended GitHub account with `gh auth login`.
2. Run `gh auth setup-git` to configure Git's credential helper.
3. Run `gh auth status`.
4. Confirm the status output identifies the intended account with authenticated
   access.
5. Only after those checks pass, send either optional prompt below to the
   authenticated coding agent.

The initial login is never delegated to the prompts. Both prompts assume it is
already complete and recheck it before acting. Command-level detail and recovery:
[GitHub auth](docs/integrations/github.md).

**Optional — version-control this sandbox in your own private repository.**

> I have completed `gh auth login` and verified the intended GitHub account inside this sandbox.
> Help me version-control this sandbox workspace in my own private GitHub repository.
> Recheck GitHub authentication before acting, then inspect existing Git history and remotes.
> Preserve my files and existing repository configuration.
> Review ignore rules and the proposed tracked files for credentials, runtime state, logs, and unrelated projects.
> Ask me to confirm the account, repository name, and private visibility before creating the repository.
> Show me the proposed commit contents and ask before pushing.
> Do all work inside this sandbox; do not create a host-side source checkout.

**Optional — prepare a contribution to AGRO.**

> I have completed `gh auth login` and verified the intended GitHub account inside this sandbox.
> Help me prepare an AGRO contribution from this sandbox.
> Recheck GitHub authentication before acting.
> Inspect existing remotes and check whether this checkout shares history with the canonical AGRO repository.
> If the histories share ancestry, help me configure an upstream remote and a contribution branch without changing my private origin.
> Otherwise, use a separate ordinary upstream checkout inside this sandbox and transfer only the changes I select.
> Keep private configuration, credentials, and unrelated files out of the contribution.
> Confirm the fork, target branch, and diff with me before pushing or opening a pull request.
> Do not replace the live workspace or create a host-side source checkout.

`agro config repo` (and `oh config repo`) remains a compatibility helper for the
retired clone-and-own recipe and stays supported through the SLA. It is not the
canonical onboarding path.

### 5. Slack and scheduled work (optional)

Configure Slack ([docs/integrations/slack.md](docs/integrations/slack.md),
[docs/harnesses/hermes.md](docs/harnesses/hermes.md)), then run and verify the
gateways from inside the sandbox:

```bash
gateway pi && gateway hermes
gateway status
tmux attach -r -t client-slack-pi   # read-only view; detach with Ctrl-b d
```

### VS Code (secondary path)

Provision with `agro sandbox install docker`, then attach with **Dev Containers:
Attach to Running Container** against your sandbox. That is the supported editor
path.

**Do not provision with "Reopen in Container".** That path reads
`.devcontainer/devcontainer.json`, which lists `docker-compose.yml` alone, so it
bypasses `.agro/scripts/docker-compose.sh` and **no overlay applies** — no SSH
(`access.ssh`), no host Docker socket (`access.dockerSocket`), no Hermes
dashboard (`hermesDashboard.enabled`), and nothing from `composeOverrides[]`.
Secrets still load, because compose auto-loads the `.devcontainer/.env` symlink
beside the compose file; non-secret `agro.json` settings fall back to the compose
defaults. Details: [lifecycle commands](docs/lifecycle-commands.md#vs-code-reopen-in-container-applies-no-overlays).

> **Optional — DebugMCP.** Once attached from VS Code, you can install the
> `microsoft/DebugMCP` extension to expose a debugging MCP server that **any
> MCP-capable harness** (Claude Code, Codex, …) can drive. It's optional and not
> tied to any single agent — see the
> [DebugMCP runbook](docs/integrations/debugmcp.md#confirmed-setup-runbook).

## 🧩 How the primitive pack ships

Open Harness vendors the shared skills/hooks primitive pack directly into the `.agro/` control plane: `.agro/skills/`, `.agro/hooks/`, and `.agro/skills.lock` are tracked as ordinary files in this repo. Skills are the reusable-behavior primitive; the harness ships no repository-authored agent definitions, and provider-native sub-agents remain available as a bounded execution primitive through `/delegate`. `oh update` lays them down, so a fresh checkout has the skills immediately — no submodule, no recursive clone, no network step.

Codex and Pi discover shared skills through `.agents/skills -> ../.agro/skills`. Claude uses `.claude/skills` for the same pack and `.claude/hooks` for `.agro/hooks`. The retired `.codex/skills` and `.pi/skills` links are absent from fresh clones. `.codex/` and `.pi/` retain their provider-specific configuration.

## 🚀 Use it

```bash
agro sandbox list       # every sandbox: name, runtime, status, repo
agro shell <name>       # enter the isolated sandbox
agro tool install herdr # nothing installs at boot; install the workspace first
herdr                 # open the primary interactive workspace
# install an agent CLI the same way, then launch it from a Herdr pane:
#   agro harness install claude-code  → claude    # Claude Code
#   agro harness install codex        → codex     # OpenAI Codex CLI
#   agro harness install pi           → pi        # Pi Coding Agent
#   agro harness install opencode     → opencode  # OpenCode
#   agro harness install hermes       → hermes    # Nous Research Hermes
#   agro harness install grok-build   → grok      # xAI Grok Build
agro stop <name>    # stop the sandbox, keeping volumes
agro destroy <name> # stop the sandbox, wipe its volumes, drop the registry entry
agro --help         # every verb
```

## 🧪 Testing

- Property-based testing convention: [docs/property-testing.md](docs/property-testing.md)

Prefer VS Code or remote SSH? Use the Dev Containers extension's "Attach to Running Container" against your sandbox name from `agro sandbox list` — not "Reopen in Container", which applies no overlays (see [VS Code (secondary path)](#vs-code-secondary-path)) — or SSH into your host first and then attach.

## ⚙️ Configure (optional)

Configuration is split by kind across two files. `agro.json` holds every
non-secret setting — sandbox identity, git identity, the SSH and Docker-socket
toggles. It holds no install field: `agro harness install <id>` and `agro tool
install <id>` are the only door. A gitignored, mode-`0600` `.env` holds nothing
but secrets (`GH_TOKEN`, `SANDBOX_PASSWORD`, `PI_SLACK_APP_TOKEN`,
`PI_SLACK_BOT_TOKEN`, …); the tracked `.example.env` documents every
allow-listed key. A sandbox keeps its pair inside its registry entry —
`agro config set --sandbox <name> <field> <value>` and `agro secret set --sandbox
<name> <KEY>` write there; without the flag both write the project root. Apply a
change with `agro stop <name> && agro sandbox install docker --name <name>`.
Full field reference: [Configuration](docs/configuration.md).

Secrets are read on **every** path, including VS Code "Reopen in Container" —
that path loads `.devcontainer/docker-compose.yml` directly and compose
auto-loads the dotenv beside it, which is a symlink to the root one. Compose
*overlays* are the exception: that path applies none, which is why
`agro sandbox install docker` provisions and VS Code only attaches. A
`harness.yaml` layer used to sit in front of these files and was invisible on
exactly that path; it was removed in 0.4.0, and a leftover one is migrated
automatically on the next lifecycle command. Compose overlay *paths* live in
`composeOverrides[]` in `agro.json`. See
[the `agro sandbox install docker` guide](docs/deployment-prebuilt-image.md) for
the image-mode recipe.

## ✨ What you get

| | |
|---|---|
| **Core agents** | Defaults: Claude Code, Codex, Pi. Optional: OpenCode, Hermes, Grok Build |
| **Runtimes** | Node 22, pnpm, Bun, uv (Python) |
| **DevOps** | Herdr, Docker CLI + Compose, GitHub CLI, cloudflared, tmux, croner |
| **Browser** | agent-browser + Chromium (headless) |
| **One project, one sandbox** | A single container scoped to a single repo and branch |
| **Worktrees** | One sandbox → many isolated git worktrees: parallel branches, delegated sub-agents, satellite project clones under `projects/` |
| **Crons** | Markdown-defined schedules in `crons/*.md` driven by the in-container croner runtime |
| **Multi-agent** | Claude, Codex, Pi, Hermes, Grok — each via `agro harness install <id>`; Slack bridging via [pi-messenger-bridge](docs/integrations/slack.md) |

## 📚 Where to go next

- **[Read the docs → agro.mifune.dev](https://agro.mifune.dev)** — the rendered, searchable documentation site (start here)
- [Docs index](docs/README.md) — GitHub-readable docs kept with the core repo
- [Quickstart](docs/quickstart.md) — full step-by-step
- [DeepWiki](https://deepwiki.com/mifunedev/agro) — generated codebase map
- [Docs site source](https://github.com/mifunedev/agro-web) — Docusaurus source repo that builds agro.mifune.dev (contribute doc edits here)

## 🧹 Cleanup

```bash
agro destroy <name>
```

## 🤝 Contributing & community

Open Harness is maintained under the [`mifunedev`](https://github.com/mifunedev) org — the canonical repo is [github.com/mifunedev/agro](https://github.com/mifunedev/agro). Contribute from a running sandbox: complete the GitHub-login prerequisite above, then use the contribution prompt or the workflow in [Contributing](docs/contributing.md). Issues and PRs welcome; if Open Harness is useful to you, please [give us a star](https://github.com/mifunedev/agro/stargazers).

## 📄 License

[Apache License 2.0](LICENSE) — copyright Ryan Eggleston, d/b/a Mifune Dev (mifune.dev). Prior MIT releases remain available under MIT; this change governs new code and future releases and does not revoke past grants.

Apache-2.0 covers the runtime, the `oh` CLI, container definitions, and the harness spec. The Mifune Console, the provisioning and fleet-management control plane, and billing / enterprise policy / RBAC / hosted operations are proprietary — see the [open-core boundary](docs/open-core.md).

## Trademarks

Apache-2.0 §6 grants no permission to use the Mifune or Open Harness names, logos, or trade dress (reasonable, customary use in describing the origin of the work is fine). Fork it, modify it, sell it — just don't present your fork as Mifune.

---

[Read the docs](https://agro.mifune.dev) · [Docs index](docs/README.md) · [Docs site source](https://github.com/mifunedev/agro-web)
