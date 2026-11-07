# Manual review: US-004 agro run validation

The worker ran these commands on 2026-11-07 on the VM host. The checkout is the worktree `.worktrees/feat/1579-ephemeral-run-target` on branch `feat/1579-ephemeral-run-target` at `3d98496a69b50c94d9fdf3fe61f2269c322fcc54`. The host user `sandbox` has uid 1001 and umask `0077`. The CLI build at `.agro/cli/dist/agro.js` includes the passwd entry and the git directory mount.

The runs use the image `agro-local:1579` (`sha256:90c6a47b3ddf2a38e569a420fa3f7bbfad58bbb5d7968085022c51f0cf78bfc1`). This image is a local build of `.devcontainer/Dockerfile` on this branch. The official image `ghcr.io/mifunedev/agro` gets the `python3` package of US-005 only at the next release. Thus the local build is necessary to test the image that this branch ships.

## Verdict

| Criterion | Result |
|---|---|
| The transcript records `agro run -- pnpm test` with the exit code and the test summary. | Met. Step A2 records exit status 1 and the summary. |
| Each baseline failure that the host umask or a missing host tool causes does not occur in the `agro run` result. | Met. The 13 failures in classification (a) do not occur. |
| The `agro run` result has no failure that the host result does not have. | Met. The one `agro run` failure also occurs on the host. |
| The transcript records each remaining failure that a host checkout file mode causes as host checkout drift. | Met. Step A3 records the `install.sh` failure as host checkout drift. |
| The transcript records the wall time of both runs. | Met. The wall time table records both runs. |

## Failure classification

| Failed test | Host | `agro run` | Class | Cause |
|---|---|---|---|---|
| `self-upgrade.test.ts` > 4 tests in `runSelfUpgrade — standalone` | fail | pass | (a) | Host umask `0077` |
| `agro-config.test.ts` > `round trip` > `writes agro.json world-readable` | fail | pass | (a) | Host umask `0077` |
| `host-config.test.ts` > `writeHostConfig` > `writes the file with mode 0644` | fail | pass | (a) | Host umask `0077` |
| `herdr-default.test.ts` > 7 tests in `Pi clipboard defaults in the canonical zshrc` | fail | pass | (a) | The host has no `zsh` |
| `install.test.ts` > `install.sh static contract` > `is executable and shebanged` | fail | fail | (b) | Host checkout drift: the checkout file has mode `700` |

No failure is in class (c), a failure that only `agro run` has.

## Wall times

| Run | Exit status | `real` | Vitest `Duration` |
|---|---|---|---|
| Host `pnpm test` | 1 | 0m29.799s | 29.26s |
| `agro run --image agro-local:1579 -- pnpm test` | 1 | 0m30.777s | 29.01s |

**A. Test suite on the host and in the ephemeral container**

Prerequisites: the worktree has its dependencies and a build of `.agro/cli/dist/agro.js`. Docker runs on the host. The local image `agro-local:1579` exists. Runs on the host, local, from the worktree root.

1. Run the test suite on the host:

   ```bash
   time pnpm test
   ```

   Output, trimmed:

   ```text
    Test Files  5 failed | 111 passed (116)
         Tests  14 failed | 2899 passed | 6 skipped (2919)
      Duration  29.26s
   real	0m29.799s
   ```

   Exit status: 1. The 14 failures are the rows with "fail" in the Host column of the classification table.

2. Run the test suite in the ephemeral container:

   ```bash
   time node .agro/cli/dist/agro.js run --image agro-local:1579 -- pnpm test
   ```

   Output, trimmed:

   ```text
    FAIL  .agro/scripts/__tests__/install.test.ts > install.sh static contract > is executable and shebanged
   AssertionError: expected 64 to be 73 // Object.is equality
    Test Files  1 failed | 115 passed (116)
         Tests  1 failed | 2924 passed (2925)
      Duration  29.01s
   real	0m30.777s
   ```

   Exit status: 1. The 13 failures in class (a) do not occur. The 6 tests that the host skips run and pass in the container.

3. Record the host checkout drift. Compare the mode of `install.sh` on the host, in git, and in the container:

   ```bash
   stat -c '%a %n' .agro/scripts/install.sh
   git ls-files -s .agro/scripts/install.sh
   node .agro/cli/dist/agro.js run --image agro-local:1579 -- sh -c 'stat -c "%a %n" .agro/scripts/install.sh'
   ```

   Output:

   ```text
   700 .agro/scripts/install.sh
   100755 44de1cb7abb65413563ec67bc03e264a5290732d 0	.agro/scripts/install.sh
   700 .agro/scripts/install.sh
   ```

   Exit status: 0 for each command. Git stores mode `100755`. Git wrote the file under the host umask `0077`, so the checkout file has mode `700`. The container mounts the same file and sees mode `700`. The test requires the execute bit for group and others (`0o111`), so the test fails on the host and in the container. This failure is host checkout drift, and the operator decision on 2026-11-07 excludes it from the count.

4. Failure path. Show that `agro run` returns the exit status of the command:

   ```bash
   node .agro/cli/dist/agro.js run --image agro-local:1579 -- sh -c 'exit 7'
   ```

   Output: none. Exit status: 7.

**B. Container identity and isolation**

Prerequisites: the same as scenario A. Runs on the host, local, from the worktree root.

1. Show the identity, the umask, and the Docker socket in the container:

   ```bash
   node .agro/cli/dist/agro.js run --image agro-local:1579 -- sh -c 'id; umask; ls /var/run/docker.sock'
   ```

   Output:

   ```text
   uid=1001(sandbox) gid=1001(sandbox) groups=1001(sandbox)
   0022
   ls: cannot access '/var/run/docker.sock': No such file or directory
   ```

   Exit status: 2 from `ls`. The container does not have the Docker socket. The container user has the host uid, no `docker` group, and umask `0022`.

2. Show the user database, the git directory, and the tools in the container:

   ```bash
   node .agro/cli/dist/agro.js run --image agro-local:1579 -- sh -c 'getent passwd $(id -u); git rev-parse --show-toplevel; command -v python3; python3 --version'
   node .agro/cli/dist/agro.js run --image agro-local:1579 -- sh -c 'command -v zsh'
   ```

   Output:

   ```text
   sandbox:x:1001:1001::/tmp:/bin/sh
   /home/sandbox/.agro/workspaces/harness/.worktrees/feat/1579-ephemeral-run-target
   /usr/bin/python3
   Python 3.13.5
   /usr/bin/zsh
   ```

   Exit status: 0 for each command. The passwd entry exists for the host uid. `git` finds the worktree. The image has `python3` and `zsh`.

3. Negative check. Show that the container cannot see the host home:

   ```bash
   node .agro/cli/dist/agro.js run --image agro-local:1579 -- sh -c 'ls -A /home/sandbox'
   ```

   Output:

   ```text
   .agro
   harness
   ```

   Exit status: 0. The `.agro` entry is the parent path of the worktree mount and the git directory mount. The `harness` entry is the project directory of the image. The container shows no other host home entry.

**C. Cleanup**

1. Confirm that `agro run` leaves no container:

   ```bash
   docker ps --format '{{.Names}}'
   ```

   Output:

   ```text
   pgadmin
   postgres
   ```

   Exit status: 0. The `pgadmin` and `postgres` containers belong to other project services. No `agro run` container remains.
