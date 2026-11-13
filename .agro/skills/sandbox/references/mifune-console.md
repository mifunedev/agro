# mifune-console

## Choose when

A brain is an AGRO node that holds the operator's projects and history.
A hand is a remote sandbox node that the brain creates through the console.
The hand does heavy or parallel work. The brain keeps the history.
Choose a hand for more CPU, memory, or disk, isolated parallel work, or potentially damaging commands.
Keep short, light work on the brain. A hand costs money from creation until destruction.

This route uses `agro hands` for project offload.
The validation driver's `console` adapter instead uses `agro node`.
Its internal ID stays `console`; do not substitute `agro hands` in that adapter.

## Prerequisites

- Get explicit operator authority for billable create/fork operations and the teardown scope.
- Confirm brain context and inspect `agro hands --help` on the installed CLI.
  Check each subcommand's help before using its flags.
- Before application build/test/install workloads, inspect the hand's runtime capabilities through SSH.
  Select `agro run` for one-shot execution or a supported persistent sandbox before application execution.
- Never read, print, or copy the brain token. `agro hands` reads the token.
- A fork copies the hand disk, including credentials.
  Fork only when every credential on the source hand can go to the new hand.
- Use `/worktrees` for checkout isolation.
- To install a coding agent on the brain, use the approved
  `agro harness install <name> --host` procedure.

## Execute

Run these commands on the brain.
Write the hand index without `#`; an unquoted `#7` starts a shell comment.

1. Create the approved hand with the project:

   ```bash
   agro hands create --project <owner>/<repo>
   ```

   `--project` pushes the current branch of the brain project.
   Use `agro hands create --clone <owner>/<repo>` to clone from GitHub instead.
   Record the returned index and ownership.

2. Use generic exec for bounded host/control-plane operations:

   ```bash
   agro hands exec <index> --project <owner>/<repo> -- <command>
   ```

   `agro hands exec` is SSH transport, not a container or runtime boundary.
   The command follows `--`. The exec exit status is the command exit status.
   After remote `agro run --help` and runtime checks confirm support, use this form for one-shot application work:

   ```bash
   agro hands exec <index> --project <owner>/<repo> -- agro run -- <command>
   ```

   For persistent application work, enter the selected supported sandbox before execution.
   Keep interactive processes in Herdr and headless gateways/tunnels in named tmux sessions.

3. Commit the result on the hand with `agro hands exec` before fetching.
   Fetch transfers commits, not uncommitted workspace changes:

   ```bash
   agro hands fetch <index> --project <owner>/<repo>
   ```

   The brain remote for the hand is `hand-<index>`.

For an approved fork, use `agro hands fork <index>` with flags from installed help.
Do not infer fork authority from permission to create a different hand.

## Verify

Inspect the execution exit code and fetched commits on the brain.
The advisor, not the hand, accepts the result.
Run `agro hands list` before finishing.
Account for each hand created or forked for this task.

## Cleanup

Within the approved scope, destroy a completed hand:

```bash
agro hands destroy <index> --yes
```

If the same task needs the hand again, use `agro hands pause <index>`.
Use `agro hands resume <index>` before continuing that task.
Confirm the resulting state with `agro hands list`.
Never destroy an unrelated hand.

## Failure remedies

If the console returns HTTP 403, stop. Do not retry.
Report `BRAIN_TOKEN_FORBIDDEN` or `BRAIN_TOKEN_TARGET_FORBIDDEN` to the operator.
Do not inspect the token or switch credentials to bypass the refusal.
If installed help lacks the requested command, report the capability gap.
If no supported runtime is available, stop and report the capability gap.
Do not silently run application work on the raw host or use a raw provider fallback.
