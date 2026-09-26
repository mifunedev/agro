# ADR-0001: #532 standards scope

Status: Accepted

Date: 2026-07-03

Related: [#532](https://github.com/mifunedev/agro/issues/532)

## Decision

AGRO keeps the lightweight `RFC:` / `ADR:` GitHub issue convention as its
standards process. AGRO defers the broader standards body that #532 proposed.
This ADR builds none of the following parts of that body:

- a document-type taxonomy
- formal registries
- an IANA-style allocation authority
- conformance profiles
- a multi-stage lifecycle

A future need can justify a heavier process. Each such need must start as a new
proposed issue with concrete evidence. Until such an issue exists, the current
convention stays the standards process.

## Context

Issue #532 proposed a broad standards model for AGRO. After #532, the
repository shipped four parts that readers use today:

- the vocabulary
- the `.agro/` layout
- the security considerations
- the lightweight RFC / ADR index

The [Deferred scope](README.md#deferred-scope) section of the index already
records the heavy scope that AGRO deferred on purpose.

This ADR closes #532 in proportion to the current need. This ADR records what
shipped. This ADR adds only the small descriptive parts that still help readers.
This ADR does not turn the harness into a standards organization before a
concrete need exists.

## #532 acceptance-criteria disposition

| # | #532 acceptance criterion | Disposition | Rationale |
|---|---|---|---|
| 1 | A standards process document exists for `OH-RFC` / `OH-STD` style proposals. | SHIPPED | The [RFC / ADR index](README.md) shipped a lighter `RFC:` / `ADR:` issue convention (#567/#569). The `OH-STD` taxonomy belongs to the [deferred scope](README.md#deferred-scope). |
| 2 | A terminology document defines the core AGRO vocabulary. | SHIPPED | The [Glossary](../glossary.md) shipped the descriptive vocabulary (#565). |
| 3 | A document describes a proposed `.oh` directory layout. | SHIPPED | The [`.agro/` directory layout](../agro-directory-layout.md) shipped the descriptive map (#566). |
| 4 | A document describes a proposed `.agro/harness.yml` manifest and gives an example. | DONE-HERE | This ADR resolves the criterion with a descriptive example at `<path of the harness.yml example>`. The example shows the current shape only. The example is not a required schema, a registry-backed format, or a conformance target. |
| 5 | Examples exist for an agent profile, a loop definition, a policy model, a trace event, and a tool invocation envelope. | DEFERRED | These five examples count as normalized spec surfaces. [Deferred scope](README.md#deferred-scope) requires a concrete future interoperability issue before these surfaces become formal examples or schemas. |
| 6 | A first-pass capability registry exists as a draft. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) defers formal registries and an IANA-style allocation authority. |
| 7 | A security considerations document exists. | SHIPPED | [Security considerations](../security-considerations.md) shipped the current enforced and recommended boundaries (#568). |
| 8 | Definitions exist for the `OH-Core` and `OH-Dev` compatibility profiles. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) defers conformance profiles. |
| 9 | The docs clearly separate model, agent CLI, harness, loop, policy, and trace layers. | DONE-HERE | This ADR resolves the separation at `<path of the layer-separation text>` as plain vocabulary and cross-references. The separation is not a conformance profile. |

## Consequences

- The lightweight process stays. Proposals live as `RFC:` / `ADR:` GitHub
  issues. If a proposal meets `<notability criterion>`, `<actor>` adds the
  proposal to the index.
- The current docs stay descriptive. The docs explain what AGRO does today. The
  docs do not create a standards authority.
- The #532 closure must not build the deferred standards machinery. If a future
  operator needs registries, schemas, profiles, or trace protocols, the
  operator proposes and scopes the need in a new issue.
