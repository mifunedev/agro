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
the operator asks for a stable hostname or a Cloudflare Access policy.

## Arguments

Arguments received: `$ARGUMENTS`

- `PORT`: the first positional argument. `PORT` is required. Example: `3000`.
- `--host`: the local upstream host. Default: `127.0.0.1`.
- `--name`: an optional slug for the tmux session suffix and the log suffix.
  Default: the port.
- `--session`: an optional override for the tmux session name. Default:
  `cloudflared-<slug>`.

If `PORT` is missing, ask the operator which local port to tunnel.

## Pre-flight — confirm the public surface

Do not assume the public surface. A dev stack can listen on more than one port.
Only one port is the intended public surface. Examples of other ports: a web UI
on `:3005`, a browser-editor gateway on `:8788`, a metrics port, and a database
port. A tunnel to the wrong port wastes the tunnel. A tunnel to the wrong port
can also expose the wrong service.

Before you start a tunnel, do these steps:

1. If the caller did not name the service, list the listening ports. Use
   `ss -ltnp` or the project's dev docs to identify each service.
2. Ask the caller which service must be public. Never select "the web port" by
   default.
3. Treat a quick-tunnel URL as a **public bearer URL**. Any person with the URL
   reaches the origin.
4. If the target has auth, webhooks, an admin surface, or real data, get an
   explicit go-ahead from the operator before you expose the target. A throwaway
   static preview needs no go-ahead.

## Quick tunnel flow

Run these steps inside the sandbox.

1. Start the app. Confirm that the app listens on the local port.
2. Run the script:

   ```bash
   bash "$CLAUDE_SKILL_DIR/scripts/run.sh" $ARGUMENTS
   ```

   The script verifies `cloudflared`, `tmux`, and the local upstream. Then the
   script starts a Cloudflare quick tunnel in `tmux` and waits for the
   generated URL. The script prints the inspect, log, and stop commands.
3. After the URL appears, verify the tunnel through the **public** URL:

   ```bash
   curl -fsS -o /dev/null -w '%{http_code}\n' https://<sub>.trycloudflare.com/<known-path>
   ```

**Always verify through the public URL, not only through the local upstream.**
The local `curl` precheck in the script is necessary. The local precheck alone
does not prove that the public URL works. An origin can answer on `127.0.0.1`
and still return `404` or `421` through the tunnel. The cause is that the origin
routes on the `Host` header that the tunnel sends, or rejects that header. See
Troubleshooting.

If the public status code differs from the local status code, the fault is a
host-header problem, not a tunnel-connectivity problem. Fix the origin as
Troubleshooting describes. Do not restart the tunnel.

## Adding cloudflared to an existing dev session (pane, not a new session)

The operator can want the tunnel inside an existing multi-pane dev session, so
that the tunnel starts and stops with the rest of the stack. In that case, add
the tunnel as a pane. Do not call `run.sh`, and do not create a separate
`cloudflared-<slug>` session.

```bash
# open a pane in the running session's window, then launch the tunnel with a log
PANE=$(tmux split-window -t <session>:0 -c <project-dir> -P -F '#{pane_id}')
tmux select-pane -t "$PANE" -T cloudflared
tmux send-keys -t "$PANE" \
  "cloudflared tunnel --url http://127.0.0.1:<port> --no-autoupdate 2>&1 | tee /tmp/<session>-cloudflared.log" C-m
tmux select-layout -t <session>:0 even-vertical   # match the session's layout
```

To stop the tunnel, run `tmux send-keys -t "$PANE" C-c` or `pkill -x cloudflared`.

**Warning:** Never run `pkill -f 'cloudflared tunnel …'`. The `-f` pattern also
matches the shell that runs the `pkill` command. The `pkill` command then kills
the same shell.

If the upstream check fails, fix the bind state and the listen state of the app
first. A dev server can need to listen on `0.0.0.0` inside the container. Only
then does the tunnel reach the dev server.

## Stable hostname path

For durable public URLs, do not invent a separate access layer. Use the
Cloudflare named-tunnel flow. Store the credentials in the existing
`~/.cloudflared` volume.

```bash
cloudflared tunnel login
cloudflared tunnel create <name>
cloudflared tunnel route dns <name> <hostname>
cloudflared tunnel run <name>
```

If the app is sensitive, put Cloudflare Access or another authentication gate in
front of the app before you share the URL. Quick-tunnel URLs are public bearer
URLs.

## Troubleshooting

### Public URL 404s / 421s while `127.0.0.1:<port>` works locally

The tunnel has a connection. The origin rejects the `Host` header that
cloudflared sends. That header carries the trycloudflare hostname. Two common
causes exist:

- **Next.js dev server:** A Next.js dev server bound to `127.0.0.1` refuses
  cross-origin hosts and answers `404`. Apply one of these three fixes:
  - Add the tunnel hostname, or a wildcard, to `allowedDevOrigins` in
    `next.config`.
  - Bind the app to `0.0.0.0`.
  - Rewrite the header at the tunnel:
    `cloudflared tunnel --url http://127.0.0.1:<port> --http-host-header <host-the-origin-expects>`.
- **Host-routed services:** A host-routed service serves only requests whose
  `Host` header matches a known route. One example is a browser-editor gateway
  that dispatches by a `cs-<label>.<domain>` subdomain. A single random
  `*.trycloudflare.com` host returns 404 by design. A host-routed service needs
  a **named tunnel with the real wildcard hostname**, not a quick tunnel. See
  *Stable hostname path*. For a smoke test, `--http-host-header` can unblock a
  single known host. The flag does not replace real host routing.

To diagnose the fault, compare the local status code and the public status code
for the same path. If the two codes differ, the fault is a host-header or
routing issue, not a connectivity issue.

### `cloudflared tunnel login` says `cert.pem` already exists

An existing `~/.cloudflared/cert.pem` file can hold a valid login. Do not treat
the file as an error. Do not delete the file. First, check whether Cloudflared
already sees tunnels:

```bash
cloudflared tunnel list
```

If `cloudflared tunnel list` shows your tunnels, do not run
`cloudflared tunnel login` again. The existing certificate is usable.

Replace the certificate only when the operator intends to switch Cloudflare
accounts. Before you replace the certificate, back up `cert.pem`. Keep the
existing tunnel credential JSON files in place. Remove a credential JSON file
only when the operator removes the matching tunnel.

```bash
mkdir -p ~/.cloudflared/backups
mv ~/.cloudflared/cert.pem ~/.cloudflared/backups/cert.pem.$(date -u +%Y%m%dT%H%M%SZ).bak
cloudflared tunnel login
```

Quick tunnels from `/cloudflared <port>` need no login. This section applies only
to named tunnels and durable hostnames.
