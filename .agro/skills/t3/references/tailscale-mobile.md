# T3 Code on a phone, over a private tailnet

Use this procedure to reach T3 Code from a phone. T3 Code stays private on your
tailnet. The tailnet node is the **sandbox container**. The `tailscaled` daemon
runs in userspace-networking mode as the unprivileged `sandbox` user. The
procedure adds no container capability and publishes no host port. T3 Code
stays bound to container loopback. Tailscale Serve terminates HTTPS on the
tailnet and proxies to `127.0.0.1:3773`.

Devices outside the tailnet cannot reach the backend.

## Sessions

The tmux sessions follow the sandbox tmux convention (see
[`sandbox-processes.md`](sandbox-processes.md)).

| Session | Process | Started by |
| --- | --- | --- |
| `agent-t3code` | `npx --yes t3@latest serve` | `/t3 start` |
| `agent-tailscaled` | `tailscaled` in userspace-networking mode, when systemd is not available | `agro tool setup t3-mobile enable` |

The container entrypoint starts neither session. A person joins the tailnet
explicitly.

## Daemon runtime

`enable` starts one userspace `tailscaled` in one of two runtimes:

| Condition | Runtime | Debug |
| --- | --- | --- |
| `/run/systemd/system` exists and `sudo -n true` succeeds | systemd unit `agro-tailscaled.service` | `systemctl status agro-tailscaled.service`; `journalctl -u agro-tailscaled.service` |
| otherwise | tmux session `agent-tailscaled` | `tmux capture-pane -pt agent-tailscaled` |

`enable` uses the `tailscaled` binary on `PATH`. If `enable` finds no
`tailscaled` binary, `enable` exits 1 and names the expected path.

## The verb

The `agro tool setup t3-mobile` verb owns the Tailscale procedure. Each action
calls upstream `tailscale` and `t3` and passes their output through.

| Action | Commands |
| --- | --- |
| `enable` | installs Tailscale when the binary is absent, starts `tailscaled` in the [daemon runtime](#daemon-runtime), then runs `tailscale up`, `tailscale serve --bg --https=443 http://127.0.0.1:3773`, and the pair command |
| `pair` | the pair command only |
| `disable` | `tailscale serve --https=443 off` |
| `status` | `tailscale status`, then `tailscale serve status` |

The pair command is `t3 pair --tailscale` when `t3` is on `PATH`. Otherwise the
pair command is `npx --yes t3@latest pair --tailscale`.

Run `enable` and `pair` in the directory where `t3 serve` started. `t3 pair`
finds the server through the `.t3` state in the current directory.

## Pair the phone

Run these commands in this order:

```bash
/t3 start
agro tool setup t3-mobile enable
```

`tailscale up` prints a login URL the first time. Open the URL in a browser and
approve the node. Tailscale keeps its state in `$HOME/.tailscale`, a named
Docker volume. A container recreate does not force a new login.

The pair command prints a QR code and a `https://<machine>.<tailnet>.ts.net/...`
pairing URL. Install the T3 Code mobile app. Then scan the QR code or paste the
`ts.net` URL.

The pairing token is one-time. To add one more device, do **not** restart the
server. Run the `pair` action:

```bash
agro tool setup t3-mobile pair
```

The hosted `https://app.t3.codes` page cannot talk to a plain-HTTP backend
(mixed content). Tailscale Serve supplies real HTTPS. Thus the hosted page and
the native mobile app both work.

## Teardown and revocation

```bash
agro tool setup t3-mobile disable     # withdraw the Serve mapping; it persists until you do
t3 auth session list                  # list T3 sessions
t3 auth session revoke <session-id>   # revoke one T3 session
/t3 stop                              # kill the T3 Code session
tailscale logout                      # remove this node's tailnet identity
```

To revoke the node from the tailnet side, delete the node in the Tailscale
admin console.

## Rename the node

A rename of the Tailscale node does not move the Serve mapping. The mapping
stays on the old MagicDNS name. Run these commands in the sandbox to remove the
old mapping and publish on the new name:

```bash
tailscale serve reset
agro tool setup t3-mobile enable
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `enable` stops at `tailscale up` | finish the browser login, then run `enable` again |
| `tailscaled` does not answer | on systemd, run `systemctl status agro-tailscaled.service` and `journalctl -u agro-tailscaled.service`; on tmux, run `tmux capture-pane -pt agent-tailscaled` |
| `enable` reports `tailscaled not found` | install Tailscale, or put the `tailscaled` binary on `PATH`, then run `enable` again |
| Node does not satisfy the range | the T3 server needs `^22.16 \|\| ^23.11 \|\| >=24.10`; raise the Node pin in `.devcontainer/Dockerfile` and rebuild |
| port 3773 does not answer | read `/t3 logs`; the provider backend can fail to start |
| phone shows the page but cannot connect | confirm that the phone is on the same tailnet and that the MagicDNS name resolves |
| Serve answers on the old name after a node rename | run `tailscale serve reset`, then `agro tool setup t3-mobile enable` |

## Secrets

Pairing URLs and tokens are credentials. Keep them in the terminal and the
`/tmp` session log only. Never put them in a tracked file, an issue, a PR body,
or a persistent log. Never print or commit a Tailscale auth key. Use the
interactive `tailscale up` login.
