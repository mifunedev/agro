# RFC: MCP exec-runner — the agro sandbox as an A3 runner target

Status: Draft. This RFC is a companion to [#592](https://github.com/mifunedev/agro/issues/592), the runtime taxonomy, and to [#591](https://github.com/mifunedev/agro/issues/591), the implementation epic for #592. This RFC scopes an **A3 (fan-out) runner candidate**. This RFC does not scope a new taxonomy.

This RFC proposes that the agro sandbox become a **remotely-drivable MCP runner**. The proposal vendors only the `exec-server` MCP proxy from [`mifunedev/sandboxes/ubuntu`](https://github.com/mifunedev/sandboxes/tree/master/ubuntu). This RFC is one candidate under the [runtime-support contract](rfc-runtime-support.md). This RFC implements one concrete mechanism for the "harness *becomes* a runner target" option. `rfc-runtime-support.md` §6 raises that option and defers it to this RFC. See [[mcp-exec-runner]] for the wiki mechanics.

## 1. What the proxy is

`mifunedev/sandboxes/ubuntu` is not a base image worth importing. The repository holds a Node MCP **server** of about 100 lines, built with `@modelcontextprotocol/sdk` ^1.12.1, `express`, and `zod`. The server exposes one tool:

- `exec_command { cmd, timeout? }` → `{ stdout, stderr, exitCode }`, run via `child_process.exec()` (120s max, 10MB buffer).
- Transport: **Streamable HTTP** (`mcp-session-id` sessions). Endpoints `POST/GET/DELETE /mcp`, `GET /health`. Port `3005` (`PORT`).
- Auth: optional `x-api-key` against `API_KEY` — **off by default** upstream.

This RFC scopes only the proxy: `index.js` and `package.json`. This RFC excludes the upstream Dockerfile, the upstream entrypoint, and the upstream "OpenClaw" `/workspace` scaffolding.

## 2. Where it fits the #592 taxonomy

| Axis | Fit | Why |
|---|---|---|
| **A1 — Substrate** | ✗ | This RFC assumes another decision sets the substrate elsewhere and adds no isolation. Under `docker.sock`, this RFC weakens the substrate boundary. |
| **A2 — Deploy target** | ✗ | This RFC is not a deploy-target runtime for the application. |
| **A3 — Scale / fan-out** | ✓ | This proxy is the runner endpoint. The runner endpoint lets an external control plane drive N sandboxes over one protocol, MCP, instead of tmux or ralph inside one container. |

**Direction.** DebugMCP takes the opposite direction: in DebugMCP, the sandbox acts as an MCP client and dials out to `:3001`. In this RFC, the sandbox hosts an MCP endpoint, and an outside orchestrator drives that endpoint. This RFC answers the question that `rfc-runtime-support.md` §6 defers: "would the harness be a runner target (`provider: ssh`)?" This RFC proposes `provider: mcp-http` as a fourth option beside the Crabbox embed and integrate options.

## 3. Meeting the "supported runtime" contract

This RFC maps to `rfc-runtime-support.md` §2 as follows:

1. **Documented** — This RFC adds `docs/integrations/mcp-exec-runner.md`. This file mirrors `debugmcp.md`: registration and the Maintainer Decision Gate. This RFC also adds one row to the runtimes overview.
2. **One toggle** — The operator sets `install.mcp_exec_runner` in `harness.yaml`. `.agro/scripts/harness-config.sh` converts that setting into a build argument or environment variable, the same pattern `INSTALL_HERMES` uses. The install stays a single toggle, never a multi-step procedure.
3. **Validated** — The proxy starts inside the sandbox. `GET :3005/health` returns OK. The MCP `initialize` handshake returns a session ID. `exec_command` runs. The boot-lint check and the probe floor both stay green.
4. **Guarded** — The probe `.agro/evals/probes/mcp-exec-runner-availability.sh` checks the handshake and the health endpoint. This probe mirrors `debugmcp-availability.sh`.

**Friction principle (§3):** The default install ships nothing new. The trusted single-operator container stays the zero-configuration default. The runner stays opt-in and off by default.

## 4. Security — the gating concern

`exec_command` grants arbitrary remote code execution (RCE). The sandbox bind-mounts `/var/run/docker.sock` in `.devcontainer/docker-compose.yml`. RCE through `exec_command` reaches the Docker daemon, then reaches the host. `rfc-runtime-support.md` §Purpose names this same risk: a root-on-host boundary becomes the weakest link once untrusted code runs unattended.

This security posture is non-negotiable. `.agro/skills/audit/references/external-proposal-audit.md` defines this posture:

- The runner stays off by default and opt-in through a single toggle. Default installs stay unchanged: `.agro/templates/full/` and `init.test.ts` stay green.
- The runner binds to loopback by default. External reach requires a deliberate `cloudflared` tunnel or an explicit `forwardPorts` entry. The default configuration never binds to `0.0.0.0`.
- `API_KEY` is required whenever the operator enables the runner. This RFC fails closed and rejects the upstream keyless default.
- This RFC vendors and pins `@modelcontextprotocol/sdk`. The configuration stays minimal and reviewed. No permission is auto-granted.
- Open question: run the proxy as the `sandbox` user, which matches the bind-mount owner but holds `sudo` and the `docker` group, or run the proxy as a dedicated low-privilege `executor` user to shrink the blast radius. This RFC recommends the low-privilege `executor` user. A compromised runner running as `executor` cannot reach `docker.sock` without an added privilege-escalation step.

## 5. Decides vs defers

- **Decides:** This RFC decides that the MCP exec-runner is the A3 runner-endpoint candidate under #592. This RFC decides the contract mapping in §3 and the security floor in §4.
- **Defers to #591 and the primary-driver decision:** #591 decides whether A3 lands as the MCP-runner endpoint, a Crabbox-style offload, or CI-as-runtime, and #591 decides the ordering among those options. This RFC does not preempt that decision. This RFC makes the MCP-runner option concrete and costed.

## 6. Proposed merge into `rfc-runtime-support.md` (for the maintainer to apply)

This RFC proposes two additive changes instead of editing the in-flight #592 draft directly:

- **§4 fit matrix — new row:**
  `| agro-as-MCP-runner (exec-server, mifunedev/sandboxes) | A3 | MCP-HTTP runner endpoint | Sandbox hosts one exec_command tool over Streamable HTTP; RCE + docker.sock → opt-in/loopback/API_KEY. Inverse of DebugMCP. |`
- **§6 and §9 — new open decision:** This RFC adds `provider: mcp-http` as a fourth A3 option beside the Crabbox `be`, `embed`, and `integrate` options. The open decision compares three choices: expose the sandbox as an MCP runner, expose the sandbox as an SSH runner, or use a Crabbox offload.

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

- This RFC vendors no proxy and wires no proxy. This document is a decision artifact.
- This RFC is not a substrate decision (A1) and not a deploy-target decision (A2).
- This RFC does not import the upstream base image. This RFC does not import the upstream base image's OpenClaw workspace scaffolding.
