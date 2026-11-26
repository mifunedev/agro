# hands

## Contents

- [Choose when](#choose-when)
- [Prerequisites](#prerequisites)
- [Execute](#execute)
- [Verify](#verify)
- [Cleanup](#cleanup)
- [Failure remedies](#failure-remedies)

## Choose when

A brain is an AGRO node that holds the operator's projects and history.
A hand is a node that a brain creates and manages through `agro hands`.
The hand does heavy or parallel work. The brain keeps the history.
Choose a hand for more CPU, memory, or disk, isolated parallel work, or potentially damaging commands.
For application runs, follow the default order in [Select a route](../SKILL.md#select-a-route). These steps support steps 5 and 6:

- A hand holds a project when `agro hands exec <hand> -- git -C projects/<owner>/<repo> rev-parse HEAD` exits 0.
- To push the current branch, follow [Put a project on an existing hand](#put-a-project-on-an-existing-hand) steps 2 and 3.
- Compare `git -C <harness-root>/projects/<owner>/<repo> rev-parse HEAD` on the brain with the hand result. If the values differ, stop and report.
- A run on a hand keeps the isolation runtime from step 1, for example `agro run --isolation microvm -- <command>`.
- Parallel agents on the same project use separate hands, because `agro hands` has no worktree support on a hand.

A hand uses paid provider resources from creation until destruction.
Get explicit operator authority before a billable create.

One brain uses one provider. `hands.provider` in the host config `${AGRO_HOME:-~/.agro}/config.json` selects the provider:

| | `console` (default) | `exedev` | `boat` |
|---|---|---|---|
| `<hand>` | index, alias, or uuid | exe.dev VM name | sandbox name without `agro-hand-`, or sandbox id |
| Credential | brain token | brain SSH key on the exe.dev account | `boat login` session on the brain host |
| Enrollment | `create` only | `create`, or the tag `agro-hand` on an existing VM | `create` only |
| Brain remote | `hand-<index>` | `hand-<vm>` | `hand-<id>` |
| SSH destination | `sandbox@<recorded-ssh-host>` | `<vm>.exe.xyz`, login shell | `boat ssh <id>`, login shell |
| Authority fence | console token scope | tag guard and brain guard in the CLI | name prefix guard and `BOAT_ID` guard in the CLI |

`<harness-root>` is the brain harness root. `agro hands --help` states how the CLI resolves it.
Do not guess the provider from the host. Read `hands.provider` in the host config.
To select exe.dev on an exe.dev brain, run `agro config set hands.provider exedev`.
To select boat.dev, run `agro config set hands.provider boat`.
No live run has verified the `boat` provider yet. See [boat.dev hands](https://github.com/mifunedev/agro/blob/main/docs/lifecycle-commands.md#boatdev-hands).

These operator requests select this route:

- "Offload the current branch of mifunedev/<repo> to hand sbx-dev-001, run pnpm test, commit, and fetch it here."
- "Run <command> on hand sbx-dev-001 in mifunedev/<repo>."
- "List my hands."
- "Pause hand sbx-dev-001" and "Resume hand sbx-dev-001".
- "Make agro-sbx-dev-001 a hand." This request enrolls an existing exe.dev VM.
- "Create a new hand for mifunedev/<repo>. I authorize creating it and destroying it after you accept the result."
- "Fork hand sbx-dev-001; its credentials may go to the copy."
- "Destroy hand sbx-dev-001 — it's task-owned and accepted."

Two owners share this route:

- `agro hands` owns hand selection, SSH transport, and git movement between the brain and the hand.
- `agro run` on the hand owns application execution: tests, builds, and installs.

A hand request that runs application work names both owners: `agro hands` and `agro run`.

This route uses `agro hands` for project offload.
The validation driver's `console` adapter also uses `agro hands`, with `--provider console --operator` and the `agro auth login` credentials.
The adapter calls `agro hands check`, `agro hands create --json`, `agro hands list --json`, and `agro hands destroy <id> --yes`.
A console node from `agro hands create --operator` is not a hand unless a brain manages it.

## Prerequisites

- Get explicit operator authority for billable create/fork operations and the teardown scope.
- Confirm brain context and inspect `agro hands --help` on the installed CLI.
  Check each subcommand's help before using its flags.
- Before application build/test/install workloads, inspect the hand's runtime capabilities through SSH.
  Select `agro run` for one-shot execution or a supported persistent sandbox before application execution.
- Never read, print, or copy the brain token. `agro hands` reads the token.
- For `exedev`, the brain SSH key must be on the exe.dev account. `agro hands` checks it with `ssh exe.dev whoami`.
  Send no token, `.env` file, or private key to a hand.
- For `boat`, the operator runs `boat login` on the brain host. Never run `boat login` or read the `boat` session.
  If `boat list --json` fails, `agro hands` exits 2 and names the remedy.
- A fork copies the hand disk, including credentials.
  Fork only when every credential on the source hand can go to the new hand.
- Use `/worktrees` for checkout isolation.
- To install a coding agent on the brain, use the approved
  `agro harness install <name> --host` procedure.

## Execute

Run these commands on the brain.
Write a console hand index without `#`; an unquoted `#7` starts a shell comment.

1. Get a hand for the project.
   To create an approved hand, run:

   ```bash
   agro hands create --project <owner>/<repo>
   ```

   `--project` pushes the current branch of the existing brain project and adds the brain remote there.
   Record the returned hand, SSH host, and ownership.
   `--spec` applies only to console hands. The `exedev` provider refuses `--spec`.
   If the console free tier does not offer the requested spec, the CLI creates `n4`.
   The CLI then prints `spec <spec> is not in the free tier; creating n4`.
   If `n4` is too small for the task, report the fallback to the operator.

   To enroll an existing exe.dev VM, get operator authority for that exact VM. Then run:

   ```bash
   ssh exe.dev tag <vm> agro-hand
   ```

   Enrollment changes no AGRO state. Tag a VM only on operator request.

2. Use generic exec for bounded host/control-plane operations:

   ```bash
   agro hands exec <hand> --project <owner>/<repo> -- <command>
   ```

   `agro hands exec` is SSH transport, not a container or runtime boundary.
   The command follows `--`. The exec exit status is the command exit status.
   With `--project`, the command runs in `projects/<owner>/<repo>` on the hand.
   On exe.dev hands, the command runs in a login shell, so `agro` resolves on `PATH`.
   After remote `agro run --help` and runtime checks confirm support, use this form for one-shot application work:

   ```bash
   agro hands exec <hand> --project <owner>/<repo> -- agro run -- <command>
   ```

   For persistent application work, enter the selected supported sandbox before execution.
   Keep interactive processes in Herdr and headless gateways/tunnels in named tmux sessions.

3. Commit the result on the hand with `agro hands exec` before fetching.
   Fetch transfers commits, not uncommitted workspace changes:

   ```bash
   agro hands fetch <hand> --project <owner>/<repo>
   ```

### Put a project on an existing hand

`agro hands create --project` is the only CLI path that pushes a branch.
For an existing hand, such as an enrolled exe.dev VM or an existing console hand, do these steps on the brain:

1. Prepare the project folder on the hand:

   ```bash
   agro hands exec <hand> -- git init -q projects/<owner>/<repo>
   agro hands exec <hand> -- git -C projects/<owner>/<repo> config receive.denyCurrentBranch updateInstead
   ```

2. Inspect the brain remote. If an existing remote differs, stop for advisor review; do not overwrite it.
   If the remote is missing, add it with the hand's SSH destination.
   For an exe.dev hand, run:

   ```bash
   git -C <harness-root>/projects/<owner>/<repo> remote add hand-<vm> <vm>.exe.xyz:projects/<owner>/<repo>
   ```

   For a console hand, use `hand-<index>` and `sandbox@<recorded-ssh-host>:projects/<owner>/<repo>`.

3. Push the current branch. `agro hands fetch` pins the host key alias, but no `agro hands` verb pushes to an existing hand.
   Pin the alias in `GIT_SSH_COMMAND` yourself.
   The alias is the VM name for an exe.dev hand and the hand uuid for a console hand:

   ```bash
   GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o HostKeyAlias=<vm>" git -C <harness-root>/projects/<owner>/<repo> push hand-<vm> HEAD
   ```

4. Continue with `agro hands exec <hand> --project <owner>/<repo> -- agro run -- <command>`, the commit, and `agro hands fetch`.

### Clone on the hand

For a GitHub source, `agro hands create --clone <owner>/<repo>` clones only on the hand.
Before fetching clone results, the matching brain checkout and brain remote must exist.
If the brain checkout is missing, complete the approved `/worktrees` project-clone workflow first.
The brain checkout is `<harness-root>/projects/<owner>/<repo>`; the hand checkout is `~/projects/<owner>/<repo>`.
On the brain, inspect the checkout and remote:
```bash
git -C <harness-root>/projects/<owner>/<repo> status --short
git -C <harness-root>/projects/<owner>/<repo> remote get-url hand-<index>
```
If only the remote is missing, add it with the SSH destination recorded at creation.
For a console hand, run:
```bash
git -C <harness-root>/projects/<owner>/<repo> remote add hand-<index> sandbox@<recorded-ssh-host>:projects/<owner>/<repo>
```
For an exe.dev hand, use `hand-<vm>` and the destination `<vm>.exe.xyz:projects/<owner>/<repo>`.
For a boat hand, use `hand-<id>` and the destination `<id>:projects/<owner>/<repo>`. `agro hands fetch` sets `GIT_SSH_COMMAND="boat ssh"`.
If an existing remote differs, stop for advisor review; do not overwrite it.
Then fetch committed results with `agro hands fetch <hand> --project <owner>/<repo>`.
Do not inspect credentials or bypass lifecycle, guard, or HTTP 403 refusals for this setup.

For an approved fork, use `agro hands fork <hand>` with flags from installed help.
Do not infer fork authority from permission to create a different hand.

## Verify

Inspect the execution exit code and fetched commits on the brain.
The advisor, not the hand, accepts the result.
Run `agro hands list` before finishing.
Account for each hand created, forked, or enrolled for this task.

## Cleanup

Within the approved scope, destroy a completed hand:

```bash
agro hands destroy <hand> --yes
```

If the same task needs the hand again, use `agro hands pause <hand>`.
Use `agro hands resume <hand>` before continuing that task.
Each provider supports `pause` and `resume`.
Confirm the resulting state with `agro hands list`.
Never destroy an unrelated hand or a borrowed VM.

## Failure remedies

If the console returns HTTP 403, stop. Do not retry.
Report `BRAIN_TOKEN_FORBIDDEN` or `BRAIN_TOKEN_TARGET_FORBIDDEN` to the operator.
Do not inspect the token or switch credentials to bypass the refusal.
The `exedev` provider refuses a write to a VM without the tag `agro-hand` and to the brain itself.
The `boat` provider refuses a write to a sandbox whose name does not start with `agro-hand-`, to the `BOAT_ID` sandbox, and to `self`.
If a guard refuses, stop and report the refusal. Do not tag a VM or rename a target to pass the guard.
If `ssh exe.dev whoami` fails, `agro hands` exits 2.
Ask the operator to register the brain SSH key with the exe.dev account.
If installed help lacks the requested command, report the capability gap.
If no supported runtime is available, stop and report the capability gap.
Do not silently run application work on the raw host or use a raw provider fallback.
