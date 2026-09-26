---
title: "T3 Code"
---

# T3 Code

T3 Code is a web-based coding agent harness from Theo Browne and ping.gg. The other harnesses in this documentation run as a CLI in a terminal. T3 Code instead runs a web UI backed by a server on port `3773`. T3 Code orchestrates an underlying provider (Claude Code, Codex, or OpenCode) as the coding agent. The operator authenticates a provider before use. T3 Code drives that provider from a browser or from the T3 Code mobile app.

## Purpose

The operator uses T3 Code for a browser or phone UI over the same providers the other harnesses run from the terminal. T3 Code adds multi-thread sessions, conversation history, and a UI for review and approval flows. T3 Code reuses provider authentication already set up in the sandbox.

## Requirements

T3 Code's server package requires Node `^22.16 || ^23.11 || >=24.10`. The sandbox base image `node:22-trixie-slim` can ship a Node 22.x version older than `22.16`, which fails this requirement.

The operator checks the Node version before each T3 Code launch:

```bash
node -v
```

`/t3 doctor` runs the same check. When the Node version is out of range, `/t3 doctor` reports an error.

## Install

T3 Code is an on-demand harness. `agro harness install` does not install T3 Code, and the sandbox image does not ship T3 Code. The `/t3` skill starts T3 Code on demand by running `npx --yes t3 serve`. The `/t3` skill keeps that process in tmux:

```text
/t3
```

The first launch downloads the T3 Code package. The first launch then starts the server. A global install is optional. Install T3 Code globally for a faster subsequent start:

```bash
pnpm add -g t3
```

Verify the install:

```bash
npx t3 --version
```

## Which command to run

| Command | Situation | What the command does |
|---------|-----------|------------------------|
| `npx t3` | The operator is on the machine with the browser and wants the normal local launch. | Starts the server. Opens the local UI. |
| `npx t3 serve` | The server runs headless in the sandbox; the operator connects from elsewhere. | Starts the server only. Prints the connection string, a pairing token, a pairing URL, and a QR code. |
| `npx t3 serve --tailscale-serve` | The operator wants a phone or another tailnet device to reach the server privately. | Starts the server, same as `serve`. Configures Tailscale Serve on HTTPS `443`. Advertises `https://<machine>.<tailnet>.ts.net/`. |
| `npx t3 pair` | A server is already running; the operator wants to add a device. | Mints a fresh one-time pairing token. Does not restart the server. |
| `npx t3 pair --tailscale` | A server is already running; the new device is on the tailnet. | Publishes over Tailscale Serve HTTPS. Pairs the device through the MagicDNS URL. |

Inside the sandbox, use the `/t3` skill instead of running `npx` directly. The `/t3` skill owns the tmux session and the preflight checks.

When HTTPS `443` is already taken on that tailnet node, use `--tailscale-serve-port <port>` with `serve` or with `pair --tailscale`. `pair --tailscale` also accepts `--ttl` and `--base-dir`.

## Authentication

T3 Code currently supports Codex, Claude, and OpenCode as backends. Before the operator starts T3 Code, the operator installs at least one provider in the sandbox. The operator authenticates that provider before use (see the per-provider pages for details):

- **[Codex](./codex.md)**: run `codex login`
- **[Claude Code](./claude-code.md)**: run `claude`. Complete OAuth in the browser that opens.
- **[OpenCode](./opencode.md)**: run `opencode auth login`

Provider authentication is separate from T3 pairing. Pairing binds a client (a browser or a phone) to the running T3 server. Pairing grants no provider credentials. Pairing does not replace `claude`, `codex login`, or `opencode auth login`.

T3 Code uses a pairing-URL authentication model. On start, T3 Code prints a one-time URL, for example `http://localhost:3773/pair#token=...`, plus a QR code. Open the URL, or scan the QR code from the T3 Code mobile app, to bind the client to the running server. The token is single-use.

To add a second device, run `npx t3 pair` against the running server. Do not restart T3 Code.

Treat pairing URLs and tokens as secrets. Do not paste them into issues, pull requests, or chat.

## Run in tmux

Per [`.agro/skills/t3/references/sandbox-processes.md`](https://github.com/mifunedev/agro/blob/development/.agro/skills/t3/references/sandbox-processes.md), a long-running process inside the sandbox runs in a named tmux session. T3 Code stays bound to container loopback (`127.0.0.1:3773`). The harness publishes no host port for T3 Code. Reach T3 Code through VSCode port forwarding, an SSH tunnel, or Tailscale Serve. See [Connecting to the Sandbox](/docs/connecting).

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

`--tailscale-serve` configures Tailscale Serve on HTTPS `443`. `--tailscale-serve` advertises `https://<machine>.<tailnet>.ts.net/`. The phone must sign in to the same tailnet as the sandbox. For the full recipe, prerequisites, and troubleshooting steps, see [Connecting → Mobile access over Tailscale](/docs/connecting#mobile-access-over-tailscale).

The Serve mapping persists after T3 Code stops. Withdraw the Serve mapping explicitly:

```bash
tailscale serve --https=443 off
```

Use `--tailscale-serve-port 8443` to publish on an alternate HTTPS port. Withdraw that mapping with `tailscale serve --https=8443 off`.

## Revoking access

Two independent credentials exist. When the operator retires a device, the operator revokes both credentials.

```bash
t3 auth                          # issue, inspect, and revoke T3 sessions and pairing credentials
tailscale serve --https=443 off  # withdraw the Serve mapping
tailscale logout                 # sign this node out of the tailnet
```

Remove the device from the tailnet in the Tailscale admin console too. `tailscale logout` signs the device out of the tailnet. The admin console deletes the device record.

## Sharing publicly

Tailscale is the private path and the supported mobile path. When the operator needs a public preview URL for a person outside the tailnet, use `/cloudflared 3773` instead. That command exposes a public bearer URL: anyone with the link reaches the port. Tailscale Funnel is not enabled by default. The harness ships no Funnel command. See [Security considerations](../security-considerations.md).

## Tips

- T3 Code is a UI over the providers. Installing T3 Code does not replace `claude login`, `codex login`, or `opencode auth login`. Authenticate the provider before the operator starts T3 Code.
- The hosted page at `https://app.t3.codes` is HTTPS. This page cannot reach a plain-HTTP tailnet endpoint because of mixed-content restrictions in the browser. Use `--tailscale-serve`, which is HTTPS, or use the native mobile app.
- T3 Code uses Node's experimental SQLite feature at startup. The startup log prints a related warning. Ignore this warning.

## Upstream documentation

- [`pingdotgg/t3code` on GitHub](https://github.com/pingdotgg/t3code)
- [T3 Code remote access](https://github.com/pingdotgg/t3code/blob/main/docs/user/remote-access.md)

[Connecting to the Sandbox](/docs/connecting)
