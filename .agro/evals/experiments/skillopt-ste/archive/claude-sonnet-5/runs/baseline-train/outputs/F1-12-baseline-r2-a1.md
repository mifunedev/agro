# RFC: Runtime support — axes taxonomy & the "supported runtime" contract

Status: Draft for [#592](https://github.com/mifunedev/agro/issues/592). Implementation epic: [#591](https://github.com/mifunedev/agro/issues/591).

This document defines *how AGRO treats runtimes*. The build-validate-support program in #591
needs a shared contract instead of ad-hoc per-runtime decisions. This document is a
definition/decision artifact. This document implements no runtime. #591's child issues decide
which runtimes land, and in what order.

## Purpose

Today the harness has exactly one substrate — a single privileged `debian:trixie-slim`
container per repo (`.devcontainer/docker-compose.yml`). The host Docker socket is **opt-in and
off by default**: the socket is a separate overlay (`.devcontainer/docker-compose.docker-sock.yml`).
`.agro/scripts/docker-compose.sh:136` applies the overlay only when `sandbox.docker_socket` /
`DOCKER_SOCKET` is truthy. The image ships the **docker CLI but no `dockerd`**
(`docker-ce-cli` + `docker-compose-plugin`, `.devcontainer/Dockerfile:37`), so in-sandbox Docker
work depends on that opt-in socket. Enabling the socket creates a root-on-host boundary. That
boundary is fine for a trusted single operator. That boundary becomes the weakest link the moment
untrusted, agent-generated code runs unattended on a shared VM ("remote-first, lights-out software
factory", `README.md`). No isolation tier exists above the privileged container. No per-task
blast-radius containment exists. No first-class "ship the app" runtime exists beyond a localhost
`cloudflared` tunnel. Before AGRO adds any of those tiers, this RFC ratifies the vocabulary and
the bar.

## 1. The three-axis taxonomy

The term "runtime" conflates three layers. A candidate that fits one axis can be nonsensical for
another axis. This RFC tags every candidate to the axis it serves.

| Axis | Question | Today | The gap |
|---|---|---|---|
| **A1 — Substrate** | Where does the *sandbox itself* run, and how isolated is it? | 1 privileged container; docker CLI but no `dockerd`, and the host Docker socket is an **opt-in overlay, off by default** | No stronger isolation tier for untrusted / lights-out / multi-tenant runs |
| **A2 — Deploy target** | Where do the *apps agents build* get shipped? | BYO tunnel (`cloudflared`), Railway *smoke-test only*, GHCR publish | No "ship it" runtime — only "expose localhost" |
| **A3 — Scale / fan-out** | How do we run *N tasks in parallel*? | git worktrees in the *one* container + tmux ralph loops | No per-task isolated sandbox; all tasks share one kernel. The image has no `dockerd`, so all tasks share the same opt-in host socket whenever an operator enables it. |

## 2. The "supported runtime" contract (ratifiable)

A runtime qualifies as **supported** only when it meets *all* of the following. This mirrors how
AGRO supports agent CLIs today (`docs/harnesses/overview.md`):

1. **Documented** — a per-runtime doc at `docs/runtimes/<name>.md` + a runtimes overview, and a
   row in the install matrix.
2. **One-toggle** — opt-in via a *single* surface: a `harness.yaml` toggle, a compose overlay, or a
   `RUNTIME=` selector. Never a manual multi-step setup.
3. **Validated** — boots the sandbox (or performs its axis's job) and clears the boot-lint +
   `.agro/evals/probes/*` floor.
4. **Guarded** — a dedicated eval/drift probe (exemplar: `.agro/evals/probes/railway-one-click-deploy.sh`)
   so support can't silently rot.

**Per-runtime definition of done:** `implement → validate (probe-green) → document as supported →
friction removed (a one-command path exists)`.

## 3. Guiding principle — actively reduce end-user friction

Every supported runtime must make the operator's life *simpler*, not add a knob to babysit. The
trusted single-operator container stays the **zero-config default**. Every new tier is opt-in and
one-toggle. AGRO updates onboarding docs in lockstep with every new tier (this ties directly into
the in-flight `feat/install-quickstart-reconcile` work). A runtime that adds operational burden
without a net friction reduction does not qualify as "supported" under this contract.

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

Cloudflare ships a two-tier offering; only one tier fits the substrate:

- **Dynamic Workers** (V8 isolates) run about 100× faster and cheaper than containers, but
  **cannot serve as an A1 substrate**: they provide no full OS (no git, bash, tmux, dev servers,
  Docker socket, or multi-language builds). Dynamic Workers fit only as an **A2** target.
- **Cloudflare Sandboxes / Containers** (GA 2026) provide persistent isolated Linux with PTY,
  snapshots, filesystem watch, code interpreter, and egress-proxy credential injection. This tier
  is the real Cloudflare fit for **A1/A3**.
- **Workers/Pages via Wrangler** serve as the **A2** target proper.

`oh.mifune.dev/install.sh` already runs as a Cloudflare Worker (302 redirect). This existing
foothold means the CF edge relationship already exists. An A2 deploy skill would extend
infrastructure AGRO already operates.

## 6. Adjacent architecture — Crabbox (awareness, not yet a committed direction)

**Crabbox** (`crabbox.sh`, `openclaw/crabbox`) is a *remote-execution control plane* — a different
decomposition of A3 than "swap the substrate." The model keeps the local edit-save-run loop and
offloads the expensive, evidence-producing command to a short-lived remote box via **plan → lease
→ sync → run → release** (sync seeds remote git from origin plus base ref, then rsyncs the *dirty*
tree — the same "it's just a git repo" grain the harness already relies on). Crabbox has three
layers: a local **CLI** (per-lease SSH key), a **coordinator** (provider creds, lease state, cost
caps), and a **runner** (a vanilla ephemeral machine with no secrets). Crabbox ships **cost caps,
guaranteed cleanup, and credential isolation** that the worktrees-in-one-container model lacks. Its
coordinator *runs on Cloudflare Workers plus a Durable Object* — Workers used correctly as a
control plane, never as the code-execution runner, which reinforces §5. Crabbox is adjacent to the
org's `mifunedev/sandboxes` ("Collection of Agent Execution Environments").

Crabbox raises one deferred decision: for A3, should AGRO prefer a Crabbox-style **offload** over a
per-task substrate? If so, would the harness **become** a runner target (`provider: ssh`),
**embed** the lease/sync/run pattern, or **integrate** Crabbox directly? The reference wiki entries
`crabbox-remote-exec-control-plane` and `runtime-isolation-landscape` hold the mechanics.

## 7. What this RFC decides vs. defers

- **Decides:** the axis vocabulary (§1), the "supported" contract (§2), and preservation of the
  zero-config default substrate (§3). On acceptance, `README.md` records this decision as an ADR
  row.
- **Defers to #591's children:** *which* runtimes land and in what *order*. That ordering turns on
  the primary-driver question (isolation-security vs. fan-out vs. deploy-convenience).

## 8. Proposed child-issue ordering (implements this contract; filed under #591)

1. **A1 · Sysbox execution target** — the scheduled next slice of [#731](https://github.com/mifunedev/agro/issues/731), landing behind the `ExecutionTarget` contract from [#733](https://github.com/mifunedev/agro/issues/733). Sysbox runs unprivileged containers with their *own* `dockerd`, so the tier gains stronger isolation **without** trading away sibling-container capability (see §9).
2. **A1 · gVisor overlay** — cheapest, most reversible; sets the "one-toggle, probe-guarded, documented" support template the others reuse.
3. **A1 · Firecracker microVM** — land #384.
4. **A1 · Kata Containers**.
5. **A1/A3 · Managed sandbox integrations** (E2B / Daytona / Fly / CF Sandboxes / Modal) — BYO-account.
6. **A3 · CI-as-runtime** (`CI_RUNNER` dind).
7. **A2 · Deploy-skill family** (Wrangler / flyctl / Railway-full).
8. **Landscape memo** — `blog/` companion to `2026-06-07-containers-microvms-vms.md`.

## 9. Open decisions

- **Primary driver** — isolation-security vs. fan-out vs. deploy-convenience (reorders §8).
- **Self-hosted vs managed** — own the isolation fleet (gVisor/Firecracker/Kata) or rent it; for
  managed, does "supported" = a documented BYO-account integration?
- ~~**DinD trade-off**~~ — **ANSWERED**: the trade is not forced. Sysbox gives the tier its **own
  `dockerd`** inside an unprivileged container, so a stronger-isolation tier keeps
  sibling-container capability instead of losing it. Sysbox therefore leads §8 as item 1. The host
  socket stays what it already is: opt-in and off by default (§Purpose).
  [#731](https://github.com/mifunedev/agro/issues/731) and
  [#733](https://github.com/mifunedev/agro/issues/733) decided this.
  [`rfc-brain-hands-boundary.md`](rfc-brain-hands-boundary.md) records the boundary that makes a
  second execution target an implementation detail. Still open *per candidate*: what gVisor and
  Firecracker tiers do, since neither ships a nested daemon for free.
- **Control-plane vs substrate-swap (Crabbox)** — offload model vs. per-task substrate for A3.
- **Install-matrix constraint** — must every supported tier work across all install paths, or may
  advanced substrates be VM-only (documented as such)?

## Non-goals

- No runtime is implemented here.
- V8-isolate / WASM runtimes *as a substrate* (cannot host a full-OS sandbox) and Kubernetes/Nomad
  orchestration (over-heavy for "one repo, one sandbox") remain out of scope.
