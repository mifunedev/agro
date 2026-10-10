# Provider setup, cleanup, and adapters

## Contents

1. [exe.dev](#exedev)
2. [Vercel Sandbox](#vercel-sandbox)
3. [Add an adapter](#add-an-adapter)

## exe.dev

The adapter is `adapters/exedev.sh`. The adapter defines the five required functions and the hooks `exedev_restart`, `exedev_row_ssh`, and `exedev_row_https`.

Prerequisites:

1. Register an SSH public key of the driver host with the exe.dev account. The command `ssh exe.dev` asks for the account email and registers the key. A host with access can also run `ssh exe.dev ssh-key add "<public key>"`.
2. Install `python3` on the driver host. `exedev_list` parses the VM list with `python3`.
3. Run `bash scripts/run.sh exedev --preflight`. The command prints `preflight ok: exedev`.

The adapter manages VMs through the exe.dev SSH command API: `new --json`, `ls --json`, `rm`, and `restart`. The adapter runs commands in a VM with `ssh <name>.exe.xyz`. The adapter needs no API token. Do not paste an API token into a chat or a log.

Set `IMAGE=<oci-ref>` to boot a VM from an image. `IMAGE=ghcr.io/mifunedev/agro:<version>` gives the image mode of `checks/agro-rows.sh`.

`exedev_row_https` requests `https://<name>.exe.xyz/`. HTTP 200 gives `PASS`. A redirect, 401, or 403 gives `SKIPPED`, because the exe.dev proxy is private until the operator shares the VM.

An exe.dev VM has no stop command. The VM uses account resources until `rm`.

Manual sweep on the driver host:

```bash
ssh exe.dev ls --json | jq -r '.vms[] | select((.tags // []) | index("agro-matrix")) | .vm_name'
ssh exe.dev rm <name>
```

## Vercel Sandbox

The adapter is `adapters/vercel.sh`. The adapter defines the five required functions and the hook `vercel_row_ssh`. The adapter defines no `vercel_row_https` and no `vercel_restart`.

Prerequisites:

1. Install the `vercel` CLI.
2. Run `vercel login`.
3. Set `VERCEL_SCOPE` to the team slug, for example `export VERCEL_SCOPE=<team-slug>`.
4. Run `bash scripts/run.sh vercel --preflight`. The command prints `preflight ok: vercel`.

The adapter creates a VM with 2 vCPU, a 42-minute timeout, `--non-persistent`, and the tag `purpose=agro-matrix`. A Hobby session stops at 45 minutes, so a check must end within the timeout.

`vercel_row_ssh` prints `RESULT R10-ssh-inbound FAIL API exec only, no standard SSH endpoint`. The driver prints `RESULT R11-https-port SKIPPED no adapter hook`. `scripts/restart-test.sh vercel` prints a usage line and exits 2.

Manual sweep on the driver host:

```bash
vercel sandbox list --scope "$VERCEL_SCOPE" | grep purpose=agro-matrix
vercel sandbox remove <name> --scope "$VERCEL_SCOPE"
```

## Add an adapter

1. Write `<p>.sh`. Put the file in `adapters/` of this skill for a provider that AGRO maintains. Put the file in another directory for a provider that another repository maintains.
2. Define the five required functions: `<p>_preflight`, `<p>_create`, `<p>_exec`, `<p>_destroy`, and `<p>_list`. `SKILL.md` states the contract of each function.
3. Tag or name each VM so that `<p>_list` counts only the VMs of the driver. Use `$MATRIX_TAG` and the name that the driver passes.
4. Define a hook only when the provider supports the operation: `<p>_row_ssh`, `<p>_row_https`, or `<p>_restart`. Each row hook prints one `RESULT <row> <status> <detail>` line.
5. Write no secret into the VM. Read a credential on the driver host only.
6. Run `bash -n <p>.sh`.
7. If the file is outside `adapters/`, set `REMOTE_SANDBOX_ADAPTERS` to the directory of the file:

   ```bash
   export REMOTE_SANDBOX_ADAPTERS=<dir>
   ```

8. Run the preflight. The command prints `preflight ok: <p>`:

   ```bash
   bash scripts/run.sh <p> --preflight
   ```

9. Get operator approval. Then run `checks/cg-probe.sh` first. Run `checks/agro-rows.sh` only when the probe shows a delegated `memory` controller or when the host-mode rows matter.
