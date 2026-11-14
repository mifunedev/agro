---
name: sandbox
description: |
  Choose and use local/docker, local/msb, mifune-console, or exedev sandbox
  execution. TRIGGER when: asked to use or configure agro run, run an isolated
  command, offload work to
  a hand, fork a hand, use agro hands, create an exe.dev VM, validate a fresh
  AGRO install or release, run a hosting matrix, cgroup probe, restart test,
  OpenShell journey, Hermes home, Docker egress, msb guest, agro run matrix,
  or add a validation adapter. Does not own persistent workspace lifecycle,
  interactive process management, or checkout isolation.
license: MIT
---

# Sandbox

## Shared safety

- Use `agro` as the control interface, not as a provider name.
- Keep provider, runtime, and resource role separate. A hand is a remote
  resource role in `mifune-console`, not another provider.
- `local` means the host running `agro`, even on a remote VM.
  `msb` means Microsandbox.
- Run application workloads inside a supported sandbox. Do not continue
  application work on a provider VM's raw host.
- Get explicit operator authority before billable create or fork operations.
  Agree on resource ownership and teardown scope before creation.
- Never silently fall back to host execution or weaker isolation after a refusal.
  Stop at a guard. Follow its remedy or report the block.
- Inspect installed capabilities with `agro --version`, `agro run --help`,
  and the selected command's help before using optional flags.
- Before suggesting existing-sandbox execution, confirm that `agro run --help`
  advertises `--sandbox`. Version 0.33.0 lacks this flag; 0.34.0 introduced it.
  Installed help remains the authority. Do not assume source capabilities exist in the installed CLI.
- Preserve checkout changes. Disposable execution does not roll back workspace writes.
- Use bounded harness completion monitoring for long operations.
  In Pi, use `MonitorCreate` with a completion wake; use the equivalent in other harnesses.
  Do not shell-poll logs with sleep loops.

## Select a route

Read the selected execution reference before acting.

| Route | Choose when | Reference |
|---|---|---|
| `local/docker` | Run one command with container isolation, services, or an egress allowlist. | [Docker execution](references/local-docker.md) |
| `local/msb` | Run one command with a separate kernel on a KVM host. | [Microsandbox execution](references/local-msb.md) |
| `mifune-console` | Offload a project from a brain to a hand. | [Console hands](references/mifune-console.md) |
| `exedev` | Use an approved exe.dev VM through the SSH command API. | [exe.dev execution](references/exedev.md) |

Choose the route from the request's intent and the execution environment.
Ask the operator only if the required host or isolation boundary remains unresolved.
Do not infer billable authority from a route selection.

## Validation and supporting resources

- For fresh-install checks and all seven validation scenarios, read
  [Validation](references/validation.md). It holds commands, variables, result
  grammar, and the adapter contract.
- For validation adapter setup and owned-resource cleanup, read
  [Validation providers](references/providers.md) directly.
  Internal adapter IDs remain `console`, `msb`, `exedev`, and `vercel`.
  These IDs are not the execution route vocabulary.
- For row purpose, historical baselines, and driver failure evidence, read
  [Validation rationale](references/rationale.md).
- Validation drivers: [run](scripts/run.sh), [restart](scripts/restart-test.sh),
  [summarize](scripts/summarize.sh), and [shared library](scripts/lib.sh).
  Run these only through the validation procedure.
- Adapters: [console](adapters/console.sh), [msb](adapters/msb.sh),
  [exedev](adapters/exedev.sh), and [vercel](adapters/vercel.sh).
- Checks: [fresh install](checks/fresh-install.sh), [cgroups](checks/cg-probe.sh),
  [hosting rows](checks/agro-rows.sh), [OpenShell](checks/openshell-journey.sh),
  [Hermes home](checks/hermes-home.sh), [Docker egress](checks/docker-egress.sh),
  [msb guest](checks/msb-guest.sh), and [run matrix](checks/agro-run-matrix.sh).

## Boundaries

For persistent Docker or OpenShell workspaces, use the public
[lifecycle commands](https://github.com/mifunedev/agro/blob/main/docs/lifecycle-commands.md).
For interactive agents, tests, or servers, use `/herdr`.
For checkout isolation, use `/worktrees`.
Keep headless gateways and tunnels in named tmux sessions.
Do not make persistent work depend on an attached shell.
