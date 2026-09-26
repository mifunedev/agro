# RFC / ADR index

A lightweight convention governs proposals and records for notable changes to
Open Harness. The convention is not a standards organization. The convention
defines no formal document-type taxonomy, no registries, and no conformance
profiles. The convention formalizes the RFC-style issues the project already
writes, nothing more.

## Convention

A proposal is a **GitHub issue**. The issue title starts with `RFC:` for a
change under discussion, or `ADR:` for an architecture decision to record.
Discussion happens on the issue. The issue's state and the index below record
the outcome. Every proposal moves through the same lifecycle:

- **Draft** — the issue is open, under discussion.
- **Accepted** — the project approved the proposal, and the project is
  implementing the proposal or has finished it.
- **Superseded** — a later proposal replaced this proposal; the entry links
  to the replacement.

The lifecycle has three states by design. The design limits the lifecycle to
four states or fewer, deliberately. The lifecycle uses no stage gates, no
editors, and no numbering scheme beyond the GitHub issue number.

## Index

| Proposal | Status | Summary |
|---|---|---|
| [#531](https://github.com/mifunedev/agro/issues/531) | Accepted | #531 adds a portable `.agro/` control plane. #531 adds `agro init` and `agro vendor`, the project-root seam, and the machinery-namespace relocation. |
| [#525](https://github.com/mifunedev/agro/issues/525) | Draft | #525 is a self-improving-harness roadmap epic. The [curation doc](rfc-selfimprove-roadmap.md) proposes the child-issue index for human filing. |
| [Trace/event ledger RFC](rfc-trace-ledger.md) | Draft | The trace/event ledger RFC is a foundational #525 child spec. It defines the normalized append-only event ledger: the storage layout, the redaction rules, and the replay/diagnosis/scoring event set. |
| [RSI survey mapping](rfc-rsi-survey-mapping.md) | Draft | This RFC is a #525 companion. It maps the recursive-self-improvement survey ([arXiv 2607.07663](https://arxiv.org/html/2607.07663v1)) onto this repository. It holds the taxonomy placement, the verification-hierarchy rung assignment for the harness's own signals, five findings the repository already evidences, and two proposed roadmap children. This RFC is a decision artifact: it makes no runtime change. |
| [#532](https://github.com/mifunedev/agro/issues/532) | [Accepted — kept the lightweight convention; deferred the heavy scope](adr-0001-standards-scope.md) | #532 sets the standards process. The process keeps the lightweight RFC / ADR convention. The process defers the full taxonomy, registries, lifecycle, and conformance profiles until a concrete future issue needs them. |
| [#592](https://github.com/mifunedev/agro/issues/592) | Draft | #592 proposes runtime support: the A1/A2/A3 axis taxonomy and the "supported runtime" contract. The [companion spec](rfc-runtime-support.md) holds the fit matrix, the Cloudflare fit, and the Crabbox control-plane comparison. The implementation epic is [#591](https://github.com/mifunedev/agro/issues/591). |
| [#929](https://github.com/mifunedev/agro/issues/929) | Accepted | #929 makes skills the canonical role/procedure primitive. #929 makes the active coding agent the runtime. #929 adds `/architect` as an inline skill. #929 keeps provider-native sub-agents as a bounded execution primitive behind `/delegate`. #929 retires repository-authored project agents. [#989](https://github.com/mifunedev/agro/issues/989) supersedes the optional-worker, direct-implementation default of #929. |
| [#939](https://github.com/mifunedev/agro/issues/939) | Accepted | #939 is a compatibility-first migration from AGRO to AGRO. The [decision record](rfc-agro-migration.md) holds the settled Q1–Q4 decisions: CLI-only `agro update`, state-only `~/.agro`, sandbox-only setup, and GitHub login before optional agent prompts. The decision record also holds the one-runtime compatibility architecture. The Phase 0 contract is [`docs/agro-compatibility.md`](../agro-compatibility.md). |
| [#733](https://github.com/mifunedev/agro/issues/733) | Draft | #733 proposes the brain/hands boundary. The [Phase-0 decisions](rfc-brain-hands-boundary.md) sit behind the `ExecutionTarget` seam. The Phase-0 decisions cover the brain/hands split, the eval capability rule, and the four-class state taxonomy, including the Hermes known-violation. The Phase-0 decisions also cover the identical-path workspace stance and synchronous `attach()` in `contractVersion: 1`. The Phase-0 decisions document is the sole authority for those decisions. Cite the document instead of restating the decisions. The implementation epic is [#731](https://github.com/mifunedev/agro/issues/731). |
| [#989](https://github.com/mifunedev/agro/issues/989) | Accepted | The advisor-first execution default: the active session is the advisor of every `/spec execute` build and assigns tracked implementation edits to bounded `/delegate` workers. A direct owner edit requires a recorded operator exception. #989 supersedes the direct-implementation / optional-worker default of [#929](https://github.com/mifunedev/agro/issues/929). #989 preserves #929's role-as-skill, single-runtime, bounded-subagent, and no-project-agent decisions. #989 keeps [#928](https://github.com/mifunedev/agro/issues/928)'s retirement of automated persistent handoff: same session by default, transfer only on operator request. |
| [#1133](https://github.com/mifunedev/agro/issues/1133) | Accepted | #1133 makes Langfuse configuration declarative in `agro.json`. The sandbox applies the configuration. #1133 splits the settings by secrecy. The tracked `agro.json` `langfuse` section holds the non-secret settings: `enabled`, `baseUrl`, `environment`, and `userId`. The `.env` file holds the credentials. #1133 makes every shell, systemd, and per-harness file a derived artifact. `agro langfuse apply` re-renders each artifact, and `status` checks each artifact for drift. Compose `environment:` is not an option, because every consumer is an in-sandbox harness. `compose-env-boundary.sh` admits no `LANGFUSE_*` key. `RETIRED_KEYS` keeps refusing `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`. #1133 reverses the removals of [#1127](https://github.com/mifunedev/agro/issues/1127) and [#1129](https://github.com/mifunedev/agro/issues/1129). |

## Decision records

| Record | Decision |
|---|---|
| [ADR-0001: #532 standards scope](adr-0001-standards-scope.md) | ADR-0001 keeps the lightweight RFC / ADR convention. ADR-0001 defers the heavier taxonomy, registries, lifecycle, and conformance machinery until a concrete future need appears. |

## Deferred scope

ADR-0001 keeps the full IETF-style standards body out of scope for this index.
The full standards body includes a document taxonomy of `OH-RFC`, `STD`,
`BCP`, `EXP`, `INF`, and `ADR`. The full standards body also includes formal
registries, an IANA-style allocation authority, conformance profiles, and a
multi-stage lifecycle. ADR-0001 resolves #532 with the lightweight convention
above. ADR-0001 keeps the heavier machinery deferred until a concrete future
issue needs it.
