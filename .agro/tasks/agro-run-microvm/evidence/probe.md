# msb probe on this host

The worker ran this probe on the VM host on 2026-11-08 for US-001. The host user is `sandbox` (uid 1001, gid 1001). The host umask is `0077`. The login session predates the `kvm` group change, so each `msb run` ran through `sg kvm`.

## Version and KVM access

- `msb --version`: `msb 0.7.13`.
- `sg kvm -c 'test -r /dev/kvm -a -w /dev/kvm && echo ok'`: `ok`.
- `ls -l /dev/kvm`: `crw-rw---- 1 root kvm 10, 232`.
- `msb doctor` without `sg kvm`: `error: /dev/kvm is not accessible by your user` and `you are in the 'kvm' group, but this login session predates the change`.

## Image build

- `docker build --target agro-msb -f .devcontainer/Dockerfile -t agro-msb-probe:1590 .`: exit 0 in 38 s, with most layers from the cache.
- Image ID: `sha256:63c28fdd17f57191a5f20615e70f9fe917de9f70a07280e4df7fe70aeed5da39`. Size: 2165585157 bytes.
- `Config.Cmd`: `["sleep","infinity"]`. `Config.WorkingDir`: `/home/sandbox/harness`. The image sets no user, so the default guest user is root.

## Image source methods

1. Exported root filesystem (`docker create`, then `docker export` into a temporary directory, then `msb run <dir>`):
   - Extracted as root with `sudo tar -x`: `msb run` failed with `guest initialization failed: init failed: init error: failed to write /etc/hosts: Permission denied (os error 13)`. The msb process runs as uid 1001 and cannot write root-owned host files.
   - Extracted as `sandbox` with `tar -x --no-same-owner`: `msb run` ran the command and passed exit 7 through. The guest showed `drwx------ 53 1001 docker /etc` and `drwx------ 3 1001 docker /home/sandbox`. The export loses the image ownership and modes, so the guest user `sandbox` has no read access to `/etc`. This method does not work for the `agro-msb` image.
2. Local registry (`docker run -d -p 127.0.0.1:5000:5000 registry:2`, then `docker push localhost:5000/agro-msb-probe:1590`):
   - `msb run localhost:5000/agro-msb-probe:1590`: `error: image error: registry error: error sending request for url (https://localhost:5000/v2/agro-msb-probe/manifests/1590)`. `msb run` has no insecure-registry flag.
   - `msb pull --insecure localhost:5000/agro-msb-probe:1590`: `Pulled ... (4.8s)`. Then `msb run --pull never localhost:5000/agro-msb-probe:1590 -- sh -c 'id; pwd; exit 7'` printed `uid=0(root)`, `/home/sandbox/harness`, and exited 7. This method works.
3. Image archive (`docker save agro-msb-probe:1590 | msb load -t agro-msb-probe:1590`):
   - The load printed `Loaded agro-msb-probe:1590` in 10.3 s. `msb image ls` showed `agro-msb-probe:1590` at 521.7 MiB. This method works without a registry. Each later probe run used this image.

## Guest user, working directory, and exit code

`msb run` has the flag `-u, --user <USER>`. Command:

```sh
sg kvm -c "msb run -n probe-a --pull never -u sandbox -v $T:$T -w $T agro-msb-probe:1590 -- sh -c 'id; pwd; ls -ln; touch guestfile; echo w=\$?; exit 7'"
```

Output:

```text
uid=1000(sandbox) gid=1000(sandbox) groups=1000(sandbox),1001(docker)
/tmp/claude-1001/-home-sandbox--agro-workspaces-harness/52539110-46e1-45b6-b664-72deb33726e0/scratchpad/mnt-a
total 4
-rw------- 1 1000 1000 5 Nov  7 17:04 hostfile
w=0
exit=7
```

`$T` is a temporary test directory. The mount is at the host path, and `-w` sets the working directory to that path. The exit code 7 passes through `msb run`. The run needs no `--init`: agentd runs the command directly, and the image `CMD` does not start.

## File ownership on the host

| msb process groups | mount option | guest view of a host file | host owner of a guest file |
| --- | --- | --- | --- |
| `sg kvm` (primary gid 993 `kvm`) | none | `1000 1000` | `1001 993` |
| `sg kvm -c 'sg sandbox -c ...'` (primary gid 1001) | none | `1000 1000` | `1001 1001` |
| `sg kvm -c 'sg sandbox -c ...'` | `uid=1000,gid=1000` | `1000 1000` | `1001 1001` |
| `sg kvm -c 'sg sandbox -c ...'` | `uid=1001,gid=1001` | `ls: cannot access 'hostfile': Permission denied` | no file (`cannot create run.sh: Permission denied`) |

- The host owner of a guest file is the uid and the primary gid of the msb process. No mount option changes the host owner.
- Without a mount option, the guest shows the guest user of the run as the owner of each host file. With `-u sandbox`, the owner is 1000. Without `-u`, the owner is 0.
- The option `uid=1001,gid=1001` presents host files as guest uid 1001, so the guest user 1000 cannot read or write the host files. Do not use this option.
- `id` inside `sg kvm -c 'sg sandbox -c id'`: `uid=1001(sandbox) gid=1001(sandbox) groups=1001(sandbox),27(sudo),987(docker),993(kvm)`. `/dev/kvm` opens for read and write in this form.

## File modes on the host

The guest umask is `0022` for root and for `sandbox`. The guest created `f644` (mode 644), `d755` (mode 755), and `run.sh` after `chmod 755`. The guest showed `-rw-r--r--`, `drwxr-xr-x`, and `-rwxr-xr-x`. The host showed `-rw-------`, `drwx------`, and `-rw-------` for the same paths, also with host umask `022` before `msb run`. msb stores the guest owner and mode in the extended attribute `user.msb.override_stat` (for `f644`: uid `0x3e8`, gid `0x3e8`, mode `0o100644`). The host loses the executable bit of a file that the guest makes executable.

## Output streams

`sh -c 'echo out; echo err >&2'` with `2>/dev/null` printed `out`. With `1>/dev/null`, it printed `err`. `msb run` keeps stdout and stderr separate.

## Timings

The command for each run was the US-002 argv below with `-q` and `sh -c 'id -un; exit 7'`. The image was in the msb cache. Each run used the default resources (1 vCPU, 512 MiB).

| run | exit code | boot-to-exit wall time | `msb rm --force` time |
| --- | --- | --- | --- |
| 1 | 7 | 1370 ms | 14 ms |
| 2 | 7 | 1416 ms | 15 ms |
| 3 | 7 | 1386 ms | 15 ms |

## Cleanup

- `msb run` leaves each sandbox in state `stopped` after the command exits. `msb ls` showed `probe-alpine    alpine    stopped` after a run. `msb run` has no flag that removes the sandbox. `msb rm --force <name>` printed `Removed <name>`.
- After the probe, `msb ls` printed `No sandboxes found.` and `msb image ls` printed `No images found.`
- The worker removed the registry container `probe-registry-1590`, the images `agro-msb-probe:1590`, `localhost:5000/agro-msb-probe:1590`, and `registry:2`, the msb images `agro-msb-probe:1590`, `localhost:5000/agro-msb-probe:1590`, and `alpine`, and the temporary directories.

## Design inputs for US-002

- Argument vector:

  ```sh
  msb run -q -n <name> --pull never -u sandbox -v <worktree>:<worktree> -w <worktree> <image> -- <command...>
  ```

  Add `-c <cpus>` and `-m <memory>` only when a step needs more than 1 vCPU and 512 MiB. Do not use `--init`.
- User selection: `-u sandbox`. The guest user is uid 1000, gid 1000.
- Mount options: none. A guest file has the host owner 1001:1001 only when the msb process runs with primary gid 1001. A new login session after the `kvm` group change gives this result. In the current session, use `sg kvm -c 'sg sandbox -c "<msb argv>"'`. Host files that the guest creates have mode 600 or 700 on the host, and the host loses the executable bit.
- Image source: a registry reference works directly over HTTPS. For a local build, use `docker save <image> | msb load -t <ref>`, then `msb run --pull never <ref>`. A local plain-HTTP registry needs `msb pull --insecure <ref>` before `msb run --pull never <ref>`. An exported root filesystem does not work.
- Cleanup: `msb rm --force <name>` after each run, also after a failure. The removal takes about 15 ms.
- Timings: boot-to-exit 1370 ms, 1416 ms, and 1386 ms with a cached image. `docker save | msb load` took 10.3 s for the 2.17 GB image. `msb pull --insecure` from a local registry took 4.8 s.
