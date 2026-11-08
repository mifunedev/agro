# agro run microVM validation

The worker ran these steps on the VM host on 2026-11-08 for US-006, from the root of the harness worktree `/home/sandbox/.agro/workspaces/harness/.worktrees/feat/1590-us-006` (branch `feat/1590-us-006`). Each output below is an observed output.

## Setup

Prerequisites: Docker, `msb 0.7.13`, `/dev/kvm`, and the CLI build at `.agro/cli/dist/agro.js` (`agro --version`: `0.31.0`). Runs on the host, local.

The host login session predates the `kvm` group change. `id` printed `groups=1001(sandbox),27(sudo),987(docker)`. Thus each `agro run` command in steps A to D ran as `sg kvm -c 'sg sandbox -c "<cmd>"'`. This form gives the msb process the `kvm` group and the primary gid 1001. The transcript below shows `<cmd>` only.

The published `-msb` image ships at the next release. Thus the worker built and loaded a local image:

1. Build the image:

   ```bash
   docker build --target agro-msb -f .devcontainer/Dockerfile -t agro-msb-local:1590 .
   ```

   Output: `sha256:eec47a44a63dcbc566177fd544d1a0aa05ab86c6bf1f386be5010eaf19bb35ed`, size 2215049575 bytes, in 52 s. Exit status: 0.

2. Load the image into msb:

   ```bash
   docker save agro-msb-local:1590 | sg kvm -c 'msb load -t agro-msb-local:1590'
   ```

   Output: `✓ Loaded              agro-msb-local:1590` in 17.5 s. `msb image ls` printed `agro-msb-local:1590    sha256:25065e689ada    531.1 MiB`. Exit status: 0.

3. Set the usage log location and the command alias:

   ```bash
   export AGRO_HOME=$(mktemp -d <scratchpad>/agro-home-XXXX)
   A="node /home/sandbox/.agro/workspaces/harness/.worktrees/feat/1590-us-006/.agro/cli/dist/agro.js"
   ```

   `AGRO_HOME` was `<scratchpad>/agro-home-Vuo4`. `<scratchpad>` is the session scratchpad directory under `/tmp/claude-1001/`.

## A. Exit code and guest user

1. Run a command that prints the user and exits 7:

   ```bash
   $A run --isolation microvm --image agro-msb-local:1590 -- sh -c 'id; exit 7'
   ```

   Output:

   ```text
   uid=1000(sandbox) gid=1000(sandbox) groups=1000(sandbox),1001(docker)
   ```

   Exit status: 7.

2. Failure path. Run the same command without `sg kvm`:

   ```bash
   $A run --isolation microvm --image agro-msb-local:1590 -- sh -c 'id; exit 7'
   ```

   Output:

   ```text
   agro run: /dev/kvm does not open for read and write; add the user to the kvm group (`sudo usermod -aG kvm $USER`) and start a new login session
   ```

   Exit status: 1. The usage log kept 7 lines.

## B. Boot-to-exit time against the container mode

1. Run `pnpm --version` in the microVM mode 3 times:

   ```bash
   $A run --isolation microvm --image agro-msb-local:1590 -- pnpm --version
   ```

   Each run printed `10.33.0` and exited 0.

2. Run `pnpm --version` in the container mode 3 times:

   ```bash
   $A run -- pnpm --version
   ```

   Each run printed `10.33.0` and exited 0. The container mode used the cached image `ghcr.io/mifunedev/agro:0.31.0`.

| mode | run 1 | run 2 | run 3 | median wall time | median `bootToExitMs` in the usage log |
| --- | --- | --- | --- | --- | --- |
| microVM | 4891 ms | 4817 ms | 4796 ms | 4817 ms | 4722 ms |
| container | 1539 ms | 1514 ms | 1455 ms | 1514 ms | no log line |

The wall time is the time of the full `sg kvm` command, measured with `date +%s%N`. The microVM runs used the default resources (1 vCPU, 512 MiB). The `sh -c` runs in steps A, C, and D had a `bootToExitMs` of 1392 ms to 1478 ms. Thus most of the `pnpm --version` time is Node.js startup in 1 vCPU.

## C. The guest cannot read the host home directory

1. List the host home directory and its subdirectories inside the guest:

   ```bash
   $A run --isolation microvm --image agro-msb-local:1590 -- sh -c 'echo --- ls /home/sandbox/.agro; ls /home/sandbox/.agro 2>&1 | head -2; echo --- ls -A /home/sandbox; ls -A /home/sandbox'
   ```

   Output:

   ```text
   --- ls /home/sandbox/.agro
   workspaces
   --- ls -A /home/sandbox
   .agro
   harness
   ```

   Exit status: 0.

2. List each parent directory of the mounted worktree inside the guest:

   ```bash
   $A run --isolation microvm --image agro-msb-local:1590 -- sh -c 'for d in /home/sandbox/.agro /home/sandbox/.agro/workspaces /home/sandbox/.agro/workspaces/harness /home/sandbox/.agro/workspaces/harness/.worktrees /home/sandbox/.agro/workspaces/harness/.worktrees/feat; do echo "--- $d"; ls -A $d; done; echo --- ls -A /home/sandbox/harness; ls -A /home/sandbox/harness | head -5'
   ```

   Output:

   ```text
   --- /home/sandbox/.agro
   workspaces
   --- /home/sandbox/.agro/workspaces
   harness
   --- /home/sandbox/.agro/workspaces/harness
   .worktrees
   --- /home/sandbox/.agro/workspaces/harness/.worktrees
   feat
   --- /home/sandbox/.agro/workspaces/harness/.worktrees/feat
   1590-us-006
   --- ls -A /home/sandbox/harness
   ```

   Exit status: 0.

3. Count the entries of the same directories on the host with `ls -A <dir> | wc -l`:

   | directory | host entries | guest entries |
   | --- | --- | --- |
   | `/home/sandbox` | 30 | 2 |
   | `/home/sandbox/.agro/workspaces/harness` | 31 | 1 |
   | `/home/sandbox/.agro/workspaces/harness/.worktrees/feat` | 3 | 1 |

The guest home holds only the image directory `harness` (empty) and the parent directories of the worktree mount. Each parent directory holds only the next path segment. No other host file is visible in the guest.

## D. The guest cannot reach the host Docker socket

1. Show the socket on the host:

   ```bash
   ls -l /var/run/docker.sock
   ```

   Output: `srw-rw---- 1 root docker 0 Nov  6 16:52 /var/run/docker.sock`. Exit status: 0.

2. Look for the socket inside the guest:

   ```bash
   $A run --isolation microvm --image agro-msb-local:1590 -- sh -c 'ls -l /var/run/docker.sock'
   ```

   Output: `ls: cannot access '/var/run/docker.sock': No such file or directory`. Exit status: 2. `agro run` passed the guest exit status through.

## E. No sandbox remains, and the usage log holds one line for each run

1. List the msb sandboxes after the runs:

   ```bash
   sg kvm -c 'msb ls'
   ```

   Output: `No sandboxes found.` Exit status: 0.

2. Show the usage log:

   ```bash
   cat $AGRO_HOME/runs/microvm.jsonl; wc -l < $AGRO_HOME/runs/microvm.jsonl
   ```

   Output:

   ```text
   {"time":"2026-11-08T00:21:27.617Z","image":"agro-msb-local:1590","digest":"sha256:25065e689ada5542167958d22bdd89f9d50071e1e0b4fb968a5394fc5d4df4f0","bootToExitMs":1478,"exitCode":7}
   {"time":"2026-11-08T00:21:33.183Z","image":"agro-msb-local:1590","digest":"sha256:25065e689ada5542167958d22bdd89f9d50071e1e0b4fb968a5394fc5d4df4f0","bootToExitMs":4796,"exitCode":0}
   {"time":"2026-11-08T00:21:38.074Z","image":"agro-msb-local:1590","digest":"sha256:25065e689ada5542167958d22bdd89f9d50071e1e0b4fb968a5394fc5d4df4f0","bootToExitMs":4722,"exitCode":0}
   {"time":"2026-11-08T00:21:42.897Z","image":"agro-msb-local:1590","digest":"sha256:25065e689ada5542167958d22bdd89f9d50071e1e0b4fb968a5394fc5d4df4f0","bootToExitMs":4703,"exitCode":0}
   {"time":"2026-11-08T00:22:07.769Z","image":"agro-msb-local:1590","digest":"sha256:25065e689ada5542167958d22bdd89f9d50071e1e0b4fb968a5394fc5d4df4f0","bootToExitMs":1419,"exitCode":0}
   {"time":"2026-11-08T00:22:16.988Z","image":"agro-msb-local:1590","digest":"sha256:25065e689ada5542167958d22bdd89f9d50071e1e0b4fb968a5394fc5d4df4f0","bootToExitMs":1392,"exitCode":0}
   {"time":"2026-11-08T00:22:23.698Z","image":"agro-msb-local:1590","digest":"sha256:25065e689ada5542167958d22bdd89f9d50071e1e0b4fb968a5394fc5d4df4f0","bootToExitMs":1403,"exitCode":2}
   7
   ```

   Exit status: 0. The worker made 7 microVM runs: 1 in step A, 3 in step B, 2 in step C, and 1 in step D. The log holds 7 lines. The 3 container runs and the refused run without `sg kvm` wrote no line.

## F. Cleanup

1. Remove the msb image:

   ```bash
   sg kvm -c 'msb image rm agro-msb-local:1590'
   ```

   Output: `✓ Removed             agro-msb-local:1590`. Exit status: 0. Then `msb image ls` printed `No images found.` and `msb ls` printed `No sandboxes found.`

2. Remove the Docker image:

   ```bash
   docker image rm agro-msb-local:1590
   ```

   Output ends with `Deleted: sha256:eec47a44a63dcbc566177fd544d1a0aa05ab86c6bf1f386be5010eaf19bb35ed`. Exit status: 0.

3. Remove the temporary usage log directory:

   ```bash
   rm -rf "$AGRO_HOME"
   ```

   Exit status: 0.
