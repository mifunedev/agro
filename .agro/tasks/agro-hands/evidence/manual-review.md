# US-004 manual review

## Round 2

The worker ran the rebuilt CLI on a new live brain on 2026-11-11 from 17:39 to 17:48 UTC, then reset the pool at 18:00. The console was the local agro-console stack at `d5e15d25`. That commit includes #744 (the brain console URL file) and #746 (a brain-token fork attaches the brain key, and the response has `forkId`). The advisor restarted the provisioner and gateway children at 17:36:30 UTC. The worker restarted nothing.

The raw files are in `raw/round2/`:

- `transcript.txt` is each brain command with its time, its full output, and its exit status.
- `runlog.txt` is the host log: the brain create, the node times, and the cleanup.
- `pool-overrides.txt` is each pool override call with its response.
- `provider-before.txt`, `db-before.txt`, and `provider-final.txt` are the read-only lists.
- `fork-events.txt` is the event list of the fork.

### Result

| Criterion | Result |
|---|---|
| 1. A read-only `agro hands list` on the brain succeeds before any hand exists. | Met. `no hands`, exit 0. |
| 2. The run covers `create --project`, `list`, `exec ... -- git log --oneline`, a commit on the hand, `fetch`, `fork`, and `destroy` for the hand and the fork. | Met. Each command exited 0. `hands fork 368` waited for the fork and printed index 369, its alias, and its SSH host. `hands exec 369 -- true` exited 0, and the fork holds the project with the hand commit. |
| 3. The console refuses `agro hands exec` on a brain node with `BRAIN_TOKEN_TARGET_FORBIDDEN`. | Met. HTTP 403, exit 1. |
| 4. The round deletes each node, SSH key, and token that it made. The final provider list matches the list before the round. | Met. See `cleanup.md`, round 2. |

No command in round 2 sets `AGRO_CONSOLE_URL` or `AGRO_CONSOLE_TOKEN`. The CLI reads `~/.agro/brain-console-url` and `~/.agro/brain-token`. No command printed a token.

### Build under test

| Item | Value |
|---|---|
| Branch and commit | `task/1604-agro-hands` at `6174e19b7`, with the fork fixes `108b5f9db` and `0ae524d73` |
| Build | `pnpm run build:harness`, output `.agro/cli/dist/agro.js` |
| sha256 on the host and on the brain | `d2de64c0feaf87c2c6a0075cdd9856bdb935b9534cdd5cb155b9c17b0dcbee54` |
| Copy on the brain | `/home/sandbox/agro-hands-test.js`, run with Node v24.22.2 |

### Setup

| Time (UTC) | Step | Result |
|---|---|---|
| 17:39:39 | Provider list (read only). | `instances=3 volumes=2 snapshots=2`: `fecb66c6`, `96e111f7`, and `6fbdfabd`. The database had no live node and no pooled VM. |
| 17:40:10 | Throwaway key `ab-handslive2` and token `ab-handslive2` through the browser session, context Admin, Billing exempt. | HTTP 201 for both: key `5317898a-…`, token `37151f8a-…`. |
| 17:40:10 | Pool override n4 min 1, max 1. | HTTP 200. The pool created `vivid-river-fdcwfw` at 17:40:31. |
| 17:42:13 | Create `hands-live-brain-2` (profile agro). | HTTP 202, node `1982607e-…`, index #367, a pool hit. The pool started the refill `vivid-raven-6vhe3i`. |
| 17:42:18 | Pool override n4 min 0, max 0. The override stayed at max 0 until 18:00. | HTTP 200. The pool destroyed `vivid-raven-6vhe3i` at 17:44:15. |
| 17:42:33 to 17:42:39 | Brain phases. | `brain.stack_enabled` 17:42:33, `brain.apps_ready` 17:42:35, `brain.workspace_created` 17:42:39. |
| 17:42:48 | Copy the CLI to the brain with `scp`. | The sha256 matches the host build. |

### 1. Console URL file and read-only list (criterion 1)

```
sandbox@brain$ cat ~/.agro/brain-console-url
https://mifune-console-local-ryaneggz-f1bb.mifune.io
[exit 0]

sandbox@brain$ stat -c '%a %U' ~/.agro/brain-console-url
600 sandbox
[exit 0]

sandbox@brain$ stat -c '%a %U' ~/.agro/brain-token
600 sandbox
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands list
no hands
[exit 0]
```

Expected: mode 600 and owner `sandbox` on both files, and an empty list. Observed: as expected.

### 2. Brain project and `hands create --project`

```
sandbox@brain$ P=~/.agro/workspaces/harness/projects/mifunedev/hands-demo; mkdir -p $P && cd $P && git init -q -b main && printf "# hands-demo\n" > README.md && git add README.md && git -c user.name=brain -c user.email=brain@example.invalid commit -qm "brain: first commit" && git log --oneline
6eebb41 brain: first commit
[exit 0]

sandbox@brain$ cd ~/.agro/workspaces/harness/projects/mifunedev/hands-demo && node ~/agro-hands-test.js hands create --project mifunedev/hands-demo
agro hands create: hand ebbf6b65-2a5b-4818-9b3f-5b1163a8dc15 queued
agro hands create: hand ebbf6b65-2a5b-4818-9b3f-5b1163a8dc15 creating_vm
agro hands create: hand ebbf6b65-2a5b-4818-9b3f-5b1163a8dc15 running
index: 368
alias: smart-beacon-kcvdr2
ssh host: ssh-smart-beacon-kcvdr2.mifune.io
project: ~/projects/mifunedev/hands-demo
Warning: Permanently added 'ebbf6b65-2a5b-4818-9b3f-5b1163a8dc15' (ED25519) to the list of known hosts.
To ssh-smart-beacon-kcvdr2.mifune.io:projects/mifunedev/hands-demo
 * [new branch]      main -> main
remote: hand-368
[exit 0]
```

Expected: a running hand, the remote `hand-368`, and the push. Observed: as expected. The hand was a cold boot: request 17:42:57, `running` at 17:44:30.1, 1 min 33 s.

### 3. List, exec, commit on the hand, and fetch

```
sandbox@brain$ node ~/agro-hands-test.js hands list
INDEX  ALIAS                STATUS   SPEC  SSH HOST
#368   smart-beacon-kcvdr2  running  n4    ssh-smart-beacon-kcvdr2.mifune.io
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands exec 368 --project mifunedev/hands-demo -- git log --oneline
6eebb41 brain: first commit
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands exec 368 --project mifunedev/hands-demo -- sh -c 'echo x > f && git add f && git -c user.name=t -c user.email=t@t commit -qm hand-commit'
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands exec 368 --project mifunedev/hands-demo -- git log --oneline
e7efd5c hand-commit
6eebb41 brain: first commit
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands fetch 368 --project mifunedev/hands-demo
From ssh-smart-beacon-kcvdr2.mifune.io:projects/mifunedev/hands-demo
   6eebb41..e7efd5c  main       -> hand-368/main
[exit 0]

sandbox@brain$ cd ~/.agro/workspaces/harness/projects/mifunedev/hands-demo && git log --oneline hand-368/main
e7efd5c hand-commit
6eebb41 brain: first commit
[exit 0]
```

Expected: the hand commit reaches `hand-368/main` on the brain. Observed: as expected.

### 4. Exec on the brain node (criterion 3)

```
sandbox@brain$ node ~/agro-hands-test.js hands exec 367 -- true
agro hands exec: HTTP 403 BRAIN_TOKEN_TARGET_FORBIDDEN: The brain token allows only hands-node operations
[exit 1]
```

Expected: HTTP 403 and a non-zero exit. Observed: as expected.

### 5. Fork

At 17:44:54 the database had no pooled VM. The brain, the hand, and the fork were the only VMs during the fork.

```
sandbox@brain$ node ~/agro-hands-test.js hands fork 368
agro hands fork: hand a1ee5c54-9a93-448a-bdc5-4af9bdf18ab7 queued
agro hands fork: hand a1ee5c54-9a93-448a-bdc5-4af9bdf18ab7 creating_vm
agro hands fork: hand a1ee5c54-9a93-448a-bdc5-4af9bdf18ab7 running
index: 369
alias: able-comet-m5ko73
ssh host: ssh-able-comet-m5ko73.mifune.io
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands list
INDEX  ALIAS                STATUS   SPEC  SSH HOST
#369   able-comet-m5ko73    running  n4    ssh-able-comet-m5ko73.mifune.io
#368   smart-beacon-kcvdr2  running  n4    ssh-smart-beacon-kcvdr2.mifune.io
[exit 0]
```

Expected: the fork command waits and prints the fork index, alias, and SSH host. Observed: as expected. The fork id `a1ee5c54` differs from the hand id `ebbf6b65`. The fork was a cold boot: request 17:44:54, `creating_vm` 17:45:01.1, `running` 17:46:44.0, 1 min 50 s. The hand recorded `fork_created` at 17:45:01.

### 6. Exec on the fork

```
sandbox@brain$ node ~/agro-hands-test.js hands exec 369 -- true
Warning: Permanently added 'a1ee5c54-9a93-448a-bdc5-4af9bdf18ab7' (ED25519) to the list of known hosts.
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands exec 369 --project mifunedev/hands-demo -- git log --oneline
e7efd5c hand-commit
6eebb41 brain: first commit
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands exec 369 -- hostname
able-comet-m5ko73
[exit 0]
```

Expected: the brain key opens the fork, and the fork holds the project. Observed: as expected. `node_ssh_keys` of the fork holds `brain #367 vivid-river-fdcwfw`.

### 7. Destroy the fork and the hand

```
sandbox@brain$ node ~/agro-hands-test.js hands destroy 369 --yes
destroyed 369
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands destroy 368 --yes
destroyed 368
[exit 0]

sandbox@brain$ node ~/agro-hands-test.js hands list
no hands
[exit 0]
```

Expected: both destroys succeed. Observed: as expected. The database marked the fork `destroyed` at 17:47:23 and the hand at 17:47:24.

### Instance-hours

| VM | Role | Live (UTC) | Hours |
|---|---|---|---|
| `vivid-river-fdcwfw` | pool VM, then the brain #367 | 17:40:31 to 17:47:48 | 0.12 |
| `vivid-raven-6vhe3i` | pool refill at the brain claim | 17:42:13 to 17:44:15 | 0.03 |
| `smart-beacon-kcvdr2` | the hand #368 (VM of `rapid-mesa-xavpy6`) | 17:42:57 to 17:47:24 | 0.07 |
| `able-comet-m5ko73` | the fork #369 (VM of `warm-pond-cizttw`) | 17:45:01 to 17:47:23 | 0.04 |
| Total | | | 0.26 |

From 17:42:57 to 17:44:15, the brain, the hand, and the refill were live: 2 nodes and 1 pool VM. From 17:45:01 to 17:47:23, the brain, the hand, and the fork were live, and the pool was empty. The final reset at 18:00 started no VM.

### Round 2 defects

None. Round 2 shows the fixes for the three defects of round 1. `hands fork` sends the spec. The fork has the brain key. `hands fork` prints the fork, not the source.

## Round 1

The worker ran the built CLI on one live brain on 2026-11-11 from 16:46 to 16:57 UTC. The console was the local agro-console stack (`task/684-sandbox-only-spike` at `8be3bb6c`, spike database). The worker restarted nothing.

The raw files of round 1 are in `raw/`:

- `raw/transcript.txt` is each brain command with its time, its full output, and its exit status.
- `raw/runlog.txt` is the host log: the pool override, the brain create, and the cleanup.
- `raw/provider-before.txt` and `raw/db-before.txt` are the read-only lists before the round.
- `raw/fork-events.txt` is the event list of the fork.

### Result

| Criterion | Result |
|---|---|
| 1. A read-only `agro hands list` on the brain succeeds before any hand exists. | Met. `no hands`, exit 0. |
| 2. The run covers `create --project`, `list`, `exec ... -- git log --oneline`, a commit on the hand, `fetch`, `fork`, and `destroy` for the hand and the fork. | Not met. `create`, `list`, `exec`, the commit, `fetch`, and both `destroy` commands passed. `agro hands fork` failed with `HTTP 400 BAD_REQUEST: Malformed request body` (defect 1). A diagnostic fork through curl started the fork. `agro hands exec` on the fork then failed with `Permission denied (publickey)` (defect 2). |
| 3. The console refuses `agro hands exec` on a brain node with `BRAIN_TOKEN_TARGET_FORBIDDEN`. | Met. HTTP 403, exit 1. |
| 4. The round deletes each node, SSH key, and token that it made. The final provider list matches the list before the round. | Met. The worker deleted the brain, the hand, the fork, the throwaway key and token, and the brain key, and the console revoked the brain tokens. The final provider list matches the list before the round. See `cleanup.md`. |

### Build under test

| Item | Value |
|---|---|
| Branch and commit | `task/1604-agro-hands` at `989b5ce14` |
| Build | `pnpm run build:harness`, output `.agro/cli/dist/agro.js` (377.0 kB) |
| sha256 on the host and on the brain | `2f3d94009c783bf1e8554ff3ae1d4c3d09004e4f81ef2e46925943d5de051876` |
| Copy on the brain | `/home/sandbox/agro-hands-test.js`, run with Node v24.22.2 |

### Setup

| Time (UTC) | Step | Result |
|---|---|---|
| 16:46:48 | Provider list (read only, the first check of criterion 1). | `instances=3 volumes=2 snapshots=2`. The database had no live node and no pooled VM. |
| 16:47:29 | Throwaway key `ab-handslive` and token `ab-handslive` through the browser session, context Admin, Billing exempt. | HTTP 201 for both: key `fc8feca8-…`, token `a8ecf406-…`. |
| 16:47:30 | Pool override n4 min 1, max 1. | HTTP 200. The pool created `proud-zephyr-ip3x9f` at 16:47:57. |
| 16:49:52 | Create `hands-live-brain` (profile agro). | HTTP 202, node `8f69fd0e-…`, index #364, a pool hit. The pool started the refill `tranquil-fern-8ozjxd`. |
| 16:49:55 | Pool override n4 min 0, max 0. | HTTP 200. The pool destroyed the refill at 16:51:41. |
| 16:50:08 to 16:50:22 | Brain phases. | `brain.stack_enabled` 16:50:08, `brain.workspace_created` 16:50:16, `brain.apps_ready` 16:50:22. |
| 16:50:40 | Copy the CLI to the brain with `scp`. | `~/.agro/brain-token` is present (mode 0600). `~/.agro/brain-console-url` is absent, because agro-console PR #744 is not in the running stack. |

The brain has no console URL file. Each `agro hands` command therefore sets `AGRO_CONSOLE_URL=https://mifune-console-local-ryaneggz-f1bb.mifune.io` inline. That URL is the base URL that the brain claimed from (agro-console `evidence/manual-review.md`). The worker wrote no env file. The first line of `raw/transcript.txt` is a stray `export` in its own SSH session, which has no effect.

The worker ran each `sandbox@brain$` command over SSH on the brain as `sandbox`. No command printed a token. Below, `A=` stands for the inline prefix `AGRO_CONSOLE_URL=https://mifune-console-local-ryaneggz-f1bb.mifune.io node ~/agro-hands-test.js`. The raw transcript has each command in full.

### 1. Read-only list before any hand (criterion 1)

Expected: exit 0 and no hand.

```
sandbox@brain$ A hands list
no hands
[exit 0]
```

Observed: as expected. The brain itself is not in the list.

### 2. Brain project and `hands create --project`

Expected: a hand reaches `running`, the brain project gets the remote `hand-<index>`, and the push lands on the hand.

```
sandbox@brain$ P=~/.agro/workspaces/harness/projects/mifunedev/hands-demo; mkdir -p $P && cd $P && git init -q -b main && printf "# hands-demo\n" > README.md && git add README.md && git -c user.name=brain -c user.email=brain@example.invalid commit -qm "brain: first commit" && git log --oneline
84ce12b brain: first commit
[exit 0]

sandbox@brain$ cd ~/.agro/workspaces/harness/projects/mifunedev/hands-demo && A hands create --project mifunedev/hands-demo
agro hands create: hand aec64157-1eba-467a-96cd-20abbf304e49 queued
agro hands create: hand aec64157-1eba-467a-96cd-20abbf304e49 creating_vm
index: 365
alias: lively-clover-iz12kg
ssh host: ssh-lively-clover-iz12kg.mifune.io
agro hands create: hand aec64157-1eba-467a-96cd-20abbf304e49 running
project: ~/projects/mifunedev/hands-demo
Warning: Permanently added 'aec64157-1eba-467a-96cd-20abbf304e49' (ED25519) to the list of known hosts.
To ssh-lively-clover-iz12kg.mifune.io:projects/mifunedev/hands-demo
 * [new branch]      main -> main
remote: hand-365
[exit 0]
```

Observed: as expected. The command started at 16:50:52 and ended at about 16:52:40. The `running` line comes after the stdout lines only because the transcript pipes stdout and stderr together. The known-hosts entry has the hand uuid as its name (`HostKeyAlias`). The hand was a cold create: the console created the pool-shaped VM `tidy-mesa-gstwnn` for the request and swapped it into the hand (`vm_swapped`, then `retired`). The hand used one VM, not two.

### 3. List, exec, commit on the hand, and fetch

Expected: `list` shows #365, `exec` runs in `~/projects/mifunedev/hands-demo` on the hand, and `fetch` brings the hand commit to `hand-365/main` on the brain.

```
sandbox@brain$ A hands list
INDEX  ALIAS                 STATUS   SPEC  SSH HOST
#365   lively-clover-iz12kg  running  n4    ssh-lively-clover-iz12kg.mifune.io
[exit 0]

sandbox@brain$ A hands exec 365 --project mifunedev/hands-demo -- git log --oneline
84ce12b brain: first commit
[exit 0]

sandbox@brain$ A hands exec 365 --project mifunedev/hands-demo -- sh -c 'echo x > f && git add f && git -c user.name=t -c user.email=t@t commit -qm hand-commit'
[exit 0]

sandbox@brain$ A hands exec 365 --project mifunedev/hands-demo -- git log --oneline
027bf46 hand-commit
84ce12b brain: first commit
[exit 0]

sandbox@brain$ A hands fetch 365 --project mifunedev/hands-demo
From ssh-lively-clover-iz12kg.mifune.io:projects/mifunedev/hands-demo
   84ce12b..027bf46  main       -> hand-365/main
[exit 0]

sandbox@brain$ cd ~/.agro/workspaces/harness/projects/mifunedev/hands-demo && git log --oneline hand-365/main
027bf46 hand-commit
84ce12b brain: first commit
[exit 0]
```

Observed: as expected. The quoted `sh -c` command reached the hand intact.

### 4. Exec on the brain node (criterion 3)

Expected: HTTP 403 `BRAIN_TOKEN_TARGET_FORBIDDEN` and a non-zero exit.

```
sandbox@brain$ A hands exec 364 -- true
agro hands exec: HTTP 403 BRAIN_TOKEN_TARGET_FORBIDDEN: The brain token allows only hands-node operations
[exit 1]
```

Observed: as expected. The console refused the `GET /api/nodes/364` that `exec` makes before SSH.

### 5. Fork (defect 1)

Before the fork, the pool was at min 0, max 0 with no pooled VM. The brain, the hand, and the fork were the only VMs.

Expected: the console accepts the fork, and the fork appears in `hands list`.

```
sandbox@brain$ A hands fork 365
agro hands fork: HTTP 400 BAD_REQUEST: Malformed request body
[exit 1]

sandbox@brain$ A hands list
INDEX  ALIAS                 STATUS   SPEC  SSH HOST
#365   lively-clover-iz12kg  running  n4    ssh-lively-clover-iz12kg.mifune.io
[exit 0]
```

Observed: the console refused the fork and created no node.

Cause: `runAction` in `.agro/cli/src/commands/hands.ts` sends `POST /api/nodes/<ref>/fork` with no body. The console fork handler (`apps/web/server/controllers/snapshots.controller.ts`, `fork`) calls `parseJsonBody(request, forkNodeRequestSchema)` without `allowEmpty`. `forkNodeRequestSchema` (`packages/shared/src/models/node.ts`) requires `spec`. An empty body therefore fails with `Malformed request body`. The `pause` and `resume` handlers read no body, so they do not have this defect.

#### Diagnostic fork through curl

To confirm the cause, the worker sent the same request with a `spec` body through curl and the brain token. The curl step is a diagnostic. The curl step does not satisfy the `agro hands fork` part of criterion 2.

```
sandbox@brain$ curl -sS -X POST --oauth2-bearer "$(cat ~/.agro/brain-token)" -H "content-type: application/json" -w "\nHTTP %{http_code}\n" https://mifune-console-local-ryaneggz-f1bb.mifune.io/api/nodes/365/fork -d "{\"spec\":\"n4\"}"
{"id":"aec64157-1eba-467a-96cd-20abbf304e49","status":"running","jobId":"8e672ffd-8a2b-4cfd-b447-94803ba3e859"}
HTTP 202
```

Observed: HTTP 202. The response `id` is the source hand `aec64157`, not the fork. After a body fix, the CLI line `forked <ref>: <id> <status>` would therefore print the source id and status (defect 3).

`hands list` polled the fork until it ran (trimmed, one line each 10 s):

```
sandbox@brain$ for i in $(seq 1 60); do out=$(A hands list); ...; sleep 10; done; A hands list
16:54:02 #366 creating_vm #365 running
...
16:56:00 #366 creating_vm #365 running
16:56:11 #366 running #365 running
INDEX  ALIAS                 STATUS   SPEC  SSH HOST
#366   ample-sparrow-aonlbo  running  n4    ssh-ample-sparrow-aonlbo.mifune.io
#365   lively-clover-iz12kg  running  n4    ssh-lively-clover-iz12kg.mifune.io
[exit 0]
```

### 6. Exec on the fork (defect 2)

Expected: `exec 366 -- true` exits 0.

```
sandbox@brain$ A hands exec 366 -- true
Warning: Permanently added 'bc848d6b-383e-4c67-be47-c96364ba8fa4' (ED25519) to the list of known hosts.
sandbox@ssh-ample-sparrow-aonlbo.mifune.io: Permission denied (publickey).
[exit 255]

sandbox@brain$ A hands exec 366 --project mifunedev/hands-demo -- sh -c 'hostname; git log --oneline'
sandbox@ssh-ample-sparrow-aonlbo.mifune.io: Permission denied (publickey).
[exit 255]
```

Observed: the fork refused the brain key. The fork reached `running` with `cold.claim_acknowledged` at 16:56:04, 12 s before the first `exec`.

The database explains the refusal. `node_ssh_keys` of the hand #365 holds the brain key `brain #364 proud-zephyr-ip3x9f` (`0192bd48-…`). `node_ssh_keys` of the fork #366 holds no row. The fork request sent no `sshKeyIds`, so the schema default `[]` applied. The brain-token create path adds the brain key, but the fork path did not. agro-console US-011 passed the brain key in `sshKeyIds` explicitly and reached its fork. The worker destroyed the fork before it read `~/.ssh/authorized_keys` on the fork, so the database rows are the only evidence of the cause.

The CLI cannot pass the brain key id from the brain, because the brain token cannot read `/api/ssh-keys`. Two fixes are possible. The console can add the brain key on a brain-token fork, as the console does on a create. Alternatively, the fork can keep the keys of the source.

### 7. Destroy the fork and the hand

Expected: both destroys succeed, and `list` is empty.

```
sandbox@brain$ A hands destroy 366 --yes
destroyed 366
[exit 0]

sandbox@brain$ A hands destroy 365 --yes
destroyed 365
[exit 0]

sandbox@brain$ A hands list
no hands
[exit 0]
```

Observed: as expected. The database marked the fork `destroyed` at 16:56:39 and the hand at 16:56:45.

### Defects

1. `agro hands fork` sends no body. The console requires `{"spec": ...}` and returns `HTTP 400 BAD_REQUEST: Malformed request body`. Location: `runAction` in `.agro/cli/src/commands/hands.ts`. The fork is unusable from the CLI.
2. A fork made with the brain token and no `sshKeyIds` gets no SSH key. The brain cannot reach it, so `agro hands exec` and `agro hands fetch` cannot work on a fork. Location: the console fork path for brain tokens, or the fork body that the CLI sends.
3. The fork response `id` is the source node. The `fork` output `forked <ref>: <id> <status>` would show the source id and status, not the new fork. Only `hands list` shows the fork index.

### Instance-hours

| VM | Role | Live (UTC) | Hours |
|---|---|---|---|
| `proud-zephyr-ip3x9f` | pool VM, then the brain #364 | 16:47:57 to 16:57:15 | 0.16 |
| `tranquil-fern-8ozjxd` | pool refill | 16:49:52 to 16:51:41 | 0.03 |
| `lively-clover-iz12kg` | the hand #365 (VM of `tidy-mesa-gstwnn`) | 16:50:52 to 16:56:45 | 0.10 |
| `ample-sparrow-aonlbo` | the fork #366 (VM of `modest-glacier-mnoxjv`) | 16:53:55 to 16:56:39 | 0.05 |
| `ample-river-r90x4l` | pool refill after the reset | 16:57:57 to 17:00:14 | 0.04 |
| `snowy-willow-7m6mqo` | pool refill after the second reset | 17:00:27 to 17:02:53 | 0.04 |
| Total | | | 0.42 |

The total is above the approved 0.3 instance-hour by about 0.12. The two refills after the reset cost 0.08 (see `cleanup.md`).

At most 3 VMs were live at one time. From 16:50:52 to 16:51:41, the brain, the hand, and a pool refill were live. From 16:53:55 to 16:56:39, the brain, the hand, and the fork were live, and the pool was empty.
