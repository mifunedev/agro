# Validation adapter setup, cleanup, and contracts

These instructions apply only to the validation driver.
Internal IDs `exedev`, `vercel`, `console`, and `msb` remain unchanged.
`msb` here is a remote console-node adapter, not the `local/msb` route.
Run the commands below from the canonical skill directory.
Use the validation procedure linked directly from SKILL.md before any live run.
Get explicit operator approval for each billable run and its teardown scope.
Cleanup examples identify candidates, not authority to delete unrelated resources.
Match each resource against the run's recorded ownership before deletion.

## Contents

1. [exe.dev](#exedev)
2. [Vercel Sandbox](#vercel-sandbox)
3. [agro-console](#agro-console)
4. [msb](#msb)
5. [Add an adapter](#add-an-adapter)

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

The adapter drives the `agro` CLI on the driver host. `console_preflight` runs `agro node check`; `console_list` runs `agro node list --json`. `console_create` runs `agro node create --json`. `console_destroy` runs `agro node delete <id> --yes`. `console_exec` runs each command with `ssh` to `sandbox@<ip>`. The `sandbox` user has passwordless sudo.

The validation reference linked directly from SKILL.md owns the driver variable table.
Keep console defaults there, not in a second setup table.

Prerequisites:

1. Install the `agro` CLI on the driver host.
2. Run `agro auth login` on the driver host, or set `AGRO_CONSOLE_TOKEN` in the driver environment. The token stays on the driver host. Do not paste the token into a chat or a log.
3. Set `CONSOLE_SSH_IDENTITY` to the private key file for the node SSH key. Without `CONSOLE_SSH_KEY_ID`, `agro node create` registers `~/.ssh/id_ed25519.pub` of the driver host. Then `CONSOLE_SSH_IDENTITY` must be the matching private key `~/.ssh/id_ed25519`. With `CONSOLE_SSH_KEY_ID` set to the UUID of a console SSH key, `CONSOLE_SSH_IDENTITY` must be the private key file of that console key.
4. Run `bash scripts/run.sh console --preflight`. The command prints `preflight ok: console`.

The free tier allows one live node for each account. With the free tier on, start one console run at a time. Before a run, confirm that `agro node list` shows no other live node.

A console node has no image choice. When the operator sets `IMAGE`, `console_create` stops and exits 2. The image mode of `checks/agro-rows.sh` does not apply to the console. `scripts/restart-test.sh console` prints a usage line and exits 2.

The console adapter does not pass `--docker` during creation.
If a check needs Docker, the check installs Docker in the VM.

`console_row_ssh` prints `RESULT R10-ssh-inbound PASS ssh <target>`. The driver prints `RESULT R11-https-port SKIPPED no adapter hook`.

A console node has no tag. `console_list` counts the nodes with a name that starts with `agro-mx-` and a status other than `destroyed`. The console API returns destroyed nodes in the node list.

If `agro node create` returns a node ID with no SSH target, `console_create` keeps the ID. The driver cleanup then deletes the node. If `agro node create` returns no ID, use the manual sweep.

`console_destroy` retries `agro node delete` on HTTP 409 for up to 60 s. The console accepts a delete before the node is gone. After a successful delete, `console_destroy` runs `agro node list --json` every 5 s for up to 180 s until the node has the status `destroyed` or is not in the list. Then `console_destroy` removes the state file and returns 0. If the node does not reach `destroyed` in 180 s, `console_destroy` prints the last status, keeps the state file, and returns 1.

Manual sweep on the driver host:

```bash
agro node list --json | jq -r '.[] | select(((.name // "") | startswith("agro-mx-")) and .status != "destroyed") | .id'
agro node delete <id> --yes
```

## msb

The provider name is `msb`. The adapter is `adapters/msb.sh`. The adapter defines the five required functions and the hooks `msb_restart` and `msb_row_ssh`. The adapter defines no `msb_row_https`. The adapter also defines `msb_snapshot_restore`, which no driver script calls.

The adapter runs a microVM guest on an agro-console node. `msb_preflight` runs `console_preflight`. `msb_create` creates a console node with `console_create` and installs `msb` on the node. Then `msb_create` runs `msb run --detach --init auto --root-disk flat:40G` with `IMAGE`. `msb_exec` runs each command in the guest with `msb exec` over SSH to the node. `msb_destroy` runs `msb rm --force` on each guest, then deletes the node with `console_destroy`. `msb_list` counts the `agro-mx-` console nodes and the `agro-mx-` guests on each node in the state directory.

The variable table in `validation.md` owns the console variables, `MSB_*`, and `IMAGE_SIZE_BYTES`.
The console variables also apply to the msb node.

Host prerequisites on the node:

1. The node must have `/dev/kvm`. The agro-console `n4` node has KVM.
2. The `sandbox` user must be in the `kvm` group in a new login session. `msb_create` runs `sudo usermod -aG kvm sandbox` in an SSH session before the `msb run` session.
3. `~/.microsandbox` must not be group-writable. `msb_create` runs `chmod go-w ~/.microsandbox` before `msb run`.

Prerequisites on the driver host:

1. Do the prerequisites of the [agro-console](#agro-console) section.
2. Run `bash scripts/run.sh msb --preflight`. The command prints `preflight ok: msb`.
3. Set `IMAGE` to an `agro-msb` image. Without `IMAGE`, `msb_create` exits 2 and creates no node.

The `agro-msb` target of `.devcontainer/Dockerfile` builds the guest image.
The release workflow publishes `ghcr.io/mifunedev/agro:${RELEASE_VERSION}-msb` and `ghcr.io/mifunedev/agro:sha-${RELEASE_SHA}-msb` from this target.
Set `IMAGE` to the release-version or full-commit-SHA tag for the build under test.
The image must meet two requirements:

- Under `--init auto`, `msb` also runs the image `CMD`. The `CMD` must stay alive, so `agro-msb` sets `CMD ["sleep", "infinity"]`. With `CMD ["/sbin/init"]`, the command exits 1 and `msb` shuts down the guest.
- `ctrl-alt-del.target` must link to `poweroff.target`. Without this link, guest systemd enters `reboot.target` and the guest drains. `agro-msb` also sets `CtrlAltDelBurstAction=poweroff-force`.

After `msb run`, `msb_restart`, and `msb_snapshot_restore`, the adapter waits until guest PID 1 is `systemd`. If `msb ls` shows the guest as `stopped`, `draining`, or `crashed`, the adapter prints the last 20 lines of `msb logs --source system` and returns 1.

`msb_row_ssh` prints `RESULT R10-ssh-inbound PASS ssh <target>`. The driver prints `RESULT R11-https-port SKIPPED no adapter hook`. `msb_restart` runs `msb stop` and `msb start` on the guest.

Existing validation findings with `msb` `v0.7.13`:

These findings describe the tested guest configuration, not new release validation results.

- `msb snap restore` has no init handoff. The restored guest stays at `pid1=init.krun`, so row `M05-snapshot-restore` fails.
- `msb stop` and `msb start` do a full guest reboot. No tmux session survives the reboot, so row `M03-restart-persist` fails.
- The Hermes smoke refuses a Docker socket. The `agro-msb` guest runs `dockerd`, so row `R14-hermes-install` fails.
- A guest with the `msb` default of 512 MiB drains under `--init auto`. The adapter default is 2 GiB and 2 vCPU for each guest.

Manual sweep on the driver host. Delete the node to remove each guest on the node:

```bash
agro node list --json | jq -r '.[] | select(((.name // "") | startswith("agro-mx-")) and .status != "destroyed") | .id'
agro node delete <id> --yes
```

## Add an adapter

1. Write `<p>.sh`. Put the file in `adapters/` of this skill for a provider that AGRO maintains. Put the file in another directory for a provider that another repository maintains.
2. Define the five required functions: `<p>_preflight`, `<p>_create`, `<p>_exec`, `<p>_destroy`, and `<p>_list`. The validation reference states each function's contract.
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
