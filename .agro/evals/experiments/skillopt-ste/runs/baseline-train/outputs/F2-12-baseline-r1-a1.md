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

This skill starts `t3 serve` as a long-running sandbox process in tmux. The
skill reports the pairing URL and leaves the session running. The operator
opens the session at `localhost:3773` through host or VS Code port forwarding.
With `--tailscale`, the operator opens the session from a phone on the same
private tailnet.

`npx t3` (no subcommand) starts the desktop GUI launcher. This skill does not
run `npx t3`. Headless and remote access use `npx t3 serve`. `npx t3 pair`
adds a new device to an already-running server.

## Arguments

Arguments received: `$ARGUMENTS`

- `ACTION`: optional first positional argument; default `start`
  - `start`: run the preflight, then start `t3 serve` in tmux, or report the existing session
  - `status`: show whether the tmux session is running and print recent output
  - `url`: print the latest pairing URL from the log/pane if present
  - `pair`: mint a fresh one-time pairing URL against the running server, without restarting it
  - `logs`: print recent log lines
  - `stop`: kill the tmux session
  - `attach`: print the attach command; do not attach from an agent run
  - `doctor`: run the preflight checks and print one actionable line per failure
  - `help`: print script usage
- `--session`: tmux session name; default `agent-t3code`
- `--port`: expected T3 Code port; default `3773`
- `--log`: log file; default `/tmp/<session>.log`
- `--tailscale`: publish over Tailscale Serve on the tailnet (`t3 serve --tailscale-serve`, `t3 pair --tailscale`)
- `--tailscale-port`: alternate Tailscale Serve HTTPS port; default `443`

If the user does not specify an action, use `start`.

## Preconditions

T3 pairing is **not** provider authentication. Pairing a phone does not log in
any provider. A provider login does not pair a device. T3 pairing and provider
authentication are two separate credentials with two separate lifecycles.

The operator installs and authenticates at least one backend inside the
sandbox before running T3 Code:

```bash
claude        # complete OAuth on first launch
codex login
opencode auth login
```

T3 Code prints a single-use pairing URL, for example
`http://localhost:3773/pair#token=...`. In Tailscale mode, T3 Code prints an
`https://<machine>.<tailnet>.ts.net/...` URL instead. The operator treats that
URL and its token as a secret. The operator never pastes the URL into an
issue, a PR, a tracked file, or a persistent log.

The preflight (`doctor`, and the first step of `start`) checks:

- `tmux`, `npx`, and `node` exist on `PATH`
- Node satisfies `^22.16 || ^23.11 || >=24.10` (the T3 server's `engines.node`)
- with `--tailscale`, the `tailscale` binary is installed, `tailscaled` is
  running and reachable, and the tailnet backend state is `Running`
- when a session is already up, the T3 port answers on loopback

## Run

Run the bundled script with the received arguments:

```bash
bash "$CLAUDE_SKILL_DIR/scripts/t3-code.sh" $ARGUMENTS
```

Launch commands the script emits, verbatim:

| Invocation | Command |
| --- | --- |
| `/t3 start` | `npx --yes t3 serve` |
| `/t3 start --tailscale` | `npx --yes t3 serve --tailscale-serve` |
| `/t3 start --tailscale --tailscale-port 8443` | `npx --yes t3 serve --tailscale-serve --tailscale-serve-port 8443` |
| `/t3 pair` | `npx --yes t3 pair` |
| `/t3 pair --tailscale` | `npx --yes t3 pair --tailscale` |

The server runs under the sandbox tmux convention:
`tmux new-session -d -s agent-t3code '... 2>&1 | tee /tmp/agent-t3code.log'`.
This command survives a terminal disconnect. The server stays bound to
container loopback. The skill never binds T3 Code to a public interface.

For the phone-side recipe and the tailnet session layout, read
[`references/tailscale-mobile.md`](references/tailscale-mobile.md). For the tmux
rules, read [`references/sandbox-processes.md`](references/sandbox-processes.md).

## Report

After `start`, report:

- tmux session name and log path
- the exact launch command the script used
- pairing URL if found, otherwise the command to inspect logs
- local URL: `http://localhost:3773`
- in Tailscale mode, the tailnet HTTPS port and confirmation that the URL is
  the node's MagicDNS name
- confirmation that `/t3 pair` adds a second device without restarting the
  server
- reminder: over SSH or a remote host without a tailnet, the operator uses
  VS Code port forwarding, or reads `docs/connecting.md`
- revocation paths:
  - `t3 auth` — issue, inspect, and revoke T3 sessions and credentials
  - `tailscale serve --https=443 off` — withdraw the Serve mapping (the mapping
    persists until the operator runs this command)
  - `tailscale logout`, or delete the node in the Tailscale admin console —
    remove the device from the tailnet

Never echo a pairing URL into a file the repository tracks.

Before using `/cloudflared 3773` for public sharing beyond a private tailnet,
confirm that the operator wants a public bearer URL. Tailscale stays private.
A Cloudflared tunnel is not private.

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
