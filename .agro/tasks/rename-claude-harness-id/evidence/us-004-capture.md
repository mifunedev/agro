# US-004 capture: quickstart harness-install screenshot

This file records the retake of `docs/img/quickstart-harness-install.png`. The
capture ran `agro harness install claude` with the CLI built from the task
branch, in a Herdr pane in a sandbox on one temporary agro-console node.

## Approval

The operator approved the capture target through the advisor before the worker
created any resource:

1. A local Docker sandbox on this host. The capture could not use it, because
   this session runs inside the sandbox `agro-sbx-local`, and `agro sandbox`
   refuses to run inside a sandbox. During that attempt, an in-sandbox
   `agro destroy agro-sbx-1525-capture --yes` stopped `agro-sbx-local` instead
   of refusing. The container restarted, and the worker reported the incident
   to the advisor.
2. A free-tier agro-console node. `agro node create --free-tier --name agro-1525-capture --json`
   exited 1 with `HTTP 403 FREE_TIER_INELIGIBLE: Only the owner of a personal context can create a free node`.
3. Exactly one paid `n4` node, deleted after the capture. The capture used this target.

## Node

| Step | Command | Exit status | Time (UTC) |
|---|---|---|---|
| Create | `agro node create --spec n4 --name agro-1525-capture --json` | 0 | 2026-10-26T04:51:13Z |
| Delete | `agro node delete 490e8ec2-e9dc-45b8-9e13-0d8e024c6de0 --yes` | 0 | 2026-10-26T04:56:41Z |
| List | `agro node list` | 0 | after the delete |

- Node id: `490e8ec2-e9dc-45b8-9e13-0d8e024c6de0`, name `agro-1525-capture`, profile `sandbox`.
- Wall-clock lifetime: about 5 minutes 29 seconds.
- Delete output: `deleted 490e8ec2-e9dc-45b8-9e13-0d8e024c6de0`.
- `agro node list` after the delete:

  ```text
  ID                                    NAME                   PROFILE  STATUS     IPV4
  490e8ec2-e9dc-45b8-9e13-0d8e024c6de0  agro-1525-capture      sandbox  destroyed  -
  ```

This record omits the public IPv4 address of the node.

## Setup on the node host

All steps ran over SSH on the node host, never in the operator sandbox.

1. `curl -fsSL https://github.com/mifunedev/agro/releases/latest/download/install.sh | bash`.
   `agro --version` printed `0.26.0`.
2. `git config --global user.name "Demo User"` and
   `git config --global user.email demo@example.com`.
3. `agro sandbox install docker --name agro-1525-capture --yes`. Exit status: 0.
   The sandbox ran `ghcr.io/mifunedev/agro:0.26.0`. In the sandbox,
   `git config --global user.name` printed `Demo User`, and
   `git config --global user.email` printed `demo@example.com`.
4. The worker ran `pnpm run build:harness` in the worktree (exit status 0) and
   copied `.agro/cli/dist/agro.js` to `/opt/agro/dist/agro.js` in the sandbox
   container. `/usr/local/bin/agro` resolves to that file. Both copies have
   the SHA-256 `b9e3af1e3ebe0967d9c885e8ae8f0a529cb27a7f082cb6cad4caadc600430d1d`.
5. In the sandbox, `agro harness list` listed `claude`, and
   `agro harness install claude-code` printed
   `agro harness: "claude-code" is a deprecated alias for "claude"; the alias stops working in 0.29.0`
   on stderr. The in-sandbox CLI is the branch build.
6. In the sandbox, `agro tool install herdr` installed `herdr 0.7.4`.
7. On the node host, the named tmux session `capture-ttyd` ran ttyd 1.7.7 on
   `127.0.0.1:7681`:

   ```bash
   ttyd -i 127.0.0.1 -p 7681 -W -t fontSize=18 -t rendererType=dom -t disableLeaveAlert=true \
     docker exec -it -e TERM=xterm-256color -u sandbox -w /home/sandbox/harness agro-1525-capture herdr
   ```

8. An SSH local forward sent `127.0.0.1:17681` on the worker side to the ttyd
   port. The capture used no public port.
9. `herdr workspace create --cwd /home/sandbox/harness --label harness --focus`
   made the workspace `harness` with the pane `w2:p1`.

## Capture

1. `agent-browser --session us004-1525 set viewport 1280 720 1.5`, then open
   `http://127.0.0.1:17681/`.
2. The worker typed `agro harness install claude` into the Herdr pane with
   `agent-browser keyboard type` and pressed Enter.
3. `herdr wait output w2:p1 --match "claude: installed" --source recent --timeout 300000`
   exited 0. The pane printed:

   ```text
   claude: installed — see https://github.com/mifunedev/agro/blob/main/docs/harnesses/claude-code.md for authentication
   ```

   `claude --version` in the sandbox printed `2.1.310 (Claude Code)`.
4. A short viewport resize to 1200x700 and back to 1280x720 made Herdr redraw
   the pane, so the long lines wrap correctly.
5. Two invisible `div[data-capture-target]` boxes cover the command row and the
   two result rows inside the pane. They give the callouts a CSS selector and
   do not change the page look.
6. `AGENT_BROWSER_SESSION=us004-1525 .agro/skills/agent-browser/scripts/annotate-screenshot.sh <scratchpad>/annotated.png '[data-capture-target="command"]=the command in a Herdr pane' '[data-capture-target="result"]=the install result'`.
   Exit status: 0. Output: `Callouts: 1 is the command in a Herdr pane. 2 is the install result.`
   The line matches the `Callouts:` line in `docs/quickstart.md`.
7. The PNG is 1920x1080. The worker copied the PNG to
   `docs/img/quickstart-harness-install.png`.

## Checks

- `pnpm exec vitest run .agro/scripts/__tests__/docs-images.test.ts`: 1 file, 10 tests passed.
- The image shows the prompt `$`, the Herdr workspace `harness`, and real
  install output. The image shows no name, email address, token, host path of
  the operator, or IP address.
- The alt text in `docs/quickstart.md` is
  `A Herdr pane in the sandbox runs agro harness install claude.` The worker did
  not change `docs/quickstart.md`.
