---
title: "Introduction"
---

# AGRO

AGRO is your **portable harness**: one repo per sandbox. AGRO wraps your project in an isolated Docker container. The repo versions the harness state in git: the agent identity, skills, crons, and memory. The sandbox keeps the agent off your host machine. The agent is Claude Code, Codex, Pi, or another agent of your choice. The agent owns its workspace and runs against your code. The croner runtime wakes the agent on a schedule.

## What is AGRO?

The single AGRO repo *is* your harness. The harness boots one Docker container, the sandbox, and wraps your project inside the sandbox. Run `agro sandbox install docker` to start the sandbox. Attach to the sandbox from your terminal or from VS Code. Your chosen agent then works on the project over time. The harness is a git repo, so git tracks and versions the whole harness setup. Git tracking makes the setup reproducible and portable. AGRO has no per-agent fan-out. One host CLI, `agro`, drives the whole lifecycle. The croner runtime ships in the image and wakes the agent on a schedule.

Key capabilities:

- **One repo, one sandbox.** Your portable harness is one repo, and that repo boots one container. The agent owns its workspace. Agents do not run directly on your host, so your machine stays clean.
- **Markdown-defined crons.** Files that match `crons/*.md` declare schedules. The croner runtime inside the container fires each file body as an agent prompt. The agent works autonomously while you focus on other tasks.
- **Host dependencies: Docker, Git, and Node.js ≥ 20.** Your laptop needs no Python, no pnpm, no agent CLIs, and no toolchain maintenance. Node runs the `agro` CLI and nothing else. If Node is missing, `get-agro.sh` installs Node for you. (See [Prerequisites](/docs/installation#prerequisites).)
- **Cloudflared previews.** Share sandbox app ports through Cloudflared tunnels. SSH and pack-supplied services remain opt-in Docker Compose overlays.
- **Multi-agent messaging.** The [`pi-messenger-bridge`](/docs/integrations/slack) npm package bridges Slack and other messengers to a Pi agent.

## How it works

The harness uses Docker Compose to build a sandbox image from `.devcontainer/`. Nothing installs at boot. Run these steps in order:

1. On the host, run `agro sandbox install docker` to start the sandbox.
2. On the host, run `agro shell <name>` to attach to the sandbox. VS Code can also attach to the sandbox.
3. In the sandbox, run `agro tool install herdr`.
4. In the sandbox, run `herdr`.
5. From a Herdr pane, authenticate GitHub.
6. From a Herdr pane, authenticate your chosen provider.
7. Launch agents from Herdr panes.

`agro stop` preserves state. `agro destroy` is the destructive teardown. Before `agro destroy` deletes the volumes, the command asks for confirmation. Every one of these verbs runs `.agro/scripts/docker-compose.sh`. See [lifecycle commands](/docs/lifecycle-commands).

The primary agent pane inside Herdr runs at the project root. This pane is your **orchestrator**. Git, sandbox lifecycle, and most file edits all flow through this workspace.

The Docker socket is optional and off by default. See [security-considerations.md](security-considerations.md#3-sandbox-isolation--the-docker-socket-caveat--enforced-with-a-caveat). If you enable the Docker socket, the orchestrator can drive other containers over the socket. The orchestrator can also edit files inside those containers over the socket. With the socket enabled, day-to-day work seldom needs a tool outside the orchestrator.

Return to the host shell only for a task that you cannot do from inside the container. For example, a new bind-mounted volume requires a change to `.devcontainer/docker-compose.yml` and a sandbox restart.

Start a **second sandbox** only when you want isolation. A second sandbox runs on its own, with an independent identity, branch, or provider key. Most users do not need a second sandbox.

Inside the sandbox, systemd runs `scripts/cron-runtime.ts` as `agro-cron.service`. The service reads `crons/*.md` and fires each file body as a prompt to the configured agent. Each prompt fires on the schedule that its file declares.

```mermaid
flowchart TB
    You["You<br/>terminal · VS Code · browser · Slack"]
    Repo[("Repo on disk")]
    GH["GitHub"]
    LLM["LLM provider"]

    subgraph sandbox["Sandbox container — default workspace"]
        Herdr["<b>Herdr</b><br/>interactive workspaces · panes"]
        Orch{{"<b>Orchestrator pane</b><br/>chosen agent @ project root<br/>git · lifecycle · file edits"}}
        Tmux["managed tmux services<br/>client-slack-pi · gateways · detached cron fires"]
        Sock(["docker.sock<br/><i>opt-in</i>"])
    end

    Sb2["Second sandbox<br/><i>only if you need isolation</i>"]

    You ==>|attach · install · run herdr| Herdr
    Herdr --> Orch
    You -.->|browser · Slack| Tmux
    Repo <-.->|bind mount| Orch
    Orch <-->|git| GH
    Orch <-->|API| LLM
    Tmux <-->|API| LLM
    Orch -.->|docker socket · opt-in| Sock
    Sock -.->|provisions| Sb2
```

## How to read these docs

If you are new, follow this order:

1. [Installation](/docs/installation) — install Docker, Git, and the `agro` CLI.
2. [Quickstart](/docs/quickstart) — go from zero to a running sandbox in under five minutes.

If you already have a sandbox running, jump directly to the page you need.

## Where to get help

- Source code and issues: [github.com/mifunedev/agro](https://github.com/mifunedev/agro)
- Learning material: [Resources](/docs/resources)
- Philosophy: [How AGRO embodies compound engineering](https://github.com/mifunedev/agro-web/tree/main/blog) — why each unit of work here should make the next one easier.

[Connecting to the Sandbox](/docs/connecting)
