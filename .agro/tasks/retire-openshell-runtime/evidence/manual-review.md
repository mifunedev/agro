# Manual review: retire the OpenShell runtime

This transcript records an observed run on 2026-11-16. Each output block shows
real output. A note marks each trimmed block.

## Prerequisites

- A host with Docker, Git, and Node 22 or newer. The run used Node v24.
- The `agro` CLI on the host `PATH`.
- A checkout of branch `task/1652-retire-openshell-runtime`. In each step,
  `<worktree>` is the path of that checkout.
- Network access to Docker Hub for the public `alpine:3.20` image.

All steps run on the host, local. Steps 2 to 4 run from `<worktree>`.

## A. Build the branch CLI

1. Build the CLI:

   ```bash
   agro run -- pnpm run build:harness
   ```

   Output (trimmed: `npm warn` and `npm notice` lines removed):

   ```text
   > agro@0.39.0 build:harness /home/exedev/.agro/workspaces/harness/.worktrees/task/1652-retire-openshell-runtime
   > (test -d .agro/cli/node_modules || npm --prefix .agro/cli ci --ignore-scripts) && npm --prefix .agro/cli run build

   > @mifune/agro@0.39.0 build
   > node build.mjs

     dist/agro.js  428.6kb

   ⚡ Done in 236ms
   ```

   Exit status: 0.

## B. The CLI refuses the `openshell` runtime

2. List the sandbox registry before the install:

   ```bash
   ls ~/.agro/sandboxes
   ```

   Output: empty. Exit status: 0.

3. Failure path. Request the `openshell` runtime:

   ```bash
   node .agro/cli/dist/agro.js sandbox install openshell
   ```

   Output:

   ```text
   agro sandbox install: unknown runtime "openshell" — known runtimes: docker, microsandbox
   ```

   Exit status: 1.

4. List the sandbox registry after the install:

   ```bash
   ls ~/.agro/sandboxes
   ```

   Output: empty. Exit status: 0. The refused install writes no entry.

## C. The help text lists no `openshell` runtime

5. Show the install help:

   ```bash
   node .agro/cli/dist/agro.js sandbox install --help
   ```

   Output (trimmed to the usage and the runtime list):

   ```text
   agro sandbox — Create and list sandboxes

   Usage:
     agro sandbox install <runtime> [--name <name>] [--checkout <dir>]
                                  [--home-mount <dir>] [--yes]
                                  [--version <X.Y.Z> | --image[=<ref>]]
                                  [--no-build] [--print-argv]
     agro sandbox list [--json]
     agro sandbox upgrade <name> --version <X.Y.Z>

   Runtimes:
     docker        provisionable
     microsandbox  planned

   Next: agro shell <name>
   ```

   Exit status: 0.

6. Count the `openshell` matches in the full help:

   ```bash
   node .agro/cli/dist/agro.js sandbox install --help 2>&1 | grep -ci openshell
   ```

   Output: `0`. Exit status of `grep`: 1, because no line matches.

## D. `agro run` uses the project `image.ref`

7. Choose a new temp path. Confirm that the path does not exist:

   ```bash
   P=$(mktemp -u /tmp/agro-us004-XXXXXX); echo "P=$P"
   test ! -e "$P"; echo "test-not-exists exit=$?"
   ```

   Output:

   ```text
   P=/tmp/agro-us004-g7Q6eN
   test-not-exists exit=0
   ```

8. Create the git project with an `image.ref` of `alpine:3.20`:

   ```bash
   mkdir "$P" && cd "$P" && git init -q
   printf '%s\n' '{"version":1,"image":{"ref":"alpine:3.20"}}' > agro.json
   cat agro.json && git status --short
   ```

   Output:

   ```text
   {"version":1,"image":{"ref":"alpine:3.20"}}
   ?? agro.json
   ```

   Exit status: 0.

9. Run a command in the project container. Write no env file:

   ```bash
   node <worktree>/.agro/cli/dist/agro.js run -- cat /etc/alpine-release
   ```

   Output:

   ```text
   Unable to find image 'alpine:3.20' locally
   3.20: Pulling from library/alpine
   25f1d6b1951a: Pulling fs layer
   25f1d6b1951a: Download complete
   d4050d56ebf2: Download complete
   3a030ca3f633: Download complete
   25f1d6b1951a: Pull complete
   Digest: sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
   Status: Downloaded newer image for alpine:3.20
   3.20.10
   ```

   Exit status: 0. The container runs `alpine:3.20` from `image.ref` and
   prints the Alpine version `3.20.10`.

## E. Cleanup

10. Delete the temp project. Delete the directory only if the path matches
    the temp pattern of step 7:

    ```bash
    case "$P" in /tmp/agro-us004-??????) ls -A "$P"; rm -rf -- "$P";; esac
    test ! -e "$P"; echo "gone exit=$?"
    ```

    Output:

    ```text
    .git
    agro.json
    gone exit=0
    ```

11. List all containers:

    ```bash
    docker ps -a --format '{{.Names}} {{.Image}}'
    ```

    Output:

    ```text
    confident_buck ghcr.io/mifunedev/agro:0.37.0
    ```

    Exit status: 0. No `alpine` container remains from the run. The
    `confident_buck` container existed before the review and is not part of
    it. The pulled `alpine:3.20` image stays in the local image cache.
