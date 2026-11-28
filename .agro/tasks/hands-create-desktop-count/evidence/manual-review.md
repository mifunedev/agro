# Manual review: hands create --count and --desktop

Tested revision: `85775c875c523b26a567e550458008c5c898687d` on
`feat/1676-hands-create-desktop-count`. Each result below is from an observed
run on 2026-11-28.

## Setup

Prerequisites: a checkout of this branch, Node 22 or newer, and a free local
port. Each step runs on the host, local. No step uses a real token. No step
reaches a live console.

1. Build the CLI:

   ```bash
   npm --prefix .agro/cli run build
   ```

   Expected output ends with `dist/agro.js` and `Done`. Expected exit status: 0.

2. Confirm that port 18777 is free:

   ```bash
   ss -ltnp | grep :18777 || echo "port 18777 free"
   ```

   Expected output: `port 18777 free`. If the port is busy, use a different
   free port in each command below.

3. Start the fake console from an untracked scratch directory `<scratch>`:

   ```bash
   node <scratch>/fake-console.mjs 18777 <scratch>/requests.log &
   ```

   The fake console is a Node script with no dependencies. It writes one log
   line for each request: the method, the path, and the JSON body. The fake
   console does not write the `Authorization` header.

   - `POST /api/nodes` returns HTTP 202 with a `queued` node. The id is
     `node-<n>`, the console index is `<n>`, and the alias is `h<n>`. The
     counter `<n>` starts at 1 and increases for each accepted request.
   - When the request `name` starts with `refuse` and ends with `-2`,
     `POST /api/nodes` returns HTTP 402 with the code `NODE_LIMIT_REACHED` and
     no node id.
   - `GET /api/nodes/<id>` returns the node with the status `running` and
     `sshHost` `h<n>.fake.test`. For a node with `desktop` in `tools`, the body
     also has `rdpListening: true` and `tailnetName` `h<n>.tail.test`.

4. Give each command a new empty home directory `<home>`, so that the CLI
   reads no credentials file. The env token `fake-token` gives brain
   authority.

## A. Two desktop hands with JSON output

1. Run:

   ```bash
   HOME=<home> AGRO_CONSOLE_URL=http://127.0.0.1:18777 AGRO_CONSOLE_TOKEN=fake-token \
     node .agro/cli/dist/agro.js hands create --count 2 --desktop --name gate --json
   ```

   Observed stdout:

   ```text
   {"id":"node-1","index":1,"alias":"h1","name":"gate-1","status":"running","spec":"n4","sshHost":"h1.fake.test","ssh":"ssh sandbox@h1.fake.test","desktop":{"rdpListening":true,"tailnetName":"h1.tail.test","rdpAddress":"h1.tail.test:3389"}}
   {"id":"node-2","index":2,"alias":"h2","name":"gate-2","status":"running","spec":"n4","sshHost":"h2.fake.test","ssh":"ssh sandbox@h2.fake.test","desktop":{"rdpListening":true,"tailnetName":"h2.tail.test","rdpAddress":"h2.tail.test:3389"}}
   ```

   Observed stderr:

   ```text
   agro hands create: hand node-1 queued
   agro hands create: hand node-2 queued
   agro hands create: hand node-1 running
   agro hands create: hand node-2 running
   ```

   Observed requests:

   ```text
   POST /api/nodes {"profile":"sandbox","name":"gate-1","tools":["agro","docker","desktop"]}
   POST /api/nodes {"profile":"sandbox","name":"gate-2","tools":["agro","docker","desktop"]}
   GET /api/nodes/node-1
   GET /api/nodes/node-2
   GET /api/nodes/node-1
   GET /api/nodes/node-2
   ```

   Exit status: 0.

   Check these results:

   - Brain authority sends `tools: ["agro","docker","desktop"]` and no
     `docker` field.
   - The body has no `spec` field. The console default spec `n4` applies.
   - The names are `gate-1` and `gate-2` in request order.
   - The CLI sends the second `POST` after the first `POST` returns a node id.
     The waits for the two hands run at the same time.
   - stdout has one JSON line for each hand, in request order.

## B. Failure path: the desktop with a small spec

1. Run:

   ```bash
   HOME=<home> AGRO_CONSOLE_URL=http://127.0.0.1:18777 AGRO_CONSOLE_TOKEN=fake-token \
     node .agro/cli/dist/agro.js hands create --desktop --spec n2
   ```

   Observed stdout: empty.

   Observed stderr:

   ```text
   agro hands create: the desktop needs at least n4 (4 GB); use --spec n4 or larger (n8 recommended)
   ```

   Observed requests: none.

   Exit status: 1.

## C. Failure path: a count above the bound

1. Run:

   ```bash
   HOME=<home> AGRO_CONSOLE_URL=http://127.0.0.1:18777 AGRO_CONSOLE_TOKEN=fake-token \
     node .agro/cli/dist/agro.js hands create --count 11
   ```

   Observed stdout: empty.

   Observed stderr:

   ```text
   agro hands create: --count must be an integer from 1 to 10
   ```

   Observed requests: none.

   Exit status: 1.

## D. Failure path: a count with the exedev provider

1. Run:

   ```bash
   HOME=<home> AGRO_CONSOLE_URL=http://127.0.0.1:18777 AGRO_CONSOLE_TOKEN=fake-token \
     node .agro/cli/dist/agro.js hands --provider exedev create --count 2
   ```

   Observed stdout: empty.

   Observed stderr:

   ```text
   agro hands create: --count applies only to console hands
   ```

   Observed requests: none. The CLI refuses before any provider call, so no
   `ssh` command runs.

   Exit status: 1.

## E. Failure path: a refusal at request 2 of 3

Prerequisite: scenario A ran on the same fake console, so the counter is at 3.

1. Run:

   ```bash
   HOME=<home> AGRO_CONSOLE_URL=http://127.0.0.1:18777 AGRO_CONSOLE_TOKEN=fake-token \
     node .agro/cli/dist/agro.js hands create --count 3 --name refuse
   ```

   Observed stdout:

   ```text
   hand 3 alias h3 status running ssh sandbox@h3.fake.test
   ```

   Observed stderr:

   ```text
   agro hands create: hand node-3 queued
   agro hands create: hand node-3 running
   agro hands create: hand 2 of 3: HTTP 402 NODE_LIMIT_REACHED: paid node limit reached
   ```

   Observed requests:

   ```text
   POST /api/nodes {"profile":"sandbox","name":"refuse-1"}
   POST /api/nodes {"profile":"sandbox","name":"refuse-2"}
   GET /api/nodes/node-3
   ```

   Exit status: 1.

   Check these results:

   - The CLI sends no third `POST` after the refusal of request 2.
   - The stderr line names the request position `2 of 3`.
   - stdout has the line of the hand with a node id. The value after `hand` is
     the console index `3`, not the request position.
   - Without `--desktop`, the body has no `tools` field.

## Cleanup

1. Stop the fake console. Use the PID of the background process from setup
   step 3:

   ```bash
   kill <pid>
   ss -ltnp | grep :18777 || echo "port free"
   ```

   Expected output: `port free`.

2. Delete the scratch directory with its log and home directories. The fake
   console keeps nodes only in memory, so no node remains.
