# Manual review: fold the runtime catalog (US-004)

This file holds a transcript of the branch CLI against a temporary registry. Each step gives the command, the observed output (stdout and stderr together), and the exit status. Each output comes from one observed run.

## Build

Location: host (brain), local. Commit `e9fa4aa8` on branch `feat/1660-fold-runtime-catalog`.

```console
$ git rev-parse --short HEAD
e9fa4aa8
$ agro run -- pnpm run build
> agro@0.39.0 build
> pnpm run build:harness
> @mifune/agro@0.39.0 build
> node build.mjs
exit=0
```

The build block above shows only the script lines of the output. The build writes `.agro/cli/dist/agro.js`. Git ignores that path.

## Transcript

Prerequisites: the build above, Docker on the host, and Node 22 or newer. Each command runs on the host, local, from the worktree root. Each `agro` command passes `AGRO_HOME` inline. The transcript writes no env file. The temporary directory is `/tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE`.

The transcript runs no `sandbox install docker`, `shell`, `stop`, `restart`, or `destroy` against the healthy entry. The transcript creates no container and no live resource.

**A. Check for name collisions**

1. Confirm that no container on the host has a name that starts with `mr-`. Expected: no output. Expected exit status: 1 (`grep` finds no match).

```console
$ docker ps -a --format '{{.Names}}' | grep mr-
exit=1
```

**B. Seed the registry**

1. Make the two entry directories. Expected exit status: 0.

```console
$ mkdir -p /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-healthy /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-old
exit=0
```

2. Write the healthy entry. Expected exit status: 0.

```console
$ printf '%s\n' '{"version":1,"name":"mr-healthy"}' > /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-healthy/agro.json
exit=0
```

3. Write the invalid entry. AGRO retired the `runtime` value `openshell`. Expected exit status: 0.

```console
$ printf '%s\n' '{"version":1,"name":"mr-old","runtime":"openshell"}' > /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-old/agro.json
exit=0
```

**C. List the registry**

1. List the sandboxes. Expected: one warning line on stderr for `mr-old`, and one row for `mr-healthy`. Expected exit status: 0.

```console
$ AGRO_HOME=/tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE node .agro/cli/dist/agro.js sandbox list
agro sandbox list: skipped mr-old: agro.json: runtime must be one of docker
mr-healthy  absent  -
exit=0
```

2. List the sandboxes as JSON. Expected: the same warning line, and one JSON object for `mr-healthy`. Expected exit status: 0.

```console
$ AGRO_HOME=/tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE node .agro/cli/dist/agro.js sandbox list --json
agro sandbox list: skipped mr-old: agro.json: runtime must be one of docker
[
  {
    "name": "mr-healthy",
    "checkout": "-",
    "repo": "-",
    "status": "absent"
  }
]
exit=0
```

**D. Failure path: a verb that targets the invalid entry**

1. Destroy the invalid entry. Expected: the validation error, then the remedy line. Expected exit status: 1.

```console
$ AGRO_HOME=/tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE node .agro/cli/dist/agro.js destroy mr-old --yes
agro destroy: agro.json: runtime must be one of docker
agro destroy: fix /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-old/agro.json, or remove the entry /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-old
exit=1
```

2. Show the status of the invalid entry. Expected: the validation error, then the remedy line. Expected exit status: 1.

```console
$ AGRO_HOME=/tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE node .agro/cli/dist/agro.js ps mr-old
agro ps: agro.json: runtime must be one of docker
agro ps: fix /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-old/agro.json, or remove the entry /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-old
exit=1
```

3. List the files in the invalid entry. Expected: only `agro.json`. Expected exit status: 0.

```console
$ ls -A /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-old
agro.json
exit=0
```

4. Show the invalid entry. Expected: the seeded content, unchanged. Expected exit status: 0.

```console
$ cat /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes/mr-old/agro.json
{"version":1,"name":"mr-old","runtime":"openshell"}
exit=0
```

**E. Failure path: an unknown runtime**

1. Install an unknown runtime. Expected: `unknown runtime "microsandbox" — the only runtime is docker`. Expected exit status: 1.

```console
$ AGRO_HOME=/tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE node .agro/cli/dist/agro.js sandbox install microsandbox --yes
agro sandbox install: unknown runtime "microsandbox" — the only runtime is docker
exit=1
```

2. List the registry. Expected: only the two seeded entries. Expected exit status: 0.

```console
$ ls /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE/sandboxes
mr-healthy
mr-old
exit=0
```

**F. Cleanup**

1. Confirm that the transcript created no container. Expected: no output. Expected exit status: 1.

```console
$ docker ps -a --format '{{.Names}}' | grep mr-
exit=1
```

2. Delete the temporary `AGRO_HOME` directory. Expected exit status: 0.

```console
$ rm -rf /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE
exit=0
```

3. Confirm that the directory is gone. Expected: `No such file or directory`. Expected exit status: 2.

```console
$ ls /tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE
ls: cannot access '/tmp/claude-1000/-home-exedev--agro-workspaces-harness/b4808c7c-8405-4ff1-89e0-f2fdb2c47f1a/scratchpad/agro-home.gRjzoE': No such file or directory
exit=2
```
