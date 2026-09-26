# RFC / ADR index

This index defines a small convention. Contributors use the convention to
propose notable changes to Open Harness and to record those changes. The
convention is **not a standards organization**. The convention has no formal
document-type taxonomy, no registries, and no conformance profiles. The
convention only formalizes the RFC-style issues that the project already writes.

## Convention

A proposal is a **GitHub issue**. The issue title starts with one of two
prefixes:

- `RFC:` marks a change that the project wants to discuss and adopt.
- `ADR:` marks an architecture decision that the project wants to record.

Contributors discuss each proposal on its issue. The issue state and the index
below record the outcome. Every proposal moves through the same three-state
lifecycle:

- **Draft** — the issue is open, and discussion continues.
- **Accepted** — the project agrees to the proposal. Implementation is in
  progress or complete.
- **Superseded** — a later proposal replaces this proposal. Link to the
  replacement.

The lifecycle has exactly three states by design. The convention limits the
lifecycle to ≤4 states on purpose. The convention has no stage gates and no
editors. The GitHub issue number is the only numbering scheme.

## Index

| Proposal | Status | Summary |
|---|---|---|
| [#531](https://github.com/mifunedev/agro/issues/531) | Accepted | Portable `.agro/` control plane — `agro init` / `agro vendor`, the project-root seam, and the machinery-namespace relocation. |
| [#525](https://github.com/mifunedev/agro/issues/525) | Draft | Self-improving-harness roadmap epic. The [curation doc](rfc-selfimprove-roadmap.md) is the proposed child-issue index for a human to file. |
| [Trace/event ledger RFC](rfc-trace-ledger.md) | Draft | Foundational #525 child spec. Covers the normalized append-only event ledger, the storage layout, and the redaction rules. Also covers the replay/diagnosis/scoring event set. |
| [RSI survey mapping](rfc-rsi-survey-mapping.md) | Draft | #525 companion. Maps the recursive-self-improvement survey ([arXiv 2607.07663](https://arxiv.org/html/2607.07663v1)) onto this repository. Holds the taxonomy placement and five findings that the repository already evidences. Holds the verification-hierarchy rung assignment for the signals of the harness. Holds two proposed roadmap children. Decision artifact — no runtime change. |
| [#532](https://github.com/mifunedev/agro/issues/532) | [Accepted — resolved lightweight; heavy scope deferred](adr-0001-standards-scope.md) | Standards process. Keeps the lightweight RFC / ADR convention. Defers the full taxonomy, registries, lifecycle, and conformance profiles until a concrete future issue needs them. |
| [#592](https://github.com/mifunedev/agro/issues/592) | Draft | Runtime support — the A1/A2/A3 axis taxonomy and the "supported runtime" contract. The [companion spec](rfc-runtime-support.md) holds the fit matrix, the Cloudflare fit, and the Crabbox control-plane comparison. Implementation epic [#591](https://github.com/mifunedev/agro/issues/591). |
| [#929](https://github.com/mifunedev/agro/issues/929) | Accepted | Skills are the canonical role/procedure primitive, and the active coding agent is the runtime. Adds `/architect` as an inline skill. Keeps provider-native sub-agents as a bounded execution primitive behind `/delegate`. Retires repository-authored project agents. [#989](https://github.com/mifunedev/agro/issues/989) supersedes the optional-worker, direct-implementation default of #929. |
| [#939](https://github.com/mifunedev/agro/issues/939) | Accepted | Compatibility-first migration from <previous project name> to AGRO. The [decision record](rfc-agro-migration.md) holds the settled Q1–Q4 decisions and the one-runtime compatibility architecture. The Q1–Q4 decisions are: CLI-only `agro update`, state-only `~/.agro`, sandbox-only setup, and GitHub login before optional agent prompts. Phase 0 contract: [`docs/agro-compatibility.md`](../agro-compatibility.md). |
| [#733](https://github.com/mifunedev/agro/issues/733) | Draft | Brain/hands boundary. The [Phase-0 decisions](rfc-brain-hands-boundary.md) sit behind the `ExecutionTarget` seam. The decisions cover the brain/hands split, the eval capability rule, and the identical-path workspace stance. The decisions also cover the four-class state taxonomy (with the Hermes known-violation) and synchronous `attach()` in `contractVersion: 1`. The record is the sole authority for those decisions — cite the record, do not restate the decisions. Epic [#731](https://github.com/mifunedev/agro/issues/731). |
| [#989](https://github.com/mifunedev/agro/issues/989) | Accepted | The advisor-first execution default. The active session is the advisor of every `/spec execute` build. The advisor assigns tracked implementation edits to bounded `/delegate` workers. A direct owner edit requires a recorded operator exception. Supersedes the direct-implementation / optional-worker default of [#929](https://github.com/mifunedev/agro/issues/929). Preserves the role-as-skill, single-runtime, bounded-subagent, and no-project-agent decisions of #929. Keeps the [#928](https://github.com/mifunedev/agro/issues/928) retirement of automated persistent handoff. The same session continues by default. A transfer occurs only on operator request. |
| [#1133](https://github.com/mifunedev/agro/issues/1133) | Accepted | Langfuse configuration is declarative in `agro.json`, and the sandbox applies the configuration. Splits the settings by secrecy. The tracked `agro.json` `langfuse` section holds the non-secret `enabled`, `baseUrl`, `environment` and `userId` settings. The `.env` file holds the credentials. Every shell, systemd and per-harness file becomes a derived artifact. `agro langfuse apply` re-renders each derived artifact, and `status` checks each derived artifact for drift. Compose `environment:` is not an option, because every consumer is an in-sandbox harness. For that reason, `compose-env-boundary.sh` admits no `LANGFUSE_*` key. `RETIRED_KEYS` continues to refuse `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET`. Reverses the removals of [#1127](https://github.com/mifunedev/agro/issues/1127) and [#1129](https://github.com/mifunedev/agro/issues/1129). |

## Decision records

| Record | Decision |
|---|---|
| [ADR-0001: #532 standards scope](adr-0001-standards-scope.md) | The lightweight RFC / ADR convention meets the current needs of the project. The heavier taxonomy, registries, lifecycle, and conformance machinery stay deferred until a concrete future need appears. |

## Deferred scope

This index keeps a full IETF-style standards body **out of scope**. That
standards body includes these parts:

- the `OH-RFC` / `STD` / `BCP` / `EXP` / `INF` / `ADR` document taxonomy
- formal registries
- an IANA-style allocation authority
- conformance profiles
- a multi-stage lifecycle

[ADR-0001](adr-0001-standards-scope.md) resolves #532 with the lightweight
convention above. ADR-0001 keeps the heavier machinery deferred until a concrete
future issue needs the machinery.
