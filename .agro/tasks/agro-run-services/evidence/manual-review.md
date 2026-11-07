# US-005 manual review: `agro run` services

The outputs below come from observed runs on 2026-11-07 on branch
`feat/1584-us-005` at commit `d6d1186fb`. The CLI is the worktree build at
`.agro/cli/dist/agro.js`. In the commands, `$AGRO` is
`node <worktree>/.agro/cli/dist/agro.js`.

## Setup

Prerequisites: Docker on the host, Node 22 or newer, and the CLI build. Runs on the host, local.

1. Make a scratch git repository. Declare a `postgres` service with a `ready` command in `agro.json`:

   ```bash
   mkdir -p "$SCRATCH/us005-repo" && cd "$SCRATCH/us005-repo" && git init -q
   cat > agro.json <<'EOF'
   {"version":1,"run":{"services":{"postgres":{"image":"postgres:17-alpine","env":{"POSTGRES_PASSWORD":"agro"},"ready":"pg_isready -U postgres"}}}}
   EOF
   git add . && git commit -qm init
   ```

   Expected exit status: 0.

2. Add `probe.js` to the scratch repository. The script connects to the host
   `postgres` on port 5432, sends a Postgres startup message, and prints the
   first server reply. Then it holds the connection for the number of seconds
   in its second argument:

   ```js
   const net = require("net");
   const os = require("os");
   const [user, holdSeconds] = process.argv.slice(2);
   const params = Buffer.from(`user\0${user}\0database\0postgres\0\0`);
   const startup = Buffer.alloc(8 + params.length);
   startup.writeInt32BE(startup.length, 0);
   startup.writeInt32BE(196608, 4);
   params.copy(startup, 8);
   const s = net.connect(5432, "postgres", () => {
     console.log(`${user}: connected postgres:5432 at ${s.remoteAddress} from ${s.localAddress} (container ${os.hostname()})`);
     s.write(startup);
   });
   s.once("data", (d) => {
     console.log(`${user}: server sent message ${String.fromCharCode(d[0])} code ${d.readInt32BE(5)}; holding ${holdSeconds} s`);
     setTimeout(() => { s.destroy(); console.log(`${user}: done`); process.exit(0); }, Number(holdSeconds) * 1000);
   });
   s.on("error", (e) => { console.error(`${user}: ${e.message}`); process.exit(2); });
   ```

   The AGRO image has `node` and `python3`. The AGRO image has no `psql`.
   Message `R` code 10 is the Postgres SASL authentication request. Thus the
   peer on `postgres:5432` is a Postgres server.

## A. One run connects to `postgres:5432`

Prerequisites: the setup. Runs on the host, local, in the scratch repository.

1. Run a TCP connect to the literal host `postgres`:

   ```bash
   $AGRO run -- node -e 'const s=require("net").connect(5432,"postgres",()=>{console.log("connected postgres:5432");s.end()});s.on("error",e=>{console.error(e.message);process.exit(2)})'
   ```

   Output:

   ```text
   connected postgres:5432
   ```

   Exit status: 0. Wall time: 3.9 s, including the `pg_isready` loop.

2. Run the Postgres protocol probe:

   ```bash
   $AGRO run -- node probe.js run_d 0
   ```

   Output:

   ```text
   run_d: connected postgres:5432 at 172.19.0.2 from 172.19.0.3 (container b3980f3ba7b3)
   run_d: server sent message R code 10; holding 0 s
   run_d: done
   ```

   Exit status: 0.

3. Failure path. Connect to a host that no service declares:

   ```bash
   $AGRO run -- node -e 'require("net").connect(5432,"nosuchhost").on("error",e=>{console.error(e.code);process.exit(2)})'
   ```

   Output: `ENOTFOUND`. Exit status: 2. `agro run` returns the exit status of the command.

4. Failure path. Set the `ready` command to `exit 1` in `agro.json`, then run the probe:

   ```bash
   $AGRO run -- node probe.js run_c 0
   docker ps -a | grep agro-run-
   docker network ls | grep agro-run-
   ```

   Output: `agro run: service postgres was not ready after 60 s`. Exit status
   of `agro run`: 1, after 63.7 s. Each `grep` prints nothing and exits 1. Thus
   the failed run also removes its container and network. Put back the
   original `agro.json` after this step.

## B. Two simultaneous runs are isolated

Prerequisites: the setup. Runs on the host, local, in the scratch repository.

1. Start two runs in the background. Each run holds its connection for 20 s.
   After 10 s, inspect Docker from the host and create one table in each
   service. Use the network suffix as the table name:

   ```bash
   $AGRO run -- node probe.js run_a 20 > a.log 2>&1 & PA=$!
   $AGRO run -- node probe.js run_b 20 > b.log 2>&1 & PB=$!
   sleep 10
   docker ps --filter name=agro-run- --format '{{.Names}} {{.Networks}}'
   for n in $(docker network ls --filter name=agro-run- --format '{{.Name}}'); do
     docker network inspect $n --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{println}}{{end}}'
     docker exec $n-postgres psql -U postgres -c "create table t_$(echo $n | cut -d- -f3) (id int)"
     docker exec $n-postgres psql -U postgres -c '\dt'
   done
   wait $PA; echo "run_a exit=$?"; wait $PB; echo "run_b exit=$?"
   cat a.log b.log
   ```

   Output of `docker ps`. Each run has its own network and its own service container:

   ```text
   agro-run-537db0d6c0b8-postgres agro-run-537db0d6c0b8
   agro-run-74acdbc2239d-postgres agro-run-74acdbc2239d
   ```

   Output of the loop, trimmed:

   ```text
   agro-run-74acdbc2239d-postgres 172.19.0.2/16
   recursing_swanson 172.19.0.3/16
   CREATE TABLE
    public | t_74acdbc2239d | table | postgres
   (1 row)

   agro-run-537db0d6c0b8-postgres 172.20.0.2/16
   epic_chatterjee 172.20.0.3/16
   CREATE TABLE
    public | t_537db0d6c0b8 | table | postgres
   (1 row)
   ```

   Output of `wait` and of the logs:

   ```text
   run_a exit=0
   run_b exit=0
   run_a: connected postgres:5432 at 172.20.0.2 from 172.20.0.3 (container f482e01635ca)
   run_a: server sent message R code 10; holding 20 s
   run_a: done
   run_b: connected postgres:5432 at 172.19.0.2 from 172.19.0.3 (container cd96a72f7ac9)
   run_b: server sent message R code 10; holding 20 s
   run_b: done
   ```

   Result: the two networks are different. The two service containers are
   different. `run_a` reached `172.20.0.2`, which is
   `agro-run-537db0d6c0b8-postgres`. `run_b` reached `172.19.0.2`, which is
   `agro-run-74acdbc2239d-postgres`. Each database lists only its own table.
   Thus each run reaches its own database. Exit status of each run: 0.

## C. Cleanup check

Prerequisites: both runs of scenario B stopped. Runs on the host, local.

1. Look for a remaining run container or network:

   ```bash
   docker ps -a | grep agro-run-; echo "grep exit=$?"
   docker network ls | grep agro-run-; echo "grep exit=$?"
   ```

   Output:

   ```text
   grep exit=1
   grep exit=1
   ```

   Neither command shows an `agro-run-` container or network.

## D. Cleanup

1. Delete the scratch repository and the run logs:

   ```bash
   rm -rf "$SCRATCH/us005-repo" "$SCRATCH/us005-out"
   test -e "$SCRATCH/us005-repo"; echo "test exit=$?"
   ```

   Output: `test exit=1`. The scratch repository does not exist.
