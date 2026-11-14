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
Keep short, light work on the brain. A hand uses paid provider resources from creation until destruction.

One brain uses one provider. `hands.provider` in `<harness-root>/agro.json` selects the provider:

| | `console` (default) | `exedev` |
|---|---|---|
| `<hand>` | index, alias, or uuid | exe.dev VM name |
| Credential | brain token | brain SSH key on the exe.dev account |
| Enrollment | `create` only | `create`, or the tag `agro-hand` on an existing VM |
| Brain remote | `hand-<index>` | `hand-<vm>` |
| SSH destination | `sandbox@<recorded-ssh-host>` | `<vm>.exe.xyz`, login shell |
| Authority fence | console token scope | tag guard and brain guard in the CLI |

`<harness-root>` is the brain harness root. `agro hands --help` states how the CLI resolves it.
Do not guess the provider from the host. Read `hands.provider` in `<harness-root>/agro.json`.
To select exe.dev on an exe.dev brain, run `agro config set hands.provider exedev` at the harness root.

These operator requests select this route:

- "Offload the current branch of mifunedev/<repo> to hand sbx-dev-001, run pnpm test, commit, and fetch it here."
- "Run <command> on hand sbx-dev-001 in mifunedev/<repo>."
- "List my hands."
- "Pause hand sbx-dev-001" and "Resume hand sbx-dev-001".
- "Make agro-sbx-dev-001 a hand." This request enrolls an existing exe.dev VM.
- "Create a new hand for mifunedev/<repo>. I authorize creating it and destroying it after you accept the result."
- "Fork hand sbx-dev-001; its credentials may go to the copy."
- "Destroy hand sbx-dev-001 — it's task-owned and accepted."

This route uses `agro hands` for project offload.
The validation driver's `console` adapter instead uses `agro node`.
Its internal ID stays `console`; do not substitute `agro hands` in that adapter.
A console node from `agro node create` is not a hand unless a brain manages it.

## Prerequisites

- Get explicit operator authority for billable create/fork operations and the teardown scope.
- Confirm brain context and inspect `agro hands --help` on the installed CLI.
  Check each subcommand's help before using its flags.
- Before application build/test/install workloads, inspect the hand's runtime capabilities through SSH.
  Select `agro run` for one-shot execution or a supported persistent sandbox before application execution.
- Never read, print, or copy the brain token. `agro hands` reads the token.
- For `exedev`, the brain SSH key must be on the exe.dev account. `agro hands` checks it with `ssh exe.dev whoami`.
  Send no token, `.env` file, or private key to a hand.
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
Both providers support `pause` and `resume`.
Confirm the resulting state with `agro hands list`.
Never destroy an unrelated hand or a borrowed VM.

## Failure remedies

If the console returns HTTP 403, stop. Do not retry.
Report `BRAIN_TOKEN_FORBIDDEN` or `BRAIN_TOKEN_TARGET_FORBIDDEN` to the operator.
Do not inspect the token or switch credentials to bypass the refusal.
The `exedev` provider refuses a write to a VM without the tag `agro-hand` and to the brain itself.
If a guard refuses, stop and report the refusal. Do not tag a VM or rename a target to pass the guard.
If `ssh exe.dev whoami` fails, `agro hands` exits 2.
Ask the operator to register the brain SSH key with the exe.dev account.
If installed help lacks the requested command, report the capability gap.
If no supported runtime is available, stop and report the capability gap.
Do not silently run application work on the raw host or use a raw provider fallback.
