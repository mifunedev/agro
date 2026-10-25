# Manual review — sandbox-root-exec

Observed run on 2026-10-25 on branch `bug/sandbox-root-exec-us-003`, based on
`69838ada` (US-001 and US-002 accepted). Each output below is copied from that run.

Environment for every step: `export COREPACK_ENABLE_DOWNLOAD_PROMPT=0`. The runner
has no `pnpm` on PATH, so each pnpm command runs as `corepack pnpm`.

**A. Root runs no agent-writable control-plane script (US-001)**

Prerequisites: a checkout of the task branch. Runs in the sandbox, local. Creates no resource.

1. Search the entrypoint for a root call to a script under `CONTROL_DIR`:

   ```bash
   grep -nE '^[[:space:]]*(if ! )?(bash|sh|source|\.) "?\$\{?CONTROL_DIR' .devcontainer/entrypoint.sh
   ```

   Output: empty. Exit status: 1.

2. Show the provisioning call:

   ```bash
   grep -n provision-python.sh .devcontainer/entrypoint.sh
   ```

   Output:

   ```text
   342:   && [ -x "$CONTROL_DIR/scripts/provision-python.sh" ]; then
   343:  if ! gosu sandbox env HOME=/home/sandbox AGRO_PROJECT_ROOT="$HARNESS" bash "$CONTROL_DIR/scripts/provision-python.sh"; then
   344:    echo "[entrypoint] WARNING: Python provisioning did not complete; run: bash $CONTROL_DIR/scripts/provision-python.sh" >&2
   ```

   Exit status: 0. Line 343 runs the script as `sandbox` through `gosu`.

3. Count the root gateway link:

   ```bash
   grep -c usr/local/bin/gateway .devcontainer/entrypoint.sh
   ```

   Output: `0`. Exit status: 1.

**B. Shell failure hint names the restart verb (US-002)**

Prerequisites: Docker on PATH. Runs in the sandbox, local. Creates no resource.

1. Build the CLI:

   ```bash
   corepack pnpm run build:harness
   ```

   Output ends with `dist/agro.js  314.8kb` and `⚡ Done in 71ms`. Exit status: 0.

   `corepack pnpm build` exits 1 on this runner with `sh: 1: pnpm: not found`,
   because the `build` script calls `pnpm run build:harness` and `pnpm` is not on PATH.

2. Run the built CLI against a sandbox name with no container:

   ```bash
   node .agro/cli/dist/agro.js shell agro-evidence-absent
   ```

   Output:

   ```text
   agro: no sandbox named `agro-evidence-absent` in /home/sandbox/.agro/sandboxes — create one with `agro sandbox install docker --name agro-evidence-absent`
   ```

   Exit status: 2.

   ```bash
   SANDBOX_NAME=agro-evidence-absent node .agro/cli/dist/agro.js shell
   ```

   Output:

   ```text
   agro: no sandbox is registered in /home/sandbox/.agro/sandboxes — create one with `agro sandbox install docker`
   ```

   Exit status: 2.

   The built CLI checks the registry before `docker exec`. The runner has no
   registry entry, and this story creates none. The CLI therefore stops before it
   prints the shell failure hint.

3. Show the hint through the unit test that drives `runShell` with a failed `docker exec`:

   ```bash
   corepack pnpm exec vitest run .agro/cli/src/__tests__/lifecycle.test.ts -t "prints the install hint" --reporter=verbose
   ```

   Output:

   ```text
    ✓ .agro/cli/src/__tests__/lifecycle.test.ts > runShell > prints the install hint (after docker's own error) and propagates a non-zero exit 8ms

    Test Files  1 passed (1)
   ```

   Exit status: 0. The test asserts this stderr line, with `DEFAULT_CONTAINER_NAME` as `<name>`:

   ```text
   container `<name>` not running? start it with `agro restart <name>`
   ```

   The source of the line is `.agro/cli/src/lib/runtimes/verbs.ts:86`:
   `` `container \`${name}\` not running? start it with \`${bin} restart ${name}\`` ``.

**C. Test suite and typecheck on the integrated task branch**

Prerequisites: installed dependencies. Runs in the sandbox, local. Creates no resource.

1. Run the tests:

   ```bash
   corepack pnpm test
   ```

   Output:

   ```text
    Test Files  2 failed | 106 passed (108)
         Tests  11 failed | 2556 passed | 6 skipped (2573)
   ```

   Exit status: 1. Failed tests:

   ```text
    FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > exports the default to children in an interactive Herdr pane
    FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > preserves an explicit value <0>
    FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > preserves an explicit value <1>
    FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > preserves an explicit value <>
    FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > leaves the variable unset without a nonempty pane marker: {}
    FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > leaves the variable unset without a nonempty pane marker: {"HERDR_PANE_ID":""}
    FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > leaves the variable unset in a noninteractive Herdr shell
    FAIL  .agro/scripts/__tests__/install.test.ts > install.sh end to end > installs the artifact, records the PATH line, and reports the version
    FAIL  .agro/scripts/__tests__/install.test.ts > install.sh end to end > falls back to the legacy AGRO_* installer variables
    FAIL  .agro/scripts/__tests__/install.test.ts > install.sh end to end > installs into AGRO_BIN_DIR and ignores the retired OH_BIN_DIR spelling
    FAIL  .agro/scripts/__tests__/install.test.ts > install.sh end to end > installs the real built agro.js bundle and reports its version in a new shell
   ```

   The `herdr-default.test.ts` failures report
   `These functional tests require zsh on the test runner: expected Error: spawnSync zsh ENOENT`.
   The runner has no `zsh`. The `install.test.ts` failures report
   `expected '#!/tmp/agro-install-…/.local/sha…' to be '#!/usr/bin/env node\nconsole.log("9.9…'`.
   No task commit (`36c65d95`, `b2187a7e`) changes either test file or the code under test.

2. Run the typecheck:

   ```bash
   corepack pnpm typecheck
   ```

   Output ends with `> @mifune/agro@0.25.0 typecheck` and `> tsc --noEmit`. Exit status: 0.

**D. No resource created**

1. Check for a container, a volume, and a registry change:

   ```bash
   docker ps -a --format '{{.Names}}' | grep evidence
   docker volume ls --format '{{.Name}}' | grep evidence
   ls ~/.agro
   md5sum ~/.agro/config.json
   ```

   Output: the two `grep` commands print nothing and exit 1. `ls ~/.agro` prints
   `config.json` and `workspaces`, so `~/.agro/sandboxes` does not exist.
   `md5sum` prints `b295f3014bce5301918f550f19b6f7bb` before and after the run.

**E. Cleanup**

No step creates a resource. No cleanup is necessary.
