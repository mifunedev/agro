# Manual review

The worker ran these steps on the VM host on 2026-11-08 at commit `5696cbef5d9e608cc599b9ccb9a476142d5386f6` of `skill/1596-retro-run-guardrails`. Each output is the observed output.

## Prerequisites

- A checkout of `skill/1596-retro-run-guardrails`.
- Stored local console credentials. `agro node list` exits 0.
- The branch CLI build:

  ```bash
  npm --prefix .agro/cli run build
  ```

  Observed output ends with `dist/agro.js  355.2kb` and `Done`.

The console account of this run is not eligible for the free tier. The host has no default public key. Each check below fails, and each failure is the expected result for this account.

## A. Free-tier check

Location: host, local.

1. Run the check:

   ```bash
   node .agro/cli/dist/agro.js node check --free-tier
   ```

   Observed output:

   ```text
   fail ssh-key: no --ssh-key given and ~/.ssh/id_ed25519.pub not found — run ssh-keygen -t ed25519 or pass --ssh-key <uuid>
   fail free-tier: not eligible — run agro auth login in the personal context, or create without --free-tier
   ```

   Observed exit status: 1.

## B. Unknown SSH key

Location: host, local.

1. Run the check with an unknown SSH key id:

   ```bash
   node .agro/cli/dist/agro.js node check --ssh-key 00000000-0000-0000-0000-000000000000
   ```

   Observed output:

   ```text
   fail ssh-key 00000000-0000-0000-0000-000000000000: not found in agro-console — pass the id of an SSH key in agro-console
   ```

   Observed exit status: 1.

## C. Console adapter preflight

Location: host, local. The value `unused` is a placeholder. The preflight reads no key.

1. Record the node count:

   ```bash
   agro node list --json
   ```

   Observed: 49 nodes.

2. Put a shim named `agro` first on `PATH`. The shim runs `node .agro/cli/dist/agro.js "$@"`. The installed agro v0.32.0 has no `node check` subcommand. Without the shim, the preflight prints `agro node: unknown subcommand "check" — expected create, list, delete` and `preflight failed: console`, and exits 1.

3. Run the preflight:

   ```bash
   CONSOLE_SSH_IDENTITY=unused bash .agro/skills/remote-sandbox/scripts/run.sh console --preflight
   ```

   Observed output:

   ```text
   fail ssh-key: no --ssh-key given and ~/.ssh/id_ed25519.pub not found — run ssh-keygen -t ed25519 or pass --ssh-key <uuid>
   fail free-tier: not eligible — run agro auth login in the personal context, or create without --free-tier
   preflight failed: console
   ```

   Observed exit status: 1.

4. Record the node count again:

   ```bash
   agro node list --json
   ```

   Observed: 49 nodes. No new node id.

`console_create` in `.agro/skills/remote-sandbox/adapters/console.sh` calls `console_preflight` before `agro node create`. When the preflight fails, `console_create` prints `console: agro node check failed, no node created` and returns 1.

## Cleanup

No step creates a resource. Delete the `PATH` shim.
