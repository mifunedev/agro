---
name: cloudflared
description: |
  Start or explain a Cloudflared tunnel for a sandbox app port. Cloudflared is
  the default public sharing method for AGRO previews; this skill
  replaces generic sharing guidance with a portable pointer to the installed
  cloudflared CLI and tmux process convention.
  TRIGGER when: asked to share a local app publicly, expose a sandbox port,
  make localhost reachable from another machine, open a preview URL, or run
  cloudflared.
argument-hint: "<port> [--host 127.0.0.1] [--name <slug>] [--session <name>]"
allowed-tools: Bash, Read
---

# Cloudflared

Use Cloudflared as the default public tunnel for sandbox app previews. Prefer a
Cloudflare quick tunnel for temporary sharing. When the operator needs a
stable hostname or a Cloudflare Access policy, use a named tunnel instead.

## Arguments

Arguments received: `$ARGUMENTS`

- `PORT`: first positional argument; required (example: `3000`)
- `--host`: local upstream host; default `127.0.0.1`
- `--name`: optional slug for the tmux/log suffix; default is the port
- `--session`: optional tmux session name override; default `cloudflared-<slug>`

If `PORT` is missing, ask which local port to tunnel.

## Pre-flight — confirm the public surface (do NOT assume)

A dev stack can listen on multiple ports. Only one port is the intended public
surface, for example a web UI on `:3005`, a browser-editor gateway on `:8788`,
a metrics port, or a database port. A tunnel to the wrong port wastes the
tunnel and can expose the wrong service.

Complete the following checks before you start a tunnel:

1. If the caller did not name the service, run `ss -ltnp`, or read the
   project's dev docs, to list the listening ports.
2. Ask the operator which listed port is the intended public service. Never
   assume the web port is the target.
3. Treat a quick-tunnel URL as a public bearer URL. Anyone with the URL
   reaches the origin.
4. If the target has authentication, webhooks, an admin surface, or real
   data, get confirmation from the operator before you expose the target. A
   throwaway static preview needs no confirmation.

## Quick tunnel flow

After the app listens locally, run the following command inside the sandbox:

```bash
bash "$CLAUDE_SKILL_DIR/scripts/run.sh" $ARGUMENTS
```

The script verifies `cloudflared`, `tmux`, and the local upstream. The script
starts a Cloudflare quick tunnel in `tmux`. The script waits for the generated
URL. The script prints the inspect, log, and stop commands.

Verify the public URL after the script prints the URL. A local `curl` check against
`127.0.0.1:<port>` confirms the origin, but the check does not confirm the
tunnel path. The origin can answer `127.0.0.1` successfully and still return
`404` or `421` through the tunnel. The origin routes traffic by the `Host`
header, and the origin can reject the header the tunnel sends. See
Troubleshooting below.

After the script prints the URL, run the following command:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://<sub>.trycloudflare.com/<known-path>
```

When the public status code differs from the local status code, the origin
has a host-header problem, not a tunnel-connectivity problem. Fix the origin
in the section below. Do not restart the tunnel.

## Adding cloudflared to an existing dev session (pane, not a new session)

The operator can choose to run the tunnel inside an existing multi-pane dev
session, instead of in a separate `cloudflared-<slug>` session. The tunnel
then starts and stops with the rest of the stack. When the operator wants
this, add the tunnel as a pane in the existing session. Do not call `run.sh`
for this case.

```bash
# open a pane in the running session's window, then launch the tunnel with a log
PANE=$(tmux split-window -t <session>:0 -c <project-dir> -P -F '#{pane_id}')
tmux select-pane -t "$PANE" -T cloudflared
tmux send-keys -t "$PANE" \
  "cloudflared tunnel --url http://127.0.0.1:<port> --no-autoupdate 2>&1 | tee /tmp/<session>-cloudflared.log" C-m
tmux select-layout -t <session>:0 even-vertical   # match the session's layout
```

Stop the tunnel with `tmux send-keys -t "$PANE" C-c`, or with `pkill -x
cloudflared`. Never use `pkill -f 'cloudflared tunnel …'`. That pattern also
matches the shell process running the `pkill` command. The command then kills
itself instead of only the tunnel.

If the upstream check fails, fix the app bind/listen state first. Many dev
servers must listen on `0.0.0.0` inside the container. The tunnel cannot
reach a server bound only to `127.0.0.1`.

## Stable hostname path

For a durable public URL, do not create a separate access layer. Use the
Cloudflare named tunnel flow. Store the credentials in the existing
`~/.cloudflared` volume:

```bash
cloudflared tunnel login
cloudflared tunnel create <name>
cloudflared tunnel route dns <name> <hostname>
cloudflared tunnel run <name>
```

If the app has authentication, webhooks, an admin surface, or real data,
require Cloudflare Access or another authentication gate before you share the
URL. A quick tunnel URL is a public bearer URL.

## Troubleshooting

### Public URL 404s / 421s while `127.0.0.1:<port>` works locally

The tunnel connects successfully. The origin rejects the `Host` header that
`cloudflared` sends, the trycloudflare hostname. Two common causes follow.

- A Next.js dev server bound to `127.0.0.1` refuses a cross-origin host. The
  server answers `404`. Fix the mismatch with one of the following options:
  - Add the tunnel hostname, or a wildcard, to `allowedDevOrigins` in
    `next.config`.
  - Bind the app to `0.0.0.0`.
  - Rewrite the header at the tunnel: run `cloudflared tunnel --url
    http://127.0.0.1:<port> --http-host-header <host-the-origin-expects>`.
- Host-routed services, for example a browser-editor gateway that dispatches
  by a `cs-<label>.<domain>` sub-domain, serve only requests whose `Host`
  header matches a known route. A random `*.trycloudflare.com` host returns
  `404` by design. Host-routed services need a named tunnel with the real
  wildcard hostname, not a quick tunnel. See *Stable hostname path* above.
  The flag `--http-host-header` can unblock one known host for a smoke test.
  The flag is not a substitute for real host routing.

To diagnose the issue, compare the local status code and the public status
code for the same path. If the codes differ, the origin has a host-header
problem, not a connectivity problem.

### `cloudflared tunnel login` says `cert.pem` already exists

An existing `~/.cloudflared/cert.pem` file is not an error. Do not delete the
file. First, check whether `cloudflared` can already list tunnels:

```bash
cloudflared tunnel list
```

If the `cloudflared tunnel list` command succeeds, do not run `cloudflared
tunnel login` again. The existing certificate works.

When the operator wants to switch Cloudflare accounts, replace the
certificate. Back up the certificate before you replace it. Unless the
operator is removing those tunnels, leave the existing tunnel credential
JSON files in place:

```bash
mkdir -p ~/.cloudflared/backups
mv ~/.cloudflared/cert.pem ~/.cloudflared/backups/cert.pem.$(date -u +%Y%m%dT%H%M%SZ).bak
cloudflared tunnel login
```

A quick tunnel from `/cloudflared <port>` does not need login. The backup
requirement above applies only to named tunnels and durable hostnames.
