# Manual review — the PR section standard

The `## Manual review` section of a PR body lists the steps that a reviewer runs
to confirm what shipped. The section comes directly after `## Where it
diverged`. The reference example is the `## Manual review` section of
mifunedev/agro-console#185.

## Contents

- [Rules](#rules)
- [Choose the shape](#choose-the-shape)
- [User-journey shape](#user-journey-shape)
- [Server, CLI, or API shape](#server-cli-or-api-shape)

## Rules

- Copy each expected result from an observed run. Never write a predicted
  result.
- Add a cleanup step for each step that creates a resource.
- `## Verification` lists the commands that the agent ran.
  `## Manual review` lists the steps that the reviewer runs.
- Keep each evidence file under `.agro/tasks/<slug>/evidence/`.
- Commit each evidence file that the section links. If the repository ignores
  the path, add the file with `git add -f <path>`.
- Link each evidence file by `blob/<commit-sha>/<path>?raw=true`.
  `<commit-sha>` is the full 40-character head commit of the PR. Never link
  by a branch name. GitHub deletes the head branch after the merge, and a
  branch link then returns HTTP 404.
- Under each screenshot block, add a line that starts with `Callouts:` in the
  same step. The line names each numbered callout.
- In a private repository, an image renders only for a reviewer who is signed
  in to GitHub.
- "N/A" is not a valid body. If the change has no user interface, server, CLI,
  or API, use the server, CLI, or API shape. Give the command that proves the
  change, for example the probe that guards the change.

## Choose the shape

| Change | Shape |
|---|---|
| A user interface change | User-journey shape |
| A server, CLI, or API change | Server, CLI, or API shape |
| A change with no runnable surface | Server, CLI, or API shape |

A change that touches a user interface and a server uses both shapes.

## User-journey shape

Write these parts in this sequence:

1. **Setup.** Give the numbered steps that prepare the environment. State where
   each step runs.
2. **Scenarios.** Give each scenario a letter and a title, for example
   `**A. Baseline and in-place restore**`. Number the steps in each scenario.
3. **Expected result.** End each step with `Expected:` and the exact visible
   text in quotes.
4. **Screenshot.** Under each UI step, add an annotated screenshot in a
   `<details><summary>Screenshot</summary>` block. Mark each value to check
   with a numbered callout. Take the screenshot with
   `.agro/skills/agent-browser/scripts/annotate-screenshot.sh <path> <selector>=<label>...`.
   Each screenshot needs its `Callouts:` line. The script prints that line.
5. **Cleanup.** Give the steps that delete each resource that the scenarios
   create.

Example, trimmed from mifunedev/agro-console#185:

```markdown
**Setup (host dev environment)**

1. Check out `feat/184-node-recovery-points`, then run `pnpm install` and `pnpm db:migrate`.
   Expected: migrations `0025_node_recovery_points` and `0026_node_source_recovery_point` show `applied`.

**A. Baseline and in-place restore**

1. Create a node on the create page. Expected: the Recovery point card shows
   "Creating recovery point", then "Baseline" with a time.
   <details><summary>Screenshot</summary>

   <img src="https://github.com/<owner>/<repo>/blob/<commit-sha>/.agro/tasks/<slug>/evidence/journey-03-baseline-ready.png?raw=true" width="720" alt="Card shows the ready Baseline point">
   </details>
   Callouts: 1 is the card title. 2 is the "Baseline" time.

**E. Cleanup**

1. Destroy each review node, then delete each kept recovery point from its
   destroyed page. Expected: no recovery point remains on any review node.
```

## Server, CLI, or API shape

Give these parts for each step:

1. **Prerequisites.** State each prerequisite of the step, for example a
   running service, a signed-in CLI, or a seeded database.
2. **Location.** State where the command runs: host or sandbox, local or
   remote.
3. **Command.** Give the exact command in a code block.
4. **Output.** Give the example output, trimmed to the lines that matter.
5. **Exit status.** State the expected exit status.
6. **Failure path.** Give one or more failure commands. Give the error output
   and the exit status of each failure command.

Add a cleanup step for each step that creates a resource.

Example, from an observed run:

````markdown
**A. The STE checker**

Prerequisites: a checkout of the AGRO harness. Runs in the sandbox, local.

1. Run the checker against the approved specimens:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh --blocks after .agro/skills/ste/references/examples.md
   ```

   Expected output starts with `ste-check: no findings in 1 file(s).` Expected exit status: 0.

2. Failure path. Run the checker with a tag that matches no block:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh --blocks nosuchtag .agro/skills/ste/references/examples.md
   ```

   Expected output: `ste-check: no fenced block tagged "nosuchtag" in 1 file(s); nothing was scanned`. Expected exit status: 2.
````
