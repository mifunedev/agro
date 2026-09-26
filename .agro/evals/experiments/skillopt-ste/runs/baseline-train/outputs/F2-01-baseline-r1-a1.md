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

Use Cloudflared as the default public tunnel for sandbox app previews. For
temporary sharing, use a Cloudflare quick tunnel. Use a named tunnel only when
the operator explicitly needs a stable hostname or a Cloudflare Access policy.

## Arguments

Arguments received: `$ARGUMENTS`

- `PORT`: the first positional argument. This argument is required. Example: `3000`.
- `--host`: the local upstream host. Default: `127.0.0.1`.
- `--name`: an optional slug for the tmux session suffix and the log suffix. Default: the port.
- `--session`: an optional tmux session name override. Default: `cloudflared-<slug>`.

If `PORT` is missing, ask the operator which local port to tunnel.

## Pre-flight — confirm the public surface (do NOT assume)

A dev stack can listen on more than one port. Only ONE port is the intended
public surface. Other ports can serve a web UI on `:3005`, a browser-editor
gateway on `:8788`, a metrics endpoint, or a database. A tunnel to the wrong port
wastes the tunnel. A tunnel to the wrong port can also expose the wrong service.

Before you start a tunnel, do these steps:

1. If the caller did not name the service explicitly, list the listening ports.
   Run `ss -ltnp`, or read the project's dev docs.
2. Ask the caller which service is meant to be public. Never default to "the web
   port".
3. Treat a quick-tunnel URL as a **public bearer URL**. Anyone with the URL
   reaches the origin.
4. If the target is not a throwaway static preview, get an explicit go-ahead
   before you expose the target. A target is not a throwaway static preview when
   the target has auth, webhooks, an admin surface, or real data.

## Quick tunnel flow

Before you run the script, confirm that the app listens locally. Run the script
inside the sandbox:

```bash
bash "$CLAUDE_SKILL_DIR/scripts/run.sh" $ARGUMENTS
```

The script does these actions in order:

1. The script verifies `cloudflared`, `tmux`, and the local upstream.
2. The script starts a Cloudflare quick tunnel in `tmux`.
3. The script waits for the generated URL.
4. The script prints the inspect, log, and stop commands.

**Always verify through the PUBLIC URL, not only the local upstream.** The
script runs a local `curl` precheck. That precheck is necessary, but the
precheck does NOT prove that the public URL works. An origin can answer on
`127.0.0.1` and still return `404`/`421` through the tunnel. This failure occurs
when the origin routes on the `Host` header that the tunnel sends, or rejects
that header. See Troubleshooting.

After the URL appears, check the public status code:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://<sub>.trycloudflare.com/<known-path>
```

If the public status code differs from the local status code, the cause is a
host-header problem, not a tunnel-connectivity problem. Fix the origin as
Troubleshooting describes. Do not restart the tunnel.

## Adding cloudflared to an existing dev session (pane, not a new session)

The operator can want the tunnel inside an existing multi-pane dev session. In
that setup, the tunnel starts and stops with the rest of the stack. If the
operator wants this setup, add the tunnel as a pane. Do not call `run.sh`, and
do not create a separate `cloudflared-<slug>` session:

```bash
# open a pane in the running session's window, then launch the tunnel with a log
PANE=$(tmux split-window -t <session>:0 -c <project-dir> -P -F '#{pane_id}')
tmux select-pane -t "$PANE" -T cloudflared
tmux send-keys -t "$PANE" \
  "cloudflared tunnel --url http://127.0.0.1:<port> --no-autoupdate 2>&1 | tee /tmp/<session>-cloudflared.log" C-m
tmux select-layout -t <session>:0 even-vertical   # match the session's layout
```

To stop the tunnel pane, run `tmux send-keys -t "$PANE" C-c` **or**
`pkill -x cloudflared`. Never run `pkill -f 'cloudflared tunnel …'`. The
`pkill -f` pattern also matches the shell that runs the `pkill`, so the `pkill` kills your
own command.

If the upstream check fails, fix the bind state and the listen state of the app
first. A dev server can need to listen on `0.0.0.0` inside the container to be
reachable through the tunnel.

## Stable hostname path

For durable public URLs, do not invent a separate access layer. Use the
Cloudflare named tunnel flow. Store the credentials in the existing
`~/.cloudflared` volume. Run these commands in order:

```bash
cloudflared tunnel login
cloudflared tunnel create <name>
cloudflared tunnel route dns <name> <hostname>
cloudflared tunnel run <name>
```

If the app has auth, webhooks, an admin surface, or real data, require
Cloudflare Access or another authentication gate before you share the URL.
Quick tunnel URLs are public bearer URLs.

## Troubleshooting

### Public URL 404s / 421s while `127.0.0.1:<port>` works locally

The tunnel has a connection. The origin rejects the `Host` header that cloudflared
sends. That header carries the trycloudflare hostname. Two common causes exist:

- **Next.js dev server** bound to `127.0.0.1`: the dev server refuses
  cross-origin hosts and answers `404`. Apply one of these three fixes:
  - Add the tunnel hostname, or a wildcard, to `allowedDevOrigins` in
    `next.config`.
  - Bind the app to `0.0.0.0`.
  - Rewrite the header at the tunnel:
    `cloudflared tunnel --url http://127.0.0.1:<port> --http-host-header <host-the-origin-expects>`.
- **Host-routed services**: a host-routed service serves only requests whose
  `Host` matches a known route. For example, a browser-editor gateway dispatches
  by a `cs-<label>.<domain>` sub-domain. A single random `*.trycloudflare.com`
  host returns 404 by design. A host-routed service needs a **named tunnel with
  the real wildcard hostname**, not a quick tunnel. See *Stable hostname path*.
  The `--http-host-header` flag can unblock a single known host for a smoke
  test. The flag is not a substitute for real host routing.

To diagnose the failure, compare the local status code and the public status
code for the same path. If the two codes differ, the cause is a host-header
issue or a routing issue, not a connectivity issue.

### `cloudflared tunnel login` says `cert.pem` already exists

Treat an existing `~/.cloudflared/cert.pem` as a probable valid login. Do not
treat the file as an error, and do not delete the file. First, check whether
Cloudflared can already see tunnels:

```bash
cloudflared tunnel list
```

If `cloudflared tunnel list` succeeds, do not run `cloudflared tunnel login`
again. The existing certificate is already usable.

Replace the certificate only when the operator intentionally wants to switch
Cloudflare accounts. Follow these rules:

1. Back up the certificate first.
2. Leave the existing tunnel credential JSON files in place. Remove those files
   only when you explicitly remove those tunnels.

```bash
mkdir -p ~/.cloudflared/backups
mv ~/.cloudflared/cert.pem ~/.cloudflared/backups/cert.pem.$(date -u +%Y%m%dT%H%M%SZ).bak
cloudflared tunnel login
```

Quick tunnels from `/cloudflared <port>` do not require login. This warning
applies only to named tunnels and durable hostnames.
