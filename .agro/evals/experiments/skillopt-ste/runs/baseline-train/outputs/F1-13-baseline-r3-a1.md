---
title: "T3 Code"
---

# T3 Code

T3 Code is a web-based coding agent harness from Theo Browne / ping.gg. T3 Code differs from the other harnesses on this list. T3 Code is **not a CLI that you use in a terminal**. T3 Code runs a web UI on a server at port `3773`. The server controls one provider as the coding agent: Claude Code, Codex, or OpenCode. You supply a provider that you already authenticated. T3 Code drives that provider from a browser or from the T3 Code mobile app.

## Purpose

If you want a browser UI or a phone UI over the providers that the other harnesses run in the terminal, use T3 Code. T3 Code adds multi-thread sessions, conversation history, and a UI for review and approval flows. T3 Code reuses the provider authentication that already exists in the sandbox.

## Requirements

The T3 Code server package requires Node `^22.16 || ^23.11 || >=24.10`. The sandbox base image is `node:22-trixie-slim`. The most probable failure is a Node 22.x version older than 22.16. Before you start T3 Code, check the Node version in the sandbox:

```bash
node -v
```

`/t3 doctor` runs the same check. If the Node version is out of range, `/t3 doctor` reports an actionable error.

## Install

T3 Code is an **on-demand** harness. `agro harness install` does not install T3 Code, and the sandbox image does not contain T3 Code. The `/t3` skill starts T3 Code on demand with `npx --yes t3 serve`. The skill keeps the server in a tmux session:

```text
/t3
```

The first start downloads the package and starts the server. A global install is optional. A global install makes later starts faster:

```bash
pnpm add -g t3
```

To verify the install, run:

```bash
npx t3 --version
```

## Which command to run

| Command | Condition | Result |
|---------|-------------|--------------|
| `npx t3` | You are on the machine with the browser and want the normal local launch | Starts the server and opens the local UI flow |
| `npx t3 serve` | The server runs headless in the sandbox and you connect from a different machine | Starts only the server. Prints the connection string, a pairing token, a pairing URL, and a QR code |
| `npx t3 serve --tailscale-serve` | You want a phone or a different tailnet device to reach the server privately | Does the same as `serve`. Also configures Tailscale Serve on HTTPS 443 and advertises `https://<machine>.<tailnet>.ts.net/` |
| `npx t3 pair` | A server already runs and you want to add a device | Makes a new one-time pairing token. The server does not restart |
| `npx t3 pair --tailscale` | A server already runs and the new device is on the tailnet | Publishes over Tailscale Serve HTTPS and pairs through the MagicDNS URL |

Inside the sandbox, use the `/t3` skill instead of a manual `npx` command. The `/t3` skill owns the tmux session and the preflight checks.

If HTTPS 443 is already in use on that tailnet node, add `--tailscale-serve-port <port>`. Both `serve` and `pair --tailscale` accept `--tailscale-serve-port <port>`. `pair --tailscale` also accepts `--ttl` and `--base-dir`.

## Authentication

T3 Code supports three backends: Codex, Claude, and OpenCode. Before you start T3 Code, install and authenticate **at least one provider** in the sandbox. Each provider page gives the full procedure:

- **[Codex](./codex.md)**: run `codex login`
- **[Claude Code](./claude-code.md)**: run `claude` and complete OAuth
- **[OpenCode](./opencode.md)**: run `opencode auth login`

Provider authentication is **separate** from T3 pairing. Pairing binds a client (a browser or a phone) to your T3 server. Pairing gives no provider credentials. Pairing does not replace `claude` / `codex login` / `opencode auth login`.

T3 Code uses a **pairing-URL** authentication model. At start, T3 Code prints a one-time URL such as `http://localhost:3773/pair#token=...` and a QR code. To bind the client to the server, open the URL. As an alternative, scan the QR code with the T3 Code mobile app. The token is single-use. To add a second device, run `npx t3 pair` against the server that runs. **Do not restart T3 Code.**

Pairing URLs and pairing tokens are secrets. Do not paste a pairing URL or a pairing token into an issue, a pull request, or a chat.

## Run in tmux

[`.agro/skills/t3/references/sandbox-processes.md`](https://github.com/mifunedev/agro/blob/development/.agro/skills/t3/references/sandbox-processes.md) sets the rule: long-running processes inside the sandbox run in named tmux sessions. T3 Code stays bound to **container loopback** (`127.0.0.1:3773`). The harness publishes no host port for T3 Code. To reach T3 Code, use VSCode port forwarding, an SSH tunnel, or Tailscale Serve. For each method, read [Connecting to the Sandbox](/docs/connecting).

When an agent is available, use the `/t3` skill:

```text
/t3 doctor          # preflight: tmux, npx, Node range, and Tailscale state
/t3 start           # launch `npx t3 serve` in tmux and print the pairing URL
/t3 start --tailscale   # launch `npx t3 serve --tailscale-serve`
/t3 status          # inspect the tmux session and recent output
/t3 url             # print the latest pairing URL found in logs
/t3 pair            # mint a fresh pairing token for a running server
/t3 pair --tailscale    # pair a new device through the MagicDNS HTTPS URL
/t3 stop            # stop the tmux session
```

If no agent is available, run these commands in a sandbox terminal:

```bash
tmux new-session -d -s agent-t3code 'npx --yes t3 serve 2>&1 | tee /tmp/agent-t3code.log'
tmux capture-pane -t agent-t3code -p | grep -i pairingUrl
```

To attach to the session again, run:

```bash
tmux attach -t agent-t3code
```

The session continues after a shell disconnect or an SSH disconnect. To detach, press `Ctrl-b d`.

## Mobile access over Tailscale

`--tailscale-serve` configures Tailscale Serve on HTTPS **443** and advertises `https://<machine>.<tailnet>.ts.net/`. The phone must sign in to the **same tailnet** as the sandbox. For the full procedure, the prerequisites, and troubleshooting, read [Connecting → Mobile access over Tailscale](/docs/connecting#mobile-access-over-tailscale).

The Serve mapping stays after T3 Code stops. To remove the mapping, run:

```bash
tailscale serve --https=443 off
```

To publish on a different HTTPS port, add `--tailscale-serve-port 8443`. To remove the port 8443 mapping, run `tailscale serve --https=8443 off`.

## Revoking access

A device holds two independent credentials. When you retire a device, revoke both credentials:

```bash
t3 auth                          # issue, inspect, and revoke T3 sessions and pairing credentials
tailscale serve --https=443 off  # withdraw the Serve mapping
tailscale logout                 # sign this node out of the tailnet
```

Also remove the device from the tailnet in the Tailscale admin console. `tailscale logout` signs the node out. The admin console deletes the node.

## Sharing publicly

Tailscale is the **private** path and the supported mobile path. If a user who is not on your tailnet needs a public preview URL, run `/cloudflared 3773`. `/cloudflared` gives public bearer-URL exposure: any person with the link reaches the port. Tailscale Funnel is **not** on by default, and the harness ships no Funnel command. Read [Security considerations](../security-considerations.md).

## Tips

- T3 Code is a UI over the providers. T3 Code does **not** replace `claude login` / `codex login` / `opencode auth login`. First, authenticate the provider. Then start T3 Code.
- The hosted page at `https://app.t3.codes` uses HTTPS. Because of mixed-content rules, that page cannot connect to a plain-HTTP tailnet endpoint. Use `--tailscale-serve`, which uses HTTPS, or use the native mobile app.
- At startup, T3 Code uses the experimental SQLite module of Node. The log shows a warning about that module. The warning is expected.

## Upstream documentation

- [`pingdotgg/t3code` on GitHub](https://github.com/pingdotgg/t3code)
- [T3 Code remote access](https://github.com/pingdotgg/t3code/blob/main/docs/user/remote-access.md)

[Connecting to the Sandbox](/docs/connecting)
