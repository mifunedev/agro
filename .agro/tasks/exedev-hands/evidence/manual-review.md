# Manual review — exe.dev hands on agro-sbx-dev-001 (US-008)

Observed run on 2026-11-14 at about 17:55–18:01 UTC.

- Brain: exe.dev VM `agro-supervisor` (`hostname` prints `agro-supervisor`).
- Hand: exe.dev VM `agro-sbx-dev-001`, tag `agro-hand`.
- CLI: built from branch `feat/1623-exedev-hands` at `6ea2802b28ddf696240313b835b1a29a5ccc1722` with `node .agro/cli/build.mjs`.
- `AGRO` below means `node <worktree>/.agro/cli/dist/agro.js`.
- `hands.provider` is passed for this run only. `$T` is a fresh `mktemp -d`. Every `agro hands` command has `AGRO_HOME=$T` inline. `$T/workspaces/harness/agro.json` is `{"version":1,"hands":{"provider":"exedev"}}`. The real `~/.agro/workspaces/harness/agro.json` has no `provider` key before and after the run.
- `$B` means the scratch brain project `$T/workspaces/harness/projects/exedev-hands-review/scratch`.

Operator authority used: read-only checks, exec on the hand, one commit in a scratch repo on the hand, fetch, and pause and resume of `agro-sbx-dev-001`. The run created, forked, destroyed, tagged, and untagged no VM or console node. The run did not touch `~/projects/mifunedev` on the hand.

**A. Baseline (read-only)**

Prerequisites: brain SSH key accepted by `exe.dev`. Runs on the brain.

1. Capture the account state, reduced to `vm_name`, `status`, and `tags` with `python3 -I`:

   ```bash
   ssh exe.dev ls --json | python3 -I reduce.py
   ```

   Output (BEFORE):

   ```json
   [
    {"vm_name": "agro-sbx-dev-001", "status": "running", "tags": ["agro-hand"]},
    {"vm_name": "agro-supervisor", "status": "running", "tags": []}
   ]
   ```

   Exit status: 0.

2. Prepare fresh state and the scratch brain project:

   ```bash
   T=$(mktemp -d)
   mkdir -p $T/workspaces/harness/projects/exedev-hands-review/scratch
   echo '{"version":1,"hands":{"provider":"exedev"}}' > $T/workspaces/harness/agro.json
   cd $B && git init -q && echo review > README.md && git add README.md && git -c user.name=agro-review -c user.email=review@invalid commit -qm "scratch readme"
   ```

   Output: `dd227c5 scratch readme` on branch `main`. Exit status: 0.

3. Read-only gate. List the hands:

   ```bash
   AGRO_HOME=$T AGRO hands list
   ```

   Output:

   ```text
   NAME              STATUS   SSH HOST
   agro-sbx-dev-001  running  agro-sbx-dev-001.exe.xyz
   ```

   Expected: lists `agro-sbx-dev-001`, exit 0. Observed: lists `agro-sbx-dev-001`, exit 0. The gate passed. `agro-supervisor` has no tag, so it is not listed.

**B. Put the scratch project on the existing hand**

Prerequisites: steps A1–A3. Runs on the brain; each `hands exec` runs on the hand over SSH.

1. Inspect the hand projects folder before any write:

   ```bash
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 -- ls -a projects
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 -- test -e projects/exedev-hands-review
   ```

   Output: `Warning: Permanently added 'agro-sbx-dev-001' (RSA) to the list of known hosts.`, then `.`, `..`, `mifunedev`. Exit status: 0 for `ls`, 1 for `test -e` (the scratch path did not exist).

2. Prepare the hand folder:

   ```bash
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 -- git init -q projects/exedev-hands-review/scratch
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 -- git -C projects/exedev-hands-review/scratch config receive.denyCurrentBranch updateInstead
   ```

   Output: none. Exit status: 0 and 0.

3. Inspect, then add the brain remote:

   ```bash
   git -C $B remote get-url hand-agro-sbx-dev-001
   git -C $B remote add hand-agro-sbx-dev-001 agro-sbx-dev-001.exe.xyz:projects/exedev-hands-review/scratch
   ```

   Output: `error: No such remote 'hand-agro-sbx-dev-001'` (exit 2, remote missing as expected), then no output (exit 0).

4. Push the current branch with the pinned host key alias:

   ```bash
   GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o HostKeyAlias=agro-sbx-dev-001" git -C $B push hand-agro-sbx-dev-001 HEAD
   ```

   Output:

   ```text
   To agro-sbx-dev-001.exe.xyz:projects/exedev-hands-review/scratch
    * [new branch]      HEAD -> main
   ```

   Exit status: 0.

**C. exec, one commit on the hand, fetch**

Prerequisites: section B. Runs on the brain.

1. Run a command in the project folder on the hand:

   ```bash
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 --project exedev-hands-review/scratch -- git log --oneline -1
   ```

   Expected: the pushed brain commit, exit 0. Observed: `dd227c5 scratch readme`, exit 0.

2. Make one commit on the hand:

   ```bash
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 --project exedev-hands-review/scratch -- sh -c 'echo hand > hand.txt && git add hand.txt && git -c user.name=agro-review -c user.email=review@invalid commit -qm "hand commit"'
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 --project exedev-hands-review/scratch -- git log --oneline -2
   ```

   Output: none (exit 0), then `a5301f0 hand commit` and `dd227c5 scratch readme` (exit 0). The quoted `sh -c` argument survived the login-shell wrapping.

3. Fetch the result to the brain:

   ```bash
   AGRO_HOME=$T AGRO hands fetch agro-sbx-dev-001 --project exedev-hands-review/scratch
   git -C $B log --oneline -1 hand-agro-sbx-dev-001/main
   ```

   Output:

   ```text
   From agro-sbx-dev-001.exe.xyz:projects/exedev-hands-review/scratch
      dd227c5..a5301f0  main       -> hand-agro-sbx-dev-001/main
   a5301f0 hand commit
   ```

   Expected: the brain ref contains "hand commit", exit 0. Observed: `a5301f0 hand commit`, exit 0 for both commands.

**D. pause and resume**

Prerequisites: section C. Runs on the brain.

1. Pause the hand and inspect the status:

   ```bash
   AGRO_HOME=$T AGRO hands pause agro-sbx-dev-001
   ssh exe.dev ls --json | python3 -I reduce.py
   AGRO_HOME=$T AGRO hands list
   ```

   Output: `paused agro-sbx-dev-001` (exit 0). `ls --json` reports `agro-sbx-dev-001` `"status": "paused"`, tags `["agro-hand"]`, and `agro-supervisor` `running`. `hands list` prints `agro-sbx-dev-001  paused  agro-sbx-dev-001.exe.xyz` (exit 0).

2. Resume the hand and wait (bounded: 18 polls, 10 s apart, at most 3 min) until `ls --json` reports `running` and SSH answers:

   ```bash
   AGRO_HOME=$T AGRO hands resume agro-sbx-dev-001
   ssh exe.dev ls --json   # status of agro-sbx-dev-001
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 -- true
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 -- uptime
   ```

   Output: `resumed agro-sbx-dev-001` (exit 0). Poll 1, 2 s after resume: status `running`, `exec -- true` exit 0. `uptime` printed `17:59:40 up 5 days, 16:56, ...` (exit 0).

**E. Guards**

Prerequisites: none beyond section A. Runs on the brain. An `ssh` shim on `PATH` logged every `ssh` invocation and then ran the real `ssh`.

1. Refuse to destroy the brain:

   ```bash
   AGRO_HOME=$T AGRO hands destroy agro-supervisor --yes
   ```

   Output: `agro hands destroy: refusing to destroy agro-supervisor: it is this brain`. Expected exit 1; observed exit 1.
   The shim logged one call only: `ssh -o BatchMode=yes exe.dev whoami --json` (the read-only preflight). No `rm`, `ls`, or other exe.dev command ran.

2. Refuse the removed `--free-tier` flag before any console request:

   ```bash
   AGRO_CONSOLE_URL=http://127.0.0.1:9 AGRO_CONSOLE_TOKEN=unused AGRO_HOME=$T AGRO node create --free-tier
   ```

   Output: `agro node create: unknown flag "--free-tier"`. Expected exit 1; observed exit 1. The console URL points at a closed local port; the run printed no connection error, so the flag parse refused before any request.

3. The same command as typed on the brain, with no console sign-in:

   ```bash
   AGRO node create --free-tier
   ```

   Output: `not logged in to agro-console: run agro auth login`. Exit status: 1. No console request (no console config exists). See Observations.

**F. Cleanup**

1. Remove the scratch project on the hand. `projects/` also holds `mifunedev`, so `projects/` stays:

   ```bash
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 -- rm -rf projects/exedev-hands-review
   AGRO_HOME=$T AGRO hands exec agro-sbx-dev-001 -- ls -a projects
   ```

   Output: none (exit 0), then `.`, `..`, `mifunedev` (exit 0).

2. Remove the fresh state: `rm -rf "$T"`; `test -e "$T"` exits 1.

3. Capture the account state again:

   ```bash
   ssh exe.dev ls --json | python3 -I reduce.py
   ```

   Output (AFTER): identical to BEFORE (`diff` printed nothing):

   ```json
   [
    {"vm_name": "agro-sbx-dev-001", "status": "running", "tags": ["agro-hand"]},
    {"vm_name": "agro-supervisor", "status": "running", "tags": []}
   ]
   ```

   Exit status: 0.

## Acceptance criteria

| Criterion | Evidence | Result |
|---|---|---|
| Read-only `agro hands list` lists `agro-sbx-dev-001` before any write | A3 | met |
| Built CLI on `agro-supervisor`, provider for this run only; `list`, `exec --project -- git log --oneline -1`, one commit, `fetch`, `pause`, `resume` | A2–D2 | met |
| `hands destroy agro-supervisor --yes` refused, exit 1, no exe.dev write | E1 | met |
| `node create --free-tier` refused, exit 1, no console request | E2, E3 | met (message depends on sign-in; see Observations) |
| No VM or console node created, forked, or destroyed | E1 shim log, F3 | met |
| End `ls --json` lists the same VMs and tags as the start | A1, F3 | met |

## Observations

1. `agro node create --free-tier` on the brain as typed prints `not logged in to agro-console: run agro auth login`, not `unknown flag "--free-tier"`. `runNode` in `.agro/cli/src/commands/node.ts` resolves the console config before it parses verb flags. Both paths exit 1 and make no console request, so the criterion holds. The `unknown flag` message appears only when a console config exists (E2).
2. The first SSH connection through `agro hands` printed `Warning: Permanently added 'agro-sbx-dev-001' (RSA) to the list of known hosts.` on stderr. The host key alias `agro-sbx-dev-001` was new in `~/.ssh/known_hosts`; later connections were silent.
3. After `pause` and `resume`, `uptime` on the hand reported 5 days of uptime. exe.dev pause appears to suspend the VM rather than reboot it. The hand answered SSH 2 s after `resume` returned.
4. The destroy guard runs the `ssh exe.dev whoami --json` preflight before the brain-name refusal. The preflight is read-only.
