# RFC / ADR index

A lightweight convention for proposing and recording notable changes to Open
Harness. This is a **convention, not a standards organization** — there is no
formal document-type taxonomy, no registries, and no conformance profiles. It
formalizes the RFC-style issues the project already writes, nothing more.

## Convention

A proposal is a **GitHub issue** whose title starts with `RFC:` (a change we want
to discuss and adopt) or `ADR:` (an architecture decision we want to record on the
record). Discussion happens on the issue; its outcome is captured by the issue's
state and the index below. Every proposal moves through the same minimal
lifecycle:

- **Draft** — open issue, under discussion.
- **Accepted** — agreed, and being (or already) implemented.
- **Superseded** — replaced by a later proposal (link to the replacement).

That is the whole lifecycle — three states by design (kept to ≤4 deliberately).
No stage gates, no editors, no numbering scheme beyond the GitHub issue number.

## Index

| Proposal | Status | Summary |
|---|---|---|
| [#531](https://github.com/mifunedev/agro/issues/531) | Accepted | Portable `.agro/` control plane — `agro init` / `agro vendor`, the project-root seam, and the machinery-namespace relocation. |
| [#525](https://github.com/mifunedev/agro/issues/525) | Draft | Self-improving-harness roadmap epic; the [curation doc](rfc-selfimprove-roadmap.md) is the proposed child-issue index for human filing. |
| [Trace/event ledger RFC](rfc-trace-ledger.md) | Draft | Foundational #525 child spec for the normalized append-only event ledger, storage layout, redaction rules, and replay/diagnosis/scoring event set. |
| [RSI survey mapping](rfc-rsi-survey-mapping.md) | Draft | #525 companion. Maps the recursive-self-improvement survey ([arXiv 2607.07663](https://arxiv.org/html/2607.07663v1)) onto this repository. Holds the taxonomy placement, the verification-hierarchy rung assignment for the harness's own signals, five findings the repository already evidences, and two proposed roadmap children. Decision artifact — no runtime change. |
| [#532](https://github.com/mifunedev/agro/issues/532) | [Accepted — resolved lightweight; heavy scope deferred](adr-0001-standards-scope.md) | Standards process — keep the lightweight RFC / ADR convention; defer the full taxonomy, registries, lifecycle, and conformance profiles until a concrete future issue needs them. |
| [#592](https://github.com/mifunedev/agro/issues/592) | Draft | Runtime support — the A1/A2/A3 axis taxonomy and the "supported runtime" contract; the [companion spec](rfc-runtime-support.md) holds the fit matrix, the Cloudflare fit, and the Crabbox control-plane comparison. Implementation epic [#591](https://github.com/mifunedev/agro/issues/591). |
| [#929](https://github.com/mifunedev/agro/issues/929) | Accepted | Skills are the canonical role/procedure primitive and the active coding agent is the runtime; adds `/architect` as an inline skill, keeps provider-native sub-agents as a bounded execution primitive behind `/delegate`, and retires repository-authored project agents. [#989](https://github.com/mifunedev/agro/issues/989) supersedes its optional-worker, direct-implementation default. |
| [#939](https://github.com/mifunedev/agro/issues/939) | Accepted | Compatibility-first migration from AGRO to AGRO; the [decision record](rfc-agro-migration.md) holds the settled Q1–Q4 decisions (CLI-only `agro update`, state-only `~/.agro`, sandbox-only setup, GitHub login before optional agent prompts) and the one-runtime compatibility architecture. Phase 0 contract: [`docs/agro-compatibility.md`](../agro-compatibility.md). |
| [#733](https://github.com/mifunedev/agro/issues/733) | Draft | Brain/hands boundary — the [Phase-0 decisions](rfc-brain-hands-boundary.md) behind the `ExecutionTarget` seam: the brain/hands split, the eval capability rule, the four-class state taxonomy (with the Hermes known-violation), the identical-path workspace stance, and synchronous `attach()` in `contractVersion: 1`. Sole authority for those decisions — cite, do not restate. Epic [#731](https://github.com/mifunedev/agro/issues/731). |
| [#989](https://github.com/mifunedev/agro/issues/989) | Accepted | The advisor-first execution default: the active session is the advisor of every `/spec execute` build and assigns tracked implementation edits to bounded `/delegate` workers. A direct owner edit requires a recorded operator exception. Supersedes the direct-implementation / optional-worker default of [#929](https://github.com/mifunedev/agro/issues/929) while preserving #929's role-as-skill, single-runtime, bounded-subagent, and no-project-agent decisions. Keeps [#928](https://github.com/mifunedev/agro/issues/928)'s retirement of automated persistent handoff: same session by default, transfer only on operator request. |
| [#1133](https://github.com/mifunedev/agro/issues/1133) | Accepted | Langfuse configuration is declarative in `agro.json` and applied inside the sandbox. Splits the settings by secrecy — non-secret `enabled`, `baseUrl`, `environment` and `userId` in the tracked `agro.json` `langfuse` section, credentials in `.env` — and makes every shell, systemd and per-harness file a derived artifact that `agro langfuse apply` re-renders and `status` checks for drift. Compose `environment:` is not an option: every consumer is an in-sandbox harness, so `compose-env-boundary.sh` admits no `LANGFUSE_*` key and `RETIRED_KEYS` keeps refusing `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`. Reverses the removals of [#1127](https://github.com/mifunedev/agro/issues/1127) and [#1129](https://github.com/mifunedev/agro/issues/1129). |

## Decision records

| Record | Decision |
|---|---|
| [ADR-0001: #532 standards scope](adr-0001-standards-scope.md) | The lightweight RFC / ADR convention is sufficient for now; heavier taxonomy, registries, lifecycle, and conformance machinery stay deferred until a concrete future need appears. |

## Deferred scope

The full IETF-style standards body — the `OH-RFC` / `STD` / `BCP` / `EXP` / `INF`
/ `ADR` document taxonomy, formal registries, an IANA-style allocation authority,
conformance profiles, and a multi-stage lifecycle — remains **out of scope for
this index**. [ADR-0001](adr-0001-standards-scope.md) resolves #532 with the
lightweight convention above and keeps that heavier machinery deferred until a
concrete future issue needs it.
