---
title: SSH
---

# SSH

The base sandbox publishes no ports and runs no SSH daemon. Reach it with
`agro shell` or VS Code Attach (see [Connecting to the Sandbox](../connecting.md)).
This integration adds an opt-in `sshd`, so you can `ssh` straight into the
container. It also shows how one host-side `nginx` routes SSH to two or more
sandboxes on one VM.

SSH is off by default. When you turn it on, the host port binds to loopback
only. `sshd` accepts public keys only and refuses `root`. Password auth is
opt-in. Two choices weaken this posture, and you own both: a `0.0.0.0` bind in
your own overlay, and password auth with the default password.

## 1. Prerequisites

- The sandbox exists (`agro ps <name>` shows the container).
- You have an SSH key pair on the client machine. To create one, run
  `ssh-keygen -t ed25519`. You give AGRO the public key only.

## 2. Turn on SSH

Run these commands on the host:

```bash
agro config set access.ssh true --sandbox <name>
agro config set access.sshPort 2222 --sandbox <name>
agro config set access.sshAuthorizedKeys "ssh-ed25519 AAAA... you@laptop" --sandbox <name>
```

| Field | Effect |
|-------|--------|
| `access.ssh` | Adds the `.devcontainer/docker-compose.ssh.yml` overlay. The entrypoint starts `sshd` at boot. |
| `access.sshPort` | Host loopback port. The overlay publishes `127.0.0.1:<port>:22`. Default: `2222`. |
| `access.sshAuthorizedKeys` | Public keys. Separate two or more keys with a newline or a literal `\n`. |

A public key is not a secret, so the key lives in `agro.json`. Field reference:
[Configuration → Access](../configuration.md#access).

Apply the change. Docker applies the overlay and the port only when
`agro sandbox install docker` creates the container again:

```bash
agro stop <name> && agro sandbox install docker --name <name>
```

### Port-collision preflight

Before `agro sandbox install docker` creates the container, it checks the SSH
port. If another container or a host process holds the port, the command stops.
It prints the owner and the next free port. It never takes a port from another
sandbox.

To check a port yourself, run `check-host-port.sh` from the AGRO checkout on the
host:

```bash
bash .agro/scripts/check-host-port.sh 2222   # prints "free" or "<port> in use by <owner>; next free: <m>"
```

To skip the preflight, prefix the command with `SANDBOX_SSH_PORT_CHECK=off`.

## 3. How the entrypoint configures sshd

At every boot, the entrypoint reads `access.*` through `agro config show`. Then
the entrypoint does these steps:

1. Writes `access.sshAuthorizedKeys` to `/home/sandbox/.ssh/authorized_keys`
   (mode `600`, owner `sandbox`).
2. Writes `/etc/ssh/sshd_config.d/agro.conf`:

   ```text
   PermitRootLogin no
   PubkeyAuthentication yes
   PasswordAuthentication no
   ```

3. Starts `sshd` next to the main process. The cron runtime, the healthcheck,
   and `agro shell` stay the same.

When `access.sshAuthorizedKeys` is empty, the entrypoint keeps an existing
`authorized_keys` file in the home volume. To mount a host `authorized_keys`
file, write a small overlay that binds the file to
`/home/sandbox/.ssh/authorized_keys:ro`. Add the overlay path to
`composeOverrides`.

> **No key and no password auth means no login.** In that state, the entrypoint
> logs a warning, and nobody can log in. Set a key, or turn on password auth.

## 4. Connect

From the host:

```bash
ssh -p 2222 sandbox@localhost
```

You log in as the `sandbox` user. To connect from another machine, open an SSH
tunnel to the host (`ssh -L 2222:localhost:2222 you@vm`). Alternatively, put
nginx in front of the port (section 6).

To confirm that `sshd` runs, run `docker exec <container> pgrep -x sshd` on the
host.

## 5. Optional: password auth

Use key auth when you can. Password auth uses the `SANDBOX_PASSWORD` secret of
the `sandbox` user.

> **Warning.** The default `SANDBOX_PASSWORD` is `test1234`, which is weak and
> public. Before you turn on password auth, set a strong password with
> `agro secret set SANDBOX_PASSWORD --sandbox <name>`. Never turn on password auth
> on a `0.0.0.0` bind while the password is the default.

```bash
agro config set access.sshPasswordAuth true --sandbox <name>
```

See [Security considerations](../security-considerations.md).

## 6. Route several sandboxes through nginx (one VM)

Give each sandbox its own name and its own host loopback SSH port. Then put one
host-side `nginx:alpine` in front of them. The nginx `stream` module forwards raw
TCP.

1. Point one DNS name per sandbox at the public IP address of the VM, for
   example `agent-1.example.com` and `agent-2.example.com`.
2. Give each sandbox a free loopback port, for example
   `agro config set access.sshPort 12201 --sandbox agent-1`.
3. Map one public port to each loopback port in `nginx.conf` on the VM:

   ```nginx
   events {}

   stream {
     server {
       listen 2201;
       proxy_pass 127.0.0.1:12201;   # agent-1.example.com
     }
     server {
       listen 2202;
       proxy_pass 127.0.0.1:12202;   # agent-2.example.com
     }
   }
   ```

4. Run nginx with host networking, so it reaches the loopback ports and binds
   the public ports:

   ```yaml
   # docker-compose.yml on the VM, next to nginx.conf
   services:
     ssh-router:
       image: nginx:alpine
       network_mode: host
       restart: unless-stopped
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf:ro
   ```

5. Connect to each sandbox, for example
   `ssh -p 2201 sandbox@agent-1.example.com`.

SSH sends no host name to the server, so the port selects the sandbox. The DNS
name only helps people. To add a sandbox, allocate a new loopback and public port
pair. Next, add one `server {}` block. Then reload with
`docker exec <router> nginx -s reload`.

For one shared port where the DNS name selects the sandbox, wrap SSH in TLS and
route on SNI with `ssl_preread`. That layout needs a TLS endpoint for each
sandbox and a wildcard certificate. AGRO does not configure SNI routing.

See also [Connecting to the Sandbox](../connecting.md) and
[Security considerations](../security-considerations.md).
