# Creating a sandbox: `agro sandbox install docker`

`agro sandbox install docker` creates a sandbox. Run the command on the host,
from any directory. The command writes a registry entry under
`${AGRO_HOME:-~/.agro}/sandboxes/<name>/` and starts the container:

```bash
agro sandbox install docker   # wizard: name, timezone, git identity, SSH, Docker socket
agro shell <name>             # attach as the sandbox user
```

The image fields `image.ref`, `image.mode`, and `image.pullPolicy` are in
[Configuration → Prebuilt image](configuration.md#prebuilt-image).

## The published image

By default, the sandbox runs the published image. The release workflow builds
the image, tests the image, and publishes the image to GHCR:

```
ghcr.io/mifunedev/agro:<X.Y.Z>   # one immutable tag per release
ghcr.io/mifunedev/agro:latest    # the newest release
```

The default tag is the version of the `agro` CLI. When the CLI version is not a
plain `X.Y.Z` release, for example `0.0.0-dev`, the default tag is `latest`. The
image is public, so a pull needs no `docker login`.

The release publishes the image for one CPU architecture, the architecture of
the CI runner. On a different architecture, build locally with `--checkout`.

## Image mode: no checkout

Without `--checkout`, the host holds no checkout. The workspace and the `.agro/`
control plane live in the home volume of the sandbox:

1. On the first boot, the entrypoint copies `/opt/agro-seed` into the empty
   volume.
2. The entrypoint writes the marker `.agro/.image-seeded`.
3. On each later boot, the entrypoint finds the marker and skips the copy.

From the first boot on, the volume holds the editable copy. Your edits survive
an image pull and a container recreation. `agro logs <name>` shows the mode that
the entrypoint detected:

```
[entrypoint] no checkout bind at /home/sandbox/harness — seeding from /opt/agro-seed
```

## Pin an image

```bash
agro sandbox install docker                     # run ghcr.io/mifunedev/agro:<CLI version>
agro sandbox install docker --version=0.13.0    # pin the official 0.13.0 release
agro sandbox install docker --image=<registry>/<image>:<tag>   # run a custom image
```

- `--version <X.Y.Z>` selects `ghcr.io/mifunedev/agro:<X.Y.Z>`. The flag accepts
  one leading `v`. When the value does not match `X.Y.Z`, the command exits 1.
- `--image=<ref>` selects a custom image. When you pass `--image=<ref>` and
  `--version` together, the command exits 1 and writes no entry.
- `--image`, `--image=<ref>`, and `--version` imply `--no-build`.
- `--no-build` alone skips the build and uses the image that Compose already
  resolves.

The install stores `image.ref` only for an explicit pin. A later `agro restart`
keeps the pin. An unpinned sandbox renders the default tag at each start, so
after `agro self-upgrade` the next start runs the image of the new CLI version.

The CLI takes the image ref from the first source in this list that holds one:

1. `--version <X.Y.Z>` or `--image=<ref>` on `agro sandbox install docker`
2. `AGRO_SANDBOX_IMAGE` in the process environment
3. `image.ref` in the `agro.json` of the entry
4. `ghcr.io/mifunedev/agro:<CLI version>`

To pin an existing sandbox, run these commands on the host:

```bash
agro config set --sandbox <name> image.ref ghcr.io/mifunedev/agro:0.13.0
agro stop <name> && agro sandbox install docker --name <name>
```

To follow `latest`, set `image.ref` to `ghcr.io/mifunedev/agro:latest` and set
`image.pullPolicy` to `always`. To move an image-mode sandbox to a release
without a reinstall, use
[`agro sandbox upgrade`](lifecycle-commands.md#upgrading-a-sandbox-image-agro-sandbox-upgrade).

## Checkout mode: `--checkout`

```bash
cd <your-project>
agro vendor
agro sandbox install docker --checkout "$PWD" --name <your-project>
```

The CLI bind-mounts the checkout at `/home/sandbox/harness`. Your checkout then
replaces the copy of `.agro/` in the image, and the image supplies only the
toolchain. The CLI stores the path as `checkout` in the entry. A lifecycle verb
that you run inside the checkout finds the sandbox without a name.

The sandbox builds from `.devcontainer/Dockerfile` only when the checkout holds
that file and `image.mode` is `build`. A cold build takes about ten minutes.

## Boot

systemd is PID 1. On each boot, `agro-bootstrap.service` runs `entrypoint.sh`
once. The entrypoint syncs the host UID and GID when a checkout is bound, repairs
the provider links, and runs `pnpm install` at the repository root when the
lockfile changed. Then `agro-cron.service` starts the cron runtime. The boot
installs no harness and no tool.

## Run the image without `agro`

`agro` applies the overlays and the healthcheck. Use `agro` when you can. To run
the image directly, keep the systemd flags and mount the home volume:

```bash
docker run -d --name <name> --restart unless-stopped \
  --cgroupns private --cap-add SYS_ADMIN --security-opt apparmor=unconfined \
  --tmpfs /run --tmpfs /run/lock --tmpfs /sys/fs \
  -e GIT_USER_NAME="<your-name>" -e GIT_USER_EMAIL="<you@example.com>" \
  -v <name>_workspace:/home/sandbox \
  ghcr.io/mifunedev/agro:<X.Y.Z>
docker exec -it -u sandbox <name> zsh
```

Without the `/home/sandbox` volume, a container removal deletes every login and
every edit. The same image runs under MicroSandbox; see
[MicroSandbox](runtimes/microsandbox.md).

## VS Code

Attach VS Code to a sandbox that `agro` started. *Reopen in Container* applies
no overlays. See
[Lifecycle commands](lifecycle-commands.md#vs-code-reopen-in-container-applies-no-overlays)
and [Connecting to the sandbox](connecting.md).
