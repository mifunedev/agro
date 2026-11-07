# Manual review: US-004 agro run validation

The worker ran these commands on 2026-11-07 on the VM host. The checkout is the worktree `.worktrees/feat/1579-us-004` on branch `feat/1579-us-004` at `110bfc89f2ae41385225cfaf21805f197c8d5694`. The host user `sandbox` has uid 1001 and umask `0077`. The `agro.json` file sets no `image.ref`, so `agro run` used the default image `ghcr.io/mifunedev/agro:0.28.0`.

## Verdict

The acceptance criterion "the 14 host-only failures do not occur" is not met.

- 13 of the 14 baseline failures do not occur in the `agro run` result.
- 1 baseline failure remains: `install.test.ts > install.sh static contract > is executable and shebanged`. The checkout stores `.agro/scripts/install.sh` with mode `700`, because git wrote the file under the host umask `0077`. The container mounts the same files, so the container sees the same mode. The main checkout shows the same mode and the same failure in the container.
- The `agro run` result has 64 new failures with 3 environmental causes. The table in step A2 lists each cause.

## Wall times

| Run | Exit status | `real` | Vitest `Duration` |
|---|---|---|---|
| Host `pnpm test` | 1 | 0m31.166s | 30.62s |
| `agro run -- pnpm test` | 1 | 0m33.087s | 31.23s |

**A. Test suite on the host and in the ephemeral container**

Prerequisites: the worktree has its dependencies and a build of `.agro/cli/dist/agro.js`. Docker runs on the host. Runs on the host, local, from the worktree root.

1. Run the test suite on the host:

   ```bash
   time pnpm test
   ```

   Output, trimmed:

   ```text
    Test Files  5 failed | 111 passed (116)
         Tests  14 failed | 2894 passed | 6 skipped (2914)
   real	0m31.166s
   ```

   Exit status: 1. The failed files are the 5 baseline files: `self-upgrade.test.ts` (4), `agro-config.test.ts` (1, world-readable), `host-config.test.ts` (1, mode 0644), `herdr-default.test.ts` (7, zsh), and `install.test.ts` (1, executable bit).

2. Run the test suite in the ephemeral container:

   ```bash
   time node .agro/cli/dist/agro.js run -- pnpm test
   ```

   Output, trimmed:

   ```text
    Test Files  14 failed | 102 passed (116)
         Tests  78 failed | 2842 passed (2920)
   real	0m33.087s
   ```

   Exit status: 1. The 13 baseline failures in `self-upgrade.test.ts`, `agro-config.test.ts` (world-readable), `host-config.test.ts`, and `herdr-default.test.ts` do not occur. The 6 tests that the host skips run in the container.

   The 78 failures have these causes:

   | Cause | Failed files (failed tests) | Count |
   |---|---|---|
   | The image has no passwd entry for the host uid 1001, so `os.userInfo()` throws `uv_os_get_passwd returned ENOENT`. | `harness.test.ts` (27), `hermes-integration.test.ts` (17), `tool.test.ts` (2), `lifecycle.test.ts` (1) | 47 |
   | The worktree `.git` file points to `/home/sandbox/.agro/workspaces/harness/.git/worktrees/1579-us-004`. `agro run` mounts only the worktree root, so each `git` command fails with `fatal: not a git repository` and exit status 128. | `repo-layout.test.ts` (5), `standard-skills-link.test.ts` (4), `agro-config.test.ts` (2), `hooks.test.ts` (2), `shell-rename-leftovers.test.ts` (2), `docs-reference.test.ts` (1), `hermes-links.test.ts` (1), `prompt-miner-retirement.test.ts` (1) | 18 |
   | The image has no `python3`. `console_create` in `.agro/skills/remote-sandbox/scripts/lib.sh` parses JSON with `python3 -c`, so the function returns 1. | `remote-sandbox-adapters.test.ts` (12) | 12 |
   | The checkout stores `.agro/scripts/install.sh` with mode `700`. This failure is the baseline failure that remains. | `install.test.ts` (1) | 1 |

3. Confirm the cause of the 18 git failures. Run the 9 affected files from the main checkout, which has a real `.git` directory:

   ```bash
   cd /home/sandbox/.agro/workspaces/harness
   node .worktrees/feat/1579-us-004/.agro/cli/dist/agro.js run -- pnpm exec vitest run \
     .agro/cli/src/__tests__/docs-reference.test.ts .agro/cli/src/lib/__tests__/agro-config.test.ts \
     .agro/scripts/__tests__/hermes-links.test.ts .agro/scripts/__tests__/hooks.test.ts \
     .agro/scripts/__tests__/prompt-miner-retirement.test.ts .agro/scripts/__tests__/repo-layout.test.ts \
     .agro/scripts/__tests__/shell-rename-leftovers.test.ts .agro/scripts/__tests__/standard-skills-link.test.ts \
     .agro/scripts/__tests__/install.test.ts
   ```

   Output, trimmed:

   ```text
    FAIL  .agro/scripts/__tests__/install.test.ts > install.sh static contract > is executable and shebanged
    Test Files  1 failed | 8 passed (9)
         Tests  1 failed | 385 passed (386)
   ```

   Exit status: 0 from the shell pipeline. Vitest reports 1 failure. The 18 git failures do not occur. The `install.sh` failure remains, and `stat -c '%a'` on the main checkout file prints `700`.

4. Failure path. Run `git` in the container from the worktree:

   ```bash
   node .agro/cli/dist/agro.js run -- sh -c 'git rev-parse --show-toplevel'
   ```

   Output: `fatal: not a git repository: /home/sandbox/.agro/workspaces/harness/.git/worktrees/1579-us-004`. Exit status: 128 from `git`.

**B. Container identity and isolation**

Prerequisites: the same as scenario A. Runs on the host, local, from the worktree root.

1. Show the identity, umask, and shell in the container:

   ```bash
   node .agro/cli/dist/agro.js run -- sh -c 'id -u; umask; command -v zsh; ls -la / | head -3'
   ```

   Output:

   ```text
   1001
   0022
   /usr/bin/zsh
   total 64
   drwxr-xr-x   1 root root 4096 Nov  7 15:05 .
   drwxr-xr-x   1 root root 4096 Nov  7 15:05 ..
   ```

   Exit status: 0.

2. Show the user database and tools in the container:

   ```bash
   node .agro/cli/dist/agro.js run -- sh -c 'id; echo HOME=$HOME; getent passwd $(id -u) || echo no-passwd-entry; git rev-parse --show-toplevel; for c in jq curl ssh python3 bash; do printf "%s=" $c; command -v $c || echo missing; done'
   ```

   Output:

   ```text
   uid=1001 gid=1001(docker) groups=1001(docker)
   HOME=/tmp
   no-passwd-entry
   fatal: not a git repository: /home/sandbox/.agro/workspaces/harness/.git/worktrees/1579-us-004
   jq=/usr/bin/jq
   curl=/usr/bin/curl
   ssh=/usr/bin/ssh
   python3=missing
   bash=/usr/bin/bash
   ```

   Exit status: 0.

3. Negative check. Show that the container cannot see the Docker socket or the host home:

   ```bash
   node .agro/cli/dist/agro.js run -- sh -c 'ls /var/run/docker.sock; ls -A /home/sandbox'
   ```

   Output:

   ```text
   ls: cannot access '/var/run/docker.sock': No such file or directory
   .agro
   harness
   ```

   Exit status: 0. The `.agro` entry is the parent path of the worktree mount. The `harness` entry is the project directory of the image. No other host home entry is visible.

   The planned command listed a configuration directory under the host home. The operator-only path guard denied that command, so the worker did not run the command. The `ls -A /home/sandbox` listing above replaces it.

**C. Cleanup**

1. Confirm that `agro run` leaves no container:

   ```bash
   docker ps --format '{{.Names}}'
   ```

   Expected: the same names as before the runs. The observed list did not change.
