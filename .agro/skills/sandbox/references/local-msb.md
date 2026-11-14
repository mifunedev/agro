# local/msb

## Choose when

Use Microsandbox (`msb`) for one command with a separate kernel on the host running `agro`.
This route is not the remote validation adapter named `msb`.
That adapter creates a console node and a guest for validation.

## Prerequisites

- Run on the host, not inside a sandbox.
- Confirm that `agro run --help` supports `--isolation microvm`.
- `msb --version` must report exactly 0.7.13.
- The host user must have read/write access to `/dev/kvm`.
- The configuration must not declare services or `access.egress: "allowlist"`.
  MicroVM mode refuses both settings.
- Select the image in this order: `--image <ref>`, `run.microvm.image`,
  then `ghcr.io/mifunedev/agro:<version>-msb` for the CLI version.

## Execute

Run from the intended host working directory:

```bash
agro run --isolation microvm -- sh -c 'id -un; exit 7'
```

The command runs as the guest user `sandbox` in the current directory.
The writable mount is the Git repository root at the same path.
Outside a repository, the writable mount is the current directory.
The command forwards no host environment, home directory, Docker socket, or host credentials.
Image contents and credentials already inside the checkout remain accessible.
Workspace writes survive the disposable guest.
There is no implicit shell; pass `sh -c` for shell operators.

For an existing guest, first confirm that `agro run --help` advertises `--sandbox`.
Only then use `agro run --isolation microvm --sandbox <name> -- <command...>`.
This mode checks msb 0.7.13 but not KVM access.
It uses the guest workspace and default working directory, with no host mounts.
It applies no `run.services`, `run.env`, or `access.egress` configuration.
It neither changes the guest lifecycle nor writes a usage-log entry.

## Verify

The example prints `sandbox` and exits 7. Record the actual exit code.
Disposable execution appends a JSON line to `${AGRO_HOME:-~/.agro}/runs/microvm.jsonl`.
The fields are `time`, `image`, `digest`, `bootToExitMs`, and `exitCode`.
The digest can be null when image inspection cannot supply it.
A usage-log write failure prints a warning without changing the command exit code.

Inspect actual host file modes after guest writes; do not infer modes from guest metadata.
Historical tests with msb 0.7.13 in the tested guest configuration observed host file mode 600 and directory mode 700.
The host file lost its executable bit.
Those tests observed guest owner/mode storage in `user.msb.override_stat` extended attributes.
These observations are not a new live verification or a guarantee for other configurations.

## Cleanup

`agro run` owns the disposable guest lifecycle.
Its finally cleanup calls `msb rm --force` for the per-run `agro-run-<id>` guest.
Removal failures print warnings. Record the exact guest name and the cleanup failure.
Do not replace this lifecycle with raw msb create/run/remove commands.
Existing-guest execution leaves the guest running. Command writes persist.

## Failure remedies

Setup failures exit 1 with a remedy.
For a version mismatch, use the approved `agro tool install microsandbox` procedure and retain the exact 0.7.13 pin.
For KVM permission errors, the operator can add the host user to `kvm` and start a new login session.
Do not install tools or change host groups without authority.
For unsupported services or allowlists, stop and ask for a supported route.
Do not silently fall back to host execution or weaker isolation after a refusal.
