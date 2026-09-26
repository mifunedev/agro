---
name: cloudflared
description: |
  Start or explain a Cloudflared tunnel for a sandbox app port. Cloudflared is
  the default public sharing method for AGRO previews. This skill replaces
  generic sharing guidance with a portable pointer to the installed
  cloudflared CLI and the tmux process convention.
  TRIGGER when: asked to share a local app publicly, expose a sandbox port,
  make localhost reachable from another machine, open a preview URL, or run
  cloudflared.
argument-hint: "<port> [--host 127.0.0.1] [--name <slug>] [--session <name>]"
allowed-tools: Bash, Read
---

# Cloudflared

Use Cloudflared as the default public tunnel for sandbox app previews. Use a
Cloudflare quick tunnel for temporary sharing. Use a named tunnel only when the
operator needs a stable hostname or a Cloudflare Access policy.

## Arguments

Arguments received: `$ARGUMENTS`

- `PORT`: first positional argument; required (example: `3000`)
- `--host`: local upstream host; default `127.0.0.1`
- `--name`: optional slug for the tmux/log suffix; default is the port
- `--session`: optional tmux session name override; default `cloudflared-<slug>`

If `PORT` is missing, ask the operator which local port to tunnel.

## Pre-flight — confirm the public surface (do NOT assume)

A dev stack can listen on more than one port, and only one port is the intended
public surface (example: a web UI on `:3005`, a browser-editor gateway on
`:8788`, a metrics port, and a database port). A tunnel to the wrong port
exposes the wrong service.

Before you start a tunnel:

1. If the caller did not name the service, list the listening ports with
   `ss -ltnp` or the project's dev docs.
2. Ask the caller which service must be public. Never assume the web port is
   the target.
3. Check whether the target is a throwaway static preview. A quick-tunnel URL
   is a public bearer URL: anyone who holds the URL reaches the origin.
4. If the target has authentication, webhooks, an admin surface, or real data,
   get the operator's explicit approval before you expose it.

## Quick tunnel flow

After the app already listens locally inside the sandbox, run:

```bash
bash "$CLAUDE_SKILL_DIR/scripts/run.sh" $ARGUMENTS
```

The script does four actions in order:

1. The script verifies `cloudflared`, `tmux`, and the local upstream.
2. The script starts a Cloudflare quick tunnel in `tmux`.
3. The script waits for the generated URL.
4. The script prints the inspect, log, and stop commands.

Always verify through the public URL, not only the local upstream. The
script's local `curl` precheck confirms the origin, but the precheck does not
confirm the tunnel. An origin can answer `127.0.0.1` correctly and still
return `404` or `421` through the tunnel, because the origin routes on (or
rejects) the `Host` header that cloudflared sends. See *Troubleshooting*.
After the URL appears, run:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://<sub>.trycloudflare.com/<known-path>
```

If the public status code differs from the local status code, the origin has a
host-header problem, not a tunnel-connectivity problem. Fix the origin (see
*Troubleshooting*). Do not restart the tunnel.

## Adding cloudflared to an existing dev session (pane, not a new session)

When the operator wants the tunnel to live *inside* an existing multi-pane dev
session (so it starts/stops with the rest of the stack) rather than in its own
`cloudflared-<slug>` session, add it as a pane instead of calling `run.sh`:

```bash
# open a pane in the running session's window, then launch the tunnel with a log
PANE=$(tmux split-window -t <session>:0 -c <project-dir> -P -F '#{pane_id}')
tmux select-pane -t "$PANE" -T cloudflared
tmux send-keys -t "$PANE" \
  "cloudflared tunnel --url http://127.0.0.1:<port> --no-autoupdate 2>&1 | tee /tmp/<session>-cloudflared.log" C-m
tmux select-layout -t <session>:0 even-vertical   # match the session's layout
```

Stop the tunnel with `tmux send-keys -t "$PANE" C-c` or with
`pkill -x cloudflared`. Do not use `pkill -f 'cloudflared tunnel …'`. The
`-f` pattern also matches the shell that runs the `pkill` command, so the
`pkill` command kills that shell.

If the upstream check fails, fix the app's listen address first. A dev server
that listens only on `127.0.0.1` inside the container is not reachable through
the tunnel; the dev server must listen on `0.0.0.0` instead.

## Stable hostname path

For durable public URLs, do not invent a separate access layer. Use Cloudflare's
named tunnel flow and store credentials in the existing `~/.cloudflared` volume:

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

The tunnel connects, but the origin rejects the `Host` header that cloudflared
sends (the trycloudflare hostname). Two causes are common:

- **Next.js dev server** bound to `127.0.0.1` refuses cross-origin hosts and
  answers `404`. Add the tunnel hostname (or a wildcard) to `allowedDevOrigins`
  in `next.config`, or bind the app to `0.0.0.0`, or rewrite the header at the
  tunnel: `cloudflared tunnel --url http://127.0.0.1:<port> --http-host-header <host-the-origin-expects>`.
- **Host-routed services** (e.g. a browser-editor gateway that dispatches by a
  `cs-<label>.<domain>` sub-domain) only serve requests whose `Host` matches a
  known route. A random `*.trycloudflare.com` host does not match that route,
  so the origin answers `404` by design. Host-routed services need a named
  tunnel with the real wildcard hostname, not a quick tunnel — see *Stable
  hostname path*. `--http-host-header` can unblock one known host for a smoke
  test. `--http-host-header` is not a substitute for real host routing.

Compare the local status code with the public status code for the same path.
If the two codes differ, the origin has a host-header or routing problem, not
a connectivity problem.

### `cloudflared tunnel login` says `cert.pem` already exists

Treat an existing `~/.cloudflared/cert.pem` file as a valid login. Do not
delete the file before you verify the login. First check whether Cloudflared
can already see tunnels:

```bash
cloudflared tunnel list
```

If that works, do not run `cloudflared tunnel login` again. The existing
certificate is already usable.

Replace the certificate only when the operator decides to switch Cloudflare
accounts. Back up the certificate first. Leave existing tunnel credential JSON
files in place unless the operator removes those tunnels:

```bash
mkdir -p ~/.cloudflared/backups
mv ~/.cloudflared/cert.pem ~/.cloudflared/backups/cert.pem.$(date -u +%Y%m%dT%H%M%SZ).bak
cloudflared tunnel login
```

Quick tunnels from `/cloudflared <port>` do not require login, so this warning is
only relevant to named tunnels and durable hostnames.
