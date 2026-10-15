# Provider setup, cleanup, and adapters

## Contents

1. [exe.dev](#exedev)
2. [Vercel Sandbox](#vercel-sandbox)
3. [agro-console](#agro-console)
4. [Add an adapter](#add-an-adapter)

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

## agro-console

The provider name is `console`. The adapter is `adapters/console.sh`. The adapter defines the five required functions and the hook `console_row_ssh`. The adapter defines no `console_row_https` and no `console_restart`.

The adapter drives the `agro` CLI on the driver host. `console_preflight` and `console_list` run `agro node list --json`. `console_create` runs `agro node create --json`. `console_destroy` runs `agro node delete <id> --yes`. `console_exec` runs each command with `ssh` to `sandbox@<ip>`. The `sandbox` user has passwordless sudo.

Variables on the driver host:

| Variable | Default | Effect |
|---|---|---|
| `AGRO_CONSOLE_URL` | CLI default | The console API URL. The `agro` CLI reads this variable. |
| `AGRO_CONSOLE_TOKEN` | none | The console API token. The `agro` CLI reads this variable from the environment, then from the project `.env`. |
| `CONSOLE_SSH_KEY_ID` | none | The UUID of an SSH key on the console account. `console_create` passes the UUID to `--ssh-key`. |
| `CONSOLE_SSH_IDENTITY` | none | The private key file of that SSH key. `console_exec` passes the file to `ssh -i`. |
| `CONSOLE_SPEC` | `n4` | The node spec for `agro node create --spec`. |
| `CONSOLE_FREE_TIER` | `1` | `0` removes `--free-tier` from `agro node create`. Any other value keeps `--free-tier`. |

Prerequisites:

1. Install the `agro` CLI on the driver host.
2. Set `AGRO_CONSOLE_TOKEN` in the environment, or run `agro secret set AGRO_CONSOLE_TOKEN`. The token stays on the driver host. Do not paste the token into a chat or a log.
3. Register an SSH public key of the driver host with the console account. Set `CONSOLE_SSH_KEY_ID` to the UUID of that key. Set `CONSOLE_SSH_IDENTITY` to the matching private key file.
4. Run `bash scripts/run.sh console --preflight`. The command prints `preflight ok: console`.

The free tier allows one live node for each account. With the free tier on, start one console run at a time. Before a run, confirm that `agro node list` shows no other live node.

A console node has no image choice. When the operator sets `IMAGE`, `console_create` stops and exits 2. The image mode of `checks/agro-rows.sh` does not apply to the console. `scripts/restart-test.sh console` prints a usage line and exits 2.

A console sandbox node has no Docker at create. `agro node create` has no `--docker` flag yet (mifunedev/agro#1437). If a check needs Docker, the check installs Docker in the VM.

`console_row_ssh` prints `RESULT R10-ssh-inbound PASS ssh <target>`. The driver prints `RESULT R11-https-port SKIPPED no adapter hook`.

A console node has no tag. `console_list` counts the nodes with a name that starts with `agro-mx-` and a status other than `destroyed`. The console API returns destroyed nodes in the node list.

If `agro node create` returns a node ID with no SSH target, `console_create` keeps the ID. The driver cleanup then deletes the node. If `agro node create` returns no ID, use the manual sweep.

`console_destroy` retries `agro node delete` on HTTP 409 for up to 60 s.

Manual sweep on the driver host:

```bash
agro node list --json | jq -r '.[] | select(((.name // "") | startswith("agro-mx-")) and .status != "destroyed") | .id'
agro node delete <id> --yes
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
