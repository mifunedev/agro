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

Use Cloudflared as the default public tunnel for sandbox app previews. For
temporary sharing, use a Cloudflare quick tunnel. Use a named tunnel only when
the operator explicitly needs a stable hostname or a Cloudflare Access policy.

## Arguments

Arguments received: `$ARGUMENTS`

- `PORT`: the first positional argument. `PORT` is required (example: `3000`).
- `--host`: the local upstream host. The default is `127.0.0.1`.
- `--name`: an optional slug for the tmux session suffix and the log suffix.
  The default is the port.
- `--session`: an optional override for the tmux session name. The default is
  `cloudflared-<slug>`.

If `PORT` is missing, ask the caller which local port to tunnel.

## Pre-flight — confirm the public surface (do NOT assume)

A dev stack can listen on two or more ports. Only ONE port is the intended
public surface. Examples of other ports: a web UI on `:3005`, a
browser-editor gateway on `:8788`, a metrics port, a DB. A tunnel to the wrong
port wastes the tunnel and can expose the wrong service.

Before you start a tunnel, do these steps:

1. If the caller did not name the service explicitly, list the listening ports.
   Use `ss -ltnp` or the project's dev docs to tell the ports apart.
2. Ask the caller **which service is meant to be public**. Never default to
   "the web port".
3. Treat a quick-tunnel URL as a **public bearer URL**: anyone with the URL
   reaches the origin.
4. If the target is not a throwaway static preview, get an explicit go-ahead
   before you expose the target. A target is not a throwaway preview when the
   target has auth, webhooks, an admin surface, or real data.

## Quick tunnel flow

Start the app so that the app listens locally. Then run the `run.sh` script inside
the sandbox:

```bash
bash "$CLAUDE_SKILL_DIR/scripts/run.sh" $ARGUMENTS
```

The script does these steps in order:

1. The script verifies `cloudflared`, `tmux`, and the local upstream.
2. The script starts a Cloudflare quick tunnel in `tmux`.
3. The script waits for the generated URL.
4. The script prints the inspect, log, and stop commands.

**Always verify through the PUBLIC url, not only through the local upstream.**
The local `curl` precheck in the script is necessary. The precheck alone does
NOT prove that the public URL works. An origin can answer on `127.0.0.1` but
return `404` or `421` through the tunnel. The cause is origin routing on the
`Host` header that the tunnel sends, or origin rejection of that header. See
Troubleshooting. After the URL appears, check the public status code:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://<sub>.trycloudflare.com/<known-path>
```

If the public code differs from the local code, the fault is a host-header
problem, not a tunnel-connectivity problem. Fix the origin (see below). Do not
restart the tunnel.

If the upstream check fails, fix the bind state and listen state of the app
first. Inside the container, many dev servers must listen on `0.0.0.0` to be
reachable through the tunnel.

## Adding cloudflared to an existing dev session (pane, not a new session)

The operator can want the tunnel to live *inside* an existing multi-pane dev
session, so that the tunnel starts and stops with the rest of the stack. In
that case, add the tunnel as a pane. Do not call `run.sh`, which creates a
separate `cloudflared-<slug>` session.

```bash
# open a pane in the running session's window, then launch the tunnel with a log
PANE=$(tmux split-window -t <session>:0 -c <project-dir> -P -F '#{pane_id}')
tmux select-pane -t "$PANE" -T cloudflared
tmux send-keys -t "$PANE" \
  "cloudflared tunnel --url http://127.0.0.1:<port> --no-autoupdate 2>&1 | tee /tmp/<session>-cloudflared.log" C-m
tmux select-layout -t <session>:0 even-vertical   # match the session's layout
```

To stop the pane tunnel, run `tmux send-keys -t "$PANE" C-c` **or**
`pkill -x cloudflared`.

Never run `pkill -f 'cloudflared tunnel …'`. The pattern also matches the shell
that runs the `pkill` command, so the command kills its own shell.

## Stable hostname path

For durable public URLs, do not invent a separate access layer. Use the
Cloudflare named tunnel flow. Store the credentials in the existing
`~/.cloudflared` volume:

```bash
cloudflared tunnel login
cloudflared tunnel create <name>
cloudflared tunnel route dns <name> <hostname>
cloudflared tunnel run <name>
```

If the app is sensitive, require Cloudflare Access or another authentication
gate before you share the URL. Quick tunnel URLs are public bearer URLs.

## Troubleshooting

### Public URL 404s / 421s while `127.0.0.1:<port>` works locally

The tunnel has a connection. The origin rejects the `Host` header that
cloudflared sends, which is the trycloudflare hostname. Two common causes exist:

- **Next.js dev server** bound to `127.0.0.1`: the server refuses cross-origin
  hosts and answers `404`. Apply one of these fixes:
  - Add the tunnel hostname or a wildcard pattern to `allowedDevOrigins` in
    `next.config`.
  - Bind the app to `0.0.0.0`.
  - Rewrite the header at the tunnel:
    `cloudflared tunnel --url http://127.0.0.1:<port> --http-host-header <host-the-origin-expects>`.
- **Host-routed services**: for example, a browser-editor gateway that
  dispatches by a `cs-<label>.<domain>` sub-domain. The service serves a request
  only when the `Host` header matches a known route. By design, the service
  returns `404` for a single random `*.trycloudflare.com` host.
  - These services need a **named tunnel with the real wildcard hostname**, not
    a quick tunnel. See *Stable hostname path*.
  - For a smoke test, `--http-host-header` can unblock one known host. The flag
    does not replace real host routing.

To diagnose, compare the local status code and the public status code for the
same path. If the two codes differ, the fault is a host-header or routing
issue, not a connectivity issue.

### `cloudflared tunnel login` says `cert.pem` already exists

Do not treat an existing `~/.cloudflared/cert.pem` as an error. Do not delete
the file. The file can hold a valid login. First, check whether Cloudflared can already see
tunnels:

```bash
cloudflared tunnel list
```

If `cloudflared tunnel list` shows the tunnels, do not run
`cloudflared tunnel login` again. The existing certificate is already usable.

Replace the certificate only when the operator intentionally wants to switch
Cloudflare accounts. Keep the existing tunnel credential JSON files in place.
Remove a credential file only when you explicitly remove the matching tunnel.
To replace the certificate, back up the certificate first, then log in again:

```bash
mkdir -p ~/.cloudflared/backups
mv ~/.cloudflared/cert.pem ~/.cloudflared/backups/cert.pem.$(date -u +%Y%m%dT%H%M%SZ).bak
cloudflared tunnel login
```

Quick tunnels from `/cloudflared <port>` do not require a login. This
certificate warning applies only to named tunnels and durable hostnames.
