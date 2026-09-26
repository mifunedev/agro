# RFC: Runtime support — axes taxonomy & the "supported runtime" contract

Status: Draft for [#592](https://github.com/mifunedev/agro/issues/592). Implementation epic: [#591](https://github.com/mifunedev/agro/issues/591).

This document defines how AGRO treats runtimes. The build-validate-support
program in #591 builds against this shared contract, not against separate
per-runtime decisions. This document is a definition and decision artifact. This
document implements no runtime. The child issues of #591 decide which runtimes
land and in what order.

## Purpose

The harness has exactly one substrate today: a single privileged
`debian:trixie-slim` container per repository (`.devcontainer/docker-compose.yml`).

The host Docker socket is **opt-in and off by default**. The socket comes from a
separate overlay (`.devcontainer/docker-compose.docker-sock.yml`).
`.agro/scripts/docker-compose.sh:136` applies the overlay only when
`sandbox.docker_socket` or `DOCKER_SOCKET` is truthy.

The image ships the **docker CLI but no `dockerd`** (`docker-ce-cli` +
`docker-compose-plugin`, `.devcontainer/Dockerfile:37`). Docker work inside the
sandbox therefore depends on the opt-in socket.

The enabled socket gives the container root access on the host. That boundary
is acceptable for one trusted operator. The boundary becomes the weakest link
when untrusted, agent-generated code runs unattended on a shared VM. `README.md`
names that target as a "remote-first, lights-out software factory".

The harness lacks four capabilities today:

- an isolation tier above the privileged container;
- per-task containment of the blast radius;
- a first-class runtime to ship the app;
- any deploy path beyond a localhost `cloudflared` tunnel.

This RFC fixes the vocabulary and the support bar before any of those additions.

## 1. The three-axis taxonomy

The word "runtime" mixes three layers. A candidate can fit one axis and make no
sense on another axis. This RFC therefore tags every candidate with the axis
that the candidate serves.

| Axis | Question | Today | The gap |
|---|---|---|---|
| **A1 — Substrate** | Where does the *sandbox itself* run, and how isolated is it? | 1 privileged container; docker CLI but no `dockerd`, and the host Docker socket is an **opt-in overlay, off by default** | No stronger isolation tier for untrusted / lights-out / multi-tenant runs |
| **A2 — Deploy target** | Where do the *apps agents build* get shipped? | BYO tunnel (`cloudflared`), Railway *smoke-test only*, GHCR publish | No "ship it" runtime — only "expose localhost" |
| **A3 — Scale / fan-out** | How do we run *N tasks in parallel*? | git worktrees in the *one* container + tmux ralph loops | No per-task isolated sandbox; all tasks share one kernel. The image has no `dockerd`, so all tasks also share the *same* opt-in host socket when the operator enables the socket |

## 2. The "supported runtime" contract (ratifiable)

A runtime counts as **supported** only when the runtime meets *all* four
conditions below. The conditions mirror the current support bar for agent CLIs
(`docs/harnesses/overview.md`).

1. **Documented**: the runtime has a doc at `docs/runtimes/<name>.md`. A
   runtimes overview lists the runtime. The install matrix has a row for the
   runtime.
2. **One-toggle**: the operator turns the runtime on through *one* surface. That
   surface is a `harness.yaml` toggle, a compose overlay, or a `RUNTIME=`
   selector. The runtime never needs a manual multi-step setup.
3. **Validated**: the runtime boots the sandbox or performs the job of its axis.
   The runtime then passes the boot-lint and the `.agro/evals/probes/*` floor.
4. **Guarded**: a dedicated eval or drift probe checks the runtime, so support
   cannot decay without a signal. Exemplar:
   `.agro/evals/probes/railway-one-click-deploy.sh`.

**Per-runtime definition of done:** `implement → validate (probe-green) → document as supported →
friction removed (a one-command path exists)`.

## 3. Guiding principle: reduce end-user friction

Every supported runtime must make the work of the operator simpler. A supported
runtime must not add a setting that the operator has to watch.

- The trusted single-operator container stays the **zero-config default**.
- Every new tier is opt-in and one-toggle.
- The onboarding docs change in the same change set as the tier. This rule ties
  into the in-flight `feat/install-quickstart-reconcile` work.

If a runtime adds operational burden without a net reduction in friction, the
runtime does not qualify as "supported" under this contract.

## 4. Fit matrix — candidates × axis

| Candidate | Axis | Isolation / shape | Notes |
|---|---|---|---|
| **gVisor (`runsc`)** | A1 | syscall interposition, shared kernel | Cheapest first landing; drop-in OCI runtime; large step up from `--privileged` + host socket |
| **Firecracker microVM** | A1 | kernel-per-sandbox (deepest) | Continues research spike #384; suits untrusted/multi-tenant |
| **Kata Containers** | A1 | microVM depth + OCI/compose compat | Lowest-friction path to microVM-grade isolation *while keeping `docker compose`* |
| **E2B / Daytona / Fly Machines / Cloudflare Sandboxes / Modal** | A1/A3 | managed sandbox-as-a-service | Supported = one-toggle **BYO-account** integration; double as the fan-out answer |
| **Cloudflare Workers/Pages (Wrangler)** | A2 | V8 isolate / edge | Deploy target for agent-built apps |
| **Fly.io / Railway-full / Vercel** | A2 | managed PaaS | Deploy targets; Railway upgrades from today's smoke-test |
| **CI-as-runtime (self-hosted GH Actions dind)** | A3 | container on runner | Already half-owned via `CI_RUNNER` (`.github/workflows/sandbox-boot-guard.yml`) |
| **Crabbox** | A3 | remote-exec control plane | See §6 — lease→sync→run→release offload, not a substrate swap |

## 5. Cloudflare, specifically (myth-bust)

Cloudflare ships a two-tier offering. Only one tier fits the substrate axis.

- **Dynamic Workers** (V8 isolates): Dynamic Workers run about 100× faster and
  cheaper than containers. Dynamic Workers **cannot be an A1 substrate**, because
  a V8 isolate has no full OS. A full OS is necessary for git, bash, tmux, dev
  servers, the Docker socket, and multi-language builds. Dynamic Workers fit
  only as an **A2** target.
- **Cloudflare Sandboxes / Containers** (GA 2026): this tier gives persistent,
  isolated Linux. The tier includes a PTY, snapshots, filesystem watch, a code
  interpreter, and credential injection through an egress proxy. This tier is
  the real Cloudflare fit for **A1/A3**.
- **Workers/Pages via Wrangler**: this pair is the proper **A2** target.

Existing foothold: `oh.mifune.dev/install.sh` already runs as a Cloudflare
Worker that returns a 302 redirect. AGRO therefore already operates on the
Cloudflare edge. An A2 deploy skill extends that existing infrastructure.

## 6. Adjacent architecture — Crabbox (awareness, not yet a committed direction)

**Crabbox** (`crabbox.sh`, `openclaw/crabbox`) is a *remote-execution control
plane*. Crabbox splits A3 differently from a substrate swap.

The Crabbox model keeps the local edit-save-run loop. Crabbox sends each
expensive or evidence-producing command to a short-lived remote box. The
sequence is **plan → lease → sync → run → release**. The sync step has two
parts, in this order:

1. Crabbox seeds the remote git checkout from origin and the base ref.
2. Crabbox copies the *dirty* tree with rsync.

This sync step uses the same "it's just a git repo" grain that the harness
already relies on.

Crabbox has three layers:

- the local **CLI**, with one SSH key per lease;
- the **coordinator**, which holds provider credentials, lease state, and cost
  caps;
- the **runner**, a vanilla ephemeral machine that holds no secrets.

Crabbox ships **cost caps, guaranteed cleanup, and credential isolation**. The
current model of worktrees in one container lacks all three. The Crabbox
coordinator *runs on Cloudflare Workers plus a Durable Object*. That design uses
Workers correctly as a control plane and never as the code-execution runner.
This use supports the conclusion of §5. Crabbox sits next to the
`mifunedev/sandboxes` repository of the organization ("Collection of Agent
Execution Environments").

Deferred decision: for A3, does AGRO prefer a Crabbox-style **offload** over a
per-task substrate? If AGRO prefers the offload, the harness takes one of three
roles:

- **be** a runner target (`provider: ssh`);
- **embed** the lease/sync/run pattern;
- **integrate** Crabbox directly.

Two reference wiki entries hold the mechanics:
`crabbox-remote-exec-control-plane` and `runtime-isolation-landscape`.

## 7. What this RFC decides vs. defers

- **Decides:** this RFC decides three things. The first is the axis vocabulary
  (§1). The second is the "supported" contract (§2). The third is the
  preservation of the zero-config default substrate (§3). On acceptance,
  <owner> records the decision as an ADR row in `README.md`.
- **Defers to the children of #591:** *which* runtimes land, and in what
  *order*. The order depends on the primary-driver question: isolation-security,
  fan-out, or deploy-convenience.

## 8. Proposed child-issue ordering (implements this contract; filed under #591)

1. **A1 · Sysbox execution target**: the scheduled next slice of
   [#731](https://github.com/mifunedev/agro/issues/731). The target lands behind
   the `ExecutionTarget` contract from
   [#733](https://github.com/mifunedev/agro/issues/733). Sysbox runs
   unprivileged containers that each run their *own* `dockerd`. The tier
   therefore gains stronger isolation **without** a loss of sibling-container
   capability (see §9).
2. **A1 · gVisor overlay**: the cheapest and most reversible item. This item
   sets the "one-toggle, probe-guarded, documented" support template that the
   later items reuse.
3. **A1 · Firecracker microVM**: land #384.
4. **A1 · Kata Containers**.
5. **A1/A3 · Managed sandbox integrations** (E2B / Daytona / Fly / CF Sandboxes / Modal): BYO-account.
6. **A3 · CI-as-runtime** (`CI_RUNNER` dind).
7. **A2 · Deploy-skill family** (Wrangler / flyctl / Railway-full).
8. **Landscape memo**: a `blog/` companion to `2026-06-07-containers-microvms-vms.md`.

## 9. Open decisions

- **Primary driver**: isolation-security, fan-out, or deploy-convenience. The
  answer changes the order in §8.
- **Self-hosted vs managed**: does AGRO own the isolation fleet
  (gVisor/Firecracker/Kata) or rent the fleet? For a managed fleet, does
  "supported" mean a documented BYO-account integration?
- ~~**DinD trade-off**~~ — **ANSWERED**: the trade is not forced.
  - Sysbox gives the tier its **own `dockerd`** inside an unprivileged
    container. A stronger-isolation tier thus keeps sibling-container
    capability. For this reason, Sysbox is now item 1 in §8.
  - The host socket stays opt-in and off by default (§Purpose).
  - Issues [#731](https://github.com/mifunedev/agro/issues/731) and
    [#733](https://github.com/mifunedev/agro/issues/733) hold the decision.
  - [`rfc-brain-hands-boundary.md`](rfc-brain-hands-boundary.md) records the
    boundary that makes a second execution target an implementation detail.
  - Still open *per candidate*: how gVisor and Firecracker tiers give Docker
    capability to the sandbox. Neither tier ships a nested daemon for free.
- **Control-plane vs substrate-swap (Crabbox)**: for A3, the offload model or a
  per-task substrate.
- **Install-matrix constraint**: must every supported tier work across all
  install paths? Or may an advanced substrate support only a VM, with docs
  that state the limit?

## Non-goals

- This RFC implements no runtime.
- V8-isolate and WASM runtimes *as a substrate* stay out of scope. These
  runtimes cannot host a full-OS sandbox.
- Kubernetes and Nomad orchestration stay out of scope. These orchestrators are
  too heavy for the "one repo, one sandbox" model.
