# RFC: Runtime support — axes taxonomy & the "supported runtime" contract

Status: Draft for [#592](https://github.com/mifunedev/agro/issues/592). Implementation epic: [#591](https://github.com/mifunedev/agro/issues/591).

This document defines *how AGRO treats runtimes*. The build-validate-support
program in #591 builds against this shared contract. The program does not make
ad-hoc decisions per runtime. This document is a definition and decision
artifact. This document implements no runtime. The child issues of #591 decide
which runtimes land and the order in which the runtimes land.

## Purpose

The current harness has exactly one substrate. That substrate is a single privileged
`debian:trixie-slim` container per repository (`.devcontainer/docker-compose.yml`).

The host Docker socket is **opt-in and off by default**. The socket comes from a separate
overlay, `.devcontainer/docker-compose.docker-sock.yml`. `.agro/scripts/docker-compose.sh:136`
applies that overlay only when `sandbox.docker_socket` or `DOCKER_SOCKET` is truthy.

The image contains the **docker CLI but no `dockerd`** (`docker-ce-cli` +
`docker-compose-plugin`, `.devcontainer/Dockerfile:37`). Docker work inside the sandbox
therefore depends on the opt-in socket. The socket gives root access on the host. That
boundary is acceptable for a trusted single operator. The boundary becomes the weakest link
when untrusted, agent-generated code runs unattended on a shared VM. `README.md` describes
that mode as a "remote-first, lights-out software factory".

The harness lacks four capabilities:

- an isolation tier above the privileged container;
- containment of the blast radius per task;
- a first-class "ship the app" runtime;
- any deploy path beyond a localhost `cloudflared` tunnel.

Before the project adds any of these capabilities, this RFC fixes the vocabulary and the
support bar.

## 1. The three-axis taxonomy

The word "runtime" covers three different layers. A candidate that fits one axis can make no
sense on another axis. This RFC therefore tags each candidate with the axis that the candidate
serves.

| Axis | Question | Current state | The gap |
|---|---|---|---|
| **A1 — Substrate** | Where does the *sandbox itself* run, and how strong is the isolation? | One privileged container. The container has the docker CLI but no `dockerd`. The host Docker socket is an **opt-in overlay, off by default**. | The harness has no stronger isolation tier for untrusted, lights-out, or multi-tenant runs. |
| **A2 — Deploy target** | Where do the *apps that agents build* ship to? | BYO tunnel (`cloudflared`), Railway *smoke-test only*, GHCR publish. | The harness has no "ship it" runtime. The harness can only expose localhost. |
| **A3 — Scale / fan-out** | How does the harness run *N tasks in parallel*? | Git worktrees in the *one* container, plus tmux ralph loops. | The harness has no isolated sandbox per task. All tasks share one kernel. The image has no `dockerd`, so all tasks also share the *same* opt-in host socket when the operator enables the socket. |

## 2. The "supported runtime" contract (ratifiable)

A runtime earns **supported** status only when the runtime meets *all* of the conditions below. The
conditions follow the support model for agent CLIs in `docs/harnesses/overview.md`.

1. **Documented** — The runtime has a doc at `docs/runtimes/<name>.md`. A runtimes overview
   lists the runtime. The install matrix has a row for the runtime.
2. **One-toggle** — The operator enables the runtime through a *single* surface. That surface
   is a `harness.yaml` toggle, a compose overlay, or a `RUNTIME=` selector. A manual setup with
   more than one step does not qualify.
3. **Validated** — The runtime boots the sandbox, or the runtime performs the job of its axis.
   The runtime also passes the boot-lint check and the `.agro/evals/probes/*` floor.
4. **Guarded** — A dedicated eval or drift probe checks the runtime. The exemplar is
   `.agro/evals/probes/railway-one-click-deploy.sh`. The probe stops support from failing
   without notice.

**Definition of done per runtime:** `implement → validate (probe-green) → document as supported →
friction removed (a one-command path exists)`.

## 3. Guiding principle — actively reduce end-user friction

Each supported runtime must make the work of the operator *simpler*. A supported runtime must
not add a setting that the operator must watch. The trusted single-operator container stays the
**zero-config default**. Each new tier is opt-in and one-toggle. Each new tier updates the
onboarding docs in the same change. This rule connects directly to the in-progress
`feat/install-quickstart-reconcile` work. A runtime that adds operational burden and gives no
net friction reduction does not qualify as "supported" under this contract.

## 4. Fit matrix — candidates × axis

| Candidate | Axis | Isolation / shape | Notes |
|---|---|---|---|
| **gVisor (`runsc`)** | A1 | Syscall interposition, shared kernel | Lowest-cost first candidate. Drop-in OCI runtime. A large step up from `--privileged` + host socket. |
| **Firecracker microVM** | A1 | One kernel per sandbox (deepest isolation) | Continues research spike #384. Fits untrusted and multi-tenant runs. |
| **Kata Containers** | A1 | MicroVM depth + OCI/compose compatibility | Lowest-friction path to microVM-grade isolation that *keeps `docker compose`*. |
| **E2B / Daytona / Fly Machines / Cloudflare Sandboxes / Modal** | A1/A3 | Managed sandbox-as-a-service | Supported means a one-toggle **BYO-account** integration. These services also answer the fan-out question. |
| **Cloudflare Workers/Pages (Wrangler)** | A2 | V8 isolate / edge | Deploy target for apps that agents build. |
| **Fly.io / Railway-full / Vercel** | A2 | Managed PaaS | Deploy targets. Railway moves up from the current smoke test. |
| **CI-as-runtime (self-hosted GH Actions dind)** | A3 | Container on runner | `CI_RUNNER` already covers half of this candidate (`.github/workflows/sandbox-boot-guard.yml`). |
| **Crabbox** | A3 | Remote-execution control plane | See §6. Crabbox offloads work through lease→sync→run→release. Crabbox does not replace the substrate. |

## 5. Cloudflare, specifically (myth-bust)

Cloudflare offers two tiers. Only one tier fits the substrate axis.

- **Dynamic Workers** (V8 isolates): ~100× faster/cheaper than containers. Dynamic Workers
  **cannot be an A1 substrate**, because Dynamic Workers have no full OS. The missing OS
  features are git, bash, tmux, dev servers, the Docker socket, and multi-language builds.
  Dynamic Workers fit the **A2** axis only.
- **Cloudflare Sandboxes / Containers** (GA 2026): persistent isolated Linux with PTY,
  snapshots, filesystem watch, a code interpreter, and credential injection through an egress
  proxy. This tier is the real Cloudflare fit for **A1/A3**.
- **Workers/Pages via Wrangler**: the actual **A2** target.

Existing foothold: `oh.mifune.dev/install.sh` is already a Cloudflare Worker that returns a 302
redirect. The project therefore already operates on the Cloudflare edge. An A2 deploy skill
extends infrastructure that the project already operates.

## 6. Adjacent architecture — Crabbox (awareness, not yet a committed direction)

**Crabbox** (`crabbox.sh`, `openclaw/crabbox`) is a *remote-execution control plane*. Crabbox
splits A3 differently from "swap the substrate".

Model: the developer keeps the local edit-save-run loop. Crabbox offloads the expensive command
that produces evidence to a short-lived remote box. The sequence is
**plan → lease → sync → run → release**. The sync step has two parts, in this order:

1. Crabbox seeds the remote git checkout from origin and the base ref.
2. Crabbox runs rsync to copy the *dirty* tree.

This sync model matches the "it's just a git repo" assumption that the harness already uses.

Crabbox has three layers:

- the local **CLI**, with one SSH key per lease;
- the **coordinator**, which holds provider credentials, lease state, and cost caps;
- the **runner**, a vanilla ephemeral machine that holds no secrets.

Crabbox provides **cost caps, guaranteed cleanup, and credential isolation**. The model of
worktrees in one container lacks these three properties. The Crabbox coordinator *runs on
Cloudflare Workers + a Durable Object*. Crabbox uses Workers correctly: as a control plane and
never as the runner that executes code. This use confirms §5. Crabbox is adjacent to the
`mifunedev/sandboxes` repository of the organization ("Collection of Agent Execution
Environments").

Deferred decision: for A3, should the project prefer a Crabbox-style **offload** over a
substrate per task? If yes, the project must choose one of three options:

- the harness **is** a runner target (`provider: ssh`);
- the harness **embeds** the lease/sync/run pattern;
- the harness **integrates** Crabbox directly.

Two reference wiki entries hold the mechanics: `crabbox-remote-exec-control-plane` and
`runtime-isolation-landscape`.

## 7. What this RFC decides vs. defers

- **Decides:** the axis vocabulary (§1), the "supported" contract (§2), and the preservation of
  the zero-config default substrate (§3). After <approver> accepts this RFC, <actor> records the
  decision as an ADR row in `README.md`.
- **Defers to the child issues of #591:** *which* runtimes land and the *order* in which the
  runtimes land. The order depends on the primary-driver question: isolation-security, fan-out,
  or deploy-convenience.

## 8. Proposed child-issue ordering (implements this contract; filed under #591)

1. **A1 · Sysbox execution target** — the next scheduled slice of [#731](https://github.com/mifunedev/agro/issues/731). This slice lands behind the `ExecutionTarget` contract from [#733](https://github.com/mifunedev/agro/issues/733). Sysbox gives unprivileged containers that run their *own* `dockerd`. The tier gains stronger isolation and **keeps** sibling-container capability (see §9).
2. **A1 · gVisor overlay** — the lowest-cost and most reversible candidate. This item sets the "one-toggle, probe-guarded, documented" support template. The other items reuse that template.
3. **A1 · Firecracker microVM** — land #384.
4. **A1 · Kata Containers**.
5. **A1/A3 · Managed sandbox integrations** (E2B / Daytona / Fly / CF Sandboxes / Modal) — BYO-account.
6. **A3 · CI-as-runtime** (`CI_RUNNER` dind).
7. **A2 · Deploy-skill family** (Wrangler / flyctl / Railway-full).
8. **Landscape memo** — a `blog/` companion to `2026-06-07-containers-microvms-vms.md`.

## 9. Open decisions

- **Primary driver** — isolation-security, fan-out, or deploy-convenience. The answer changes the
  order in §8.
- **Self-hosted vs managed** — should the project own the isolation fleet
  (gVisor/Firecracker/Kata) or rent the fleet? For managed services, does "supported" mean a
  documented BYO-account integration?
- ~~**DinD trade-off**~~ — **ANSWERED**: the project does not have to make this trade. Sysbox
  gives the tier its **own `dockerd`** inside an unprivileged container. A tier with stronger
  isolation therefore keeps sibling-container capability. For this reason, Sysbox is now item 1
  in §8. The host socket does not change: the socket stays opt-in and off by default (§Purpose).
  Issues [#731](https://github.com/mifunedev/agro/issues/731) and
  [#733](https://github.com/mifunedev/agro/issues/733) hold this decision.
  [`rfc-brain-hands-boundary.md`](rfc-brain-hands-boundary.md) records the boundary that makes a
  second execution target an implementation detail. One question stays open *per candidate*:
  how gVisor and Firecracker tiers provide sibling-container capability. Neither tier includes a
  nested daemon by default.
- **Control-plane vs substrate-swap (Crabbox)** — for A3, should the project use the offload
  model or a substrate per task?
- **Install-matrix constraint** — must each supported tier work across all install paths? Or can
  advanced substrates support only VM installs, with documentation that states this limit?

## Non-goals

- This RFC implements no runtime.
- Two areas stay out of scope:
  - V8-isolate and WASM runtimes *as a substrate*, because these runtimes cannot host a full-OS
    sandbox;
  - Kubernetes and Nomad orchestration, because these tools are too heavy for "one repo, one
    sandbox".
