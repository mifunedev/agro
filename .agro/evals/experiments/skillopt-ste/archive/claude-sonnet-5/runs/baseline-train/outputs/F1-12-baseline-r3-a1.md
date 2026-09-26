# RFC: Runtime support — axes taxonomy and the "supported runtime" contract

Status: Draft for [#592](https://github.com/mifunedev/agro/issues/592). Implementation epic: [#591](https://github.com/mifunedev/agro/issues/591).

This document defines how AGRO classifies runtimes. The build-validate-support
program in #591 builds against this shared contract instead of ad-hoc
per-runtime decisions. This document defines terms and records decisions. It
implements no runtime. #591's child issues decide which runtimes land, and in
what order.

## Purpose

Today the harness runs on exactly one substrate: one privileged
`debian:trixie-slim` container per repository
(`.devcontainer/docker-compose.yml`). The host Docker socket is opt-in and off
by default. The operator applies it as a separate overlay
(`.devcontainer/docker-compose.docker-sock.yml`) only when
`sandbox.docker_socket` or `DOCKER_SOCKET` is truthy
(`.agro/scripts/docker-compose.sh:136`). The image ships the docker CLI
(`docker-ce-cli` and `docker-compose-plugin`, `.devcontainer/Dockerfile:37`)
but no `dockerd`. So in-sandbox Docker work depends on that opt-in socket.
Enabling the socket grants root on the host. That boundary is acceptable for a
trusted single operator. The same boundary is the weakest link the moment
untrusted, agent-generated code runs unattended on a shared VM (the
"remote-first, lights-out software factory" goal, `README.md`).

Three gaps follow from this single-substrate design:

- No isolation tier exists above the privileged container.
- No mechanism limits the blast radius of one task.
- No first-class "ship the app" runtime exists beyond a localhost `cloudflared`
  tunnel.

Before the harness adds any of these, this RFC ratifies the vocabulary and the
bar a runtime must clear.

## 1. The three-axis taxonomy

The word "runtime" conflates three layers. A candidate that fits one axis can
be nonsensical for another axis. This RFC tags every candidate to the axis it
serves.

| Axis | Question | Today | The gap |
|---|---|---|---|
| **A1 — Substrate** | Where does the sandbox itself run, and how isolated is it? | One privileged container; the image ships the docker CLI but no `dockerd`; the host Docker socket is an opt-in overlay, off by default | No stronger isolation tier exists for untrusted, lights-out, or multi-tenant runs |
| **A2 — Deploy target** | Where do the apps agents build get shipped? | BYO tunnel (`cloudflared`), Railway smoke-test only, GHCR publish | No "ship it" runtime exists; only "expose localhost" exists |
| **A3 — Scale / fan-out** | How does the harness run N tasks in parallel? | Git worktrees inside the one container, plus tmux ralph loops | No per-task isolated sandbox exists. All tasks share one kernel. Since the image has no `dockerd`, every task shares the same opt-in host socket whenever an operator enables it |

## 2. The "supported runtime" contract (ratifiable)

The harness supports a runtime only when the runtime meets all four of the
following conditions. These conditions mirror how the harness supports agent
CLIs today (`docs/harnesses/overview.md`):

1. **Documented** — The runtime has a per-runtime doc at
   `docs/runtimes/<name>.md`, an entry in the runtimes overview, and a row in
   the install matrix.
2. **One-toggle** — The operator opts in through a single surface: a
   `harness.yaml` toggle, a compose overlay, or a `RUNTIME=` selector. The
   runtime never requires a manual multi-step setup.
3. **Validated** — The runtime boots the sandbox, or performs its axis's job,
   and clears the boot-lint floor and the `.agro/evals/probes/*` floor.
4. **Guarded** — The runtime has a dedicated eval or drift probe (example:
   `.agro/evals/probes/railway-one-click-deploy.sh`), so support cannot rot
   silently.

**Per-runtime definition of done:** implement, then validate until the probe
suite is green, then document the runtime as supported, then remove friction
until a one-command path exists.

## 3. Guiding principle — actively reduce end-user friction

Every supported runtime must make the operator's task simpler. A supported
runtime must not add a knob the operator has to babysit. The trusted
single-operator container stays the zero-config default. Every new tier is
opt-in and one-toggle. The onboarding docs update in lockstep with each new
tier; this ties directly to the in-flight `feat/install-quickstart-reconcile`
work. A runtime that adds operational burden without a net friction reduction
does not qualify as "supported" under this contract.

## 4. Fit matrix — candidates by axis

| Candidate | Axis | Isolation / shape | Notes |
|---|---|---|---|
| **gVisor (`runsc`)** | A1 | Syscall interposition, shared kernel | Cheapest first landing; drop-in OCI runtime; a large step up from `--privileged` plus a host socket |
| **Firecracker microVM** | A1 | Kernel-per-sandbox (deepest isolation) | Continues research spike #384; suits untrusted or multi-tenant runs |
| **Kata Containers** | A1 | MicroVM depth plus OCI/compose compatibility | Lowest-friction path to microVM-grade isolation while keeping `docker compose` |
| **E2B, Daytona, Fly Machines, Cloudflare Sandboxes, Modal** | A1/A3 | Managed sandbox-as-a-service | "Supported" means a one-toggle BYO-account integration; these candidates double as the fan-out answer |
| **Cloudflare Workers/Pages (Wrangler)** | A2 | V8 isolate / edge | Deploy target for agent-built apps |
| **Fly.io, Railway-full, Vercel** | A2 | Managed PaaS | Deploy targets; Railway upgrades from today's smoke-test |
| **CI-as-runtime (self-hosted GH Actions dind)** | A3 | Container on runner | Already half-owned through `CI_RUNNER` (`.github/workflows/sandbox-boot-guard.yml`) |
| **Crabbox** | A3 | Remote-exec control plane | See §6. Crabbox offloads work through lease, sync, run, and release; Crabbox does not swap the substrate |

## 5. Cloudflare, specifically (myth-bust)

Cloudflare ships a two-tier offering. Only one tier fits the substrate axis.

- **Dynamic Workers** (V8 isolates) run about 100 times faster and cheaper than
  containers, but cannot serve as an A1 substrate: a Worker has no full OS, so
  it cannot run git, bash, tmux, dev servers, a Docker socket, or
  multi-language builds. A Worker fits only as an A2 target.
- **Cloudflare Sandboxes / Containers** (general availability in 2026) provide
  persistent isolated Linux with a PTY, snapshots, filesystem watch, a code
  interpreter, and egress-proxy credential injection. This tier is the real
  Cloudflare fit for A1 and A3.
- **Workers/Pages through Wrangler** is the proper A2 target.

An existing foothold already exists: `oh.mifune.dev/install.sh` already runs
as a Cloudflare Worker that issues a 302 redirect. The harness already
operates on the Cloudflare edge. An A2 deploy skill extends infrastructure the
harness already runs.

## 6. Adjacent architecture — Crabbox (awareness, not yet a committed direction)

**Crabbox** (`crabbox.sh`, `openclaw/crabbox`) is a remote-execution control
plane. It decomposes A3 differently than a substrate swap does. In the Crabbox
model, the local edit-save-run loop stays in place. Crabbox offloads the
expensive, evidence-producing command to a short-lived remote box through five
steps: plan, lease, sync, run, release. The sync step seeds the remote git
repository from origin plus the base ref, then rsyncs the dirty tree — the
same "it's just a git repo" principle the harness already relies on. Crabbox
has three layers: a local CLI (with a per-lease SSH key), a coordinator (which
holds provider credentials, lease state, and cost caps), and a runner (a
vanilla ephemeral machine with no secrets).

Crabbox ships three properties the worktrees-in-one-container model lacks:
cost caps, guaranteed cleanup, and credential isolation. Its coordinator runs
on Cloudflare Workers plus a Durable Object. This use of Workers matches §5:
Workers serve as a control plane, never as the code-execution runner. Crabbox
is adjacent to the org's `mifunedev/sandboxes` project ("Collection of Agent
Execution Environments").

This RFC defers one decision: for A3, does the harness prefer a Crabbox-style
offload over a per-task substrate? If the harness prefers offload, should the
harness become a runner target (`provider: ssh`), embed the lease-sync-run
pattern, or integrate Crabbox directly? Two wiki entries hold the mechanics:
`crabbox-remote-exec-control-plane` and `runtime-isolation-landscape`.

## 7. What this RFC decides vs. defers

**Decides:**

- the axis vocabulary (§1),
- the "supported" contract (§2), and
- preservation of the zero-config default substrate (§3).

On acceptance, the harness records this decision as an ADR row in `README.md`.

**Defers to #591's children:** which runtimes land, and in what order. That
ordering turns on the primary-driver question: isolation-security vs.
fan-out vs. deploy-convenience.

## 8. Proposed child-issue ordering (implements this contract; filed under #591)

1. **A1 · Sysbox execution target** — the scheduled next slice of
   [#731](https://github.com/mifunedev/agro/issues/731), landing behind the
   `ExecutionTarget` contract from
   [#733](https://github.com/mifunedev/agro/issues/733). Sysbox runs
   unprivileged containers that run their own `dockerd`. This tier gains
   stronger isolation without losing sibling-container capability (see §9).
2. **A1 · gVisor overlay** — the cheapest and most reversible option; it sets
   the "one-toggle, probe-guarded, documented" support template the other
   candidates reuse.
3. **A1 · Firecracker microVM** — lands #384.
4. **A1 · Kata Containers**.
5. **A1/A3 · Managed sandbox integrations** (E2B, Daytona, Fly, Cloudflare
   Sandboxes, Modal) — BYO-account.
6. **A3 · CI-as-runtime** (`CI_RUNNER` dind).
7. **A2 · Deploy-skill family** (Wrangler, flyctl, Railway-full).
8. **Landscape memo** — a `blog/` companion to
   `2026-06-07-containers-microvms-vms.md`.

## 9. Open decisions

- **Primary driver** — isolation-security vs. fan-out vs. deploy-convenience.
  This choice reorders §8.
- **Self-hosted vs. managed** — Does the harness own the isolation fleet
  (gVisor, Firecracker, Kata), or rent it? For a managed fleet, does
  "supported" mean a documented BYO-account integration?
- ~~**DinD trade-off**~~ — **ANSWERED**: the trade is not forced. Sysbox gives
  the tier its own `dockerd` inside an unprivileged container. A
  stronger-isolation tier therefore keeps sibling-container capability instead
  of losing it. That gain is why Sysbox is now §8 item 1. The host socket
  stays opt-in and off by default (see Purpose). The harness decided this
  trade-off under [#731](https://github.com/mifunedev/agro/issues/731) and
  [#733](https://github.com/mifunedev/agro/issues/733).
  [`rfc-brain-hands-boundary.md`](rfc-brain-hands-boundary.md) records the
  boundary that makes a second execution target an implementation detail. One
  question stays open per candidate: what do the gVisor and Firecracker tiers
  do, since neither ships a nested daemon for free?
- **Control-plane vs. substrate-swap (Crabbox)** — offload model vs. per-task
  substrate for A3.
- **Install-matrix constraint** — Must every supported tier work across all
  install paths? Or may the harness restrict advanced substrates to VM-only
  installs, and document that restriction?

## Non-goals

- This RFC implements no runtime.
- V8-isolate and WASM runtimes are out of scope as a substrate, because
  neither can host a full-OS sandbox. Kubernetes and Nomad orchestration are
  out of scope as over-heavy for "one repository, one sandbox."
