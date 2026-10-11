# PRD: Docker egress allowlist

Status: DRAFT

## User Stories

### US-001: Add the egress setting

**Description:** As an operator, I want one `agro.json` setting that selects open or allowlist egress so that the hardened mode is a single toggle.

**Acceptance Criteria:**

- [ ] `AgroConfig` accepts `access.egress` with the values `"open"` and `"allowlist"`. The default is `"open"`.
- [ ] `AgroConfig` accepts `access.egressAllow` as an array of host strings. The default is an empty array.
- [ ] `agro config set access.egress allowlist --sandbox <name>` exits 0, and `agro config set access.egress closed --sandbox <name>` exits 1.
- [ ] `config-render.ts` renders `AGRO_EGRESS` from `access.egress`, as `DOCKER_SOCKET` renders from `access.dockerSocket`.
- [ ] `docs/configuration.md` lists both fields.
- [ ] `pnpm exec vitest run .agro/cli/src/lib/__tests__/agro-config.test.ts` exits 0, and `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Add the egress overlay

**Description:** As an operator, I want an overlay that removes the direct route out and adds a proxy. Root in the sandbox then has no path past the allowlist.

**Acceptance Criteria:**

- [ ] `.devcontainer/docker-compose.egress.yml` defines a `proxy` service from `ubuntu/squid@sha256:6a097f68bae708cedbabd6188d68c7e2e7a38cedd05a176e1cc0ba29e3bbe029`, an `internal: true` network for the sandbox, and an egress network for the proxy only.
- [ ] The overlay sets `HTTPS_PROXY`, `HTTP_PROXY`, `https_proxy`, `http_proxy`, `NO_PROXY`, `no_proxy`, and `NODE_USE_ENV_PROXY=1` on the sandbox service.
- [ ] If `AGRO_EGRESS` is `allowlist`, `.agro/scripts/docker-compose.sh` adds the overlay after `docker-compose.yml`. Otherwise the argv stays byte-identical to the current argv.
- [ ] `materialize()` writes the overlay into each Docker entry from an `agro-asset:` import, and the Dockerfile `/opt/agro-assets` COPY ships the overlay.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/compose-args.test.ts .agro/scripts/__tests__/sandbox-privilege-boundary.test.ts .agro/scripts/__tests__/docs-compose-overlays.test.ts` exits 0.

### US-003: Generate the allowlist from one source

**Description:** As a maintainer, I want the proxy allowlist built from the OpenShell policy hosts plus `access.egressAllow` so that the two runtimes share one host list.

**Acceptance Criteria:**

- [ ] On each lifecycle call, `materialize()` writes `<entry>/egress-allow.txt` for a Docker entry with `access.egress: "allowlist"`.
- [ ] The file holds the union of each `host` in the `network_policies` of `.devcontainer/openshell-policy.yaml` and each entry of `access.egressAllow`, sorted and without duplicates.
- [ ] The proxy reads `egress-allow.txt` and denies each other host.
- [ ] A test proves that the file equals the policy hosts plus the extra hosts for a fixture `agro.json`.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-004: Add the egress log and reload verbs

**Description:** As an operator, I want to see blocked hosts and apply a new allowlist without a restart. I can then fix a blocked host in one step.

**Acceptance Criteria:**

- [ ] `agro egress log [name]` prints the proxy access log lines of the sandbox, with the denied lines marked.
- [ ] `agro egress reload [name]` regenerates `egress-allow.txt` and sends the proxy its reconfigure signal. The sandbox container keeps running.
- [ ] For an entry with `access.egress: "open"` or an OpenShell entry, both verbs exit 1 with one line that names the setting.
- [ ] `pnpm exec vitest run` covers the argv of both verbs, and the run exits 0.

### US-005: Document the egress mode

**Description:** As an operator, I want a page that states what allowlist mode blocks and how to fix a blocked host.

**Acceptance Criteria:**

- [ ] `docs/security-considerations.md` and `docs/configuration.md` describe allowlist mode, the hosts in the default list, `access.egressAllow`, `agro egress log`, `agro egress reload`, and the limits in `## Out of Scope`.
- [ ] `CHANGELOG.md` has one bullet under `## [Unreleased]` that names ADR #1378.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` reports no new finding on each changed document.

### US-006: Prove the boundary on a new VM

**Description:** As the advisor, I want a remote-sandbox check for the shipped overlay. The check repeats the proof of concept, and the PR proves the boundary with the result. This story depends on US-001 through US-005.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/checks/docker-egress.sh` installs AGRO, sets `access.egress` to `allowlist`, and runs `agro sandbox install docker --yes`.
- [ ] The check fails if `agro-bootstrap` is not `active`. Development retired `agro-cron.service` in #1392, so the check has no cron row.
- [ ] The check passes an allowed GitHub request, a denied request with a `TCP_DENIED` line in `agro egress log`, a Claude Code install through the proxy, and an `agro egress reload` that allows a new host.
- [ ] The check fails if a request without the proxy, a request to a direct IP, or a request after a root route change reaches the internet.
- [ ] With operator approval, the advisor runs the check on exe.dev and writes the transcript to `.agro/tasks/docker-egress-allowlist/evidence/manual-review.md`. The log ends with `remaining agro-matrix resources on exedev: 0`.

## Summary

### Verified current state

- ADR #1378 selects option 3: an opt-in proxy sidecar outside the container, with the sandbox on an `internal: true` network.
- The proof of concept on exe.dev (ADR #1378, comment 6105755760) passed the allowed request, the denied request, the audit log, git, npm, the Claude Code install, the Anthropic API, three bypass attempts as root, and a live reload.
- The bootstrap failed in the proof of concept. The diagnostic run (comment 6105841237) found the cause: corepack uses the Node.js `fetch`, which ignores `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1` is set. A local Docker run confirmed the fix.
- `.agro/scripts/docker-compose.sh` adds overlays from truthy values: `DOCKER_SOCKET` adds `docker-compose.docker-sock.yml`, and `SANDBOX_SSH` adds `docker-compose.ssh.yml`.
- `config-render.ts` renders `DOCKER_SOCKET` from `access.dockerSocket` and `SANDBOX_SSH` from `access.ssh`.
- `.devcontainer/openshell-policy.yaml` holds the network hosts of the OpenShell runtime: GitHub, npm, Anthropic, and `platform.claude.com`.

### Selected approach

Follow the existing overlay pattern. One setting selects the overlay. The CLI generates the allowlist from the OpenShell policy hosts plus extra hosts, and two verbs expose the log and the reload.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/agro-config.ts` | `AgroConfig`, `AGRO_CONFIG_FIELDS` | `access.egress`, `access.egressAllow` |
| `.agro/cli/src/lib/config-render.ts` | `put` calls | Renders `AGRO_EGRESS` |
| `.agro/scripts/docker-compose.sh` | overlay selection | Adds `docker-compose.egress.yml` |
| `.devcontainer/docker-compose.egress.yml` | new overlay | Proxy, networks, proxy variables |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Writes the overlay and `egress-allow.txt` |
| `.devcontainer/Dockerfile` | `/opt/agro-assets` COPY | Ships the overlay |
| `.agro/cli/src/cli.ts` and a new `commands/egress.ts` | `egress log`, `egress reload` | Operator verbs |
| `.agro/skills/remote-sandbox/checks/docker-egress.sh` | new check | Live proof |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro.json` `access.egress`, `access.egressAllow` | New fields | Select the mode and add hosts |
| `agro egress log [name]` | New verb | Shows allowed and denied hosts |
| `agro egress reload [name]` | New verb | Applies a new allowlist without a restart |
| Docker sandbox network | Behaviour in allowlist mode | No direct route out; traffic through the proxy |

## Storage

The entry holds `egress-allow.txt` next to `agro.json`. `materialize()` rewrites the file on each lifecycle call. The proxy log stays in the proxy container.

## Architectural Decisions

- **Source of truth.** The network hosts of `.devcontainer/openshell-policy.yaml` plus `access.egressAllow`. No other host list exists.
- **Boundary.** The network topology enforces the allowlist. The proxy variables only route cooperative clients.
- **Default.** `access.egress` defaults to `"open"`. The open mode keeps the current argv byte-identical.
- **Node.js.** The overlay sets `NODE_USE_ENV_PROXY=1`, because Node.js `fetch` ignores the proxy variables without the setting.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/agro-config.test.ts` | enum values, default, array field | US-001 |
| `.agro/scripts/__tests__/compose-args.test.ts` | overlay added only for `allowlist`; open argv unchanged | US-002 |
| `.agro/scripts/__tests__/sandbox-privilege-boundary.test.ts` | the overlay adds no capability | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `egress-allow.txt` equals policy hosts plus extras | US-003 |
| `.agro/cli/src/__tests__/egress.test.ts` | verb argv; refusal for open and OpenShell entries | US-004 |
| `.agro/skills/remote-sandbox/checks/docker-egress.sh` | live rows on exe.dev | US-006 |

## Design Principles

- Enforce outside the container. A rule inside the container is not a boundary.
- Keep one host list for both runtimes.
- Keep the default mode unchanged.
- Show each denial, and make the fix one config line plus a reload.

## Out of Scope

- Rules for each binary in Docker.
- Credential injection and TLS interception (ADR #1378, option 4).
- Egress other than HTTP(S): git over SSH and UDP other than DNS fail in allowlist mode.
- `host.docker.internal`, `cloudflared`, and `tailscale` in allowlist mode.
- The OpenShell runtime, which has its own policy enforcement.

## Open Questions

None. The operator decided both questions on 2026-10-10:

1. The proxy image is `ubuntu/squid@sha256:6a097f68bae708cedbabd6188d68c7e2e7a38cedd05a176e1cc0ba29e3bbe029`. A maintainer changes the digest in a deliberate commit.
2. The verbs are `agro egress log` and `agro egress reload`. `agro logs` stays the Compose passthrough for the sandbox, and `agro config set` never changes a running container.

## Acceptance Criteria

- [ ] With `access.egress` unset, `agro sandbox install docker` produces the same Compose argv as before this task.
- [ ] With `access.egress: "allowlist"`, the US-006 check passes on exe.dev, including the bootstrap and the three bypass rows.
- [ ] `pnpm test` exits 0, and `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `.agro/tasks/docker-egress-allowlist/evidence/manual-review.md` holds the US-006 transcript.

## Lessons

1. **Claim:** Node.js `fetch` ignores `HTTPS_PROXY`, so corepack failed behind the proxy in the proof of concept. **Evidence:** ADR #1378, comment 6105841237. **Outcome:** fixed in this PR; the overlay sets `NODE_USE_ENV_PROXY=1`.
2. **Claim:** Development retired `agro-cron.service` and the boot-time `pnpm install` in #1392 while this task ran. **Evidence:** development commit `e284433d`. **Outcome:** fixed in this PR; the plan and the check dropped the cron criterion.
3. **Claim:** `egress.ts` repeats the few lines of the unexported `sandboxRoot()` from `lifecycle.ts`. **Evidence:** the US-004 notes in `prd.json`. **Outcome:** dropped, because an export would change `lifecycle.ts`, which this PR does not otherwise touch, for four lines.
4. **Claim:** The CLI reads the policy hosts with a line-based extraction instead of a YAML parser. **Evidence:** `policyHosts()` in `.agro/cli/src/lib/registry.ts`. **Outcome:** dropped, because a test compares the extraction with a full YAML parse and fails on drift.
