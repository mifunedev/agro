# local/docker

## Choose when

Use this route for one command on the host running `agro`.
Use Docker when the command needs services or an egress allowlist.
For persistent Docker or OpenShell workspaces, use the public
[lifecycle commands](https://github.com/mifunedev/agro/blob/main/docs/lifecycle-commands.md).

## Prerequisites

- Run on the host, not inside a sandbox. `agro run` refuses nested execution.
- Have Docker available. Inspect `agro run --help` before execution.
- Select the image: `--image <ref>` overrides `image.ref` in `agro.json`.
  Without either value, `agro run` uses the official image for the CLI version.
- Review the writable checkout for credentials. Isolation does not remove
  image environment variables or credentials already inside the mounted checkout.

## Execute

Run from the intended working directory on the host:

```bash
agro run -- pnpm test
agro run -- sh -c 'pnpm test && pnpm typecheck'
```

There is no implicit shell. Pass `sh -c` explicitly for shell operators.
The container mounts the Git repository root writable at the same path.
Outside a repository, the container mounts the current directory writable.
For a linked worktree, Docker also mounts the external Git common directory writable.
This exception lets Git resolve shared repository metadata.

The command uses the host uid/gid and the host current directory, with `HOME=/tmp`.
Temporary passwd/group files provide the host identity through read-only mounts.
The container receives no forwarded host environment, home directory, or Docker socket.

For PostgreSQL, declare this configuration in the checkout's `agro.json` before execution:

```json
{
  "run": {
    "services": {
      "postgres": {
        "image": "postgres:17-alpine",
        "env": { "POSTGRES_PASSWORD": "agro" },
        "ready": "pg_isready -U postgres"
      }
    },
    "env": {
      "TEST_DATABASE_URL": "postgres://postgres:agro@postgres:5432/postgres"
    }
  }
}
```

Keep secrets out of tracked configuration.
Each service gets a fresh container and its service name as a network alias.
The command reaches PostgreSQL at `postgres:5432` on the per-run network.
Readiness uses `sh -c` inside each service.
The default interval is 1 second per check, with a 60-second budget per readiness check.
Without `ready`, the service has no readiness probe.

`run.env` applies only in the service/allowlist network path.
With neither services nor an allowlist, `run.env` does not apply.
Default open egress uses Docker's default network without services.
With services and open egress, the per-run network also permits internet access.

With `access.egress: "allowlist"`, the command and services use an internal network.
A Squid proxy connects that network to a separate outbound network.
The proxy permits OpenShell policy hosts plus `access.egressAllow`.
The command gets upper/lowercase HTTP proxy variables, `NO_PROXY`/`no_proxy`, and `NODE_USE_ENV_PROXY=1`.
`NO_PROXY` includes localhost, 127.0.0.1, and service names.
Clients that ignore the proxy cannot reach the internet.
The proxy readiness budget is also 60 seconds.

Before existing-sandbox execution, confirm `--sandbox` support in `agro run --help`.
After that capability check, use `agro run --sandbox <name> -- <command...>`.
Existing-sandbox mode uses the sandbox workspace and default working directory, not the host checkout.
The command mounts no host path and applies no `run.services`, `run.env`, or `access.egress` settings.
The command does not start, stop, or remove the existing sandbox.

## Verify

Record the command and actual exit code. `agro run` propagates the command's exit code.
Inspect the checkout diff for expected writes. Disposable containers provide no rollback.

## Cleanup

`agro run` removes the command container and temporary identity files after execution.
The service/allowlist path also removes services, proxy, networks, and temporary proxy configuration after success or failure.
Inspect cleanup errors. Remove only resources that belong to the approved run.
Existing-sandbox execution leaves the sandbox running.

## Failure remedies

Setup errors exit 1 and name the failed operation or readiness check.
Check the image, Docker access, service configuration, and proxy policy named by the error.
Do not silently fall back to host execution or weaker isolation after a refusal.
Do not disable the allowlist to make a refused request succeed.
