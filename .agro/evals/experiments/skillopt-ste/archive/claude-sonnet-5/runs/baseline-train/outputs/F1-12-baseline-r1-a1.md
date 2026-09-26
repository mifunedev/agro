# RFC: Runtime Support — Axes Taxonomy and the "Supported Runtime" Contract

Status: Draft for [#592](https://github.com/mifunedev/agro/issues/592). Implementation epic: [#591](https://github.com/mifunedev/agro/issues/591).

This document defines how AGRO classifies runtimes. The build-validate-support
program in issue #591 uses this contract instead of separate per-runtime decisions.
This document is a decision record. This document implements no runtime.
The child issues of #591 decide which runtimes land, and in what order.

## Purpose

Today the harness runs exactly one substrate: a single privileged
`debian:trixie-slim` container per repo (`.devcontainer/docker-compose.yml`). The
host Docker socket is opt-in and off by default. `.agro/scripts/docker-compose.sh:136`
applies a separate overlay, `.devcontainer/docker-compose.docker-sock.yml`, only when
`sandbox.docker_socket` or `DOCKER_SOCKET` is truthy. The image ships the docker CLI
but no `dockerd` (`docker-ce-cli` and `docker-compose-plugin`,
`.devcontainer/Dockerfile:37`). In-sandbox Docker work depends on that opt-in socket.
Enabling the socket opens a root-on-host boundary. That boundary carries acceptable
risk for a trusted single operator. That boundary carries the highest risk when
untrusted, agent-generated code runs unattended on a shared VM — the "remote-first,
lights-out software factory" model that `README.md` describes. The harness has no
isolation tier above the privileged container. The harness has no per-task
blast-radius containment. The harness has no "ship the app" runtime beyond a
localhost `cloudflared` tunnel. This RFC ratifies the vocabulary and the support bar
before any team adds those tiers.

## 1. The three-axis taxonomy

The word "runtime" conflates three layers. A candidate that fits one axis can make
no sense on another axis. This RFC tags every candidate to the one axis it serves.

| Axis | Question | Today | The gap |
|---|---|---|---|
| **A1 — Substrate** | Where does the sandbox run, and how isolated is it? | One privileged container. Docker CLI present, `dockerd` absent. The host Docker socket is an opt-in overlay, off by default. | No stronger isolation tier for untrusted, unattended, or multi-tenant runs |
| **A2 — Deploy target** | Where do agents ship the apps they build? | A BYO tunnel (`cloudflared`), a Railway smoke test only, and GHCR publish | No runtime that ships an app — only a way to expose localhost |
| **A3 — Scale / fan-out** | How does the harness run N tasks in parallel? | Git worktrees inside the one container, plus tmux ralph loops | No per-task isolated sandbox. Every task shares one kernel. Since the image has no `dockerd`, every task also shares the same opt-in host socket when an operator enables it. |

## 2. The "supported runtime" contract (ratifiable)

This contract supports a runtime only when the runtime meets all four conditions
below. This bar mirrors how the harness already supports agent CLIs
(`docs/harnesses/overview.md`).

1. **Documented** — a per-runtime doc exists at `docs/runtimes/<name>.md`, a
   runtimes overview references it, and the install matrix carries a row for it.
2. **One-toggle** — an operator opts in through one surface: a `harness.yaml`
   toggle, a compose overlay, or a `RUNTIME=` selector. No runtime requires a
   manual multi-step setup.
3. **Validated** — the runtime boots the sandbox, or performs its axis's job, and
   clears the boot-lint check and the `.agro/evals/probes/*` floor.
4. **Guarded** — a dedicated eval or drift probe protects the runtime (exemplar:
   `.agro/evals/probes/railway-one-click-deploy.sh`), so support cannot rot
   silently.

**Per-runtime definition of done:** `implement → validate (probe-green) → document
as supported → remove friction (a one-command path exists)`.

## 3. Guiding principle — reduce end-user friction

Every supported runtime must make the operator's work simpler. No supported
runtime may add a knob the operator must babysit. The trusted single-operator
container stays the zero-config default. Every new tier stays opt-in and
one-toggle, with onboarding docs updated in the same change (this requirement
ties directly to the in-flight `feat/install-quickstart-reconcile` work). A runtime
that adds operational burden without a net friction reduction does not qualify as
"supported" under this contract.

## 4. Fit matrix — candidates by axis

| Candidate | Axis | Isolation / shape | Notes |
|---|---|---|---|
| **gVisor (`runsc`)** | A1 | Syscall interposition, shared kernel | The cheapest first landing. A drop-in OCI runtime. A large step up from `--privileged` plus a host socket. |
| **Firecracker microVM** | A1 | Kernel-per-sandbox (deepest) | Continues research spike #384. Fits untrusted or multi-tenant runs. |
| **Kata Containers** | A1 | MicroVM depth, OCI/compose compatible | The lowest-friction path to microVM-grade isolation while the harness keeps `docker compose`. |
| **E2B / Daytona / Fly Machines / Cloudflare Sandboxes / Modal** | A1/A3 | Managed sandbox-as-a-service | Support means a one-toggle BYO-account integration. Each candidate can also serve as the fan-out answer. |
| **Cloudflare Workers/Pages (Wrangler)** | A2 | V8 isolate, edge | A deploy target for apps that agents build. |
| **Fly.io / Railway-full / Vercel** | A2 | Managed PaaS | Deploy targets. Railway upgrades from today's smoke test only. |
| **CI-as-runtime (self-hosted GH Actions dind)** | A3 | Container on runner | Already half-owned through `CI_RUNNER` (`.github/workflows/sandbox-boot-guard.yml`). |
| **Crabbox** | A3 | Remote-exec control plane | See §6. Crabbox offloads through lease → sync → run → release, and Crabbox never swaps the substrate. |

## 5. Cloudflare, specifically

Cloudflare ships two tiers. Only one tier fits the substrate axis.

- **Dynamic Workers** (V8 isolates) run about 100 times faster and cheaper than
  containers, but cannot serve as an A1 substrate: a Worker carries no full OS, so
  it cannot run git, bash, tmux, dev servers, a Docker socket, or multi-language
  builds. A Worker fits only as an A2 target.
- **Cloudflare Sandboxes / Containers** (general availability in 2026) run a
  persistent isolated Linux environment with a PTY, snapshots, filesystem watch, a
  code interpreter, and egress-proxy credential injection. This tier is the real
  Cloudflare fit for A1 and A3.
- **Workers/Pages through Wrangler** is the A2 target proper.

`oh.mifune.dev/install.sh` already runs as a Cloudflare Worker (a 302 redirect), so
the harness already operates a Cloudflare edge relationship. An A2 deploy skill
extends infrastructure the harness already runs.

## 6. Adjacent architecture — Crabbox (awareness, not yet a committed direction)

**Crabbox** (`crabbox.sh`, `openclaw/crabbox`) is a remote-execution control
plane — a different decomposition of A3 than a substrate swap. The Crabbox model
keeps the local edit-save-run loop and offloads the expensive, evidence-producing
command to a short-lived remote box. The offload runs through five stages: plan,
lease, sync, run, release. The sync stage seeds the remote git checkout from the
origin and the base ref, then rsyncs the dirty tree — the same "it's just a git
repo" model the harness already relies on. Crabbox has three layers: a local CLI
that holds a per-lease SSH key, a coordinator that holds provider credentials,
lease state, and cost caps, and a runner: a vanilla ephemeral machine with no
secrets. Crabbox provides cost caps, guaranteed cleanup, and credential
isolation that the worktrees-in-one-container model lacks. The Crabbox coordinator
runs on Cloudflare Workers and a Durable Object — Workers used as a control plane,
never as the code-execution runner, which reinforces §5. Crabbox sits adjacent to
the org's `mifunedev/sandboxes` repo ("Collection of Agent Execution Environments").

This RFC defers one decision: for A3, does the harness prefer a Crabbox-style
offload over a per-task substrate? If the harness prefers offload, does the
harness become a runner target (`provider: ssh`), embed the lease/sync/run
pattern, or integrate Crabbox directly? The wiki entries
`crabbox-remote-exec-control-plane` and `runtime-isolation-landscape` hold the
mechanics.

## 7. What this RFC decides vs. defers

- **Decides:** the axis vocabulary (§1), the "supported" contract (§2), and the
  zero-config default substrate (§3). On acceptance, the harness records this RFC
  as an ADR row in `README.md`.
- **Defers to #591's child issues:** which runtimes land, and in what order. That
  order turns on one question: does isolation security, fan-out, or
  deploy-convenience drive the sequence?

## 8. Proposed child-issue ordering (implements this contract; filed under #591)

1. **A1 · Sysbox execution target** — the scheduled next slice of
   [#731](https://github.com/mifunedev/agro/issues/731), landing behind the
   `ExecutionTarget` contract from
   [#733](https://github.com/mifunedev/agro/issues/733). Unprivileged containers
   run their own `dockerd`, so this tier gains stronger isolation without losing
   sibling-container capability (see §9).
2. **A1 · gVisor overlay** — the cheapest, most reversible tier. This tier sets the
   one-toggle, probe-guarded, documented support template the other tiers reuse.
3. **A1 · Firecracker microVM** — lands #384.
4. **A1 · Kata Containers**.
5. **A1/A3 · Managed sandbox integrations** (E2B, Daytona, Fly, Cloudflare
   Sandboxes, Modal) — each ships as a BYO-account integration.
6. **A3 · CI-as-runtime** (`CI_RUNNER` dind).
7. **A2 · Deploy-skill family** (Wrangler, flyctl, Railway-full).
8. **Landscape memo** — a `blog/` companion to
   `2026-06-07-containers-microvms-vms.md`.

## 9. Open decisions

- **Primary driver** — does isolation security, fan-out, or deploy-convenience
  drive the order in §8?
- **Self-hosted vs. managed** — does the harness own the isolation fleet (gVisor,
  Firecracker, Kata), or rent it? For a managed tier, does "supported" mean a
  documented BYO-account integration?
- ~~**DinD trade-off**~~ — **ANSWERED**: the trade-off is not forced. Sysbox gives
  its tier its own `dockerd` inside an unprivileged container, so a
  stronger-isolation tier keeps sibling-container capability instead of losing it.
  That gain places Sysbox as item 1 in §8. The host socket stays opt-in and off by
  default, per the Purpose section above. Issue
  [#731](https://github.com/mifunedev/agro/issues/731) and issue
  [#733](https://github.com/mifunedev/agro/issues/733) record this decision. The
  document [`rfc-brain-hands-boundary.md`](rfc-brain-hands-boundary.md) records the
  boundary that makes a second execution target an implementation detail. One
  question stays open per candidate: what do the gVisor and Firecracker tiers do,
  since neither ships a nested daemon for free?
- **Control plane vs. substrate swap (Crabbox)** — for A3, does the harness prefer
  an offload model or a per-task substrate?
- **Install-matrix constraint** — must every supported tier work across every
  install path, or may an advanced substrate stay VM-only, documented as such?

## Non-goals

- This RFC implements no runtime.
- V8-isolate and WASM runtimes cannot serve as a substrate, because neither hosts a
  full-OS sandbox. This RFC excludes both.
- Kubernetes and Nomad orchestration stay out of scope, because each is too heavy
  for a "one repo, one sandbox" model.
