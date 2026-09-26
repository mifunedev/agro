---
title: "T3 Code"
---

# T3 Code

T3 Code is a web-based coding agent harness from Theo Browne and ping.gg. T3 Code differs from the other harnesses in this repository. T3 Code is not a command-line interface that runs in a terminal. T3 Code runs a web UI backed by a server on port `3773`. T3 Code orchestrates an underlying provider — Claude Code, Codex, or OpenCode — as the coding agent. Before T3 Code starts, the operator authenticates one provider. T3 Code then drives the authenticated provider from a browser or from the T3 Code mobile app.

## Purpose

The operator uses T3 Code for a browser or phone UI over the same providers the other harnesses run from the terminal. T3 Code adds multi-thread sessions, conversation history, and a UI for review and approval flows. T3 Code reuses the provider authentication already set up in the sandbox.

## Requirements

T3 Code's server package requires Node `^22.16 || ^23.11 || >=24.10`. The sandbox base image is `node:22-trixie-slim`. A 22.x version older than 22.16 causes the realistic failure. Before the operator launches T3 Code, the operator checks the Node version:

```bash
node -v
```

When the version is out of range, `/t3 doctor` reports an error naming the required Node range.

## Install

T3 Code is an on-demand harness. `agro harness install` does not install T3 Code. The sandbox image does not include T3 Code. The `/t3` skill starts T3 Code with `npx --yes t3 serve`. The `/t3` skill keeps T3 Code running in a named tmux session:

```text
/t3
```

The first launch downloads the t3 package. The first launch then starts the server. The operator does not need a global install. The operator installs t3 globally for faster later starts:

```bash
pnpm add -g t3
```

The operator verifies the install:

```bash
npx t3 --version
```

## Which command to run

| Command | Use it when | Effect |
|---------|-------------|--------|
| `npx t3` | The operator has a browser on this machine and wants a local launch | Starts the server. Opens the local UI flow. |
| `npx t3 serve` | The server runs headless in the sandbox; the operator connects from another machine | Starts the server only. Prints the connection string, a pairing token, a pairing URL, and a QR code. |
| `npx t3 serve --tailscale-serve` | The operator wants a phone or another tailnet device to reach the server privately | Same as `serve`. Also configures Tailscale Serve on HTTPS 443 and advertises `https://<machine>.<tailnet>.ts.net/`. |
| `npx t3 pair` | A server already runs and the operator wants to add a device | Mints a fresh one-time pairing token without restarting the server. |
| `npx t3 pair --tailscale` | A server already runs and the new device is on the tailnet | Publishes over Tailscale Serve HTTPS. Pairs through the MagicDNS URL. |

Inside the sandbox, the operator runs the `/t3` skill instead of calling `npx` directly. The `/t3` skill owns the tmux session and the preflight checks.

When the tailnet node already uses HTTPS 443 for another service, the operator adds `--tailscale-serve-port <port>` to `serve` or to `pair --tailscale`. `pair --tailscale` also accepts `--ttl` and `--base-dir`.

## Authentication

T3 Code supports three provider backends: Codex, Claude Code, and OpenCode. Before the operator launches T3 Code, the operator installs at least one provider in the sandbox. The operator then authenticates that provider. See the per-provider pages for details:

- **[Codex](./codex.md)**: run `codex login`
- **[Claude Code](./claude-code.md)**: run `claude` and complete OAuth
- **[OpenCode](./opencode.md)**: run `opencode auth login`

Provider authentication is separate from T3 pairing. Pairing binds a client — a browser or a phone — to the running T3 server. Pairing grants no provider credentials. Pairing does not replace `claude` login, `codex login`, or `opencode auth login`.

T3 Code uses a pairing-URL authentication model. When the server starts, T3 Code prints a one-time URL, for example `http://localhost:3773/pair#token=...`, plus a QR code. The operator opens the URL, or scans the QR code from the T3 Code mobile app, to bind the client to the running server. The token works one time only. To add a second device, the operator runs `npx t3 pair` against the running server. The operator does not restart T3 Code.

The operator treats pairing URLs and tokens as secrets. The operator does not paste pairing URLs or tokens into issues, pull requests, or chat messages.

## Run in tmux

Per [`.agro/skills/t3/references/sandbox-processes.md`](https://github.com/mifunedev/agro/blob/development/.agro/skills/t3/references/sandbox-processes.md), long-running processes inside the sandbox run in named tmux sessions. T3 Code stays bound to container loopback at `127.0.0.1:3773`. The harness publishes no host port for T3 Code. The operator reaches T3 Code through VSCode port forwarding, an SSH tunnel, or Tailscale Serve. See [Connecting to the Sandbox](/docs/connecting).

When an agent is available, the operator uses the `/t3` skill:

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

Without the `/t3` skill, the operator runs the manual terminal fallback:

```bash
tmux new-session -d -s agent-t3code 'npx --yes t3 serve 2>&1 | tee /tmp/agent-t3code.log'
tmux capture-pane -t agent-t3code -p | grep -i pairingUrl
```

The operator reattaches to the session at any time:

```bash
tmux attach -t agent-t3code
```

The tmux session survives a shell or SSH disconnect. The operator detaches with `Ctrl-b d`.

## Mobile access over Tailscale

`--tailscale-serve` configures Tailscale Serve on HTTPS 443. `--tailscale-serve` advertises `https://<machine>.<tailnet>.ts.net/`. The phone must sign in to the same tailnet as the sandbox. For the full recipe, prerequisites, and troubleshooting, see [Connecting → Mobile access over Tailscale](/docs/connecting#mobile-access-over-tailscale).

The Serve mapping persists after T3 Code stops. The operator withdraws the Serve mapping explicitly:

```bash
tailscale serve --https=443 off
```

The operator uses `--tailscale-serve-port 8443` to publish on an alternate HTTPS port. The operator withdraws that mapping with `tailscale serve --https=8443 off`.

## Revoking access

Two independent credentials exist. When the operator retires a device, the operator revokes both credentials.

```bash
t3 auth                          # issue, inspect, and revoke T3 sessions and pairing credentials
tailscale serve --https=443 off  # withdraw the Serve mapping
tailscale logout                 # sign this node out of the tailnet
```

The operator also removes the device from the tailnet in the Tailscale admin console. `tailscale logout` signs the node out of the tailnet. The admin console deletes the device record.

## Sharing publicly

Tailscale is the private path and the supported mobile path. When the operator needs a public preview URL for a collaborator outside the sandbox's tailnet, the operator uses `/cloudflared 3773` instead. `/cloudflared 3773` creates public bearer-URL exposure: anyone with the link reaches the port. The harness does not enable Tailscale Funnel by default. The harness ships no Funnel command. See [Security considerations](../security-considerations.md).

## Tips

- T3 Code is a UI over the providers. Installing T3 Code does not replace `claude login`, `codex login`, or `opencode auth login`. The operator authenticates the provider first, then starts T3 Code.
- The hosted page at `https://app.t3.codes` uses HTTPS. HTTPS cannot reach a plain-HTTP tailnet endpoint; browsers block that as mixed content. The operator uses `--tailscale-serve`, which serves HTTPS, or uses the native mobile app.
- T3 Code uses Node's experimental SQLite feature at startup. Node prints an experimental-feature warning in the log; that warning does not indicate a failure.

## Upstream documentation

- [`pingdotgg/t3code` on GitHub](https://github.com/pingdotgg/t3code)
- [T3 Code remote access](https://github.com/pingdotgg/t3code/blob/main/docs/user/remote-access.md)

[Connecting to the Sandbox](/docs/connecting)
