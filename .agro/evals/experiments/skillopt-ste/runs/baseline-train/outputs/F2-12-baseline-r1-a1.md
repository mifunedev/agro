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

Run T3 Code as a long-running sandbox process. The agent starts `t3 serve` in
tmux, reports the pairing URL, and leaves the tmux session running. The operator
opens T3 Code at `localhost:3773` through host or VS Code port forwarding. With
`--tailscale`, the operator opens T3 Code from a phone on the same private
tailnet.

`npx t3` with no subcommand starts the desktop GUI. This skill does not run
`npx t3`. Headless access and remote access use `npx t3 serve`. To add a new
device to a running server, run `npx t3 pair`.

## Arguments

Arguments received: `$ARGUMENTS`

- `ACTION`: optional first positional argument; default `start`
  - `start`: run the preflight. If a tmux session exists, report the session. Otherwise, start `t3 serve` in tmux.
  - `status`: show whether the tmux session runs, then print recent output
  - `url`: print the latest pairing URL from the log file or the tmux pane, if a pairing URL exists
  - `pair`: create a new one-time pairing URL against the running server. The server does not restart.
  - `logs`: print recent log lines
  - `stop`: kill the tmux session
  - `attach`: print the attach command. The agent does not attach from an agent run.
  - `doctor`: run the preflight checks, then print one actionable line for each failure
  - `help`: print the script usage
- `--session`: tmux session name; default `agent-t3code`
- `--port`: expected T3 Code port; default `3773`
- `--log`: log file; default `/tmp/<session>.log`
- `--tailscale`: publish over Tailscale Serve on the tailnet (`t3 serve --tailscale-serve`, `t3 pair --tailscale`)
- `--tailscale-port`: alternate Tailscale Serve HTTPS port; default `443`

If the user specifies no action, use `start`.

## Preconditions

T3 pairing is **not** provider authentication. Pairing a phone logs in no
provider. A provider login pairs no device. Pairing and provider login are two
separate credentials with two separate lifecycles.

T3 Code needs at least one backend. Before the agent starts T3 Code, the
operator installs and authenticates at least one backend inside the sandbox:

```bash
claude        # complete OAuth on first launch
codex login
opencode auth login
```

T3 Code prints a single-use pairing URL such as
`http://localhost:3773/pair#token=...`. In Tailscale mode, T3 Code prints an
`https://<machine>.<tailnet>.ts.net/...` URL. Treat the pairing URL and its token
as a secret. Never paste the pairing URL into an issue, a PR, a tracked file, or
a persistent log.

The preflight runs as `doctor` and as the first step of `start`. The preflight
checks these items:

- `tmux`, `npx`, and `node` are on `PATH`.
- Node satisfies `^22.16 || ^23.11 || >=24.10` (the T3 server's `engines.node`).
- If `--tailscale` is set, the `tailscale` binary is installed. `tailscaled`
  runs and is reachable. The tailnet backend state is `Running`.
- If a session already runs, the T3 port answers on loopback.

## Run

Run the bundled script with the received arguments:

```bash
bash "$CLAUDE_SKILL_DIR/scripts/t3-code.sh" $ARGUMENTS
```

The script emits these launch commands, verbatim:

| Invocation | Command |
| --- | --- |
| `/t3 start` | `npx --yes t3 serve` |
| `/t3 start --tailscale` | `npx --yes t3 serve --tailscale-serve` |
| `/t3 start --tailscale --tailscale-port 8443` | `npx --yes t3 serve --tailscale-serve --tailscale-serve-port 8443` |
| `/t3 pair` | `npx --yes t3 pair` |
| `/t3 pair --tailscale` | `npx --yes t3 pair --tailscale` |

The server always runs under the sandbox tmux convention:
`tmux new-session -d -s agent-t3code '... 2>&1 | tee /tmp/agent-t3code.log'`.
The server survives a terminal disconnect. The server stays bound to container
loopback. The skill never binds T3 Code to a public interface.

For the phone-side procedure and the tailnet session layout, read
[`references/tailscale-mobile.md`](references/tailscale-mobile.md). For the tmux
rules, read [`references/sandbox-processes.md`](references/sandbox-processes.md).

## Report

After `start`, the agent reports these items:

- the tmux session name and the log path
- the exact launch command that the script used
- the pairing URL. If the log holds no pairing URL, report the command that
  shows the log.
- the local URL, `http://localhost:<port>`. With the default port, the local
  URL is `http://localhost:3773`.
- in Tailscale mode, the tailnet HTTPS port. The pairing URL uses the MagicDNS
  name of the node.
- `/t3 pair` adds a second device. The server does not restart.
- If the operator connects over SSH or to a remote host without a tailnet, the
  operator uses VS Code port forwarding or reads `docs/connecting.md`.
- the revocation paths:
  - `t3 auth` — issue, inspect, and revoke T3 sessions and credentials.
  - `tailscale serve --https=443 off` — withdraw the Serve mapping on the
    default port `443`. The mapping persists until the operator runs this
    command. For another port, use `<tailscale-port>` in place of `443`.
  - `tailscale logout`, or delete the node in the Tailscale admin console —
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
