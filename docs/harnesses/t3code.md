---
title: "T3 Code"
---

# T3 Code

T3 Code is a web-based coding agent harness from Theo Browne / ping.gg. Unlike the other harnesses listed here, T3 Code is **not a CLI you talk to in a terminal**. T3 Code runs a web UI backed by a server on port `3773`. T3 Code drives an underlying provider (Claude Code, Codex, or OpenCode) as the actual coding agent. Bring your own already-authenticated provider. T3 Code then drives that provider from a browser or from the T3 Code mobile app.

## Purpose

Use T3 Code when you want a browser or phone UI over the same providers the other harnesses run from the terminal. T3 Code adds multi-thread sessions, conversational history, and a UI for review/approval flows, and reuses whatever provider auth you already set up in the sandbox.

## Requirements

T3 Code's server package requires Node `^22.16 || ^23.11 || >=24.10`. The sandbox base image is `node:22-trixie-slim`, so a 22.x version older than 22.16 is the realistic failure. Check before you launch:

```bash
node -v
```

`/t3 doctor` runs the same check and reports an actionable error when the version is out of range.

## Install

T3 Code is an **on-demand** harness: `agro harness install` does not install T3 Code, and T3 Code is not in the sandbox image. The `/t3` skill starts T3 Code on demand via `npx --yes t3 serve` and keeps the server in tmux:

```text
/t3
```

The first launch downloads the package and starts the server. A global install is optional; install `t3` globally for faster subsequent starts:

```bash
pnpm add -g t3
```

Verify:

```bash
npx t3 --version
```

Inside the sandbox, prefer the `/t3` skill over calling `npx` by hand; the skill owns the tmux session and the preflight checks.

## Authentication

T3 Code currently supports Codex, Claude, and OpenCode as backends. Install and authenticate **at least one provider** in the sandbox before you launch T3 Code:

- **[Codex](./codex.md)**: run `codex login`
- **[Claude Code](./claude-code.md)**: run `claude` and complete OAuth
- **[OpenCode](./opencode.md)**: run `opencode auth login`

Provider authentication is **separate** from T3 pairing. Pairing binds a client (browser or phone) to your running T3 server; pairing grants no provider credentials and does not replace `claude` / `codex login` / `opencode auth login`.

T3 Code itself uses a **pairing-URL** auth model: on start T3 Code prints a one-time URL like `http://localhost:3773/pair#token=...` plus a QR code. Open the URL, or scan the QR from the T3 Code mobile app, to bind the client to the running server. The token is single-use. To add a second device, run `npx t3 pair` against the running server. Do not restart T3 Code for this.

Treat pairing URLs and tokens as secrets. Do not paste them into issues, pull requests, or chat.

## Run in tmux

T3 Code stays bound to **container loopback** (`127.0.0.1:3773`); the harness publishes no host port for it. Reach it through VSCode port forwarding, an SSH tunnel, or Tailscale Serve — see [Connecting to the Sandbox](../connecting.md).

Prefer the `/t3` skill when an agent is available: `/t3 doctor`, `/t3 start`, `/t3 status`, `/t3 url`, `/t3 pair`, `/t3 stop`. See [`.agro/skills/t3/SKILL.md`](../../.agro/skills/t3/SKILL.md) for the full argument list, including `--tailscale`.

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

Tailscale is the supported path for reaching T3 Code from a phone, or from a remote sandbox with no published port. Run `/t3 start --tailscale` to configure Tailscale Serve and advertise `https://<machine>.<tailnet>.ts.net/`. Full prerequisites, the end-to-end recipe, and troubleshooting live at [Connecting → Mobile access over Tailscale](../connecting.md#mobile-access-over-tailscale).

## Revoking access

Two independent credentials exist. Revoke both when you retire a device.

```bash
t3 auth                          # issue, inspect, and revoke T3 sessions and pairing credentials
tailscale serve --https=443 off  # withdraw the Serve mapping
tailscale logout                 # sign this node out of the tailnet
```

Remove the device from the tailnet in the Tailscale admin console too; `tailscale logout` signs out the node, and the admin console deletes it.

## Sharing publicly

Tailscale is the **private** path and the supported mobile path. When you need a public preview URL for a reviewer outside your tailnet, use `/cloudflared 3773` instead. A Cloudflared tunnel is public bearer-URL exposure: anyone who holds the link reaches the port. See [Security considerations](../security-considerations.md).

## Tips

- T3 Code is a UI over the providers; installing T3 Code does **not** replace `claude` / `codex login` / `opencode auth login`. Authenticate the provider first, then start T3 Code.
- The hosted page at `https://app.t3.codes` is HTTPS, so it cannot talk to a plain-HTTP tailnet endpoint (mixed content). Use `--tailscale-serve`, which is HTTPS, or the native mobile app.
- T3 Code uses Node's experimental SQLite at startup; the warning in the log is expected.

## Upstream documentation

- [`pingdotgg/t3code` on GitHub](https://github.com/pingdotgg/t3code)
- [T3 Code remote access](https://github.com/pingdotgg/t3code/blob/main/docs/user/remote-access.md)
