# Manual review transcript (US-006)

The worker copied each expected result from an observed run on 2026-10-25. `<scratchpad>` is the session scratchpad directory. `<fixture>` is the fixture repository of the scenario.

## Setup

Prerequisites: a checkout of the AGRO harness at `/home/sandbox/harness` with the task branch commits. The operator signed in to Claude Code `2.1.310 (Claude Code)`. All steps run in the sandbox, local.

1. Copy the current `next.sh` of the task branch to the scratchpad:

   ```bash
   cp .agro/skills/delegate/scripts/next.sh <scratchpad>/next.sh
   ```

   Expected exit status: 0.

## Scenarios

**A. Story states of this task**

Prerequisites: the setup step. Runs in the sandbox, local, from `/home/sandbox/harness`.

1. For each task branch commit, make a detached worktree, run the copied `next.sh`, and remove the worktree:

   ```bash
   for c in 75faae3f 9b925dd7 c6bb12db 1d526e26 158258f3 f88f7137; do
     git worktree add --detach <scratchpad>/wt-$c $c
     (cd <scratchpad>/wt-$c && bash <scratchpad>/next.sh --task task-lifecycle-owner)
     bash .agro/scripts/git-maintenance.sh worktree-remove <scratchpad>/wt-$c
   done
   ```

   Expected output, two lines for each commit:

   ```text
   75faae3f feat: plan task-lifecycle-owner (#1512)
   story US-001
   Dispatch, verify, and accept US-001 per /delegate.

   9b925dd7 feat: accept US-001 (#1512)
   story US-002
   Dispatch, verify, and accept US-002 per /delegate.

   c6bb12db feat: accept US-002 (#1512)
   story US-003
   Dispatch, verify, and accept US-003 per /delegate.

   1d526e26 feat: accept US-004 (#1512)
   story US-003
   Dispatch, verify, and accept US-003 per /delegate.

   158258f3 feat: accept US-005 (#1512)
   story US-003
   Dispatch, verify, and accept US-003 per /delegate.

   f88f7137 feat: accept US-003 (#1512)
   story US-006
   Dispatch, verify, and accept US-006 per /delegate.
   ```

   Expected exit status of each `next.sh` run: 0.

   `next.sh` prints the ready story with the lowest priority. US-003 has priority 3 and stayed open while the advisor accepted US-004 and US-005 in parallel. Thus `next.sh` printed `story US-003` at three commits and did not print `story US-004` or `story US-005`. The `passes` values at each commit confirm this:

   ```bash
   git show 1d526e26:.agro/tasks/task-lifecycle-owner/prd.json | jq -c '[.userStories[] | {id, passes}]'
   ```

   Expected output: `[{"id":"US-001","passes":true},{"id":"US-002","passes":true},{"id":"US-003","passes":false},{"id":"US-004","passes":true},{"id":"US-005","passes":false},{"id":"US-006","passes":false}]`.

2. Failure path. Run `next.sh` with `--task` and no slug:

   ```bash
   bash <scratchpad>/next.sh --task
   ```

   Expected output: `usage: next.sh [--task <slug>]`. Expected exit status: 2.

3. Failure path. Run `next.sh` with the slug `no-such-task`. The task directory of this slug has no `prd.json`:

   ```bash
   bash <scratchpad>/next.sh --task no-such-task
   ```

   Expected output: `none` and `Stop.`. Expected exit status: 0.

**B. One Claude Code Stop hook block and the continuation**

Prerequisites: a signed-in Claude Code. Runs in the sandbox, local.

1. Make a new git repository `<fixture>` with one commit and these files:

   - `.claude/settings.json` with only this Stop hook entry:

     ```json
     {"hooks":{"Stop":[{"hooks":[{"type":"command","command":"bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/task-next-stop.sh","timeout":30}]}]}}
     ```

   - `.claude/hooks/task-next-stop.sh`, a copy of `.agro/hooks/task-next-stop.sh`.
   - `.agro/skills/delegate/scripts/next.sh`, a fake state script:

     ```bash
     #!/usr/bin/env bash
     cd "$(git rev-parse --show-toplevel)"
     if [ -e done.flag ]; then
       printf '%s\n%s\n' done Stop.
     else
       printf '%s\n%s\n' "story US-001" "Create the file done.flag in the repository root, then stop."
     fi
     ```

   Expected: `git log --oneline` shows `26f508e fixture`.

2. Run one headless session in `<fixture>`:

   ```bash
   command claude -p "Reply with the word OK." --dangerously-skip-permissions --output-format json --max-turns 6
   ```

   Expected exit status: 0. Expected result fields:

   ```json
   {
     "type": "result",
     "subtype": "success",
     "is_error": false,
     "num_turns": 4,
     "result": "I created an empty `done.flag` file in the repository root for story US-001. Running `next.sh` again printed \"done\" and \"Stop.\", so there's nothing left to do.",
     "stop_reason": "end_turn",
     "session_id": "94aa7a08-4ac8-4030-8ba3-df723654b2e2"
   }
   ```

3. Read the session transcript `~/.claude/projects/<fixture-key>/94aa7a08-4ac8-4030-8ba3-df723654b2e2.jsonl`. Expected sequence, trimmed:

   ```text
   user       Reply with the word OK.
   assistant  OK
   user       Stop hook feedback:
              story US-001
              Create the file done.flag in the repository root, then stop.
              Run bash .agro/skills/delegate/scripts/next.sh again after the action.
   assistant  Bash: touch done.flag && ls -la done.flag && cat .agro/skills/delegate/scripts/next.sh
   assistant  Bash: bash .agro/skills/delegate/scripts/next.sh
   user       done
              Stop.
   assistant  I created an empty `done.flag` file in the repository root for story US-001. ...
   ```

   Expected: the first `stop_hook_summary` entry has `hookErrors` equal to `["story US-001\nCreate the file done.flag in the repository root, then stop.\nRun bash .agro/skills/delegate/scripts/next.sh again after the action."]`. The second `stop_hook_summary` entry has `"hookErrors":[]`.

4. Check the fixture state after the session:

   ```bash
   ls done.flag && cat .git/agro-next-stop
   ```

   Expected output:

   ```text
   done.flag
   story US-001
   26f508e0be7d7c61767d1848b89a5030fd9a87c5
   1
   ```

   The hook blocked one time at `story US-001`. At the second stop, `next.sh` printed `done`, and the hook let the session stop.

**C. No-progress release after 3 blocks**

Prerequisites: none. Runs in the sandbox, local.

1. Make a new git repository `<fixture>` with one commit. Its `.agro/skills/delegate/scripts/next.sh` always prints the `review` state:

   ```bash
   #!/usr/bin/env bash
   printf '%s\n%s\n' review 'Review the task diff and record review in prd.json per /delegate.'
   ```

   Make `<scratchpad>/escalate-stub.sh`. The stub appends its arguments to `<scratchpad>/escalate.log`:

   ```bash
   #!/usr/bin/env bash
   printf "%s\n" "$*" >> <scratchpad>/escalate.log
   ```

   Expected: `git log --oneline` shows `554c851 fixture`.

2. From the task branch checkout, send 4 Stop events to the canonical hook:

   ```bash
   for i in 1 2 3 4; do
     echo "--- stop $i"
     printf '{"cwd":"<fixture>"}' | AGRO_ESCALATE_SCRIPT=<scratchpad>/escalate-stub.sh bash .agro/hooks/task-next-stop.sh
   done
   ```

   Expected output:

   ```text
   --- stop 1
   {"decision":"block","reason":"review\nReview the task diff and record review in prd.json per /delegate.\nRun bash .agro/skills/delegate/scripts/next.sh again after the action."}
   --- stop 2
   {"decision":"block","reason":"review\nReview the task diff and record review in prd.json per /delegate.\nRun bash .agro/skills/delegate/scripts/next.sh again after the action."}
   --- stop 3
   {"decision":"block","reason":"review\nReview the task diff and record review in prd.json per /delegate.\nRun bash .agro/skills/delegate/scripts/next.sh again after the action."}
   --- stop 4
   ```

   Expected exit status of each run: 0. Stop 4 prints nothing, so the session can stop.

3. Read the counter file and the escalation log:

   ```bash
   cat <fixture>/.git/agro-next-stop; cat <scratchpad>/escalate.log
   ```

   Expected output:

   ```text
   review
   554c8516e8d79b79735c0d67939d1484b8402f53
   4
   --summary master lifecycle hook released a stop after 3 blocks with no progress at state review --needs Decide how to unblock review --key master-review
   ```

   Expected: `escalate.log` has exactly 1 line.

**D. Operator nudges**

1. Count the operator messages between the plan approval message "Approve advisor recommendations." and this transcript. Expected: 0 operator messages. The advisor supplied this count. At `ready`, the advisor appends the final count during Close.

## Cleanup

1. Remove each detached worktree of scenario A with `bash .agro/scripts/git-maintenance.sh worktree-remove <scratchpad>/wt-<sha>`. Expected: `git worktree list` shows no `wt-` entry.
2. Delete the fixtures, the scratchpad copy of `next.sh`, the escalate stub, and the escalation log:

   ```bash
   rm -rf <scratchpad>/claude-fixture <scratchpad>/release-fixture <scratchpad>/next.sh <scratchpad>/escalate-stub.sh <scratchpad>/escalate.log
   ```

   Expected exit status: 0.

## Close-time states (appended by the advisor)

The advisor ran `bash .agro/skills/delegate/scripts/next.sh` on the task branch in `/home/sandbox/harness/.worktrees/skill/1512-task-lifecycle-owner` after each step. Each run exited 0.

1. After US-006 acceptance (`a0dd320e`):

   ```text
   review
   Review the task diff and record review in prd.json per /delegate.
   ```

2. Review round 1 reviewed `a0dd320e` and returned `fail` with one blocking finding. The advisor ran the reviewer command and observed exit 0 from the Lessons gate on the placeholder. The advisor reopened US-001 (`rounds: 1`), and `next.sh` printed:

   ```text
   story US-001
   Dispatch, verify, and accept US-001 per /delegate.
   ```

3. After the US-001 repair (`96060362`), `next.sh` printed `review` again. Review round 2 reviewed `960603629e216ce27d422c0e84cc63f934c0c1c0` and returned `pass` with 7 non-blocking findings.
4. After the review record (`2b0481bc`):

   ```text
   close
   Write a non-empty ## Lessons section in prd.md per /git § Ready for review.
   ```
5. The advisor committed Lessons (`60d9a750`). `next.sh` printed `push`. After `git push`, `next.sh` printed `ready` while GitHub still reported the previous head. The advisor reopened US-002 (`rounds: 1`) and left the PR in draft.

   ```text
   push
   Run git push.
   ready
   Run gh pr ready 1513.
   ```

6. After the US-002 repair (`abb53611`), `next.sh` printed `review`. Review round 3 reviewed `abb5361163e94bcc32f36634a79439deb656ea7c` and returned `pass` with 7 non-blocking findings.
7. After the push of `434bf840`, `next.sh` printed `ci`. `timeout 900 gh pr checks 1513 --repo mifunedev/agro --watch` exited 0, and each check passed or skipped. `next.sh` then printed:

   ```text
   ci
   Run /ci-status and wait for the result.
   ready
   Run gh pr ready 1513.
   ```

8. The operator sent 0 messages between plan approval ("Approve advisor recommendations.") and the `ready` state.
9. This transcript commit changes only `.agro/tasks/task-lifecycle-owner/`. The advisor pushes the commit, waits for CI on the new head, and runs `gh pr ready 1513`.
