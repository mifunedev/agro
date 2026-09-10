# Phase 4 — Migrate Cloud and downstream Mifune consumers to AGRO

- **Issue:** [#944](https://github.com/mifunedev/agro/issues/944) (parent [#939](https://github.com/mifunedev/agro/issues/939))
- **Plan:** `.agro/plans/agro-compatibility-migration/plan.md` — step S5, deliverables D1, D8, D11, D13, D14
- **Depends on:** #943 (merged `b10ecac3`)
- **Slug:** `agro-cloud-consumer-migration`
- **Branch:** `feat/944-agro-cloud-consumer-migration` in **both** repositories
- **Primary implementation repository:** `mifunedev/openharness-cloud` @ `0aa8f99`
- **Record repository:** `mifunedev/agro` @ `b10ecac3` (this task folder, inventory, evidence)

## Summary

Phase 4 makes AGRO the canonical **runtime dependency** consumed by Mifune-managed
infrastructure. It is explicitly *not* a product rename of Cloud.

Grounding against `mifunedev/openharness-cloud@0aa8f99` and `mifunedev/agro@b10ecac3`
found that this phase is not a string-replacement exercise. Cloud's node bootstrap
targets three harness contracts that **no longer exist**, so parts of Cloud are
already broken against the shipped runtime, independent of any rename.

## Grounded findings — the real constraint

### F1 · Fresh Cloud provisioning is broken today (blocking, pre-existing)

`infra/cloud-init/cloud-config.yaml` and
`packages/shared/src/workspace-bootstrap-assets.ts` clone
`https://github.com/mifunedev/openharness.git` into `~/.openharness` and run
`make sandbox`.

`Makefile` was **deleted** from the runtime repository by
[#893](https://github.com/mifunedev/agro/pull/893) (`0b292bf8`, 2026-08-29), which is
contained in tags `v0.5.1` through `v0.9.0`. The clone takes the default branch
(`main`), which has no `Makefile`.

Consequence: every new Cloud node clones successfully, then fails `make sandbox`,
writes `failed:127` to `~/.openharness-bootstrap-status`, and never touches
`/run/openharness-ready`. This predates the AGRO rename and is not caused by it.
Verified: `git ls-tree origin/main --name-only | grep -i makefile` → empty.

### F2 · Harness selections are silently dropped (blocking)

`packages/shared/src/workspace-bootstrap-assets.ts:52-57` maps each user harness
selection to an `INSTALL_<X>=true` line written into `.devcontainer/.env`.

All four flags — `INSTALL_OPENCODE`, `INSTALL_GROK_BUILD`, `INSTALL_DEEPAGENTS`,
`INSTALL_HERMES` — plus `INSTALL_AGENT_BROWSER` are listed in `RETIRED_KEYS` in
`.agro/cli/src/lib/config-render.ts:4-23`. The runtime **refuses to render them**
(`refusing to render retired variable ${key}`) and the devcontainer no longer reads
them.

Consequence: the Cloud create-node harness multi-select is a no-op. A user selects
Hermes, Cloud reports success, nothing is installed. The plan's Phase 4 note applies
directly: *"Translate supported user selections into explicit harness/tool
installation calls; do not reactivate retired boot-time installation flags. Report
unsupported legacy selections instead of silently dropping or replacing them."*

Two sub-cases:

- `opencode`, `grok_build`, `hermes` map to live AGRO ids `opencode`,
  **`grok-build`** (hyphen, not underscore), `hermes` — migrate to explicit
  `agro harness install <id>`.
- `deepagents` has **no AGRO id at all**. It survives only as a retired key. It is an
  unsupported legacy selection and must be reported, never silently dropped.
- `agentBrowserEnabled` → `agro tool install agent-browser`.

### F3 · `node.rebuild` reports success without doing anything (blocking for D11)

`apps/provisioner/src/provision.ts:385-401` advances
`rebuild_requested → stopping_container → pulling_image → starting_container → running`
with no node-side effect. The only implementation is a comment:

```
// TODO: exec `git -C ~/.openharness pull && make sandbox` on the node over SSH
```

The intended implementation references both retired contracts from F1.

Consequence: `running` after a rebuild does not prove workspace readiness, so D11's
*"suspend/resume/rebuild/attach flows do not silently disconnect persistent user
state"* cannot be evidenced against the current handler. The plan anticipates this:
*"If incomplete Cloud lifecycle operations block D11, obtain a bounded prerequisite
fix before claiming Phase 4 completion."* `apps/provisioner/src/management-ssh.ts`
already provides the SSH capability, so the fix is bounded.

### F4 · The organization audit is small and bounded

- 32 org repositories; 1 archived.
- Only **two** repositories carry a `.oh/` directory: `mifunedev/agro-web` (`.oh/tasks`
  only) and `mifunedev/openharness-cloud` (`.oh/skills`, `.oh/tasks`). Neither is a
  fully equipped control plane — no `cli`, `scripts`, `hooks`, or config — so
  `agro migrate --check` decides whether the supported path applies before anything
  moves.
- Org code search shows legacy identifiers concentrated in `mifunedev/agro` itself
  (compatibility surfaces, Phase 5's business) plus `mifunedev/website`
  (6 `oh.mifune.dev` hits) and the private `openharness-cloud`.
- `mifunedev/agro-web` returns no `oh.mifune.dev` hits — Phase 3 cleared it.

Code search does not index private repositories in this query, so the recorded audit
must scan by clone or API rather than relying on `gh search code` alone.

## Cloud naming boundary — classification policy

`mifunedev/openharness-cloud` keeps its product and repository identity. Names are
classified into #939's five categories; only categories 1 and 2 move.

| Name | Category | Disposition |
|---|---|---|
| `mifunedev/openharness` clone URL, `~/.openharness` source checkout | 1 runtime | **Removed** — replaced by artifact install (see US-003); not renamed to a new checkout |
| `make sandbox` | 1 runtime | **Removed** — replaced by `agro sandbox install docker` |
| `INSTALL_*` harness flags | 1 runtime | **Removed** — replaced by explicit `agro harness/tool install` |
| `OH_CODE_SERVER_ENABLED` and other node-side `OH_*` runtime vars | 2 compat | Migrate to `AGRO_*` with Phase 0 compatibility |
| `oh` CLI invocation in node/user-facing copy | 1 runtime | Migrate to `agro` |
| `ghcr.io/mifunedev/openharness` runtime image | 1 runtime | Migrate to `ghcr.io/mifunedev/agro` |
| `mifunedev/openharness-cloud` repository | 3 product identity | **Retain** |
| `ghcr.io/mifunedev/openharness-cloud/{web,gateway,provisioner}` | 3 product identity | **Retain** — Cloud's own images, not the runtime |
| `@openharness-cloud/shared` npm workspace scope | 3 product identity | **Retain** |
| `OH_IMAGE_TAG`, `OH_ENV_FILE` | 4 internal/operator config | **Retain** — Cloud's own compose stack, live on deployed hosts |
| `~/.openharness-bootstrap-status`, `~/.openharness-bootstrap.log`, `/run/openharness-ready` | 4 internal contract | **Retain paths** — cloud-init/provisioner/gateway contract |
| `docker-build-oh-sandbox` tmux session | 4 internal identifier | **Retain** |
| Database names, durable IDs, API token prefixes | 4 persistence | **Retain** — never changed for grep cleanliness |
| `.oh/tasks/*` historical task records | 5 historical | **Retain content**; directory moves only if `agro migrate` applies |
| CI run URLs, closed-issue links, `docs/design/console-mvp.md` history | 5 historical | **Retain** |

## Plan reconciliation

The approved plan's Phase 4 intent is unchanged. Grounding **enlarged the known work**
within that intent rather than redirecting it: the plan already required replacing
`make sandbox` with artifact-based provisioning, already forbade a renamed source
checkout, already required translating selections into explicit installation calls,
and already anticipated a bounded lifecycle prerequisite fix for D11. F1–F3 are the
concrete instances of those four instructions. No re-approval is sought on scope
shape. The two naming questions raised during grounding were resolved as grounded
applications of #944's own retention boundary, not as new decisions.

## Knowledge context

Recalled and re-grounded against current code:

- `[[compose-env-boundary]]` — verified: `RETIRED_KEYS` in `config-render.ts` is the
  live mechanism behind F2, and the retirement is enforced by a throw, not a warning.
- `[[oh-cli-portable-lifecycle]]` — verified: `docs/lifecycle-commands.md:38-55` is the
  current verb surface used for the replacement bootstrap.
- `[[fresh-machine-setup]]` — verified: artifact-only installation with no host
  checkout is the canonical model (D16).
- `[[agro-web-pipeline]]` — orientation only; no Phase 4 dependency.
- `[[pattern-spec-stubbed-runner-state-gap]]` — directly applicable to F3: a status
  advance is not evidence of a runtime effect. D11 evidence must observe node state,
  never the `running` status field.
- `[[plan-vs-built-reconciliation]]` — applied above.

## Expected knowledge impact

- UPDATE `oh-cli-portable-lifecycle` — the lifecycle verbs gain a documented
  headless/unattended provisioning consumer.
- NEW `cloud-node-provisioning` — how Cloud installs and drives AGRO on a node,
  including the artifact path and the retained internal contract paths.
- REVERIFY `compose-env-boundary` — F2 is a second consumer discovering the retirement.
- Candidate pattern: *a downstream consumer pinned to a deleted build entrypoint fails
  only at provision time*, from F1.

## Resolved decisions and the one real gate

**Q1 and Q2 are resolved, not pending.** #944 already directs retention of stable
Cloud and internal identifiers, so these need no new naming decision — they are
grounded applications of the approved boundary:

- `OH_IMAGE_TAG` and `OH_ENV_FILE` configure Cloud's own compose stack, not the AGRO
  runtime, and live in `.env` files on running control-plane hosts. **Retained**,
  category 4.
- `~/.openharness-bootstrap-status`, `~/.openharness-bootstrap.log`,
  `/run/openharness-ready`, and the `docker-build-oh-sandbox` tmux session are the
  internal contract between cloud-init, the provisioner, and the gateway.
  **Paths and session name retained**, category 4. Only runtime-facing prose changes.

**Q3 is a genuine operator gate**, but it gates less than the whole of US-007. The
lifecycle matrix splits by what actually requires the provider:

- **Locally exercisable, faithfully:** the node bootstrap is a generated shell script
  run by cloud-init on a Linux host. Fresh AGRO provisioning, recovery of a
  representative legacy `~/.openharness` workspace, AGRO operating existing legacy
  project state, and rebuild-over-SSH state preservation can all be exercised against
  a real disposable local Linux VM or container with real observed filesystem and
  container state. This is US-007a.
- **Requires the provider:** OVH instance create, destroy, suspend, and resume, and
  the provisioner's OVH-side reconciliation. This is US-007b.

A mock, a fixture, or a status transition is never accepted as observed state for
either half. US-007a's evidence must read real files and real container state on a
real booted host.

## User stories

### US-001 · Organization-wide downstream dependency inventory
Record a classified inventory of every active dependency on legacy identifiers across
all 32 `mifunedev` repositories, scanned by an auditable, reproducible command against
recorded commit SHAs rather than by `gh search code` alone (which omits private repos).
Every occurrence lands in exactly one of the five categories.

### US-002 · Cloud name classification record
Publish the classification table above as a reviewable record in the Cloud repository,
with a justification per retained name. Explicitly justify every category 3 and 4
retention. No durable persistence identifier changes.

### US-003 · Artifact-based node provisioning replaces the deleted `make sandbox` path
Replace the source-clone bootstrap with canonical AGRO installation from artifacts and
`agro sandbox install docker`. No managed source checkout is created — neither the old
`~/.openharness` clone nor a renamed equivalent. Fixes F1.

### US-004 · Harness and tool selections become explicit installation calls
Emit no retired `INSTALL_*` flag. Translate supported selections into explicit
`agro harness install` / `agro tool install` calls, mapping `grok_build` → `grok-build`.
Report `deepagents` as an unsupported legacy selection rather than dropping it
silently. Fixes F2.

### US-005 · Canonical AGRO refs and variables across Cloud runtime surfaces
Source URLs, installer URLs, GHCR runtime references, node-side `OH_*` → `AGRO_*` with
compatibility, and `oh` → `agro` invocation, in cloud-init, host-management assets,
workspace-bootstrap assets, provisioning fixtures, and tests. Category 3 and 4 names
are untouched.

### US-006 · Bounded `node.rebuild` implementation
Give `node.rebuild` a real node-side operation over the existing SSH management path,
so `running` reflects an observed workspace state. Scope is the prerequisite D11 needs
and no more — this is not a Cloud lifecycle redesign. Fixes F3.

## The attach surface — three places, two test homes

#944 requires that "suspend/resume/rebuild/attach flows do not silently disconnect
persistent user state". Attach is not one thing on a Cloud node, and splitting US-007 by
provider dependency must not drop it. The three surfaces:

1. **SSH + tmux.** `packages/shared/src/index.ts:788-789` documents
   `ssh <sshUser>@<ipv4>` then `tmux attach -t docker-build-oh-sandbox`.
2. **Browser editor.** `apps/gateway` proxies to the node's loopback code-server on
   `127.0.0.1:8080` over a pinned SSH forward (`proxy.ts:86`, `dialer.ts:48`).
   `README.md:356` records that this editor "opens `~/.openharness` by default".
3. **Container attach.** VS Code Dev Containers against the compose-built sandbox.

Surface 2 makes attach a **design constraint on US-003, not only a test**: the directory
US-003 removes is the editor's default workspace root. US-003 therefore has to decide
what that root becomes and point `/home/sandbox/oh.code-workspace` at a path that exists
after the new bootstrap and holds durable user state.

All three surfaces are exercisable on a real local host, so they live in US-007a,
including after a restart and after a rebuild. Only the live cloudflared tunnel and
attach across provider suspend/resume need the provider, so those go to US-007b.

One nuance the evidence must respect: `node.rebuild` deliberately calls
`revokeNodeBrowserAccess` before it does anything else. A revoked session after a rebuild
is **correct behaviour**. The criterion is that the user's *re-attach* lands on preserved
state — not that an open websocket survives.

### US-007a · Node-bootstrap lifecycle evidence on a real local host
Run the generated bootstrap on a real disposable Linux host. Evidence that fresh AGRO
provisioning completes, that a representative OpenHarness-era `~/.openharness`
workspace remains recoverable, that AGRO operates existing legacy project state, that
migration to native AGRO state is explicit and safe, and that a rebuild preserves
persistent user state. Every assertion reads observed filesystem or container state.
No mock, fixture, or status transition is accepted as evidence.

### US-007b · Provider-level lifecycle evidence (D11 remainder)
OVH instance create, destroy, suspend, and resume against disposable paid nodes, and
the provisioner's OVH-side reconciliation. **Blocked on Q3 — explicit operator
authorization to provision paid infrastructure. No live infrastructure is touched
without it.**

### US-008 · Equipped-repository migration through the supported path
For each `.oh/`-carrying org repository, run `agro migrate --check` first and migrate
through the supported mechanism where it applies; where it does not apply, record why
rather than performing an ad hoc rename.

### US-009 · Operator- and user-facing copy reflects the AGRO runtime contract
README, quickstart, threat model, deploy and gateway runbooks, cloud-init README,
console setup guide, and API/UI copy stop presenting OpenHarness as the canonical
runtime name, while retaining Cloud's own product identity and historical references.

## Non-goals

- Removing any compatibility surface defined by #939 — that is Phase 5 (#945).
- Renaming the Cloud product, repository, images, npm scope, or persistence identifiers.
- Any release, promotion, credential creation, or Cloudflare mutation.
- Cloud lifecycle redesign beyond the bounded US-006 prerequisite.
- Closing #939.

## Verification

- Cloud unit and integration suites on the exact implementation head.
- A provisioning fixture asserting no retired `INSTALL_*` key and no `make sandbox`
  reaches generated userData.
- A fixture asserting generated userData creates no source checkout.
- `agro migrate --check` output recorded per equipped repository.
- Live D11 matrix per Q3, with observed-state evidence.
- Independent read-only review from a clean candidate worktree (D13).

## Ready PR contract

Two coordinated pull requests, both referencing #944, with the dependency order
recorded: the Cloud implementation PR (`mifunedev/openharness-cloud`) and the record
PR (`mifunedev/agro`, this folder plus inventory and evidence). Dedicated worktrees per
repository. Neither is merged without explicit operator authorization — the prior
authorization covered #1015 only.
