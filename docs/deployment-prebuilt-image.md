# Creating a sandbox: `agro sandbox install docker`

`agro sandbox install docker` is the one command that creates a sandbox. It runs
from **any** directory, writes a registry entry under
`${AGRO_HOME:-~/.agro}/sandboxes/<name>/`, and starts the container:

```bash
agro sandbox install docker   # wizard: name, timezone, git identity, SSH, Docker socket
agro shell <name>             # attach as the sandbox user
```

**Running the published image is the default.** Each tagged release publishes the
sandbox image to GHCR. The release workflow builds and smoke-tests the image first.
The default tag is the `agro` CLI version: `ghcr.io/mifunedev/agro:<CLI version>`.
Each released CLI therefore runs the image of the same release. If the CLI
version is not a plain `X.Y.Z` release, for example `0.0.0-dev` from a source
run, the default falls back to `ghcr.io/mifunedev/agro:latest`.

```
ghcr.io/mifunedev/agro:<X.Y.Z>   # one immutable tag per release, e.g. 0.13.0
ghcr.io/mifunedev/agro:latest    # moving alias for the newest release
```

With no `--checkout`, the host holds **no checkout at all**. The workspace and
the `.agro/` control plane live in the sandbox's home volume. The entrypoint
seeds that volume once from the image's baked `/opt/agro-seed`. The CLI clones
nothing and builds nothing. A volume that an earlier image seeded keeps its
`.agro/` control plane, and the entrypoint never seeds that volume again.

Pass `--checkout <dir>`, and the CLI bind-mounts that checkout at
`/home/sandbox/harness` instead. The image then supplies only the **toolchain** —
your live, git-versioned `.agro/` control plane (and the rest of your repo)
shadows the copy baked into the image. The key property follows: **the image
version is a toolchain concern, not a correctness one**. A local build from
[`.devcontainer/Dockerfile`](../.devcontainer/Dockerfile) — Node, `gh`, the
Docker CLI, bun, uv, pnpm — happens only in that case, and only when
`image.mode` is `build`. On a cold cache that build takes **~10 minutes**.

## Prerequisites

| Need | For |
|---|---|
| Docker (with Compose plugin) | pulling + running the image |
| Node.js ≥ 20 | running the `agro` CLI |
| A checkout equipped with `agro vendor` | only for `--checkout`: the bind-mounted `.agro/` control plane |

The image is public — you need no `docker login ghcr.io` to pull the image. The
release currently publishes for the architecture the CI runner builds on; if you
run a different CPU arch, prefer a local build (`--checkout` with `image.mode` set to
`build`) until multi-arch images land.

## Pinning an image ref

```bash
agro sandbox install docker                     # run ghcr.io/mifunedev/agro:<CLI version>
agro sandbox install docker --version=0.13.0    # pin the official 0.13.0 release
agro sandbox install docker --image=<registry>/<image>:<tag>   # run a custom image
agro shell <name>                               # zsh in the running container, as usual
```

`--version <X.Y.Z>` selects the official image `ghcr.io/mifunedev/agro:<X.Y.Z>`.
The flag accepts `--version=0.13.0`, `--version 0.13.0`, and one leading `v`, as
in `--version=v0.13.0`. If the value does not match `X.Y.Z`, the command exits
with code 1. `--version` implies `--image`, so a bare `--image` beside
`--version` changes nothing.

Use `--image=<ref>` for a custom image. `--version` and `--image=<ref>` both
choose the image. If you pass both flags, the command exits with code 1 and
writes no sandbox entry.

`--image`, `--image=<ref>`, and `--version` imply `--no-build`. The CLI swaps
the wrapper's `up -d --build` for `up -d --no-build`. The CLI then passes the
resolved image ref through `AGRO_SANDBOX_IMAGE`, which the compose file
interpolates at `image:`.

`--no-build` on its own suppresses the build and reuses whatever image compose
already resolves (a previously built `sandbox-<name>`, or an `image.ref` set in
the entry's `agro.json`) without pinning one — an advanced escape hatch.

### What the install stores

The install stores only an explicit pin in the entry's `image.ref`. A
`--version` value and an `--image=<ref>` value are explicit pins. A re-install
with a new value replaces the stored ref. Later runs of `agro start` and
`agro restart` keep the pinned image.

Without a pin, the install stores no `image.ref`. Each start then renders the
default `ghcr.io/mifunedev/agro:<CLI version>`. After `agro update`, the next
start of an unpinned sandbox runs the image that matches the new CLI version.

### Which image ref wins

The CLI uses the first source in this list that holds a ref:

1. `--version <X.Y.Z>` or `--image=<ref>` on `agro sandbox install docker`
2. `AGRO_SANDBOX_IMAGE` in the process environment
3. `image.ref` in the entry's `agro.json` (see [configuration](configuration.md))
4. `ghcr.io/mifunedev/agro:<CLI version>`, the built-in default

Set a durable pin on the entry:

```bash
agro config set --sandbox <name> image.ref ghcr.io/mifunedev/agro:0.13.0
agro config set --sandbox <name> image.pullPolicy always
```

which is the same as writing this into `~/.agro/sandboxes/<name>/agro.json`:

```json
{
  "image": {
    "ref": "ghcr.io/mifunedev/agro:0.13.0",
    "mode": "image",
    "pullPolicy": "missing"
  }
}
```

If the entry sets `image.ref`, a bare `agro sandbox install docker --image` uses
that ref. To follow the moving `latest` alias, set `image.ref` to
`ghcr.io/mifunedev/agro:latest` and set `image.pullPolicy` to `"always"`.

## `--checkout`: bind a checkout into the sandbox

```bash
cd <your-project>
agro vendor                                     # vendor .agro/ + crons/ into this checkout
agro sandbox install docker --checkout "$PWD" --name <your-project>
```

The CLI stores `checkout` in the entry's `agro.json` and renders the value into the compose
environment as `AGRO_REPO_DIR`, which the base compose file reads as
`${AGRO_REPO_DIR:-${AGRO_REPO_DIR:-..}}` for both the bind mount and the build
context — so an entry rendered by an older CLI still resolves. It also lets a
lifecycle verb resolve this sandbox whenever you stand inside that checkout, so
`agro shell` needs no name there. The flag `--repo` and the `agro.json` field
`repo` remain supported aliases for `--checkout` and `checkout`.

## What still happens at boot

systemd is PID 1 and runs `entrypoint.sh` once as `agro-bootstrap.service`,
the same either way: host UID/GID sync when a checkout is bound, provider symlink
repair, and the **fingerprint-gated `pnpm install`** at the repo root. The cron
runtime then starts as `agro-cron.service`. That install covers the
repo's root dependencies only (not the image toolchain), so it stays fast and
does not defeat the point of skipping the build.

## Compose-equivalent (no CLI)

The CLI is a thin wrapper over the compose files it materialises into the entry;
you can drive compose directly from an equipped checkout:

```bash
AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0 \
  bash .agro/scripts/docker-compose.sh --repo-dir "$PWD" up -d --no-build
```

`AGRO_SANDBOX_IMAGE` in the process environment takes precedence over the
`.env` `--env-file`, so it overrides an `AGRO_SANDBOX_IMAGE` pin — the
same last-wins ordering as the CLI. The legacy `AGRO_SANDBOX_IMAGE` spelling
applies when the AGRO one is unset.

## VS Code "Reopen in Container"

The VS Code Dev Containers path reads
[`.devcontainer/docker-compose.yml`](../.devcontainer/docker-compose.yml)
**directly** and cannot receive `--no-build`, so its build-suppression relies on
`pull_policy`. Set both in `.devcontainer/.env` (compose auto-loads it):

```dotenv
AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0
AGRO_PULL_POLICY=always
```

> ⚠️ Because the service keeps its `build:` block, some Docker Compose versions
> may still rebuild on this path rather than pull. **Validate on your host**
> (watch for a `pull` vs a `build` in the VS Code container log) before relying
> on it; if it rebuilds, use the CLI path above, or the direct-image
> `devcontainer.json` below.

### Direct-image variant (bypasses the compose stack)

For a minimal VS Code container that pulls and skips compose entirely, point
`devcontainer.json` at the image instead of the compose file. Note this drops the
named auth volumes and compose overlays — the result is a lighter, less-featured
container:

```jsonc
{
  "name": "agro-image",
  "image": "ghcr.io/mifunedev/agro:0.13.0",
  "workspaceFolder": "/home/sandbox/harness",
  "remoteUser": "sandbox"
}
```

## Under the hood: the image-only compose file

Without `--checkout`, the CLI materialises
[`.devcontainer/docker-compose.image-only.yml`](../.devcontainer/docker-compose.image-only.yml)
into the entry as the compose base. Everything below describes that path, and it
is what `agro sandbox install docker` runs for you. Tracked in
[#609](https://github.com/mifunedev/agro/issues/609).

### The recipe by hand

That file is standalone — no `..:` bind mount, no `build:` stanza:

```bash
docker compose -f .devcontainer/docker-compose.image-only.yml up -d
```

This pulls and runs the published image with **no clone and no build**.
Everything the sandbox persists — the workspace and control plane at
`/home/sandbox/harness` included — lives in the single `/home/sandbox` mount
declared in that file: the named volume `<sandbox-name>_workspace` by default,
or an absolute host path when `AGRO_HOME_MOUNT` (legacy `AGRO_HOME_MOUNT`) is
set.

### How the mode is detected

Nothing declares the mode. `entrypoint.sh` asks whether
`/home/sandbox/harness` is a bind mount **and** already holds a `.agro/` directory,
and reads the answer from the kernel and the filesystem:

- **checkout bind present** (`--checkout`) — sync the sandbox UID/GID to the host
  directory's owner, and never seed.
- **anything else** (the image-only default, and a runtime that mounts a fresh empty host
  directory at the project root) — skip the UID/GID sync, since there is no host
  directory to read ownership from; `chown` the workspace to the sandbox user;
  and run the first-boot seed (below) before `link-providers`, the root
  `pnpm install`, and cron tmux setup, so those steps see a populated `.agro/`.

The entrypoint logs the detected mode on both paths, so `agro logs` shows a
wrong detection:

```
[entrypoint] checkout bind detected at /home/sandbox/harness — syncing host UID/GID
[entrypoint] no checkout bind at /home/sandbox/harness — seeding from /opt/agro-seed
```

Three independent guards keep a misdetection from seeding over a real checkout:
`mountpoint -q` is a kernel fact rather than a heuristic, `seed_workspace_volume`
refuses when `.agro/` or a legacy `.agro/` already exists, and
`.gitignore` excludes `.agro/.image-seeded`.

### Seed-to-volume persistence

On the **first boot** against an empty home mount, the entrypoint
seeds the baked control plane — from the image's `/opt/agro-seed` — into the
volume, then writes the marker `.agro/.image-seeded`. From that point on, the
**volume is authoritative**: the volume holds the operator-editable copy of `.agro/` (and
the rest of the repo), and edits made inside the running sandbox persist there
across image pulls and container recreation, not in the image itself. Later
boots see the marker and skip re-seeding, so a populated volume is never
clobbered.

> ⚠️ **The image-only path requires an image built after two changes:** (1) the seed-bake
> that stages `/opt/agro-seed`, and (2) the `.claude` seed-config fix
> ([#617](https://github.com/mifunedev/agro/pull/617)) that stops
> `.dockerignore` from starving `/opt/agro-seed` of `.claude/protected-paths.txt`.
> An image missing (2) crash-loops on boot with
> `ERROR: .claude/protected-paths.txt is missing`. Pin a tag published **after
> #617 merges** (or a local build of that branch — see below) before relying on
> the image-only path. Volumes already seeded by a pre-#617 image self-heal on
> the next boot against a fixed image.

### Clean slate + fresh run (explicit `docker run`)

The [compose file](../.devcontainer/docker-compose.image-only.yml) is the
canonical one-liner (`docker compose -f … up -d`). If you drive Docker directly
instead, run the equivalent teardown → fresh run → verify sequence below. It
mirrors the compose file's env and volume set — note it reads `GIT_USER_NAME` /
`GIT_USER_EMAIL` (the entrypoint ignores any `AGRO_GIT_*` variants).

```bash
# ── 0. Config ──────────────────────────────────────────────────────
IMAGE=ghcr.io/mifunedev/agro:latest   # a tag published after #617
NAME=agro

# To test BEFORE #617 is published, build the fix branch locally and point
# IMAGE at it (this is the "run it now" path):
#   git fetch origin && git checkout feat/image-seed-claude-config
#   docker build -t agro:seedfix -f .devcontainer/Dockerfile .
#   IMAGE=agro:seedfix

# ── 1. Clear previous state ── DESTRUCTIVE: wipes the seeded workspace ──
docker rm -f "$NAME" 2>/dev/null || true
docker volume rm "${NAME}_workspace" 2>/dev/null || true   # the whole sandbox home

# ── 2. Fresh run (no bind mount, no build) ─────────────────────────
docker run -d --name "$NAME" --restart unless-stopped \
  --cgroupns private \
  --cap-add SYS_ADMIN \
  --security-opt apparmor=unconfined \
  --tmpfs /run --tmpfs /run/lock --tmpfs /sys/fs \
  -e GIT_USER_NAME="ryaneggz" \
  -e GIT_USER_EMAIL="kre8mymedia@gmail.com" \
  -e GH_TOKEN="${GH_TOKEN:-}" \
  -v "${NAME}_workspace":/home/sandbox \
  "$IMAGE"

# ── 3. Verify the seed + provider wiring ───────────────────────────
sleep 8
docker logs "$NAME" 2>&1 | tail -30
docker exec "$NAME" bash -lc '
  ls -l /home/sandbox/harness/.claude/protected-paths.txt \
  && bash /home/sandbox/harness/.agro/scripts/link-providers.sh --check \
  && ls /home/sandbox/harness/.agro >/dev/null && echo SEED_OK'
```

A healthy boot ends with `Providers OK: …` and `SEED_OK`, and the logs show
**no** `protected-paths.txt is missing`. The home mount is now
authoritative — later boots see the `.agro/.image-seeded` marker and skip
re-seeding, so your in-container edits persist.

The boot installs no harness and no tool. The image contains none either, so the
container comes up with no agent CLI and no `herdr`. Check the state with
`docker exec "$NAME" bash -lc 'agro harness list'` and
`docker exec "$NAME" bash -lc 'agro tool list'`, then install what you need
through the one door, for example
`docker exec "$NAME" bash -lc 'agro tool install herdr'`.

```bash
# ── 4. Attach an interactive shell (once the container is stable) ──
# Optional: block until the healthcheck reports healthy (start_period ~600s).
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$NAME" 2>/dev/null)" = healthy ]; do
  echo "waiting for $NAME to become healthy…"; sleep 5
done

docker exec -it -u sandbox "$NAME" zsh   # interactive shell (bash also available)
# first commands inside the container:
#   agro tool install herdr
#   herdr
# then complete gh/provider auth and launch agents from Herdr panes
```

The image has no `HEALTHCHECK` of its own, so `docker run` won't populate
`.State.Health` unless you add `--health-cmd`; on the plain `docker run` above,
skip the wait loop and just exec once `docker ps` shows the container `Up`. The
compose path (`docker-compose.image-only.yml`) defines the healthcheck, so there
the wait loop works as written — or use `agro ps <name>` and `agro shell <name>`.

### The same image runs under MicroSandbox

`msb` runs standard OCI images, so this image is also what you point MicroSandbox
at if you want a microVM rather than a container. The `docker run` recipe above
is the invocation to translate — see
[Running AGRO on MicroSandbox](runtimes/microsandbox.md#running-agro-on-microsandbox).
Nobody has tested this path end to end; that page lists the risks.

### Single-arch caveat

Same caveat as above: the published image targets the CI runner's architecture.
If you run a different CPU arch, prefer `--checkout` with `image.mode` set to
`build`, so the machine that runs the image also builds the image, until multi-arch
images land.

### Manual live-host smoke checklist (non-gating)

The eval probe suite covers the static contract (env-var gating, compose
shape, doc content) deterministically, without a Docker host. It cannot cover
an actual live boot. Before relying on the image-only path in production, run
this checklist by hand on a real host:

- [ ] `docker pull ghcr.io/mifunedev/agro:<tag built after the /opt/agro-seed change>`
- [ ] `docker compose -f .devcontainer/docker-compose.image-only.yml up -d`
- [ ] confirm **no build step ran** — the compose/Docker output shows a pull, not a build
- [ ] confirm `.agro/` was seeded into the volume:
      `docker compose -f .devcontainer/docker-compose.image-only.yml exec sandbox ls /home/sandbox/harness/.agro`
- [ ] confirm an agent / the `agro` CLI is usable inside the container
- [ ] edit a file under `.agro/` in the running container, then
      `docker compose -f .devcontainer/docker-compose.image-only.yml restart`,
      and confirm the edit is still there

See also [Pinning an image ref](#pinning-an-image-ref) above for pulling a
pinned tag through the CLI.

## See also

- [Installation](installation.md) — all install paths
- [Security considerations](security-considerations.md) — the Docker-socket opt-in
- [`.agro/` directory layout](agro-directory-layout.md)
