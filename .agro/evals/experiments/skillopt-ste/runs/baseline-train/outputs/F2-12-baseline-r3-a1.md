---
name: t3
description: |
  Start, inspect, pair, or stop T3 Code in the AGRO sandbox, locally or
  over a private Tailscale tailnet for phone access. Use this for the headless
  `t3 serve` harness on port 3773, including tmux launch, preflight diagnosis,
  pairing URL discovery, minting a pairing URL for a second device, logs,
  status, and shutdown. T3 Code wraps an already-authenticated Claude Code,
  Codex, or OpenCode backend.
  TRIGGER when: user asks to run T3 Code, start `t3 serve`, reach T3 Code from a
  phone or another machine, pair a device, get the T3 pairing URL, diagnose why
  T3 Code or the tailnet will not start, check T3 Code status/logs, or stop
  T3 Code.
argument-hint: "[start|status|url|pair|logs|stop|attach|doctor|help] [--session <name>] [--port <port>] [--log <path>] [--tailscale] [--tailscale-port <p>]"
allowed-tools: Bash, Read
disable-model-invocation: true
---

# T3 Code

This skill runs T3 Code as a long-running sandbox process. The skill starts
`t3 serve` in tmux, reports the pairing URL, and leaves the tmux session
running. The operator opens T3 Code at `localhost:3773` through host or VS Code
port forwarding. With `--tailscale`, the operator opens T3 Code from a phone on
the same private tailnet.

`npx t3` with no subcommand starts the desktop GUI. This skill does not run
`npx t3`. For headless and remote access, the skill runs `npx t3 serve`. To add
a new device to a running server, the skill runs `npx t3 pair`.

## Arguments

Arguments received: `$ARGUMENTS`

- `ACTION`: optional first positional argument; default `start`
  - `start`: run the preflight. If a tmux session already exists, report the
    session. If no session exists, start `t3 serve` in tmux.
  - `status`: show whether the tmux session runs, and print recent output
  - `url`: print the latest pairing URL from the log or the tmux pane, if the
    log or the pane holds one
  - `pair`: create a new one-time pairing URL against the running server; do
    not restart the server
  - `logs`: print recent log lines
  - `stop`: kill the tmux session
  - `attach`: print the attach command; never attach from an agent run
  - `doctor`: run the preflight checks, and print one actionable line for each
    failure
  - `help`: print the script usage
- `--session`: tmux session name; default `agent-t3code`
- `--port`: expected T3 Code port; default `3773`
- `--log`: log file; default `/tmp/<session>.log`
- `--tailscale`: publish T3 Code over Tailscale Serve on the tailnet
  (`t3 serve --tailscale-serve`, `t3 pair --tailscale`)
- `--tailscale-port`: alternate Tailscale Serve HTTPS port; default `443`

If the operator specifies no action, use `start`.

## Preconditions

T3 pairing is **not** provider authentication. Two separate credentials exist,
and each credential has a separate lifecycle:

- A pairing lets a device reach T3 Code. A pairing does not log in to any
  provider.
- A provider login authenticates a backend. A provider login does not pair a
  device.

Before T3 Code can run a session, the operator installs and authenticates at
least one backend inside the sandbox:

```bash
claude        # complete OAuth on first launch
codex login
opencode auth login
```

T3 Code prints a single-use pairing URL to the tmux pane and the log. In local
mode, the URL has the shape `http://localhost:3773/pair#token=...`. In
Tailscale mode, the URL has the shape `https://<machine>.<tailnet>.ts.net/...`.
Treat the pairing URL and its token as a secret. Never paste the pairing URL
into an issue, a PR, a tracked file, or a persistent log.

The preflight checks these conditions. The `doctor` action runs the preflight.
The `start` action runs the preflight as its first step.

- `tmux`, `npx`, and `node` are on `PATH`.
- Node satisfies `^22.16 || ^23.11 || >=24.10` (the T3 server's `engines.node`).
- With `--tailscale`, the `tailscale` binary is installed.
- With `--tailscale`, `tailscaled` runs and answers.
- With `--tailscale`, the tailnet backend state is `Running`.
- If a session already runs, the T3 port answers on loopback.

## Run

Run the bundled script with the received arguments:

```bash
bash "$CLAUDE_SKILL_DIR/scripts/t3-code.sh" $ARGUMENTS
```

The script emits these launch commands verbatim:

| Invocation | Command |
| --- | --- |
| `/t3 start` | `npx --yes t3 serve` |
| `/t3 start --tailscale` | `npx --yes t3 serve --tailscale-serve` |
| `/t3 start --tailscale --tailscale-port 8443` | `npx --yes t3 serve --tailscale-serve --tailscale-serve-port 8443` |
| `/t3 pair` | `npx --yes t3 pair` |
| `/t3 pair --tailscale` | `npx --yes t3 pair --tailscale` |

The script always runs the server under the sandbox tmux convention:
`tmux new-session -d -s agent-t3code '... 2>&1 | tee /tmp/agent-t3code.log'`.
The server survives a terminal disconnect. The server stays bound to container
loopback. The skill never binds T3 Code to a public interface.

For the phone-side recipe and the tailnet session layout, read
[`references/tailscale-mobile.md`](references/tailscale-mobile.md). For the tmux
rules, read [`references/sandbox-processes.md`](references/sandbox-processes.md).

## Report

After `start`, the agent reports these items:

- the tmux session name and the log path
- the exact launch command that the script ran
- the pairing URL, if the agent finds one; otherwise, the command that shows
  the logs
- the local URL `http://localhost:<port>`; with the default `--port`, the local
  URL is `http://localhost:3773`
- in Tailscale mode, the tailnet HTTPS port
- in Tailscale mode, the fact that the URL uses the MagicDNS name of the node
- the fact that `/t3 pair` adds a second device and does not restart the server
- for an SSH session or a remote host without a tailnet: use VS Code port
  forwarding, or read `docs/connecting.md`
- the revocation paths:
  - `t3 auth`: issue, inspect, and revoke T3 sessions and credentials.
  - `tailscale serve --https=443 off`: withdraw the Serve mapping on port
    `443`. The Serve mapping stays active until the operator runs this command.
    For a non-default `--tailscale-port`, use <withdraw command for that port>.
  - `tailscale logout`, or delete the node in the Tailscale admin console:
    remove the device from the tailnet.

Never write a pairing URL into a file that the repository tracks.

Tailscale is private. A Cloudflared tunnel is public. For public sharing beyond
a private tailnet, first confirm that the operator wants a public bearer URL.
Then use `/cloudflared 3773`.

## Examples

```bash
/t3
/t3 doctor --tailscale
/t3 start --tailscale
/t3 pair --tailscale
/t3 status
/t3 logs --session agent-t3code
/t3 stop
```
