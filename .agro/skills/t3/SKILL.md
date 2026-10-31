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
argument-hint: "[start|status|url|pair|logs|stop|attach|doctor|help] [--session <name>] [--port <port>] [--log <path>]"
allowed-tools: Bash, Read
disable-model-invocation: true
---

# T3 Code

`npx t3@latest` (no subcommand) is the desktop GUI launcher and is not what this
skill runs. Headless and remote access use `npx t3@latest serve`. To add a new
device to a running server, run `npx t3@latest pair`.

## Arguments

Arguments received: `$ARGUMENTS`

- `ACTION`: optional first positional argument; default `start`
  - `start`: run the preflight, then start `t3 serve` in tmux, or report the existing session
  - `status`: show whether the tmux session is running and print recent output
  - `url`: print the latest pairing URL from the log/pane if present
  - `pair`: mint a fresh one-time local pairing URL against the running server, without restarting it
  - `logs`: print recent log lines
  - `stop`: kill the tmux session
  - `attach`: print the attach command; do not attach from an agent run
  - `doctor`: run the preflight checks and print one actionable line per failure
  - `help`: print script usage
- `--session`: tmux session name; default `agent-t3code`
- `--port`: expected T3 Code port; default `3773`
- `--log`: log file; default `/tmp/<session>.log`

## Preconditions

T3 pairing is **not** provider auth. Pairing a phone does not log any provider
in, and a provider login does not pair a device. They are two separate
credentials on two separate lifecycles.

At least one backend must already be installed and authenticated inside the
sandbox before T3 Code is useful:

```bash
claude        # complete OAuth on first launch
codex login
opencode auth login
```

T3 Code itself prints a single-use pairing URL such as
`http://localhost:3773/pair#token=...`. The phone-access verb prints an
`https://<machine>.<tailnet>.ts.net/...` URL. Treat that URL
and its token as a secret: never paste it into an issue, a PR, a tracked file,
or a persistent log.

The preflight (`doctor`, and the first step of `start`) checks:

- `tmux`, `npx`, and `node` on `PATH`
- Node satisfies `^22.16 || ^23.11 || >=24.10` (the T3 server's `engines.node`)
- the T3 port answers on loopback when a session is already up

## Run

Run the bundled script with the received arguments:

```bash
bash "$CLAUDE_SKILL_DIR/scripts/t3-code.sh" $ARGUMENTS
```

Launch commands the script emits, verbatim:

| Invocation | Command |
| --- | --- |
| `/t3 start` | `npx --yes t3@latest serve` |
| `/t3 pair` | `npx --yes t3@latest pair` |

The server always runs under the sandbox tmux convention
(`tmux new-session -d -s agent-t3code '... 2>&1 | tee /tmp/agent-t3code.log'`),
so it survives a terminal disconnect. The launch command removes every `HERDR_*`
variable before it starts `t3 serve`, and `/t3 pair` does the same before it
starts `t3 pair`. It stays bound to container loopback; the
skill never binds T3 Code to a public interface.

## Phone access

The `agro tool setup t3-mobile` verb owns phone access over a private tailnet.
Run these commands in this order:

```bash
/t3 start
agro tool setup t3-mobile enable
```

`enable` starts `tailscaled`, joins the tailnet, publishes port 3773 over
Tailscale Serve, and prints a `ts.net` pairing URL and a QR code. Use the other
actions later:

- `agro tool setup t3-mobile pair`: mint a pairing URL for one more device.
- `agro tool setup t3-mobile disable`: withdraw the Serve mapping.
- `agro tool setup t3-mobile status`: print the tailnet and Serve state.

For the phone-side steps and revocation, read
[`references/tailscale-mobile.md`](references/tailscale-mobile.md). For the tmux
rules, read [`references/sandbox-processes.md`](references/sandbox-processes.md).

## Report

After `start`, report:

- tmux session name and log path
- the exact launch command that was used
- pairing URL if found, otherwise the command to inspect logs
- local URL, normally `http://localhost:3773`
- phone access: `agro tool setup t3-mobile enable`
- reminder: over SSH/remote host without a tailnet, use VS Code port forwarding
  or see `docs/connecting.md`
- revocation paths:
  - `t3 auth` — issue, inspect, and revoke T3 sessions and credentials
  - `agro tool setup t3-mobile disable` — withdraw the Serve mapping (it
    persists until you do)
  - `tailscale logout`, or delete the node in the Tailscale admin console —
    remove the device from the tailnet

For public sharing beyond a private tailnet, use `/cloudflared 3773` only after
confirming the operator wants a public bearer URL. Tailscale is private; a
Cloudflared tunnel is not.
