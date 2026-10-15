# Dashboard

Read this reference before you start, share, or stop the agent-browser
dashboard. The dashboard is a local web UI that shows the live viewport and the
command feed of every session on the machine. Use it to watch a worker drive a
page, check a recording before `record.sh stop`, show the operator the
browser state, or let the operator sign in to a session. For a sign-in, follow
`references/auth.md`.

The dashboard is observation. It is not evidence. Capture evidence with an
annotated screenshot or a recording.

## Rules

- Run the dashboard inside the sandbox. One dashboard serves every session in
  the sandbox.
- Start the dashboard only when it is not already running. Never stop a
  dashboard that another agent or the operator started.
- The dashboard runs as its own background process. It survives a terminal
  disconnect and needs no tmux session.
- The dashboard sends input to the browser. A person who reaches the dashboard
  can drive each session. Treat each dashboard URL as a credential.
- Dashboard input resets the session idle timeout, which is 1 hour by default.

## Start

```bash
if curl -fsS -o /dev/null http://127.0.0.1:4848/; then
  echo "Dashboard already running at http://localhost:4848"
else
  agent-browser dashboard start
fi
```

`dashboard start` prints `Dashboard started at http://localhost:4848`. To use
another port, give `--port <n>`. Stop the dashboard before you change the port
or the allowed origins.

## Reach the dashboard from the laptop

The base sandbox publishes no ports. Loopback access needs no token. Use the
first method that applies:

| Connection | Method |
|---|---|
| VS Code attached to the sandbox | The Ports panel forwards `4848`. Open `http://localhost:4848`. |
| Direct SSH to the sandbox | `ssh -p 2222 -L 4848:127.0.0.1:4848 sandbox@localhost`, then open `http://localhost:4848`. |
| Remote VM without VS Code | Forward `4848` through an `ssh -L` tunnel to the VM, then into the sandbox. |
| No port forward is possible | Use a public tunnel. See [Public tunnel](#public-tunnel). |

## Public tunnel

A public tunnel exposes browser control. Get an explicit go-ahead from the
operator first.

1. Start a tunnel to port `4848` with the `cloudflared` skill. Record the
   `https://` URL that the skill prints.
2. Restart the dashboard with that exact origin:

   ```bash
   agent-browser dashboard stop
   agent-browser dashboard start --allowed-origins "https://<sub>.trycloudflare.com"
   ```

3. `dashboard start` prints a private external URL with a fragment token. Give
   that URL only to the operator. Never post it in a PR, an issue, Slack, or a
   log.
4. When the operator is done, stop the tunnel. Then restart the dashboard
   without `--allowed-origins`.

## Stop

Stop only a dashboard that you started:

```bash
agent-browser dashboard stop
```

The command stops the dashboard server. It does not close any browser session.
