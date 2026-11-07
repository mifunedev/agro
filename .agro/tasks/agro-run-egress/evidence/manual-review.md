# Manual review: agro run egress allowlist

The steps below come from an observed run on branch `feat/1588-us-004`.
Each output is the observed output.

## Setup

Prerequisites: Docker on the host, Node 22 or newer, and a build of the CLI at
`.agro/cli/dist/agro.js`. Run each step on the host, local.

1. Make the CLI alias. Replace `<worktree>` with the checkout path:

   ```bash
   A="node <worktree>/.agro/cli/dist/agro.js"
   ```

2. Make a scratch git repository with an allowlist and a `postgres` service:

   ```bash
   S="$(mktemp -d)/egress-scratch"
   mkdir -p "$S" && cd "$S" && git init -q
   cat > agro.json <<'EOF'
   {"version":1,"access":{"egress":"allowlist","egressAllow":["example.org"]},"run":{"services":{"postgres":{"image":"postgres:17-alpine","env":{"POSTGRES_PASSWORD":"agro"},"ready":"pg_isready -U postgres"}}}}
   EOF
   git add agro.json && git -c user.email=t@t -c user.name=t commit -qm init
   ```

   Expected exit status: 0.

## A. Egress through the proxy

1. Request an allowed host through the proxy:

   ```bash
   $A run -- curl -sS -o /dev/null -w '%{http_code}' https://example.org
   ```

   Output:

   ```text
   200
   ```

   Expected exit status: 0.

2. Failure path. Request a host outside the allowlist:

   ```bash
   $A run -- curl -sS -o /dev/null -w '%{http_code}' https://example.com
   ```

   Output:

   ```text
   curl: (56) CONNECT tunnel failed, response 403
   000
   ```

   Expected exit status: 56.

## B. Direct egress

1. Failure path. Request a host directly, without the proxy:

   ```bash
   $A run -- curl --noproxy '*' -sS https://example.com
   ```

   Output:

   ```text
   curl: (6) Could not resolve host: example.com
   ```

   Expected exit status: 6. The network is internal, so the command cannot
   resolve or reach an external host.

## C. Declared service

1. Connect to the declared `postgres` service on port 5432:

   ```bash
   $A run -- node -e 'require("net").connect(5432,"postgres").on("connect",function(){console.log("connected postgres:5432");this.end()}).on("error",function(e){console.error(e.message);process.exit(1)})'
   ```

   Output:

   ```text
   connected postgres:5432
   ```

   Expected exit status: 0.

## D. Cleanup check after each run

1. After each step in A, B, and C, look for a remaining run container or
   network:

   ```bash
   docker ps -a | grep agro-run-
   docker network ls | grep agro-run-
   ```

   Output: no lines from each command, after each of the four runs.

   Expected exit status: 1 from each `grep`, which means no match.

## E. Cleanup

1. Delete the scratch repository:

   ```bash
   rm -rf "$S"
   test -e "$S"
   ```

   Output: no lines. Expected exit status: 1 from `test -e`, which means the
   scratch repository does not exist.
