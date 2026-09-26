# RFC / ADR index

The AGRO project uses a lightweight convention to propose and record notable
changes. The convention is not a standards organization: the convention has no
formal document-type taxonomy, no registries, and no conformance profiles. The
convention formalizes the RFC-style issues the project already writes.

## Convention

A proposal is a GitHub issue. The issue title starts with `RFC:` for a change
to discuss and adopt, or `ADR:` for an architecture decision to record.
Discussion happens on the issue. The issue's state and the index below record
the outcome. Every proposal moves through the same three-state lifecycle:

- **Draft** — open issue, under discussion.
- **Accepted** — agreed, and being (or already) implemented.
- **Superseded** — replaced by a later proposal (link to the replacement).

The lifecycle holds exactly three states by design. The convention caps the
lifecycle at four states. The convention defines no stage gates, no editors,
and no numbering scheme beyond the GitHub issue number.

## Index

| Proposal | Status | Summary |
|---|---|---|
| [#531](https://github.com/mifunedev/agro/issues/531) | Accepted | Portable `.agro/` control plane — `agro init` / `agro vendor`, the project-root seam, and the machinery-namespace relocation. |
| [#525](https://github.com/mifunedev/agro/issues/525) | Draft | The self-improving-harness roadmap epic proposes child issues. The [curation doc](rfc-selfimprove-roadmap.md) is the proposed child-issue index for human filing. |
| [Trace/event ledger RFC](rfc-trace-ledger.md) | Draft | Foundational #525 child spec for the normalized append-only event ledger, storage layout, redaction rules, and replay/diagnosis/scoring event set. |
| [RSI survey mapping](rfc-rsi-survey-mapping.md) | Draft | #525 companion. The document maps the recursive-self-improvement survey ([arXiv 2607.07663](https://arxiv.org/html/2607.07663v1)) onto this repository. The document holds the taxonomy placement and the verification-hierarchy rung assignment for the harness's own signals. The document also holds five findings the repository already evidences and two proposed roadmap children. The document is a decision artifact and makes no runtime change. |
| [#532](https://github.com/mifunedev/agro/issues/532) | [Accepted — resolved lightweight; heavy scope deferred](adr-0001-standards-scope.md) | The decision keeps the lightweight RFC/ADR convention. The decision defers the full taxonomy, registries, lifecycle, and conformance profiles until a concrete future issue needs them. |
| [#592](https://github.com/mifunedev/agro/issues/592) | Draft | Runtime support defines the A1/A2/A3 axis taxonomy and the "supported runtime" contract. The [companion spec](rfc-runtime-support.md) holds the fit matrix, the Cloudflare fit, and the Crabbox control-plane comparison. Implementation epic: [#591](https://github.com/mifunedev/agro/issues/591). |
| [#929](https://github.com/mifunedev/agro/issues/929) | Accepted | Skills are the canonical role and procedure primitive. The active coding agent is the runtime. The decision adds `/architect` as an inline skill. The decision keeps provider-native sub-agents as a bounded execution primitive behind `/delegate`. The decision retires repository-authored project agents. [#989](https://github.com/mifunedev/agro/issues/989) supersedes the optional-worker, direct-implementation default. |
| [#939](https://github.com/mifunedev/agro/issues/939) | Accepted | The migration from AGRO to AGRO is compatibility-first. The [decision record](rfc-agro-migration.md) holds the settled Q1–Q4 decisions: CLI-only `agro update`, state-only `~/.agro`, sandbox-only setup, and GitHub login before optional agent prompts. The decision record also holds the one-runtime compatibility architecture. Phase 0 contract: [`docs/agro-compatibility.md`](../agro-compatibility.md). |
| [#733](https://github.com/mifunedev/agro/issues/733) | Draft | The brain/hands boundary [Phase-0 decisions](rfc-brain-hands-boundary.md) define the `ExecutionTarget` seam. The decisions cover the brain/hands split, the eval capability rule, and the four-class state taxonomy (with the Hermes known violation). The decisions also cover the identical-path workspace stance and synchronous `attach()` in `contractVersion: 1`. The linked document is the sole authority for those decisions: cite the document, do not restate the decisions. Epic [#731](https://github.com/mifunedev/agro/issues/731). |
| [#989](https://github.com/mifunedev/agro/issues/989) | Accepted | The advisor-first execution default: the active session is the advisor of every `/spec execute` build and assigns tracked implementation edits to bounded `/delegate` workers. A direct owner edit requires a recorded operator exception. The decision supersedes the direct-implementation / optional-worker default of [#929](https://github.com/mifunedev/agro/issues/929) while preserving #929's role-as-skill, single-runtime, bounded-subagent, and no-project-agent decisions. The decision keeps [#928](https://github.com/mifunedev/agro/issues/928)'s retirement of automated persistent handoff: same session by default, transfer only on operator request. |
| [#1133](https://github.com/mifunedev/agro/issues/1133) | Accepted | Langfuse configuration is declarative in `agro.json` and applied inside the sandbox. The decision splits the settings by secrecy. Non-secret `enabled`, `baseUrl`, `environment`, and `userId` live in the tracked `agro.json` `langfuse` section. Credentials live in `.env`. The decision makes every shell, systemd, and per-harness file a derived artifact. `agro langfuse apply` re-renders each artifact, and `status` checks each artifact for drift. Compose `environment:` is not an option, because every consumer is an in-sandbox harness. `compose-env-boundary.sh` admits no `LANGFUSE_*` key. `RETIRED_KEYS` keeps refusing `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`. The decision reverses the removals of [#1127](https://github.com/mifunedev/agro/issues/1127) and [#1129](https://github.com/mifunedev/agro/issues/1129). |

## Decision records

| Record | Decision |
|---|---|
| [ADR-0001: #532 standards scope](adr-0001-standards-scope.md) | The lightweight RFC/ADR convention meets the project's needs today. Heavier taxonomy, registries, lifecycle, and conformance machinery stay deferred until a concrete future need appears. |

## Deferred scope

The full IETF-style standards body stays out of scope for this index: the
`OH-RFC` / `STD` / `BCP` / `EXP` / `INF` / `ADR` document taxonomy, formal
registries, an IANA-style allocation authority, conformance profiles, and a
multi-stage lifecycle. [ADR-0001](adr-0001-standards-scope.md) resolves #532
with the lightweight convention above. ADR-0001 keeps that heavier machinery
deferred until a concrete future issue needs it.
