# Manual review: nvm-to-fnm fresh install

The transcript below comes from one run of `install.sh` in a clean container. In this run, `install.sh` installs fnm, `unzip`, and Node 24 on a host without Node and without `unzip`.

The agent ran the commands at commit `3420f41f384b0adfac64ff0ccda645882846e86b` on branch `task/1569-nvm-to-fnm`.

## Observed results

| Check | Observed line | Exit status |
|---|---|---|
| Node is absent at the start | `node_before=ABSENT` | not applicable |
| `unzip` is absent at the start | `unzip_before=ABSENT` | not applicable |
| `curl` is present at the start | `curl=/usr/bin/curl` | not applicable |
| `ca-certificates` is present at the start | `ca-certificates 20250419~deb12u2` | not applicable |
| The smoke script passes | `cli-first-install-smoke: phase bootstrap complete` | `smoke_exit=0` |
| `install.sh` installs Node 24 | `node_after=/tmp/tmp.a4X7MfadXw/bootstrap-home/.local/state/fnm_multishells/3156_1794038432133/bin/node version=v24.22.2` | not applicable |
| The `agro` shebang has a pinned Node | `pinned_node=/tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/agro/node -> /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/fnm/node-versions/v24.22.2/installation/bin/node` | not applicable |
| `agro` runs with a minimal `PATH` | `0.28.0` | `agro_version_exit=0` |
| The pinned Node runs through the link | `v24.22.2` | `pinned_node_version_exit=0` |
| `unzip` is present after the install | `UnZip 6.00 of 20 April 2009, by Debian. Original by Info-ZIP.` | `unzip_exit=0` |
| `~/.nvm` is absent | `nvm_dir=ABSENT` | not applicable |
| The container command passes | `docker_run_exit=0` | 0 |

## A. Fresh install in a clean container

Prerequisites: a host with Docker and a checkout of this branch. Runs on the host, local.

1. Build the candidate bundle from the repository root on the host:

   ```bash
   npm --prefix .agro/cli run build
   ```

   Expected output ends with `⚡ Done in 64ms`. The time changes for each run. Expected exit status: 0.

2. Run the install in a `--rm` container from the repository root on the host. The container mounts the repository read-only at `/src`. The agent set `SCRATCH` to the session scratchpad directory. The output goes to a log in a new temp directory on the host:

   ```bash
   TMP=$(mktemp -d -p "$SCRATCH")
   docker run --rm \
     -e AGRO_ASSUME_YES=1 \
     -v "$PWD:/src:ro" \
     debian:bookworm-slim \
     bash -lc '
       set -euo pipefail
       apt-get update
       apt-get install -y --no-install-recommends curl ca-certificates bash
       if command -v node >/dev/null 2>&1; then echo "node unexpectedly present: $(command -v node)"; exit 1; fi
       echo "node_before=ABSENT"
       if command -v unzip >/dev/null 2>&1; then echo "unzip unexpectedly present: $(command -v unzip)"; exit 1; fi
       echo "unzip_before=ABSENT"
       echo "curl=$(command -v curl)"
       dpkg-query -W -f="\${Package} \${Version}\n" ca-certificates
       WORK=$(mktemp -d)
       echo "WORK=$WORK"
       smoke_rc=0
       bash /src/.agro/scripts/cli-first-install-smoke.sh --phase bootstrap --bootstrap-without-node --bundle /src/.agro/cli/dist/agro.js --workdir "$WORK" --keep || smoke_rc=$?
       echo "smoke_exit=$smoke_rc"
       [ "$smoke_rc" = 0 ] || exit "$smoke_rc"
       unzip_rc=0
       unzip_out=$(unzip -v) || unzip_rc=$?
       printf "%s\n" "$unzip_out" | sed -n 1p
       echo "unzip_exit=$unzip_rc"
       H="$WORK/bootstrap-home"
       if ls -d "$H/.nvm" 2>&1; then echo "nvm_dir=PRESENT"; exit 1; else echo "nvm_dir=ABSENT"; fi
       ls -l "$H/.local/share/agro/node"
       head -1 "$H/.local/bin/agro"
       agro_rc=0
       env -i HOME="$H" PATH=/usr/bin:/bin "$H/.local/bin/agro" --version || agro_rc=$?
       echo "agro_version_exit=$agro_rc"
       NODE_REAL=$(readlink "$H/.local/share/agro/node")
       echo "readlink_node=$NODE_REAL"
       node_rc=0
       "$H/.local/share/agro/node" --version || node_rc=$?
       echo "pinned_node_version_exit=$node_rc"
       [ "$agro_rc" = 0 ] && [ "$node_rc" = 0 ] && [ "$unzip_rc" = 0 ]
     ' > "$TMP/out.log" 2>&1
   RC=$?
   echo "docker_run_exit=$RC" | tee -a "$TMP/out.log"
   ```

   Expected exit status: 0.

   The command captures `unzip -v` in a variable, so `unzip_exit` records the status of `unzip` itself.

   The output below is the observed output, byte for byte, with ANSI color codes and carriage returns. Each `[apt output removed: ...]` line marks removed apt output and names the removed lines of the 241-line log. The removed lines hold no mention of `unzip` or `nodejs` before the `Installing unzip` banner. The last line comes from the `tee` on the host.

   ```text
   Unable to find image 'debian:bookworm-slim' locally
   bookworm-slim: Pulling from library/debian
   dd051e1b8c92: Pulling fs layer
   dd051e1b8c92: Download complete
   91fa335226d3: Download complete
   dd051e1b8c92: Pull complete
   Digest: sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
   Status: Downloaded newer image for debian:bookworm-slim
   [apt output removed: lines 9-143, apt-get update and apt-get install of curl, ca-certificates, bash]
   node_before=ABSENT
   unzip_before=ABSENT
   curl=/usr/bin/curl
   ca-certificates 20250419~deb12u2
   WORK=/tmp/tmp.a4X7MfadXw
   === bootstrap ===
   node_before=ABSENT
   
   [0;36m╔══════════════════════════════════════╗[0m
   [0;36m║       AGRO — install 'agro' CLI      ║[0m
   [0;36m╚══════════════════════════════════════╝[0m
   
   
   [0;36m==> Checking Node.js[0m
   [1;33mWARN: Node.js not found (need >= 22 to run 'agro')[0m
   
   [0;36m==> Installing fnm + Node 24[0m
   
   [0;36m==> Installing unzip[0m
   [apt output removed: lines 163-171, apt-get update and package resolution]
   The following NEW packages will be installed:
     unzip
   0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.
   [apt output removed: lines 175-176, download size]
   Get:1 http://deb.debian.org/debian-security bookworm-security/main amd64 unzip amd64 6.0-28+deb12u1 [167 kB]
   [apt output removed: lines 178-183, unpack progress]
   Setting up unzip (6.0-28+deb12u1) ...
   `--force-install`: I hope you know what you're doing.
   Checking dependencies for the installation script...
   Checking availability of curl... OK!
   Checking availability of unzip... OK!
   Downloading https://github.com/Schniz/fnm/releases/download/v1.39.0/fnm-linux.zip...
   #=#=#                                                                         ######################################################################## 100.0%
   Installing Node v24.22.2 (x64)
   
   Using Node v24.22.2
   [0;32m ✓  Added fnm setup to /tmp/tmp.a4X7MfadXw/bootstrap-home/.profile (for new shells)[0m
   [0;32m ✓  Node.js v24.22.2 — OK[0m
   
   [0;36m==> Fetching the 'agro' CLI[0m
   [0;32m ✓  Downloaded prebuilt 'agro' from file:///src/.agro/cli/dist/agro.js[0m
   
   [0;36m==> Installing 'agro' to /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/bin/agro[0m
   [0;32m ✓  Pinned the 'agro' shebang to /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/agro/node -> /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/fnm/node-versions/v24.22.2/installation/bin/node[0m
   [0;32m ✓  Installed /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/bin/agro[0m
   [0;32m ✓  Added /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/bin to PATH in /tmp/tmp.a4X7MfadXw/bootstrap-home/.profile (for new shells)[0m
   
   [0;36m==> Done[0m
   [0;32m ✓  agro 0.28.0[0m
   
   Next steps:
     agro sandbox install docker   # create and start a sandbox (needs Docker + Compose)
     agro shell <name>             # open a shell in it
     agro tool install herdr       # then run: herdr
     agro update                   # upgrade this installed CLI later
   
   'agro' is a single file at /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/bin/agro — nothing was cloned or built.
   
   [1;33m╔══════════════════════════════════════════════════════════════╗[0m
   [1;33m║  ACTION REQUIRED — activate 'agro' in your CURRENT shell      ║[0m
   [1;33m╚══════════════════════════════════════════════════════════════╝[0m
     '/tmp/tmp.a4X7MfadXw/bootstrap-home/.local/bin' is on PATH for NEW shells. For THIS shell, run:
   
       [0;32mexport PATH="/tmp/tmp.a4X7MfadXw/bootstrap-home/.local/bin:$PATH"[0m
   
     …or just open a new terminal.
   pinned_node=/tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/agro/node -> /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/fnm/node-versions/v24.22.2/installation/bin/node
   bootstrap_agro=/tmp/tmp.a4X7MfadXw/bootstrap-home/.local/bin/agro
   bootstrap_version=0.28.0
   node_after=/tmp/tmp.a4X7MfadXw/bootstrap-home/.local/state/fnm_multishells/3156_1794038432133/bin/node version=v24.22.2
   cli-first-install-smoke: phase bootstrap complete
   smoke_exit=0
   UnZip 6.00 of 20 April 2009, by Debian. Original by Info-ZIP.
   unzip_exit=0
   ls: cannot access '/tmp/tmp.a4X7MfadXw/bootstrap-home/.nvm': No such file or directory
   nvm_dir=ABSENT
   lrwxrwxrwx 1 root root 96 Nov  7 08:00 /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/agro/node -> /tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/fnm/node-versions/v24.22.2/installation/bin/node
   #!/tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/agro/node
   0.28.0
   agro_version_exit=0
   readlink_node=/tmp/tmp.a4X7MfadXw/bootstrap-home/.local/share/fnm/node-versions/v24.22.2/installation/bin/node
   v24.22.2
   pinned_node_version_exit=0
   docker_run_exit=0
   ```

## B. Failure path: Node is present

Prerequisites: a host with Node on `PATH`. Runs on the host, local.

1. Run the smoke script with `--bootstrap-without-node` from the repository root on the host. The command writes to a new directory under `$TMP`:

   ```bash
   bash .agro/scripts/cli-first-install-smoke.sh --phase bootstrap --bootstrap-without-node --bundle .agro/cli/dist/agro.js --workdir "$TMP/failpath" --keep
   ```

   Observed output:

   ```text
   === bootstrap ===
   cli-first-install-smoke: bootstrap-without-node requires node to be absent (found /home/sandbox/.nvm/versions/node/v24.22.2/bin/node)
   ```

   Observed exit status: 1. The script stops before it runs `install.sh`. The work directory holds only `manifest`.

## C. Cleanup

Runs on the host, local.

1. Delete the temp directory on the host. The directory holds the log and the work directory from section B:

   ```bash
   rm -rf "$TMP"
   ```

   Observed result: `ls -d` on the directory reports `No such file or directory`.

2. List the containers from the image:

   ```bash
   docker ps -a --filter ancestor=debian:bookworm-slim
   ```

   Observed output holds the header line and no container. The `--rm` flag deleted the container and the container work directory `/tmp/tmp.a4X7MfadXw`.

The run pulled `debian:bookworm-slim` into the image cache of the host, because the image was not on the host before the run. The agent did not delete the image.
