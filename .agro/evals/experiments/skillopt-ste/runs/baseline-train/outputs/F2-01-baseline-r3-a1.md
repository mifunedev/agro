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

Use Cloudflared as the default public tunnel for sandbox app previews. Use a
Cloudflare quick tunnel for temporary sharing. Use a named tunnel only when the
operator needs a stable hostname or a Cloudflare Access policy.

## Arguments

Arguments received: `$ARGUMENTS`

- `PORT`: first positional argument; required (example: `3000`)
- `--host`: local upstream host; default `127.0.0.1`
- `--name`: optional slug for the tmux/log suffix; default is the port
- `--session`: optional tmux session name override; default `cloudflared-<slug>`

If `PORT` is missing, ask which local port to tunnel.

## Pre-flight — confirm the public surface (do NOT assume)

A dev stack can listen on multiple ports at once. Only one port is the intended
public surface — for example, a web UI on `:3005`, a browser-editor gateway on
`:8788`, a metrics port, or a database port. Tunneling the wrong port wastes the
tunnel and can expose the wrong service.

Before you start a tunnel:

1. If the caller did not name the service, list the listening ports with
   `ss -ltnp` or the project's dev docs. Ask the caller which service must be
   public. Never default to the web port.
2. A quick-tunnel URL is a **public bearer URL**: anyone who has the URL can
   reach the origin. If the target has authentication, webhooks, an admin
   surface, or real data, ask the operator for approval before you expose it.

## Quick tunnel flow

After the app starts listening locally, run the following command inside the
sandbox:

```bash
bash "$CLAUDE_SKILL_DIR/scripts/run.sh" $ARGUMENTS
```

The script checks that `cloudflared`, `tmux`, and the local upstream are
available. The script starts a Cloudflare quick tunnel inside `tmux`. The
script waits for the generated URL. The script prints commands to inspect the
tunnel, view the tunnel log, and stop the tunnel.

Always verify the tunnel through the public URL. Do not rely on the local
upstream check alone. The script's local `curl` precheck confirms only that the
app answers on `127.0.0.1`. That check does not confirm the public URL works:
the origin can return `404` or `421` through the tunnel when the origin rejects
the `Host` header the tunnel sends (see Troubleshooting). After the URL
appears, run:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://<sub>.trycloudflare.com/<known-path>
```

If the public status code differs from the local status code, the origin has a
host-header problem, not a tunnel-connectivity problem. Fix the origin (below).
Do not restart the tunnel.

## Adding cloudflared to an existing dev session (pane, not a new session)

When the operator wants the tunnel to start and stop with an existing
multi-pane dev session, add the tunnel as a pane in that session instead of
running `run.sh`. Running `run.sh` creates a separate `cloudflared-<slug>`
session.

```bash
# open a pane in the running session's window, then launch the tunnel with a log
PANE=$(tmux split-window -t <session>:0 -c <project-dir> -P -F '#{pane_id}')
tmux select-pane -t "$PANE" -T cloudflared
tmux send-keys -t "$PANE" \
  "cloudflared tunnel --url http://127.0.0.1:<port> --no-autoupdate 2>&1 | tee /tmp/<session>-cloudflared.log" C-m
tmux select-layout -t <session>:0 even-vertical   # match the session's layout
```

Stop the tunnel with `tmux send-keys -t "$PANE" C-c` or with
`pkill -x cloudflared`. Never use `pkill -f 'cloudflared tunnel …'`. That
pattern also matches the shell that runs the `pkill` command, so it kills your
own command.

If the upstream check fails, fix the app's bind address first. Many dev
servers must listen on `0.0.0.0` inside the container so the tunnel can reach
them.

## Stable hostname path

For a durable public URL, use Cloudflare's named tunnel flow. Do not build a
separate access layer. Store credentials in the existing `~/.cloudflared`
volume:

```bash
cloudflared tunnel login
cloudflared tunnel create <name>
cloudflared tunnel route dns <name> <hostname>
cloudflared tunnel run <name>
```

If the app handles sensitive data, require Cloudflare Access or another
authentication gate before you share the URL. A quick-tunnel URL is a public
bearer URL.

## Troubleshooting

### Public URL 404s / 421s while `127.0.0.1:<port>` works locally

Cloudflared connects the tunnel. The origin rejects the `Host` header that
cloudflared sends, the trycloudflare hostname. Two causes are common:

- A **Next.js dev server** bound to `127.0.0.1` refuses cross-origin hosts and
  returns `404`. Fix this with one of three changes: add the tunnel hostname,
  or a wildcard, to `allowedDevOrigins` in `next.config`; bind the app to
  `0.0.0.0`; or rewrite the header at the tunnel with
  `cloudflared tunnel --url http://127.0.0.1:<port> --http-host-header <host-the-origin-expects>`.
- A **host-routed service** — for example, a browser-editor gateway that
  routes by a `cs-<label>.<domain>` sub-domain — serves only requests whose
  `Host` matches a known route. A random `*.trycloudflare.com` host returns
  `404` by design. This service needs a **named tunnel with the real wildcard
  hostname**, not a quick tunnel; see *Stable hostname path*. The
  `--http-host-header` flag can unblock one known host for a smoke test. That
  flag is not a substitute for real host routing.

To diagnose the problem, compare the local and public status codes for the
same path. If the codes differ, the problem is a host-header or routing issue,
not a connectivity issue.

### `cloudflared tunnel login` says `cert.pem` already exists

Do not delete an existing `~/.cloudflared/cert.pem` file. Check whether
cloudflared can see existing tunnels before you treat the file as an error:

```bash
cloudflared tunnel list
```

If `cloudflared tunnel list` succeeds, do not run `cloudflared tunnel login`
again. The existing certificate works.

Replace the certificate only when the operator wants to switch Cloudflare
accounts. Back up the certificate first. Leave existing tunnel credential JSON
files in place unless you remove those tunnels:

```bash
mkdir -p ~/.cloudflared/backups
mv ~/.cloudflared/cert.pem ~/.cloudflared/backups/cert.pem.$(date -u +%Y%m%dT%H%M%SZ).bak
cloudflared tunnel login
```

A quick tunnel started with `/cloudflared <port>` does not require login. This
warning applies only to named tunnels and durable hostnames.
