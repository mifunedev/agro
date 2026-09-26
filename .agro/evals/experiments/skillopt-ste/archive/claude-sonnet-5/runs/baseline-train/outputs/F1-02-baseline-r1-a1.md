# RFC: MCP exec-runner — the agro sandbox as an A3 runner target

Status: Draft. This RFC is a companion to [#592](https://github.com/mifunedev/agro/issues/592) (runtime taxonomy) and to its implementation epic, [#591](https://github.com/mifunedev/agro/issues/591). This RFC scopes an **A3 (fan-out) runner candidate**. This RFC does not define a new taxonomy.

This RFC proposes one change: vendor only the `exec-server` MCP proxy from [`mifunedev/sandboxes/ubuntu`](https://github.com/mifunedev/sandboxes/tree/master/ubuntu) into the agro sandbox. The change makes the agro sandbox a remotely-drivable MCP runner. This RFC is a candidate under the [runtime-support contract](rfc-runtime-support.md). `rfc-runtime-support.md` §6 raises the "harness *becomes* a runner target" option and defers it. This RFC implements one concrete mechanism for that option. Wiki mechanics: [[mcp-exec-runner]].

## 1. What the proxy is

`mifunedev/sandboxes/ubuntu` is not a base image. `mifunedev/sandboxes/ubuntu` is a Node MCP server of about 100 lines, built with `@modelcontextprotocol/sdk` ^1.12.1, `express`, and `zod`. The server exposes one tool:

- `exec_command { cmd, timeout? }` → `{ stdout, stderr, exitCode }`, run via `child_process.exec()`, with a 120-second maximum timeout and a 10 MB buffer limit.
- Transport: Streamable HTTP, using `mcp-session-id` sessions. Endpoints: `POST/GET/DELETE /mcp` and `GET /health`. Default port: `3005`, set by the `PORT` environment variable.
- Authentication: optional. The server checks the `x-api-key` header against `API_KEY` only when `API_KEY` is set. Upstream ships with this check off by default.

The requester scoped this RFC to the proxy files only: `index.js` and `package.json`. This RFC excludes the upstream Dockerfile, the upstream entrypoint, and the upstream "OpenClaw" `/workspace` scaffolding.

## 2. Where it fits the #592 taxonomy

| Axis | Fit | Why |
|---|---|---|
| **A1 — Substrate** | ✗ | Adds no isolation. The substrate decision happens elsewhere. Under `docker.sock`, the proxy weakens the isolation boundary. |
| **A2 — Deploy target** | ✗ | The exec-runner is not a runtime for shipping the application. |
| **A3 — Scale / fan-out** | ✓ | The exec-runner is the runner endpoint. An external control plane uses this endpoint to drive N sandboxes over one protocol, MCP, instead of tmux or ralph inside one container. |

**Direction.** This design is the inverse of DebugMCP. In DebugMCP, the sandbox acts as an MCP client and dials out to `:3001`. In this design, the sandbox hosts an MCP endpoint, and an outside orchestrator drives that endpoint. `rfc-runtime-support.md` §6 asks: would the harness be a runner target (`provider: ssh`)? This design answers that question with one MCP-shaped mechanism. This design adds `provider: mcp-http` as a fourth option, alongside the Crabbox embed option and the Crabbox integrate option.

## 3. Meeting the "supported runtime" contract

Mapped to `rfc-runtime-support.md` §2:

1. **Documented.** This RFC adds `docs/integrations/mcp-exec-runner.md`, mirroring `debugmcp.md`: it documents registration and the Maintainer Decision Gate. This RFC also adds one row to the runtimes overview.
2. **One toggle.** The operator sets `install.mcp_exec_runner` in `harness.yaml`. `.agro/scripts/harness-config.sh` converts that setting into a build argument and an environment variable, mirroring `INSTALL_HERMES`. Installation never takes more than one step.
3. **Validated.** The server boots inside the sandbox. `GET :3005/health` returns ok. The MCP `initialize` handshake returns a session id. `exec_command` runs. The boot-lint check and the probe floor stay green.
4. **Guarded.** `.agro/evals/probes/mcp-exec-runner-availability.sh` checks the handshake and the health endpoint, mirroring `debugmcp-availability.sh`.

**Friction principle (§3).** The default install ships nothing new. The trusted single-operator container stays the zero-config default. The runner stays opt-in and off by default.

## 4. Security — the gating concern

`exec_command` allows arbitrary remote code execution (RCE). The sandbox bind-mounts `/var/run/docker.sock` in `.devcontainer/docker-compose.yml`. Through that mount, RCE reaches the Docker daemon, and from the Docker daemon, RCE reaches the host. `rfc-runtime-support.md` §Purpose names this same risk: a root-on-host boundary becomes the weakest link once untrusted code runs unattended.

This security posture is non-negotiable. `.agro/skills/audit/references/external-proposal-audit.md` defines this posture:

- **Off by default.** One toggle turns the runner on. Default installs stay unchanged: `.agro/templates/full/` and `init.test.ts` stay green.
- **Loopback-bound by default.** External reach requires a deliberate `cloudflared` tunnel or an explicit `forwardPorts` entry. The server never binds to `0.0.0.0` by default.
- **`API_KEY` required whenever the runner is enabled.** This design fails closed. This design does not inherit the upstream keyless default.
- This design vendors and pins `@modelcontextprotocol/sdk`. This design keeps the configuration minimal and reviewed. This design grants no permission automatically.
- **Open question: which user runs the proxy?** The `sandbox` user matches the bind-mount owner, but the `sandbox` user has `sudo` access and belongs to the `docker` group. A dedicated low-privilege `executor` user would shrink the blast radius instead. This RFC recommends the low-privilege `executor` user, so that a compromised runner cannot reach the socket directly.

## 5. Decides vs defers

- **Decides:** This RFC decides that the MCP exec-runner is the A3 runner-endpoint candidate under #592. This RFC decides the contract mapping in §3. This RFC decides the security floor in §4.
- **Defers to #591 / the primary-driver decision:** whether A3 lands as this MCP-runner endpoint, as a Crabbox-style offload, or as CI-as-runtime, and in what order. This RFC does not preempt that decision. This RFC makes the MCP-runner option concrete and costed instead.

## 6. Proposed merge into `rfc-runtime-support.md` (for the maintainer to apply)

This RFC proposes two additive changes instead of editing the in-flight #592 draft directly:

- **§4 fit matrix — new row:**
  `| agro-as-MCP-runner (exec-server, mifunedev/sandboxes) | A3 | MCP-HTTP runner endpoint | Sandbox hosts one exec_command tool over Streamable HTTP; RCE + docker.sock → opt-in/loopback/API_KEY. Inverse of DebugMCP. |`
- **§6 / §9 — new open decision.** Add `provider: mcp-http` as a fourth A3 option, beside the Crabbox *be* option, the Crabbox *embed* option, and the Crabbox *integrate* option. The open decision: expose the sandbox as an MCP runner, as an SSH runner, or as a Crabbox offload.

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

- This RFC vendors no proxy and wires no proxy. This RFC is a decision artifact only.
- This is not a substrate (A1). This is not a deploy target (A2).
- This RFC does not import the upstream base image. This RFC does not import the upstream OpenClaw workspace scaffolding.
