# RFC: MCP exec-runner — the agro sandbox as an A3 runner target

Status: Draft. This RFC is a companion to [#592](https://github.com/mifunedev/agro/issues/592) (runtime taxonomy) and to its implementation epic [#591](https://github.com/mifunedev/agro/issues/591). The scope is an **A3 (fan-out) runner candidate**. This RFC adds no new taxonomy.

This RFC proposes to make the agro sandbox a **remotely-drivable MCP runner**. To do this, the project vendors *only* the `exec-server` MCP proxy from [`mifunedev/sandboxes/ubuntu`](https://github.com/mifunedev/sandboxes/tree/master/ubuntu). The proposal is a candidate under the [runtime-support contract](rfc-runtime-support.md). `rfc-runtime-support.md` §6 raises the option that the "harness *becomes* a runner target", but defers the option. This RFC implements one concrete mechanism for that option. Wiki mechanics: [[mcp-exec-runner]].

## 1. What the proxy is

`mifunedev/sandboxes/ubuntu` is not a base image to import. The repository holds a Node MCP **server** of approximately 100 lines (`@modelcontextprotocol/sdk` ^1.12.1 + `express` + `zod`). The server exposes one tool:

- `exec_command { cmd, timeout? }` → `{ stdout, stderr, exitCode }`. The server runs the command through `child_process.exec()`, with a 120s maximum and a 10MB buffer. The source does not state the unit of `timeout`: <timeout unit>.
- Transport: **Streamable HTTP** (`mcp-session-id` sessions). Endpoints: `POST/GET/DELETE /mcp` and `GET /health`. Port: `3005` (`PORT`).
- Auth: optional `x-api-key` against `API_KEY`. Upstream turns auth **off by default**.

The requester limits the scope to **the proxy only** (`index.js` + `package.json`). The upstream Dockerfile, the upstream entrypoint, and the upstream "OpenClaw" `/workspace` scaffolding stay out of scope.

## 2. Where it fits the #592 taxonomy

| Axis | Fit | Why |
|---|---|---|
| **A1 — Substrate** | ✗ | The proxy adds no isolation. The proxy presumes that a separate decision chooses the substrate. With docker.sock mounted, the proxy *weakens* the boundary. |
| **A2 — Deploy target** | ✗ | The proxy is not a "ship the app" runtime. |
| **A3 — Scale / fan-out** | ✓ | The proxy is the **runner endpoint**. An external control plane uses the endpoint to drive N sandboxes over one uniform protocol (MCP). This replaces tmux/ralph inside the one container. |

**Direction.** The exec-runner is the *inverse* of DebugMCP. With DebugMCP, the sandbox is an MCP **client** that dials out to `:3001`. With the exec-runner, the sandbox **hosts** an MCP endpoint that an outside orchestrator drives. `rfc-runtime-support.md` §6 defers this question: "would the harness *be* a runner target (`provider: ssh`)?" The exec-runner is the MCP-shaped answer to that question. The exec-runner adds `provider: mcp-http` as a fourth A3 option beside the Crabbox *be / embed / integrate* options.

## 3. Meeting the "supported runtime" contract

This section maps the exec-runner to `rfc-runtime-support.md` §2:

1. **Documented** — `docs/integrations/mcp-exec-runner.md` holds registration and the Maintainer Decision Gate, and mirrors `debugmcp.md`. The runtimes overview gets one new row.
2. **One-toggle** — `harness.yaml` `install.mcp_exec_runner` maps to a build-arg/env through `.agro/scripts/harness-config.sh`. This mirrors `INSTALL_HERMES`. The install never takes more than one step.
3. **Validated** — The runner boots inside the sandbox. `GET :3005/health` returns ok. The MCP `initialize` handshake returns a session id. `exec_command` runs. Boot-lint and the probe floor stay green.
4. **Guarded** — `.agro/evals/probes/mcp-exec-runner-availability.sh` checks the handshake and the health endpoint. This probe mirrors `debugmcp-availability.sh`.

**Friction principle (§3):** The default install ships *nothing* new. The trusted single-operator container stays the zero-config default. The runner is opt-in and off by default.

## 4. Security — the gating concern

`exec_command` gives arbitrary remote code execution (RCE). The sandbox bind-mounts `/var/run/docker.sock` (`.devcontainer/docker-compose.yml`). Thus RCE reaches the Docker daemon, and the Docker daemon reaches the host. `rfc-runtime-support.md` §Purpose names this risk: the "root-on-host boundary / weakest link once untrusted code runs unattended".

The security posture is non-negotiable. The external proposal decision audit defines the posture (`.agro/skills/audit/references/external-proposal-audit.md`):

- **Off by default.** One opt-in toggle enables the runner. Default installs stay unchanged: `.agro/templates/full/` and `init.test.ts` stay green.
- **Loopback-bound by default.** External reach comes only from a deliberate `cloudflared` tunnel or from explicit `forwardPorts`. **Never bind to `0.0.0.0` by default.**
- **`API_KEY` required whenever the runner is enabled.** The runner fails closed without the key. Do not inherit the upstream keyless default.
- Vendor and **pin** `@modelcontextprotocol/sdk`. Keep the config minimal and reviewed. Grant no permissions automatically.
- Open decision: the runner runs as `sandbox` or as a dedicated low-privilege `executor` user. The `sandbox` user matches the bind-mount owner, but has sudo and docker-group membership. The `executor` user shrinks the blast radius. **This RFC recommends the low-privilege `executor` user.** With that user, a compromised runner cannot trivially reach the socket.

## 5. Decides vs defers

- **Decides:** This RFC decides three things. First, the MCP exec-runner is the A3 *runner-endpoint* candidate under #592. Second, the contract mapping is §3. Third, the security floor is §4.
- **Defers to #591 / the primary-driver decision:** #591 decides the form of A3: this MCP-runner endpoint, a Crabbox-style offload, or CI-as-runtime. #591 also decides the order. This RFC does not preempt that decision. This RFC makes the MCP-runner option concrete and costed.

## 6. Proposed merge into `rfc-runtime-support.md` (for the maintainer to apply)

This RFC does not edit the in-flight #592 draft. Instead, this RFC proposes two additive changes for the maintainer:

- **§4 fit matrix — new row:**
  `| agro-as-MCP-runner (exec-server, mifunedev/sandboxes) | A3 | MCP-HTTP runner endpoint | Sandbox hosts one exec_command tool over Streamable HTTP; RCE + docker.sock → opt-in/loopback/API_KEY. Inverse of DebugMCP. |`
- **§6 / §9 — new open decision:** Add `provider: mcp-http` as a fourth A3 option beside Crabbox *be / embed / integrate*. The decision chooses among three forms: the sandbox as an MCP runner, the sandbox as an SSH runner, or a Crabbox offload.

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

- This RFC vendors no proxy and wires no proxy. This RFC is a decision artifact.
- The exec-runner is not a substrate (A1) and not a deploy target (A2).
- This RFC does not import the upstream base image or the upstream OpenClaw workspace scaffolding.
