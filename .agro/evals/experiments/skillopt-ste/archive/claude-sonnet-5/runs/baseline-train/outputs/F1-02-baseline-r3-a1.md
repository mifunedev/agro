# RFC: MCP exec-runner — the agro sandbox as an A3 runner target

Status: Draft. This RFC is a companion to issue [#592](https://github.com/mifunedev/agro/issues/592) (runtime taxonomy) and to its implementation epic, issue [#591](https://github.com/mifunedev/agro/issues/591). This RFC scopes one A3 (fan-out) runner candidate. This RFC does not define a new taxonomy.

This RFC proposes one change: vendor only the `exec-server` MCP proxy from [`mifunedev/sandboxes/ubuntu`](https://github.com/mifunedev/sandboxes/tree/master/ubuntu) into the agro sandbox. This change turns the agro sandbox into a remotely-drivable MCP runner. This RFC is a candidate under the [runtime-support contract](rfc-runtime-support.md). This RFC implements one concrete mechanism for an option that `rfc-runtime-support.md` §6 raises and defers: the harness becomes a runner target. Wiki mechanics: [[mcp-exec-runner]].

## 1. What the proxy is

`mifunedev/sandboxes/ubuntu` is not a base image. This repository is a Node MCP server of about 100 lines. The server uses `@modelcontextprotocol/sdk` ^1.12.1, `express`, and `zod`. The server exposes one tool:

- `exec_command { cmd, timeout? }` returns `{ stdout, stderr, exitCode }`. The server runs the command through `child_process.exec()`, with a 120-second timeout and a 10MB buffer limit.
- The transport is Streamable HTTP, using `mcp-session-id` sessions. The endpoints are `POST/GET/DELETE /mcp` and `GET /health`. The default port is `3005`, set through the `PORT` environment variable.
- Authentication through `x-api-key` against `API_KEY` is optional. The upstream server has authentication off by default.

This RFC scopes only the proxy: `index.js` and `package.json`. This RFC excludes the upstream Dockerfile, the upstream entrypoint, and the upstream `/workspace` scaffolding, named "OpenClaw" upstream.

## 2. Where it fits the #592 taxonomy

| Axis | Fit | Why |
|---|---|---|
| A1 — Substrate | No | The proxy adds no isolation. The proxy assumes another mechanism already decided the substrate. Under a mounted docker.sock, the proxy weakens the boundary. |
| A2 — Deploy target | No | This proxy is not a runtime that ships the application. |
| A3 — Scale / fan-out | Yes | The proxy is the runner endpoint. The runner endpoint lets an external control plane drive many sandboxes over one protocol, MCP, instead of tmux or ralph inside one container. |

Direction: This RFC is the inverse of DebugMCP. In DebugMCP, the sandbox is an MCP client that dials out to `:3001`. In this RFC, the sandbox hosts an MCP endpoint, and an outside orchestrator drives that endpoint. This RFC answers the deferred question in `rfc-runtime-support.md` §6: would the harness become a runner target through `provider: ssh`? This RFC proposes `provider: mcp-http` as a fourth option, alongside the Crabbox embed option and the Crabbox integrate option.

## 3. Meeting the "supported runtime" contract

This mapping follows `rfc-runtime-support.md` §2:

1. Documented: This RFC adds `docs/integrations/mcp-exec-runner.md`, mirroring `debugmcp.md` with a registration section and a Maintainer Decision Gate section. This RFC adds one row to the runtimes-overview document.
2. One toggle: The operator sets `install.mcp_exec_runner` in `harness.yaml`. `.agro/scripts/harness-config.sh` turns that setting into a build argument or an environment variable, mirroring `INSTALL_HERMES`. Installation never takes more than one step.
3. Validated: The exec-runner boots inside the sandbox. `GET :3005/health` returns ok. The MCP `initialize` handshake returns a session id. `exec_command` runs a command successfully. The boot-lint check and the probe floor stay green.
4. Guarded: `.agro/evals/probes/mcp-exec-runner-availability.sh` checks the handshake and the health endpoint, mirroring `debugmcp-availability.sh`.

Friction principle, `rfc-runtime-support.md` §3: the default install ships nothing new. The trusted single-operator container stays the zero-configuration default. The runner is opt-in, and the runner stays off by default.

## 4. Security — the gating concern

`exec_command` grants arbitrary remote code execution. `.devcontainer/docker-compose.yml` bind-mounts `/var/run/docker.sock` into the sandbox. Remote code execution through `exec_command` reaches the Docker daemon. The Docker daemon reaches the host. This fact matches the root-on-host boundary that `rfc-runtime-support.md` §Purpose names as the weakest link once untrusted code runs unattended.

This posture is non-negotiable. `.agro/skills/audit/references/external-proposal-audit.md` defines this posture:

- The runner stays off by default. The operator turns on the runner through one opt-in toggle. Default installs stay unchanged: `.agro/templates/full/` and `init.test.ts` stay green.
- The runner binds to loopback by default. External reach requires a deliberate `cloudflared` tunnel or an explicit `forwardPorts` entry. The default configuration never binds to `0.0.0.0`.
- Whenever the operator enables the runner, the runner requires `API_KEY`. This RFC rejects the upstream keyless default.
- This RFC vendors a pinned copy of `@modelcontextprotocol/sdk`. This RFC keeps the configuration minimal and reviewed. This RFC grants no permission automatically.
- Open question: should the runner run as the `sandbox` user, which matches the bind-mount owner but holds `sudo` access and `docker` group membership, or as a dedicated low-privilege `executor` user, which shrinks the blast radius? This RFC recommends the low-privilege `executor` user. A compromised runner running as `executor` cannot reach `/var/run/docker.sock` directly.

## 5. Decides vs defers

- This RFC decides that the MCP exec-runner is the A3 runner-endpoint candidate under issue #592. This RFC decides the contract mapping in §3. This RFC decides the security floor in §4.
- This RFC defers to issue #591 and to the primary-driver decision: whether A3 lands as this MCP-runner endpoint, as a Crabbox-style offload, or as CI-as-runtime, and in what order. This RFC does not preempt that decision. This RFC makes the MCP-runner option concrete, with a defined cost.

## 6. Proposed merge into `rfc-runtime-support.md` (for the maintainer to apply)

This RFC proposes two additive changes instead of editing the in-flight #592 draft directly:

- §4 fit matrix, new row:
  `| agro-as-MCP-runner (exec-server, mifunedev/sandboxes) | A3 | MCP-HTTP runner endpoint | Sandbox hosts one exec_command tool over Streamable HTTP; RCE + docker.sock → opt-in/loopback/API_KEY. Inverse of DebugMCP. |`
- §6 and §9, new open decision: add `provider: mcp-http` as a fourth A3 option, alongside the Crabbox `be` option, the Crabbox `embed` option, and the Crabbox `integrate` option. The open decision compares three choices: expose the sandbox as an MCP runner, expose the sandbox as an SSH runner, or use a Crabbox offload.

## 7. Next steps (non-executable — for after the decision)

```bash
# Only after the maintainer accepts the A3 primary-driver ordering:
gh issue create \
  --title "RFC: MCP exec-runner — sandbox as A3 MCP runner target (child of #591)" \
  --label autopilot \
  --body "Decision-gate: A3 runner endpoint via the mifunedev/sandboxes exec-server.
Vendor only index.js+package.json into .agro/mcp/exec-runner/ (repoint /workspace->/home/sandbox/harness, executor->low-priv user, pin SDK).
Opt-in install.mcp_exec_runner toggle; loopback + required API_KEY; docs/integrations/mcp-exec-runner.md + eval probe.
Gate: must satisfy rfc-runtime-support.md §2 contract and §4 security floor. No Dockerfile/compose change until accepted."
```

## Non-goals

- This RFC vendors no proxy. This RFC wires no proxy. This RFC is a decision artifact.
- This proxy is not a substrate under axis A1. This proxy is not a deploy target under axis A2.
- This RFC does not import the upstream base image. This RFC does not import the upstream OpenClaw workspace scaffolding.
