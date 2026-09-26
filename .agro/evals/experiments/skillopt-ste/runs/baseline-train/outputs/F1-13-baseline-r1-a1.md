---
title: "T3 Code"
---

# T3 Code

T3 Code is a web-based coding agent harness from Theo Browne and ping.gg. T3 Code differs from the other harnesses in this repository. T3 Code runs a web UI backed by a server on port `3773`, not a CLI in a terminal. T3 Code orchestrates an underlying provider — Claude Code, Codex, or OpenCode — as the coding agent. The operator authenticates the provider first. T3 Code then drives that provider from a browser or from the T3 Code mobile app.

## Purpose

Use T3 Code for a browser or phone UI over the same providers the other harnesses run from the terminal. T3 Code adds multi-thread sessions, conversation history, and a review-and-approval UI. T3 Code reuses the provider authentication already configured in the sandbox.

## Requirements

The T3 Code server package requires Node `^22.16 || ^23.11 || >=24.10`. The sandbox base image `node:22-trixie-slim` ships a Node 22.x build. A Node 22.x build older than `22.16` fails this requirement. Before you launch T3 Code, check the Node version:

```bash
node -v
```

`/t3 doctor` runs the same check. `/t3 doctor` reports an error when the installed Node version falls outside the required range.

## Install

T3 Code is an on-demand harness. `agro harness install` does not install T3 Code. The sandbox image does not include T3 Code. The `/t3` skill starts T3 Code on demand with `npx --yes t3 serve` and keeps the process in tmux:

```text
/t3
```

The first launch downloads the package and starts the server. T3 Code needs no global install. Install T3 Code globally for a faster subsequent start:

```bash
pnpm add -g t3
```

Verify:

```bash
npx t3 --version
```

## Which command to run

| Command | Use this command when | What the command does |
|---------|-------------|--------------|
| `npx t3` | You are on the machine with the browser and want the normal local launch | Starts the server and opens the local UI flow |
| `npx t3 serve` | The server runs headless in the sandbox and you connect from elsewhere | Starts the server only, prints the connection string, a pairing token, a pairing URL, and a QR code |
| `npx t3 serve --tailscale-serve` | You want a phone or another tailnet device to reach the server privately | Same as `serve`, plus configures Tailscale Serve on HTTPS 443 and advertises `https://<machine>.<tailnet>.ts.net/` |
| `npx t3 pair` | A server is already running and you want to add a device | Mints a fresh one-time pairing token without restarting the server |
| `npx t3 pair --tailscale` | A server is already running and the new device is on the tailnet | Publishes over Tailscale Serve HTTPS and pairs through the MagicDNS URL |

Inside the sandbox, prefer the `/t3` skill over calling `npx` directly. The `/t3` skill owns the tmux session and the preflight checks.

When HTTPS port `443` is already in use on the sandbox's tailnet node, pass `--tailscale-serve-port <port>` to `serve` or to `pair --tailscale`. `pair --tailscale` also accepts `--ttl` and `--base-dir`.

## Authentication

T3 Code supports three provider backends: Codex, Claude Code, and OpenCode. Before you launch T3 Code, install and authenticate at least one provider in the sandbox. See the per-provider pages for details:

- **[Codex](./codex.md)**: run `codex login`
- **[Claude Code](./claude-code.md)**: run `claude` and complete OAuth
- **[OpenCode](./opencode.md)**: run `opencode auth login`

Provider authentication is separate from T3 pairing. Pairing binds a client — a browser or a phone — to the running T3 Code server. Pairing grants no provider credentials. Pairing does not replace `claude` / `codex login` / `opencode auth login`.

T3 Code uses a pairing-URL authentication model. On start, T3 Code prints a one-time URL, for example `http://localhost:3773/pair#token=...`, plus a QR code. Open the URL, or scan the QR code from the T3 Code mobile app, to bind the client to the running server. The token is single-use. To add a second device, run `npx t3 pair` against the running server. Do not restart T3 Code to add the device.

Treat pairing URLs and tokens as secrets. Do not paste them into issues, pull requests, or chat.

## Run in tmux

Per [`.agro/skills/t3/references/sandbox-processes.md`](https://github.com/mifunedev/agro/blob/development/.agro/skills/t3/references/sandbox-processes.md), long-running processes inside the sandbox run in named tmux sessions. T3 Code binds to the container loopback address `127.0.0.1:3773`. The harness publishes no host port for T3 Code. Reach T3 Code through VSCode port forwarding, an SSH tunnel, or Tailscale Serve. See [Connecting to the Sandbox](/docs/connecting).

Prefer the `/t3` skill when an agent is available:

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

Manual terminal fallback:

```bash
tmux new-session -d -s agent-t3code 'npx --yes t3 serve 2>&1 | tee /tmp/agent-t3code.log'
tmux capture-pane -t agent-t3code -p | grep -i pairingUrl
```

Reattach to the session at any time:

```bash
tmux attach -t agent-t3code
```

The session survives a shell or SSH disconnect. Detach with `Ctrl-b d`.

## Mobile access over Tailscale

`--tailscale-serve` configures Tailscale Serve on HTTPS port `443` and advertises `https://<machine>.<tailnet>.ts.net/`. The phone must sign in to the same tailnet as the sandbox. For the full setup recipe, the prerequisites, and troubleshooting steps, see [Connecting → Mobile access over Tailscale](/docs/connecting#mobile-access-over-tailscale).

The Serve mapping persists after T3 Code stops. Withdraw the Serve mapping explicitly:

```bash
tailscale serve --https=443 off
```

Use `--tailscale-serve-port 8443` to publish on an alternate HTTPS port. Withdraw that mapping with `tailscale serve --https=8443 off`.

## Revoking access

Two independent credentials exist for a device: the T3 pairing credential and the Tailscale node credential. When the operator retires a device, the operator revokes both credentials:

```bash
t3 auth                          # issue, inspect, and revoke T3 sessions and pairing credentials
tailscale serve --https=443 off  # withdraw the Serve mapping
tailscale logout                 # sign this node out of the tailnet
```

Remove the device from the tailnet in the Tailscale admin console too. `tailscale logout` signs out the node. The Tailscale admin console deletes the node record.

## Sharing publicly

Tailscale is the private path and the supported mobile path. When a reviewer outside the sandbox's tailnet needs a public preview URL, run `/cloudflared 3773` instead. `/cloudflared 3773` exposes the port as a public bearer URL: anyone who holds the link reaches the port. The harness disables Tailscale Funnel by default. The harness ships no Funnel command. See [Security considerations](../security-considerations.md).

## Tips

- T3 Code is a UI over the providers. Installing T3 Code does not replace `claude login` / `codex login` / `opencode auth login`. Authenticate the provider first. Start T3 Code second.
- The hosted page at `https://app.t3.codes` serves over HTTPS. The browser blocks the page from reaching a plain-HTTP tailnet endpoint as mixed content. Use `--tailscale-serve`, which serves HTTPS, or use the native mobile app.
- T3 Code uses Node's experimental SQLite module at startup. T3 Code logs a warning for this module. The warning does not indicate a failure.

## Upstream documentation

- [`pingdotgg/t3code` on GitHub](https://github.com/pingdotgg/t3code)
- [T3 Code remote access](https://github.com/pingdotgg/t3code/blob/main/docs/user/remote-access.md)

[Connecting to the Sandbox](/docs/connecting)
