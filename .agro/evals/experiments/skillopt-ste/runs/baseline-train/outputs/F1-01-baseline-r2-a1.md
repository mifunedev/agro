# ADR-0001: #532 standards scope

Status: Accepted

Date: 2026-07-03

Related: [#532](https://github.com/mifunedev/agro/issues/532)

## Decision

AGRO keeps the lightweight `RFC:` / `ADR:` GitHub issue convention as the
standards process. AGRO defers the broader standards body that #532 proposed.
This ADR does not build the following parts of that body:

- a document-type taxonomy
- formal registries
- an IANA-style allocation authority
- conformance profiles
- a multi-stage lifecycle

A future need can justify a heavier process. Each such need starts as a new
proposed issue with concrete evidence. Until an issue of that kind exists, the
existing convention stays the standards process.

## Context

Issue #532 proposed a broad standards model for AGRO. After #532, the
repository shipped the parts that readers use today:

- the vocabulary
- the `.agro/` layout
- the security considerations
- the lightweight RFC / ADR index

The [Deferred scope](README.md#deferred-scope) section of the index already
records the heavy scope that AGRO deferred on purpose.

This decision closes #532 in proportion to the current need. The decision takes
three actions:

1. The decision records what shipped.
2. The decision adds only the small descriptive parts that still help readers.
3. The decision keeps the harness from becoming a standards organization before
   a concrete need exists.

## #532 acceptance-criteria disposition

| # | #532 acceptance criterion | Disposition | Rationale |
|---|---|---|---|
| 1 | A standards process document exists for `OH-RFC` / `OH-STD` style proposals. | SHIPPED | The [RFC / ADR index](README.md) shipped a lighter `RFC:` / `ADR:` issue convention (#567/#569). The `OH-STD` taxonomy is part of the [deferred scope](README.md#deferred-scope). |
| 2 | A terminology document defines the core AGRO vocabulary. | SHIPPED | The [Glossary](../glossary.md) shipped the descriptive vocabulary (#565). |
| 3 | A document describes a proposed `.oh` directory layout. | SHIPPED | The [`.agro/` directory layout](../agro-directory-layout.md) shipped the descriptive map (#566). |
| 4 | A document describes a proposed `.agro/harness.yml` manifest and gives an example. | DONE-HERE | This task resolves criterion 4 with a descriptive example only. The example shows the current shape. The example is not a required schema, a registry-backed format, or a conformance target. |
| 5 | Examples exist for the agent profile, the loop definition, the policy model, the trace event, and the envelope for a tool invocation. | DEFERRED | The five examples define normalized spec surfaces. The [Deferred scope](README.md#deferred-scope) section requires a concrete future interoperability issue before any of the five becomes a formal example or a schema. |
| 6 | A first-pass capability registry draft exists. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) defers formal registries and an IANA-style allocation authority. |
| 7 | A security considerations document exists. | SHIPPED | [Security considerations](../security-considerations.md) shipped the current enforced and recommended boundaries (#568). |
| 8 | Definitions exist for the `OH-Core` and `OH-Dev` compatibility profiles. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) defers conformance profiles. |
| 9 | The docs separate the model, agent CLI, harness, loop, policy, and trace layers. | DONE-HERE | This task resolves the separation with plain vocabulary and cross-references, not with a conformance profile. |

## Consequences

- The lightweight process stays in place. Each proposal lives as an `RFC:` or
  `ADR:` GitHub issue.
- <actor> adds a proposal to the RFC / ADR index when the proposal meets
  <indexing criterion>.
- The current docs stay descriptive. The current docs state what AGRO does
  today. The current docs create no standards authority.
- The closure of #532 must not build the deferred standards machinery.
- If a future operator needs registries, schemas, profiles, or trace protocols,
  the operator proposes and scopes the need in a new issue.
