# ADR-0001: #532 standards scope

Status: Accepted

Date: 2026-07-03

Related: [#532](https://github.com/mifunedev/agro/issues/532)

## Decision

AGRO keeps the lightweight `RFC:` / `ADR:` GitHub issue convention as its
standards process. AGRO defers the broader standards body that #532 proposed.
This decision builds none of these parts of that body:

- a document-type taxonomy
- formal registries
- an IANA-style allocation authority
- conformance profiles
- a multi-stage lifecycle

A future need can justify a heavier process. Each such need must start as a new
proposed issue with concrete evidence. Until such an issue exists, the `RFC:` /
`ADR:` convention stays the only standards process.

## Context

Issue #532 proposed a broad standards model for AGRO. After #532, the repository
shipped the parts that readers use today:

- the vocabulary
- the `.agro/` layout
- the security considerations
- the lightweight RFC / ADR index

The index records the deferred heavy scope in its
[Deferred scope](README.md#deferred-scope) section.

This decision closes #532 without the deferred scope. This decision records
each shipped part. This decision adds only the small descriptive parts that
readers still need. AGRO does not become a standards organization until a
concrete need exists.

## #532 acceptance-criteria disposition

| # | #532 acceptance criterion | Disposition | Rationale |
|---|---|---|---|
| 1 | A standards process document exists for `OH-RFC` / `OH-STD` style proposals. | SHIPPED | The [RFC / ADR index](README.md) shipped a lighter `RFC:` / `ADR:` issue convention (#567/#569). The `OH-STD` taxonomy belongs to the [deferred scope](README.md#deferred-scope). |
| 2 | A terminology document defines the core AGRO vocabulary. | SHIPPED | The [Glossary](../glossary.md) shipped the descriptive vocabulary (#565). |
| 3 | A document describes a proposed `.oh` directory layout. | SHIPPED | The [`.agro/` directory layout](../agro-directory-layout.md) shipped the descriptive map (#566). |
| 4 | A document describes a proposed `.agro/harness.yml` manifest and gives an example. | DONE-HERE | This ADR resolves the criterion with a descriptive example only. The example illustrates the current shape. The example does not act as a required schema, a registry-backed format, or a conformance target. |
| 5 | Agent profile, loop definition, policy model, trace event, and tool invocation envelope examples exist. | DEFERRED | These five examples count as normalized spec surfaces. [Deferred scope](README.md#deferred-scope) requires a concrete future interoperability issue before any of these examples becomes a formal example or a schema. |
| 6 | A draft of a first-pass capability registry exists. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) defers formal registries and an IANA-style allocation authority. |
| 7 | A security considerations document exists. | SHIPPED | [Security considerations](../security-considerations.md) shipped the current enforced boundaries and the current recommended boundaries (#568). |
| 8 | A document defines `OH-Core` and `OH-Dev` compatibility profiles. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) defers conformance profiles. |
| 9 | The docs clearly separate model, agent CLI, harness, loop, policy, and trace layers. | DONE-HERE | This ADR resolves the layer separation with plain vocabulary and cross-references. This ADR defines no conformance profile. |

## Consequences

- The lightweight process stays. Each proposal lives as an `RFC:` / `ADR:`
  GitHub issue. When a proposal meets <index criterion>, <actor> adds the
  proposal to the index.
- The current docs stay descriptive. The docs explain what AGRO does today. The
  docs create no standards authority.
- The #532 closure builds no deferred standards machinery. If a future operator
  needs registries, schemas, profiles, or trace protocols, the operator must
  propose and scope the need in a new issue.
