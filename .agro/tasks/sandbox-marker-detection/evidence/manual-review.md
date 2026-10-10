# Manual review: sandbox marker detection

Date: 2026-10-03. Branch build at `3df94900`. Runs inside the AGRO sandbox, local.

## Environment

```text
$ ls /etc/agro/sandbox
ls: cannot access '/etc/agro/sandbox': No such file or directory
exit=2

$ test -e /.dockerenv && echo "/.dockerenv present"
/.dockerenv present
exit=0

$ test -n "$SANDBOX_NAME" && echo "SANDBOX_NAME is set"
SANDBOX_NAME is set
exit=0

```

This sandbox has no marker, so the runs below prove the fallback path. The unit tests prove the marker path.

## Probe

```text
$ node .agro/cli/dist/agro.js sandbox list
agro: warning: /etc/agro/sandbox is missing; detected the sandbox from /.dockerenv and SANDBOX_NAME. Upgrade the sandbox image.
no sandbox is registered in /home/sandbox/.agro/sandboxes — create one with `agro sandbox install docker`
exit=0

$ node .agro/cli/dist/agro.js sandbox upgrade zz-detect-probe --version 0.16.2
agro: warning: /etc/agro/sandbox is missing; detected the sandbox from /.dockerenv and SANDBOX_NAME. Upgrade the sandbox image.
agro sandbox upgrade: host-only — run this command on the host
exit=1

$ AGRO_EXECUTION_TARGET=docker-compose node .agro/cli/dist/agro.js sandbox upgrade zz-detect-probe --version 0.16.2
agro sandbox upgrade: no sandbox entry named "zz-detect-probe"
exit=1

$ ls /home/sandbox/.agro/sandboxes/zz-detect-probe
ls: cannot access '/home/sandbox/.agro/sandboxes/zz-detect-probe': No such file or directory
exit=2

```
