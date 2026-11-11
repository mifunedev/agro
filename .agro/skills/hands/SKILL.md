---
name: hands
description: |
  Use hands from a brain: create a sandbox node with `agro hands`, move a
  project to it, run commands there over SSH, fetch the result, and destroy
  or pause the hand. Covers when a hand is worth its cost, the token and 403
  rules, and fork credential risk.
  TRIGGER when: asked to run this on a hand, spin up a sandbox node, parallelize
  on hands, fork the environment, offload a heavy build or test run from a
  brain, or run `agro hands`.
allowed-tools: Bash
---

# Hands

A brain is an AGRO node that holds the operator's projects and history. A hand
is a sandbox node that the brain creates through the console. The hand does
heavy or parallel work. The brain keeps the history. `agro hands` is the only
interface. Run `agro hands --help` for the flags. Write the hand index without
`#` in a shell, because the shell reads an unquoted `#7` as a comment.

## When to use a hand

Use a hand when one of these conditions is true:

- The work needs more CPU, memory, or disk than the brain has.
- Two or more tasks must run in parallel without a shared checkout.
- A command can damage the environment, and the brain must stay clean.

Do short, light work on the brain. A hand costs money from creation until you
destroy the hand.

## Flow

1. Create the hand with the project. `--project <owner>/<repo>` pushes the
   current branch of the brain project to the hand.
   `--clone <owner>/<repo>` clones the project from GitHub on the hand.

   ```bash
   agro hands create --project <owner>/<repo>
   ```

2. Run commands on the hand. Pass the command after `--`. The exit status of
   `agro hands exec` is the exit status of the command. Commit the result on
   the hand with `agro hands exec` before the fetch.

   ```bash
   agro hands exec <index> --project <owner>/<repo> -- <command>
   ```

3. Fetch the commits of the hand into the brain project. The brain remote for
   the hand is `hand-<index>`.

   ```bash
   agro hands fetch <index> --project <owner>/<repo>
   ```

4. Destroy the hand when the work is complete. Pause the hand when you need it
   again in the same task.

   ```bash
   agro hands destroy <index> --yes
   ```

Run `agro hands list` before you finish. Destroy or pause each hand that you
created.

## Rules

- Never read, print, or copy the brain token. `agro hands` reads the token.
- If the console returns HTTP 403 (`BRAIN_TOKEN_FORBIDDEN` or
  `BRAIN_TOKEN_TARGET_FORBIDDEN`), stop. Do not retry. Report the code to the
  operator.
- A fork copies the disk of the hand, with its credentials. Fork a hand only
  when each credential on the hand can go to the new hand.
- To install a coding agent on the brain, run
  `agro harness install <name> --host`.
