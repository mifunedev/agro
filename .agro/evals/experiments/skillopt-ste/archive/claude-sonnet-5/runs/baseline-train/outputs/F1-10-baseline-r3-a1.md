# RFC / ADR index

This convention governs how contributors propose and record notable changes to
Open Harness. The convention is **a convention, not a standards
organization** — the convention defines no formal document-type taxonomy, no
registries, and no conformance profiles. The convention formalizes the
RFC-style issues the project already writes.

## Convention

A proposal is a **GitHub issue** whose title starts with `RFC:` (a change we want
to discuss and adopt) or `ADR:` (an architecture decision we want to record on the
record). Discussion happens on the issue. The issue's state and the index below record the outcome. Every
proposal moves through the same minimal lifecycle:

- **Draft** — open issue, under discussion.
- **Accepted** — agreed, and being (or already) implemented.
- **Superseded** — replaced by a later proposal (link to the replacement).

The lifecycle holds exactly three states by design; the convention caps the
lifecycle at four states deliberately. The convention has no stage gates, no
editors, and no numbering scheme beyond the GitHub issue number.

## Index

| Proposal | Status | Summary |
|---|---|---|
| [#531](https://github.com/mifunedev/agro/issues/531) | Accepted | Portable `.agro/` control plane — `agro init` / `agro vendor`, the project-root seam, and the machinery-namespace relocation. |
| [#525](https://github.com/mifunedev/agro/issues/525) | Draft | Self-improving-harness roadmap epic; the [curation doc](rfc-selfimprove-roadmap.md) is the proposed child-issue index for human filing. |
| [Trace/event ledger RFC](rfc-trace-ledger.md) | Draft | Foundational #525 child spec for the normalized append-only event ledger, storage layout, redaction rules, and replay/diagnosis/scoring event set. |
| [RSI survey mapping](rfc-rsi-survey-mapping.md) | Draft | #525 companion. Maps the recursive-self-improvement survey ([arXiv 2607.07663](https://arxiv.org/html/2607.07663v1)) onto this repository. Holds the taxonomy placement, the verification-hierarchy rung assignment for the harness's own signals, five findings the repository already evidences, and two proposed roadmap children. Decision artifact — no runtime change. |
| [#532](https://github.com/mifunedev/agro/issues/532) | [Accepted — resolved lightweight; heavy scope deferred](adr-0001-standards-scope.md) | Standards process. Keep the lightweight RFC / ADR convention. Defer the full taxonomy, registries, lifecycle, and conformance profiles until a concrete future issue needs them. |
| [#592](https://github.com/mifunedev/agro/issues/592) | Draft | Runtime support: the A1/A2/A3 axis taxonomy and the "supported runtime" contract. The [companion spec](rfc-runtime-support.md) holds the fit matrix, the Cloudflare fit, and the Crabbox control-plane comparison. Implementation epic [#591](https://github.com/mifunedev/agro/issues/591). |
| [#929](https://github.com/mifunedev/agro/issues/929) | Accepted | Skills are the canonical role/procedure primitive. The active coding agent is the runtime. `/architect` is now an inline skill. Provider-native sub-agents remain a bounded execution primitive behind `/delegate`. This decision retires repository-authored project agents. [#989](https://github.com/mifunedev/agro/issues/989) supersedes its optional-worker, direct-implementation default. |
| [#939](https://github.com/mifunedev/agro/issues/939) | Accepted | Compatibility-first migration from AGRO to AGRO. The [decision record](rfc-agro-migration.md) holds the settled Q1–Q4 decisions: CLI-only `agro update`, state-only `~/.agro`, sandbox-only setup, and GitHub login before optional agent prompts. The record also holds the one-runtime compatibility architecture. Phase 0 contract: [`docs/agro-compatibility.md`](../agro-compatibility.md). |
| [#733](https://github.com/mifunedev/agro/issues/733) | Draft | Brain/hands boundary. The [Phase-0 decisions](rfc-brain-hands-boundary.md) govern the `ExecutionTarget` seam. The decisions cover the brain/hands split, the eval capability rule, the four-class state taxonomy (with the Hermes known-violation), the identical-path workspace stance, and synchronous `attach()` in `contractVersion: 1`. The Phase-0 decisions document is the sole authority for those decisions; cite the document, do not restate it. Epic [#731](https://github.com/mifunedev/agro/issues/731). |
| [#989](https://github.com/mifunedev/agro/issues/989) | Accepted | The advisor-first execution default: the active session is the advisor of every `/spec execute` build and assigns tracked implementation edits to bounded `/delegate` workers. A direct owner edit requires a recorded operator exception. Supersedes the direct-implementation / optional-worker default of [#929](https://github.com/mifunedev/agro/issues/929) while preserving #929's role-as-skill, single-runtime, bounded-subagent, and no-project-agent decisions. Keeps [#928](https://github.com/mifunedev/agro/issues/928)'s retirement of automated persistent handoff: same session by default, transfer only on operator request. |
| [#1133](https://github.com/mifunedev/agro/issues/1133) | Accepted | Langfuse configuration is declarative in `agro.json` and applied inside the sandbox. The convention splits settings by secrecy: non-secret `enabled`, `baseUrl`, `environment`, and `userId` live in the tracked `agro.json` `langfuse` section, and credentials live in `.env`. Every shell, systemd, and per-harness file becomes a derived artifact; `agro langfuse apply` re-renders each artifact and `status` checks each artifact for drift. Compose `environment:` is not an option: every consumer is an in-sandbox harness, so `compose-env-boundary.sh` admits no `LANGFUSE_*` key, and `RETIRED_KEYS` keeps refusing `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`. This decision reverses the removals of [#1127](https://github.com/mifunedev/agro/issues/1127) and [#1129](https://github.com/mifunedev/agro/issues/1129). |

## Decision records

| Record | Decision |
|---|---|
| [ADR-0001: #532 standards scope](adr-0001-standards-scope.md) | The lightweight RFC / ADR convention covers the project's current proposal and decision-recording needs. Heavier taxonomy, registries, lifecycle, and conformance machinery stay deferred until a concrete future need appears. |

## Deferred scope

The full IETF-style standards body — the `OH-RFC` / `STD` / `BCP` / `EXP` / `INF`
/ `ADR` document taxonomy, formal registries, an IANA-style allocation authority,
conformance profiles, and a multi-stage lifecycle — remains **out of scope for
this index**. [ADR-0001](adr-0001-standards-scope.md) resolves #532 with the
lightweight convention above and keeps that heavier machinery deferred until a
concrete future issue needs it.
