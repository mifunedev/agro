# US-003 manual review

## Scope

The reviewer receives this command transcript for advisor acceptance.
The worker ran the built CLI inside the existing amd64 sandbox at `a61e768f`.
The branch was `feat/1610-aws-gws-tool-install`.
This run exercises the host-fallback path inside the sandbox, not container installation.
The downloads and installed executables are real upstream artifacts.
No fixture supplies a successful installation.

The run uses the documented `AGRO_EXECUTION_TARGET=docker-compose` override.
`DOCKER_HOST` names a nonexistent socket inside the temporary directory.
No command starts, stops, or mutates Docker.
No command performs login, cloud API calls, or signing-key operations.
No command reads or writes actual credentials.

## Affected surfaces

- Host and sandbox: applied. Commands run inside the sandbox with isolated host-fallback state.
- Lifecycle door: applied. All tool operations use the built CLI entry point.
- Canonical and provider surfaces: applied to this canonical evidence file. Provider changes are not applicable.
- Root and scaffold: applied to evidence in the main task checkout. Scaffold changes are not applicable.
- Interactive and headless processes: not applicable. The run starts no persistent service.
- Local and remote operation: applied to the existing host-fallback path. No remote VM test runs here.
- Parallel operation: not applicable. This worker runs alone in the assigned main checkout.
- Public documentation: not applicable. US-002 owns documentation.
- Verification: applied through the transcript and checks below.

## Setup

All commands run from `/home/sandbox/harness`.
The initial tracked working tree was clean.
`git rev-parse --short=8 HEAD` returned `a61e768f`; exit 0.
`git branch --show-current` returned `feat/1610-aws-gws-tool-install`; exit 0.
`dpkg --print-architecture` returned `amd64`; exit 0.
`node --version` returned `v24.22.1`; exit 0.

```sh
/home/sandbox/.local/bin/aws --version
sha256sum /home/sandbox/.local/bin/aws
mktemp -d /tmp/agro-us003.XXXXXXXX
```

Observed output, in order; each command exited 0:

```text
aws-cli/2.38.5 Python/3.14.8 Linux/6.18.58.1-microsoft-standard-WSL2 script-exe/x86_64.debian.13
84958b12b8c1d794ba565acec08444cba19704e3e484d38eb45c60c51772460d  /home/sandbox/.local/bin/aws
/tmp/agro-us003.WNWUP9lC
```

```sh
test ! -e /tmp/agro-us003.WNWUP9lC/workspace
mkdir -p /tmp/agro-us003.WNWUP9lC/home /tmp/agro-us003.WNWUP9lC/state /tmp/agro-us003.WNWUP9lC/tmp /tmp/agro-us003.WNWUP9lC/workspace/.git
```

Both commands exited 0 with no output.
The workspace input path did not exist before setup.
Setup creates a new local workspace with an empty `.git` directory marker.
The CLI requires an existing workspace; setup performs no clone.
The temporary home and AGRO state start empty.
The worker writes no environment file.

## Command notation

The transcript uses `E` below only to shorten repeated inline assignments.
For each recorded CLI or executable command, replace `E` with this exact prefix:

```sh
HOME=/tmp/agro-us003.WNWUP9lC/home AGRO_HOME=/tmp/agro-us003.WNWUP9lC/state XDG_CONFIG_HOME=/tmp/agro-us003.WNWUP9lC/home/.config TMPDIR=/tmp/agro-us003.WNWUP9lC/tmp AGRO_EXECUTION_TARGET=docker-compose DOCKER_HOST=unix:///tmp/agro-us003.WNWUP9lC/no-docker.sock PATH=/tmp/agro-us003.WNWUP9lC/home/.local/bin:/usr/local/bin:/usr/bin:/bin
```

`E` is transcript notation, not a shell variable, wrapper, or environment file.
The worker passed these assignments inline on every CLI command.
The CLI derives its installation prefix from the temporary `HOME`.
`TMPDIR` contains installer staging directories.

## Transcript

### Help

```sh
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool --help
```

Exit 0. The help lists `aws` and `gws` under installable tools, host tools, and tools.
The help includes `list`, `status`, `install`, and `uninstall` usage.
The help states that host installs require an existing workspace and use `~/.local` with recorded receipts.

### Real AWS installation

```sh
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool install aws --host --path /tmp/agro-us003.WNWUP9lC/workspace --yes
```

Exit 0. Observed output excerpt:

```text
/tmp/agro-us003.WNWUP9lC/tmp/tmp.nRiDjcpf3Z/aws.zip: OK
You can now run: /tmp/agro-us003.WNWUP9lC/home/.local/bin/aws --version
```

The CLI reports installation at `/tmp/agro-us003.WNWUP9lC/home/.local`.
The installer downloads the official AWS ZIP and checks its pinned SHA-256 before extraction.
The real installer reports `OK`; the catalog verifies the absolute installed executable's version before recording success.
See `artifact-integrity.md` for the exact upstream URLs and digest pins.
The vendor also prints an authentication setup tip. The worker does not execute that tip.

```sh
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool status aws
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool install aws --host --path /tmp/agro-us003.WNWUP9lC/workspace --yes
E /tmp/agro-us003.WNWUP9lC/home/.local/bin/aws --version
readlink /tmp/agro-us003.WNWUP9lC/home/.local/bin/aws
readlink /tmp/agro-us003.WNWUP9lC/home/.local/bin/aws_completer
```

Each command exited 0. Status output:

```text
TOOL  KIND         INSTALLED
aws   installable  yes

INSTALLED reports the host prefix /tmp/agro-us003.WNWUP9lC/home/.local — the sandbox is not running.

aws — AWS CLI v2
  version:    aws-cli/2.40.1 Python/3.14.8 Linux/6.18.58.1-microsoft-standard-WSL2 exe/x86_64.debian.13
  installable: yes
  on the host: yes
  see https://github.com/mifunedev/agro/blob/main/docs/installation.md
```

Repeat-install output:

```text
host workspace /tmp/agro-us003.WNWUP9lC/workspace
aws: already installed (aws)
```

The repeat command performs no download. Absolute version output:

```text
aws-cli/2.40.1 Python/3.14.8 Linux/6.18.58.1-microsoft-standard-WSL2 exe/x86_64.debian.13
```

Launcher targets, in order:

```text
/tmp/agro-us003.WNWUP9lC/home/.local/lib/aws-cli/v2/current/bin/aws
/tmp/agro-us003.WNWUP9lC/home/.local/lib/aws-cli/v2/current/bin/aws_completer
```

### Unknown-tool failure

```sh
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool install unknown-us003 --host --path /tmp/agro-us003.WNWUP9lC/workspace --yes
```

Exit 1. Output begins:

```text
agro tool: unknown tool "unknown-us003"

Known tools:
```

The output lists all 13 catalog tool IDs, including `aws` and `gws`.

### Real GWS installation

```sh
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool install gws --host --path /tmp/agro-us003.WNWUP9lC/workspace --yes
```

Exit 0. Observed output:

```text
host workspace /tmp/agro-us003.WNWUP9lC/workspace
installing Google Workspace CLI on the host…
/tmp/agro-us003.WNWUP9lC/tmp/tmp.YN3d9jPfEM/gws.tar.gz: OK
gws: installed at /tmp/agro-us003.WNWUP9lC/home/.local — see https://github.com/mifunedev/agro/blob/main/docs/installation.md
Run gws from the AGRO workspace: cd /tmp/agro-us003.WNWUP9lC/workspace
```

The real catalog installer verifies the pinned SHA-256 before extraction.
The installer verifies the absolute executable's first version line before recording success.

```sh
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool list
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool status gws
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool install gws --host --path /tmp/agro-us003.WNWUP9lC/workspace --yes
E /tmp/agro-us003.WNWUP9lC/home/.local/bin/gws --version
```

Each command exited 0. List output:

```text
TOOL           KIND                INSTALLED
agent-browser  installable         no
herdr          installable         no
cloudflared    installable         no
microsandbox   installable         no
docker-cli     baked-in            yes
gh             baked-in            yes
tailscale      installable         no
code-server    installable         no
ffmpeg         installable         no
docker-engine  installable (root)  no
desktop        installable (root)  no
aws            installable         yes
gws            installable         yes

(root) installs on the host as root through `sudo -n`.

INSTALLED reports the host prefix /tmp/agro-us003.WNWUP9lC/home/.local — the sandbox is not running.
```

Status output:

```text
TOOL  KIND         INSTALLED
gws   installable  yes

INSTALLED reports the host prefix /tmp/agro-us003.WNWUP9lC/home/.local — the sandbox is not running.

gws — Google Workspace CLI
  version:    gws 0.22.5
  installable: yes
  on the host: yes
  see https://github.com/mifunedev/agro/blob/main/docs/installation.md
```

Repeat-install output:

```text
host workspace /tmp/agro-us003.WNWUP9lC/workspace
gws: already installed (gws)
```

The repeat command performs no download. Absolute version output:

```text
gws 0.22.5
This is not an officially supported Google product.
```

The worker read only the temporary `/tmp/agro-us003.WNWUP9lC/state/config.json` through the file reader.
The config contained receipts for both binaries, the temporary prefix, and the temporary workspace root.
The receipts recorded `installedAt` values `2026-11-12T01:02:27.341Z` and `2026-11-12T01:03:28.314Z` for AWS and GWS.

### Uninstall

```sh
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool uninstall aws
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool uninstall gws
```

Both commands exited 0. Output:

```text
removing AWS CLI v2 from /tmp/agro-us003.WNWUP9lC/home/.local…
aws: removed from /tmp/agro-us003.WNWUP9lC/home/.local
aws: cleared the host install record
removing Google Workspace CLI from /tmp/agro-us003.WNWUP9lC/home/.local…
gws: removed from /tmp/agro-us003.WNWUP9lC/home/.local
gws: cleared the host install record
```

```sh
test ! -e /tmp/agro-us003.WNWUP9lC/home/.local/bin/aws && test ! -L /tmp/agro-us003.WNWUP9lC/home/.local/bin/aws && test ! -e /tmp/agro-us003.WNWUP9lC/home/.local/bin/aws_completer && test ! -L /tmp/agro-us003.WNWUP9lC/home/.local/bin/aws_completer && test ! -e /tmp/agro-us003.WNWUP9lC/home/.local/lib/aws-cli && test ! -e /tmp/agro-us003.WNWUP9lC/home/.local/bin/gws
```

Exit 0 with no output. Both launchers, the AWS payload, and GWS are absent.

### Offline unsupported-architecture fixture

This fixture is not a real architecture test or an upstream installation.
The actual machine remains amd64.
The worker created `/tmp/agro-us003.WNWUP9lC/fixture/dpkg` through the file writer with these exact bytes:

```sh
#!/bin/sh
printf '%s\n' riscv64
```

```sh
chmod 0755 /tmp/agro-us003.WNWUP9lC/fixture/dpkg
```

Exit 0 with no output.
For the next two commands only, `F` means the same inline assignments as `E`, except for this replacement `PATH`:

```sh
PATH=/tmp/agro-us003.WNWUP9lC/fixture:/tmp/agro-us003.WNWUP9lC/home/.local/bin:/usr/local/bin:/usr/bin:/bin
```

```sh
F node /home/sandbox/harness/.agro/cli/dist/agro.js tool install aws --host --path /tmp/agro-us003.WNWUP9lC/workspace --yes
F node /home/sandbox/harness/.agro/cli/dist/agro.js tool install gws --host --path /tmp/agro-us003.WNWUP9lC/workspace --yes
```

Each command exited 1. Output:

```text
host workspace /tmp/agro-us003.WNWUP9lC/workspace
installing AWS CLI v2 on the host…
no pinned AWS CLI build for riscv64
agro tool: installing aws failed (exit 1).
host workspace /tmp/agro-us003.WNWUP9lC/workspace
installing Google Workspace CLI on the host…
no pinned Google Workspace CLI build for riscv64
agro tool: installing gws failed (exit 1).
```

```sh
test ! -e /tmp/agro-us003.WNWUP9lC/home/.local/bin/aws && test ! -e /tmp/agro-us003.WNWUP9lC/home/.local/bin/gws && test ! -e /tmp/agro-us003.WNWUP9lC/home/.local/lib/aws-cli
```

Exit 0 with no output. The fixture creates no installed binary or payload.
The worker read the temporary config again. The complete final config was:

```json
{
  "version": 1,
  "harnessRoot": "/tmp/agro-us003.WNWUP9lC/workspace",
  "hostTools": {}
}
```

Neither failure creates a receipt.
Source inspection confirms architecture rejection precedes prefix creation, temporary staging, and download in both installers.
The fixture tests that rejection through the full built CLI.
The fixture does not independently instrument network traffic.

### Final status and preservation

```sh
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool status aws
E node /home/sandbox/harness/.agro/cli/dist/agro.js tool status gws
```

Both commands exited 0.
Both report `INSTALLED` as `no`, version `—`, and the same temporary host prefix.

```sh
test ! -e /tmp/agro-us003.WNWUP9lC/home/.aws && test ! -e /tmp/agro-us003.WNWUP9lC/home/.config/gws
test -z "$(/usr/bin/find /tmp/agro-us003.WNWUP9lC/tmp -mindepth 1 -print -quit)"
/home/sandbox/.local/bin/aws --version
sha256sum /home/sandbox/.local/bin/aws
```

Each command exited 0. The first two commands produced no output.
The installer staging directory is empty.
The last two commands reproduce the original AWS version and digest exactly:

```text
aws-cli/2.38.5 Python/3.14.8 Linux/6.18.58.1-microsoft-standard-WSL2 script-exe/x86_64.debian.13
84958b12b8c1d794ba565acec08444cba19704e3e484d38eb45c60c51772460d  /home/sandbox/.local/bin/aws
```

An earlier `test ! -S /tmp/agro-us003.WNWUP9lC/no-docker.sock` also exited 0 with no output.
The run never reads original credentials or the original AGRO config.
Isolation and host routing preserve the original markers without inspecting their contents.
Version-only commands do not request cloud credentials or make cloud API calls.
The real downloads use free public HTTPS artifact endpoints, not cloud resource APIs.

### Cleanup

```sh
rm -r /tmp/agro-us003.WNWUP9lC
test ! -e /tmp/agro-us003.WNWUP9lC
```

Both commands exited 0 with no output.
Cleanup removes only this run's temporary directory, fixture, workspace, state, home, and staging directory.
Cleanup preserves every pre-existing installation, marker, config, and process.

## US-003 criterion mapping

1. Executed: this file records setup, exact command expansions, observed outputs, exit statuses, and cleanup.
2. Executed: `mktemp`, the workspace absence check, and setup establish fresh isolation. Every CLI command receives inline environment values.
3. Executed: the built entry point covers help, list, install, status, repeat-install no-op, and uninstall for both tools.
4. Executed: both real amd64 installers pass checksum verification. Absolute executables report AWS `2.40.1` and GWS `0.22.5`. No cloud API call runs.
5. Executed: the labeled offline `dpkg` fixture rejects `riscv64` through the built CLI for both tools. Both exit 1 without receipts.
6. Executed: original AWS version and digest match before and after. Cleanup deletes only this run's resources. Reasoned: isolated paths preserve original credentials and markers.

The advisor owns acceptance. This worker changes no PRD, tracker, code, or public documentation.

## Artifact checks

`bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/aws-gws-tool-install/evidence/manual-review.md` exits 0 with no findings.
`git diff --check` exits 0.
The worker force-adds only this ignored evidence file and checks the staged diff before committing.
The commit targets the existing local task branch for `origin` (`https://github.com/mifunedev/agro.git`).
The worker performs no push or CI request.
