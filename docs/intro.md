---
title: "Introduction"
---

# AGRO

AGRO gives a coding agent an isolated Docker sandbox that you control. You choose
the coding harness: Claude Code, Codex, Pi, or another. The sandbox keeps the
agent, its tools, and its logins off your host. The sandbox runs on your laptop
or on a remote VM, and the agent keeps working after you disconnect.

## What AGRO gives you

- **One CLI.** `agro` creates, starts, stops, and removes each sandbox.
- **A clean host.** The host needs Docker, Git, and Node.js ≥ 20. Node runs the
  `agro` CLI only. See [Installation](installation.md#prerequisites).
- **A persistent home.** Logins, tools, and the workspace live in one volume
  that survives a restart.
- **Markdown crons.** Each `crons/*.md` file declares a schedule. The cron
  runtime sends the body to the agent as a prompt.
- **Shared procedures.** Skills and hooks in `.agro/` serve every harness.
- **Opt-in access.** SSH, the host Docker socket, Cloudflared tunnels, and Slack
  stay off until you turn them on.

## How it works

1. On the host, run `agro sandbox install docker`. The sandbox runs the
   published image, so you need no project checkout.
2. Run `agro shell <name>`, or attach VS Code.
3. In the sandbox, run `agro tool install herdr` and `herdr` first — nothing installs at boot.
4. In a Herdr pane, install a harness, authenticate it, and start the agent.

The agent in the first Herdr pane at `/home/sandbox/harness` is the
orchestrator. The orchestrator manages git, the sandbox lifecycle, and the
shared agent setup. `agro stop` keeps the home volume. `agro destroy` deletes the
home volume, and it asks before it runs. See
[Lifecycle commands](lifecycle-commands.md).

In the sandbox, systemd runs `.agro/scripts/cron-runtime.ts` as
`agro-cron.service`. The runtime reads `crons/*.md` and sends each body to the
configured agent on its schedule.

## License

AGRO ships under [Apache-2.0](../LICENSE). Mifune's hosted control plane (the
Mifune Console, provisioning, billing, and enterprise policy) is separate and
proprietary.

## Where to start

1. [Installation](installation.md) installs the `agro` CLI.
2. [Quickstart](quickstart.md) takes you to a working agent in the sandbox.

Report issues at [github.com/mifunedev/agro](https://github.com/mifunedev/agro/issues).
