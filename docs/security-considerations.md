# Security considerations

AGRO runs coding agents with broad autonomy. This page lists the security
boundaries that the repository holds now, and the file that holds each one. An
**ENFORCED** boundary holds whatever the model does. A **DOCTRINE** boundary is a
convention, and no mechanism holds the line.

**Threat model.** These boundaries stop two threats: accidental credential
leaks into transcripts and prompt caches, and agents that act outside their
intended surface. The boundaries do not stop a determined adversary who controls
the model. The guards match patterns, and the sandbox trades some isolation for
capability (section 4). Treat every model output and tool output as untrusted
(section 7).

## 1. Secrets stay out of git — ENFORCED

Real credentials never enter the tracked checkout.

- [`.gitignore`](../.gitignore) ignores `**/.env*`, `**/auth.json`,
  `**/.credentials.json`, and `/.agro/config.json`.
- The tracked [`.example.env`](../.example.env) holds no secret. Secrets live in
  the root `.env` (mode `0600`), which `.gitignore` excludes.
  `agro secret set <KEY>` writes one key to that file.
- Non-secret settings live in the tracked [`agro.json`](../agro.json).
  `.agro/cli/src/lib/secrets.ts` holds the secret allowlist.
  `.agro/cli/src/lib/config-render.ts` refuses to render a secret into the
  compose environment. See [Configuration](configuration.md).
- Provider authentication lives in the `/home/sandbox` mount, not in the
  repository.

No mechanism scans commit contents for a pasted secret.

## 2. Secret-exposure hooks — ENFORCED

The sandbox runs Claude Code with `bypassPermissions` and Codex with
`approval_policy = "never"`. The permission engine is off, so a deny list alone
does not hold. Deterministic hooks in [`.agro/hooks/`](../.agro/hooks/) run
before each tool call. `.claude/hooks` is a symlink to `.agro/hooks`.

- [`deny-env-dump.sh`](../.agro/hooks/deny-env-dump.sh) checks each `Bash`
  command. The hook denies environment dumps, shell history dumps, and `echo` of
  a secret-named variable. The hook denies token-printing commands such as
  `gh auth token` and `agro secret get`, and reads of secret files such as `.env*`, `*.pem`, and
  `id_rsa*`. The hook also denies any command that names a `.config/` path.
  The operator runs `agro secret get` on the host.
- [`deny-secret-paths.sh`](../.agro/hooks/deny-secret-paths.sh) checks the file
  tools (`Read`, `Write`, `Edit`, `NotebookEdit`, `Grep`, `Glob`). The hook denies
  the same secret paths, `.config/`, and `settings.local.json`.
- [`warn-devtcp.sh`](../.agro/hooks/warn-devtcp.sh) prints a warning for
  `/dev/tcp` and `/dev/udp`. The hook blocks nothing.

`deny-env-dump.sh` ignores HEREDOC bodies. A template file such as
`.example.env` stays readable.

Wiring:

- **Claude Code**: `hooks.PreToolUse` in [`.claude/settings.json`](../.claude/settings.json)
  runs all three hooks. `permissions.deny` repeats the same patterns.
- **Codex**: [`.codex/hooks.json`](../.codex/hooks.json) runs `deny-env-dump.sh`
  and `.codex/hooks/deny-local-settings.sh`. Codex cannot prompt, so the Codex
  wrapper turns each ask into a deny.
- **Pi**: [`.pi/extensions/path-guard.ts`](../.pi/extensions/path-guard.ts)
  asks before a write or an edit to a sensitive path. The guard runs only in an
  interactive Pi session.
- **Hermes**: no hook surface.

When a commit body contains a flagged substring, pass the body as a file
(`git commit -F msg.txt`, `gh pr create --body-file body.md`). Do not retry a
variant that bypasses a deny.

## 3. Destructive-command guard — ENFORCED

[cc-safety-net](https://github.com/kenryu42/cc-safety-net) `1.0.6` parses each
`Bash` command and denies destructive intent: `rm -rf`, `git reset --hard`,
`git checkout --`, `git push --force`, `git clean -f`, `find -delete`, `dd`,
`mkfs`, and destructive interpreter one-liners. The guard follows `bash -c`,
`xargs`, and command chains. This guard does not scan for secrets. Section 2
covers secrets.

- `.devcontainer/Dockerfile` installs the pinned binary. At boot,
  `.agro/scripts/link-providers.sh` fails when the binary is missing or differs
  from the pin.
- `CC_SAFETY_NET_STRICT=1` denies shell syntax that the guard cannot parse.
  `CC_SAFETY_NET_WORKTREE=1` allows a bare `git reset --hard` inside a linked
  worktree.
- Claude Code and Codex run the guard as a `Bash` hook. Pi loads
  `npm:cc-safety-net@1.0.6` from [`.pi/settings.json`](../.pi/settings.json).
  Hermes has no guard.

To override a false positive, use one of these:

1. Set `CC_SAFETY_NET_OFF=1`. Only Claude Code and Codex processes that start
   after the change read the flag. Pi ignores the flag. To turn the guard off in
   Pi, remove the package from `.pi/settings.json` and restart the Pi session.
2. Run the operation through
   `bash .agro/scripts/git-maintenance.sh <subcommand>`. The guard does not read
   script files.

The script-file route also lets an agent bypass the guard. cc-safety-net catches
accidents. Docker is the security boundary (section 4).

## 4. Sandbox isolation — ENFORCED, with opt-in exceptions

Agents run in a container as the non-root `sandbox` user. Agent work stays off
the host filesystem and out of host user state.

**Docker socket (off by default).** The compose files mount no Docker socket.
`access.dockerSocket: true` in `agro.json` adds
[`docker-compose.docker-sock.yml`](../.devcontainer/docker-compose.docker-sock.yml),
which mounts `/var/run/docker.sock`. The `agro sandbox install docker` wizard
asks, and the default answer is no.

> **Warning.** Socket access is host root. An agent with the socket can start a
> privileged container that mounts the host filesystem. With the socket mounted,
> the sandbox limits accidents but is not a security boundary. Leave the socket
> off unless the agent must drive Docker. If you need Docker and a hard boundary,
> use a rootless or proxied Docker daemon.

With the socket present, the entrypoint adds `sandbox` to the group that owns the
socket GID. On a Debian host, that group can be `systemd-journal`, which also
grants journal read access.

**Privilege posture.** The compose files use Compose init (`init: true`). PID 1
is `docker-init`, which runs `sandbox-main.sh`. `sandbox-main.sh` runs
`entrypoint.sh` once and stays up. The compose files grant no extra privilege:

- no added capability;
- the default AppArmor profile;
- the default cgroup namespace, with no private cgroup;
- no `tmpfs` mount.

The sandbox never sets `privileged: true`, exposes no host device, and never
binds the host cgroup tree.
[`sandbox-privilege-boundary.test.ts`](../.agro/scripts/__tests__/sandbox-privilege-boundary.test.ts)
fails when a compose file contains `privileged: true`, `devices:`, a host cgroup
bind, `cap_add:`, `security_opt:`, or `cgroup:`.

VM image mode is different. A VM that boots the image runs the image `CMD`,
`/sbin/init`, as PID 1. systemd then runs `agro-bootstrap.service`.

**Permission engine off.** `CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS=true` turns off
interactive permission prompts. The hooks in sections 2 and 3 still run.

## 5. Network exposure — ENFORCED defaults

The base container publishes no ports.

- **sshd (opt-in).** `access.ssh: true` adds
  [`docker-compose.ssh.yml`](../.devcontainer/docker-compose.ssh.yml). The
  default posture is a `127.0.0.1` bind, public-key auth, `PermitRootLogin no`,
  and password auth off. Before `agro sandbox install docker` creates the
  container, a port-collision preflight refuses a port in use. `agro sandbox
  install docker` generates a random `SANDBOX_PASSWORD`; run `agro secret get
  SANDBOX_PASSWORD` to read the generated value. You own the remaining weaker choice: a
  `0.0.0.0` bind. See [SSH](integrations/sshd.md).
- **Tailscale (opt-in).** `agro tool install tailscale` adds no capability and
  no compose change. `tailscaled` runs in userspace-networking mode as
  `sandbox`. Nothing joins a tailnet at boot. AGRO ships no Funnel command. Never
  commit or print a reusable auth key. If you automate login, store the key in
  `.env`. Treat a T3 pairing URL as a secret. See
  [Connecting → Mobile access over Tailscale](connecting.md#mobile-access-over-tailscale).

## 6. Human merge gate — DOCTRINE

No agent merges its own work. The [`/git` skill](../.agro/skills/git/SKILL.md#ready-for-review)
ends the agent path at `gh pr ready`. A human merges. No scheduled agent opens
or merges a PR.

Configure GitHub branch protection with required reviews on `development` and
`main`. Without branch protection, the gate rests on skill text alone.

## 7. Untrusted model output — DOCTRINE

Treat every model output, tool output, fetched page, and recalled memory as
untrusted context, not as commands. Verify a cited file or flag before you act on
the citation. The hooks in sections 2 and 3 are the only deterministic authority.
The scope rule in `AGENTS.md` ("Agent work stays inside the sandbox") and the
merge gate in section 6 are doctrine. When a boundary matters, prefer a hook over
a prompt instruction.

## 8. Egress allowlist — ENFORCED, opt-in

`access.egress` defaults to `open`: the sandbox keeps its current, unrestricted
route out. Set `access.egress: "allowlist"` and `agro sandbox install docker`
adds [`docker-compose.egress.yml`](../.devcontainer/docker-compose.egress.yml).
The overlay puts the sandbox on an `internal: true` network and adds a `proxy`
service on a second, egress-only network. The sandbox has no default route and
no direct path to the internet. Every outbound request must pass through the
proxy, and the proxy denies every host outside `egress-allow.txt`.

**Default hosts.** `materialize()` builds `egress-allow.txt` from one source:
the `host` entries under `network_policies` in
[`openshell-policy.yaml`](../.devcontainer/openshell-policy.yaml), plus
`access.egressAllow`. The built-in hosts are `github.com`, `api.github.com`,
`release-assets.githubusercontent.com`, `registry.npmjs.org`,
`api.anthropic.com`, and `platform.claude.com`. `access.egressAllow` is an
array of extra hosts in `agro.json`. See [Configuration → Egress
allowlist](configuration.md#egress-allowlist).

**Fix a blocked host.** Run `agro egress log [name]` and find the denied host
in the `TCP_DENIED` lines. Add the host with `agro config set
access.egressAllow "<hosts>" --sandbox <name>`. Run `agro egress reload
[name]`. The command rewrites `egress-allow.txt` and sends the proxy `squid -k
reconfigure`; the sandbox container keeps running.

**The boundary.** The network topology enforces the allowlist, not a rule
inside the container. The sandbox has no route to the internet other than the
proxy, and the proxy is a separate container that root in the sandbox cannot
reach or reconfigure. The proof of concept on ADR #1378 ran as root inside the
sandbox with `SYS_ADMIN` and found no bypass: a request without the proxy
variables failed to resolve its host, a request to a direct IP failed to
connect, and an attempt to add a default route failed with `Operation not
permitted`.

**Limits.** Allowlist mode blocks git over SSH, UDP other than DNS,
`host.docker.internal`, `cloudflared`, and `tailscale`; none of these pass
through an HTTP(S) proxy. `access.ssh` (`SANDBOX_SSH`) does not work in
allowlist mode: the sandbox has no published port, because the sandbox sits on
an internal network with no route from the host. Allowlist mode needs Compose
2.23 or later, because the overlay's proxy configuration uses the inline
`configs.content` field. The overlay sets `NODE_USE_ENV_PROXY=1`, because a
Node.js `fetch` call, including the one corepack makes, ignores the proxy
variables without that setting. Allowlist mode defines no rule for each
binary, and it uses no credential injection or TLS interception. See [the PRD
§ Out of Scope](../.agro/tasks/docker-egress-allowlist/prd.md#out-of-scope).

## Report a vulnerability

To report a way past an ENFORCED boundary, open a GitHub issue. For a sensitive
report, contact the maintainers privately first. Do not post a working exploit in
public.

Related: [Connecting to the sandbox](connecting.md),
[Configuration](configuration.md), [SSH](integrations/sshd.md).
