# exedev

## Choose when

Use this route for approved work on an exe.dev VM.
The SSH account API manages the VM; `agro` manages the supported sandbox inside it.
Provider VM ownership does not authorize continuing application work on the raw VM host.

## Prerequisites

- Register the driver host's SSH public key with the exe.dev account.
  `ssh exe.dev` supports account registration.
  An authorized host can use `ssh exe.dev ssh-key add "<public key>"`.
- Get explicit operator approval for resource creation and teardown scope.
- Record whether the task creates a VM or borrows an existing VM.
  Record the exact name, task owner, and allowed lifecycle operations.
- Inspect the account with `ssh exe.dev whoami --json`.
- For remote validation, send no GitHub token, Slack token, API token, or `.env` file into the VM.
  This validation ban is separate from the hands fork credential rule.
  An account SSH key stays on the driver host; the adapter needs no API token.

## Execute

Run API commands on the driver host. These forms match `adapters/exedev.sh`:

```bash
ssh exe.dev ls --json
ssh exe.dev new --json --name <name> --tag <task-tag>
```

Select a recorded existing VM from `ls --json`, or create only the approved new VM.
For an approved image, append `--image <oci-ref>` to `new`.
Do not use a name or tag as proof that an unrelated VM belongs to this task.

Execute remote commands through standard SSH:

```bash
ssh <name>.exe.xyz '<command>'
```

Before application execution, prepare the checkout and a supported AGRO sandbox on the VM host.
Use the public [lifecycle commands](https://github.com/mifunedev/agro/blob/main/docs/lifecycle-commands.md)
for persistent Docker or OpenShell workspaces.
For disposable execution, inspect remote `agro run --help` and use the local route on that VM host:

```bash
ssh <name>.exe.xyz 'cd <checkout> && agro run -- <command>'
```

Check remote help for `--sandbox` before suggesting existing-sandbox execution.
Never assume the remote CLI matches source capabilities.
Run interactive agents, tests, and servers in Herdr inside the supported sandbox.
Run headless gateways and tunnels in named tmux sessions.
Do not make persistent work depend on the attached SSH shell.

Retrieve command output through SSH.
For example, retrieve a workspace patch from its recorded checkout:

```bash
ssh <name>.exe.xyz 'git -C <checkout> diff' > <local-patch>
```

This patch excludes untracked files and committed changes.
Agree on the complete result-transfer scope before deleting a VM.
Do not transfer credentials with results.

## Verify

Record actual remote exit codes and inspect the retrieved result before acceptance.
Confirm the exact VM remains in `ssh exe.dev ls --json` when the task retains it.
The adapter's HTTPS URL is `https://<name>.exe.xyz/`.
A redirect, 401, or 403 can mean the proxy is private, not that execution failed.
Do not share the VM publicly without operator authority.

## Cleanup

An exe.dev VM has no stop/pause API in this adapter.
The VM consumes account resources until deletion.
For the exact owned VM within approved teardown scope, use:

```bash
ssh exe.dev rm <name>
```

Confirm removal with `ssh exe.dev ls --json`.
Do not delete borrowed VMs or perform an arbitrary account-wide sweep.
For validation runs, the driver owns cleanup unless `KEEP=1`.

## Failure remedies

For account SSH failures, stop and ask the operator to repair account/key access.
Do not copy a private key or send an API token to the VM.
The adapter supports `ssh exe.dev restart <name>` but has no pause operation.
Restart only within explicit authority. A restart can lose recent unsynced writes.
For a sandbox refusal, follow the named remedy or report the block.
Do not silently switch to raw-host application execution.
