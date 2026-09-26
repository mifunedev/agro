# RFC: Runtime support — axes taxonomy & the "supported runtime" contract

Status: Draft for [#592](https://github.com/mifunedev/agro/issues/592). Implementation epic: [#591](https://github.com/mifunedev/agro/issues/591).

This document defines *how AGRO treats runtimes*. The build-validate-support
program in #591 builds against this shared contract, not against separate
per-runtime decisions. This document is a definition and decision artifact.
This document implements no runtime. The child issues of #591 decide which
runtimes land and in what order.

## Purpose

The harness has exactly one substrate today. That substrate is a single
privileged `debian:trixie-slim` container per repo
(`.devcontainer/docker-compose.yml`).

The host Docker socket is **opt-in and off by default**. The socket comes from a
separate overlay (`.devcontainer/docker-compose.docker-sock.yml`). The lifecycle
script applies that overlay only when `sandbox.docker_socket` / `DOCKER_SOCKET`
is truthy (`.agro/scripts/docker-compose.sh:136`).

The image ships the **docker CLI but no `dockerd`** (`docker-ce-cli` +
`docker-compose-plugin`, `.devcontainer/Dockerfile:37`). Thus, Docker work
inside the sandbox depends on the opt-in socket. An enabled socket gives root
access on the host. That boundary is acceptable for a trusted single operator.
That boundary becomes the weakest link when untrusted, agent-generated code runs
unattended on a shared VM ("remote-first, lights-out software factory",
`README.md`).

The harness has three gaps today:

- No isolation tier exists above the privileged container.
- No containment limits the blast radius of a single task.
- No first-class "ship the app" runtime exists beyond a localhost `cloudflared`
  tunnel.

Before AGRO adds any of these, this RFC ratifies the vocabulary and the bar.

## 1. The three-axis taxonomy

The word "runtime" mixes three layers. A candidate that fits one axis can make
no sense on another axis. Thus, this RFC tags each candidate with the axis that
the candidate serves.

| Axis | Question | Today | The gap |
|---|---|---|---|
| **A1 — Substrate** | Where does the *sandbox itself* run, and how isolated is it? | 1 privileged container; docker CLI but no `dockerd`, and the host Docker socket is an **opt-in overlay, off by default** | No stronger isolation tier for untrusted / lights-out / multi-tenant runs |
| **A2 — Deploy target** | Where do the *apps agents build* get shipped? | BYO tunnel (`cloudflared`), Railway *smoke-test only*, GHCR publish | No "ship it" runtime — only "expose localhost" |
| **A3 — Scale / fan-out** | How do we run *N tasks in parallel*? | git worktrees in the *one* container + tmux ralph loops | No per-task isolated sandbox. All tasks share one kernel. The image has no `dockerd`, so all tasks also share the *same* opt-in host socket whenever the operator enables that socket |

## 2. The "supported runtime" contract (ratifiable)

A runtime earns **supported** status only when the runtime meets *all* of the following
conditions. The conditions mirror the current support model for agent CLIs
(`docs/harnesses/overview.md`).

1. **Documented** — the runtime has a doc at `docs/runtimes/<name>.md`. A
   runtimes overview exists. The install matrix has a row for the runtime.
2. **One-toggle** — the operator opts in through a *single* surface: a
   `harness.yaml` toggle, a compose overlay, or a `RUNTIME=` selector. A
   manual multi-step setup never qualifies.
3. **Validated** — the runtime boots the sandbox, or the runtime performs the
   job of its axis. The runtime passes the boot-lint and the
   `.agro/evals/probes/*` floor.
4. **Guarded** — a dedicated eval or drift probe covers the runtime, so support
   cannot rot without a signal. Exemplar:
   `.agro/evals/probes/railway-one-click-deploy.sh`.

**Per-runtime definition of done:** `implement → validate (probe-green) → document as supported →
friction removed (a one-command path exists)`.

## 3. Guiding principle — actively reduce end-user friction

Each supported runtime must make the work of the operator *simpler*. A
supported runtime must not add a knob that the operator must watch.

The trusted single-operator container stays the **zero-config default**. Each
new tier is opt-in and one-toggle. Each new tier updates the onboarding docs in
the same change. This rule ties directly into the in-flight
`feat/install-quickstart-reconcile` work.

If a runtime adds operational burden without a net friction reduction, the
runtime does not qualify as "supported" under this contract.

## 4. Fit matrix — candidates × axis

| Candidate | Axis | Isolation / shape | Notes |
|---|---|---|---|
| **gVisor (`runsc`)** | A1 | syscall interposition, shared kernel | Cheapest first landing. Drop-in OCI runtime. Large step up from `--privileged` + host socket |
| **Firecracker microVM** | A1 | kernel-per-sandbox (deepest) | Continues research spike #384. Fits untrusted and multi-tenant runs |
| **Kata Containers** | A1 | microVM depth + OCI/compose compat | Lowest-friction path to microVM-grade isolation *that keeps `docker compose`* |
| **E2B / Daytona / Fly Machines / Cloudflare Sandboxes / Modal** | A1/A3 | managed sandbox-as-a-service | Supported = one-toggle **BYO-account** integration. These services also answer fan-out |
| **Cloudflare Workers/Pages (Wrangler)** | A2 | V8 isolate / edge | Deploy target for agent-built apps |
| **Fly.io / Railway-full / Vercel** | A2 | managed PaaS | Deploy targets. Railway upgrades from the current smoke-test |
| **CI-as-runtime (self-hosted GH Actions dind)** | A3 | container on runner | `CI_RUNNER` already covers half of this path (`.github/workflows/sandbox-boot-guard.yml`) |
| **Crabbox** | A3 | remote-exec control plane | See §6. A lease→sync→run→release offload, not a substrate swap |

## 5. Cloudflare, specifically (myth-bust)

Cloudflare ships a two-tier offering. Only one tier fits the substrate axis:

- **Dynamic Workers** (V8 isolates): ~100× faster/cheaper than containers. A
  Dynamic Worker **cannot be an A1 substrate**, because a Dynamic Worker has no
  full OS (git/bash/tmux/dev-servers/Docker-socket/multi-language builds).
  Dynamic Workers fit as an **A2** target only.
- **Cloudflare Sandboxes / Containers** (GA 2026): persistent isolated Linux
  with PTY, snapshots, filesystem watch, code interpreter, and egress-proxy
  credential injection. This tier is the real Cloudflare fit for **A1/A3**.
- **Workers/Pages via Wrangler**: the **A2** target proper.

Existing foothold: `oh.mifune.dev/install.sh` is already a Cloudflare Worker
(302 redirect). Thus, AGRO already has a relationship with the Cloudflare edge.
An A2 deploy skill extends infrastructure that AGRO already operates.

## 6. Adjacent architecture — Crabbox (awareness, not yet a committed direction)

**Crabbox** (`crabbox.sh`, `openclaw/crabbox`) is a *remote-execution control
plane*. Crabbox splits A3 differently from "swap the substrate."

The Crabbox model keeps the local edit-save-run loop. Crabbox sends the
expensive or evidence-producing command to a short-lived remote box. The
sequence is **plan → lease → sync → run → release**.

The sync step has two parts:

1. Crabbox seeds the remote git checkout from origin and the base ref.
2. Crabbox runs rsync to copy the *dirty* tree.

The harness already relies on the same "it's just a git repo" grain.

Crabbox has three layers:

- the local **CLI**, with an SSH key per lease;
- the **coordinator**, with provider credentials, lease state, and cost caps;
- the **runner**, a vanilla ephemeral machine with no secrets.

Crabbox ships **cost caps, guaranteed cleanup, and credential isolation**. The
worktrees-in-one-container model lacks all three. The Crabbox coordinator *runs
on Cloudflare Workers + a Durable Object*. That design uses Workers correctly as
a control plane and never as the code-execution runner. That design supports §5.
Crabbox is adjacent to the org repo `mifunedev/sandboxes` ("Collection of Agent
Execution Environments").

Decision that Crabbox raises (deferred): for A3, does AGRO prefer a
Crabbox-style **offload** over a per-task substrate? If yes, AGRO has three
options:

- the harness **is** a runner target (`provider: ssh`);
- the harness **embeds** the lease/sync/run pattern;
- the harness **integrates** Crabbox directly.

The reference wiki entries hold the mechanics:
`crabbox-remote-exec-control-plane`, `runtime-isolation-landscape`.

## 7. What this RFC decides vs. defers

- **Decides:** the axis vocabulary (§1), the "supported" contract (§2), and
  preservation of the zero-config default substrate (§3). When <approver>
  accepts this RFC, <owner> records the decision as an ADR row in `README.md`.
- **Defers to the child issues of #591:** *which* runtimes land and in what
  *order*. That order depends on the primary-driver question
  (isolation-security vs. fan-out vs. deploy-convenience).

## 8. Proposed child-issue ordering (implements this contract; filed under #591)

1. **A1 · Sysbox execution target** — the scheduled next slice of [#731](https://github.com/mifunedev/agro/issues/731). This target lands behind the `ExecutionTarget` contract from [#733](https://github.com/mifunedev/agro/issues/733). Sysbox runs unprivileged containers that run their *own* `dockerd`. Thus, the tier gains stronger isolation **without** a loss of sibling-container capability (see §9).
2. **A1 · gVisor overlay** — the cheapest and most reversible option. This item sets the "one-toggle, probe-guarded, documented" support template. The later items reuse that template.
3. **A1 · Firecracker microVM** — land #384.
4. **A1 · Kata Containers**.
5. **A1/A3 · Managed sandbox integrations** (E2B / Daytona / Fly / CF Sandboxes / Modal) — BYO-account.
6. **A3 · CI-as-runtime** (`CI_RUNNER` dind).
7. **A2 · Deploy-skill family** (Wrangler / flyctl / Railway-full).
8. **Landscape memo** — a `blog/` companion to `2026-06-07-containers-microvms-vms.md`.

## 9. Open decisions

- **Primary driver** — isolation-security vs. fan-out vs. deploy-convenience.
  The answer reorders §8.
- **Self-hosted vs managed** — does AGRO own the isolation fleet
  (gVisor/Firecracker/Kata) or rent the fleet? For managed services, does
  "supported" mean a documented BYO-account integration?
- ~~**DinD trade-off**~~ — **ANSWERED**: the trade is not forced. Sysbox gives
  the tier its **own `dockerd`** inside an unprivileged container. Thus, a
  stronger-isolation tier keeps sibling-container capability. For this reason,
  Sysbox is now §8 item 1. The host socket stays opt-in and off by default
  (§Purpose). Issues [#731](https://github.com/mifunedev/agro/issues/731) and
  [#733](https://github.com/mifunedev/agro/issues/733) hold this decision.
  [`rfc-brain-hands-boundary.md`](rfc-brain-hands-boundary.md) records the
  boundary that makes a second execution target an implementation detail. Still
  open *per candidate*: how gVisor and Firecracker tiers provide
  sibling-container capability, because neither tier ships a nested daemon for
  free.
- **Control-plane vs substrate-swap (Crabbox)** — offload model vs. per-task
  substrate for A3.
- **Install-matrix constraint** — must every supported tier work across all
  install paths? Or may advanced substrates be VM-only, with documentation that
  states the limit?

## Non-goals

- This RFC implements no runtime.
- V8-isolate and WASM runtimes *as a substrate* stay out of scope, because these
  runtimes cannot host a full-OS sandbox.
- Kubernetes and Nomad orchestration stay out of scope, because these tools are
  too heavy for "one repo, one sandbox."
