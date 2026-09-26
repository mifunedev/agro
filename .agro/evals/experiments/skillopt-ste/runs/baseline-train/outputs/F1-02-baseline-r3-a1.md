# RFC: MCP exec-runner — the agro sandbox as an A3 runner target

Status: Draft. This RFC is a companion to [#592](https://github.com/mifunedev/agro/issues/592) (runtime taxonomy) and to the implementation epic [#591](https://github.com/mifunedev/agro/issues/591). The scope is an **A3 (fan-out) runner candidate**. This RFC adds no new taxonomy.

This RFC proposes to make the agro sandbox a **remotely-drivable MCP runner**. The sandbox vendors *only* the `exec-server` MCP proxy from [`mifunedev/sandboxes/ubuntu`](https://github.com/mifunedev/sandboxes/tree/master/ubuntu). The proposal is a candidate under the [runtime-support contract](rfc-runtime-support.md). `rfc-runtime-support.md` §6 raises the option "harness *becomes* a runner target" and defers that option. This RFC supplies one concrete mechanism for that option. Wiki mechanics: [[mcp-exec-runner]].

## 1. What the proxy is

`mifunedev/sandboxes/ubuntu` is not a base image worth importing. The repository holds a ~100-line Node MCP **server** (`@modelcontextprotocol/sdk` ^1.12.1 + `express` + `zod`). The server exposes a single tool:

- `exec_command { cmd, timeout? }` → `{ stdout, stderr, exitCode }`. The server runs `cmd` through `child_process.exec()`. The maximum timeout is 120s. The output buffer is 10MB.
- Transport: **Streamable HTTP** with `mcp-session-id` sessions. Endpoints: `POST/GET/DELETE /mcp` and `GET /health`. Port: `3005` (`PORT`).
- Auth: optional `x-api-key` checked against `API_KEY`. Upstream sets auth **off by default**.

The requester limits the scope to **the proxy only**: `index.js` and `package.json`. The upstream Dockerfile, the upstream entrypoint, and the "OpenClaw" `/workspace` scaffolding stay out of scope.

## 2. Where the proxy fits the #592 taxonomy

| Axis | Fit | Why |
|---|---|---|
| **A1 — Substrate** | ✗ | The proxy adds no isolation. The proxy presumes that another decision selects the substrate. Under docker.sock, the proxy *weakens* the boundary. |
| **A2 — Deploy target** | ✗ | The proxy is not a "ship the app" runtime. |
| **A3 — Scale / fan-out** | ✓ | The proxy is the **runner endpoint**. An external control plane uses the endpoint to drive N sandboxes over one uniform protocol (MCP). The endpoint replaces tmux/ralph inside the one container. |

**Direction.** The proxy is the *inverse* of DebugMCP. In DebugMCP, the sandbox is an MCP **client** that dials out to `:3001`. In this RFC, the sandbox **hosts** an MCP endpoint, and an outside orchestrator drives the endpoint. `rfc-runtime-support.md` §6 defers one question: "would the harness *be* a runner target (`provider: ssh`)?" This RFC gives the MCP-shaped answer to that question. The answer adds `provider: mcp-http` as a fourth option beside Crabbox embed/integrate.

## 3. Meeting the "supported runtime" contract

The mapping below follows `rfc-runtime-support.md` §2:

1. **Documented** — add `docs/integrations/mcp-exec-runner.md`. The file mirrors `debugmcp.md`: registration plus the Maintainer Decision Gate. Add one row to `docs/runtimes/overview.md`.
2. **One-toggle** — `harness.yaml` `install.mcp_exec_runner` maps to a build-arg/env through `.agro/scripts/harness-config.sh`. The toggle mirrors `INSTALL_HERMES`. The install never takes more than one step.
3. **Validated** — the proxy boots inside the sandbox. `GET :3005/health` returns ok. The MCP `initialize` handshake returns a session id. `exec_command` runs. The boot-lint and the probe floor stay green.
4. **Guarded** — `.agro/evals/probes/mcp-exec-runner-availability.sh` checks the handshake and the health endpoint. The probe mirrors `debugmcp-availability.sh`.

**Friction principle (`rfc-runtime-support.md` §3):** the default install ships *nothing* new. The trusted single-operator container stays the zero-config default. The runner is opt-in and off by default.

## 4. Security — the gating concern

`exec_command` gives arbitrary RCE. The sandbox bind-mounts `/var/run/docker.sock` (`.devcontainer/docker-compose.yml`). Through the socket, RCE reaches the Docker daemon. Through the Docker daemon, RCE reaches the host. `rfc-runtime-support.md` §Purpose names this risk: the "root-on-host boundary / weakest link once untrusted code runs unattended".

The posture is non-negotiable. The external proposal decision audit defines the posture (`.agro/skills/audit/references/external-proposal-audit.md`):

- **Off by default.** One opt-in toggle enables the runner. Default installs stay unchanged: `.agro/templates/full/` and `init.test.ts` stay green.
- **Loopback-bound by default.** External reach requires a deliberate `cloudflared` tunnel or an explicit `forwardPorts` entry. **Never bind to `0.0.0.0` by default.**
- **`API_KEY` required whenever the runner is enabled** (fail-closed). Do not inherit the upstream keyless default.
- Vendor and **pin** `@modelcontextprotocol/sdk`. Keep the configuration minimal and reviewed. Grant no permissions automatically.
- Open question: run the proxy as `sandbox`, or as a dedicated low-priv `executor` user. The `sandbox` user matches the bind-mount owner, but `sandbox` has sudo and docker group membership. The `executor` user shrinks the blast radius. **This RFC recommends the low-priv `executor` user.** With `executor`, a compromised runner cannot trivially reach the socket.

## 5. Decides vs defers

- **Decides:** this RFC decides three items. First, the MCP exec-runner is the A3 *runner-endpoint* candidate under #592. Second, §3 gives the contract mapping. Third, §4 gives the security floor.
- **Defers to #591 / the primary-driver decision:** that decision selects how A3 lands. The options are this MCP-runner endpoint, a Crabbox-style offload, or CI-as-runtime. That decision also sets the order of the options. This RFC does not preempt that decision. This RFC makes the MCP-runner option concrete and costed.

## 6. Proposed merge into `rfc-runtime-support.md` (for the maintainer to apply)

This RFC does not edit the in-flight #592 draft. This RFC proposes two additive changes instead:

- **§4 fit matrix — new row:**
  `| agro-as-MCP-runner (exec-server, mifunedev/sandboxes) | A3 | MCP-HTTP runner endpoint | Sandbox hosts one exec_command tool over Streamable HTTP; RCE + docker.sock → opt-in/loopback/API_KEY. Inverse of DebugMCP. |`
- **§6 / §9 — new open decision:** add `provider: mcp-http` as a fourth A3 option beside Crabbox *be / embed / integrate*. The decision chooses between three options: expose the sandbox as an MCP runner, as an SSH runner, or as a Crabbox offload.

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
- The proxy is not a substrate (A1). The proxy is not a deploy target (A2).
- This RFC does not import the upstream base image or the upstream OpenClaw workspace scaffolding.
