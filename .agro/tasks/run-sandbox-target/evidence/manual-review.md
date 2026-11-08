# US-005 manual review: agro run --sandbox

Host: exe.dev VM. Branch: `feat/1600-run-sandbox-target` at `0acb02ca`. Date: 2026-11-08.
The worker created no sandbox, started none, stopped none, and deleted none.

## Build

```text
$ npm --prefix .agro/cli run build
  dist/agro.js  358.5kb
⚡ Done in 40ms
exit=0
```

`git status --short` after the build: empty (no tracked file changed).

## Precheck

```text
$ msb --version
msb 0.7.13
exit=0

$ msb inspect agro-console
Name:                 agro-console
Status:               running
Image:                ghcr.io/mifunedev/agro:0.33.0-msb
Workdir:              /home/sandbox
(remaining lines trimmed)
exit=0
```

## Live run

```text
$ node .agro/cli/dist/agro.js run --isolation microvm --sandbox agro-console -- ls /home/sandbox
agro-console
harness
install
exit=0

$ node .agro/cli/dist/agro.js run --isolation microvm --sandbox agro-console -- sh -c 'exit 7'
exit=7

$ node .agro/cli/dist/agro.js run --sandbox run-sandbox-target-missing-1794122036 -- true
agro run: no sandbox named `run-sandbox-target-missing-1794122036` in /home/exedev/.agro/sandboxes — create one with `agro sandbox install docker --name run-sandbox-target-missing-1794122036`
exit=1

$ node .agro/cli/dist/agro.js run --sandbox agro-console --image alpine -- true
agro run: --image cannot be combined with --sandbox
exit=1
```

## After the run

```text
$ msb ls
NAME            IMAGE                                      STATUS     CREATED
agro-console    ghcr.io/mifunedev/agro:0.33.0-msb          running    2026-11-08 06:43:28
sandbox         ghcr.io/ryaneggz/msb-ubuntu-dind:latest    running    2026-10-27 23:54:02
exit=0
```

`agro-console` is still `running` with the same CREATED time. The not-running message path was not run live, because the worker did not stop the VM; unit tests in `run.test.ts` cover it.
