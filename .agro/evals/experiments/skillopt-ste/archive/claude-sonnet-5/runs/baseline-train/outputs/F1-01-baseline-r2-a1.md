# ADR-0001: #532 standards scope

Status: Accepted

Date: 2026-07-03

Related: [#532](https://github.com/mifunedev/agro/issues/532)

## Decision

AGRO keeps the lightweight `RFC:` / `ADR:` GitHub issue convention as its
standards process. AGRO defers the broader standards body that #532 proposed:
a document-type taxonomy, formal registries, an IANA-style allocation
authority, conformance profiles, and a multi-stage lifecycle. This decision
does not build those five items.

A future need can justify a heavier process. The proposer must open a new
`RFC:` or `ADR:` issue with concrete evidence before AGRO builds that
process. Until an operator opens that issue, the `RFC:` / `ADR:` convention
stays the standards process.

## Context

Issue #532 proposed a broad standards model for AGRO. After #532, AGRO shipped
four pieces: the vocabulary, the `.agro/` layout, the security considerations,
and the lightweight RFC / ADR index. The RFC / ADR index records the
deliberately deferred heavy scope in its
[Deferred scope](README.md#deferred-scope) section.

This decision closes #532 at the scope that #532's own evidence supports. The
decision records what AGRO already shipped. The decision adds only the
descriptive pieces that the [RFC / ADR index](README.md) references. The
decision does not turn AGRO into a standards organization before an operator
files a concrete need.

## #532 acceptance-criteria disposition

| # | #532 acceptance criterion | Disposition | Rationale |
|---|---|---|---|
| 1 | A standards process document exists for `OH-RFC` / `OH-STD` style proposals. | SHIPPED | The [RFC / ADR index](README.md) shipped a lighter `RFC:` / `ADR:` issue convention (#567/#569); the `OH-STD` taxonomy is part of the [deferred scope](README.md#deferred-scope). |
| 2 | A terminology document defines the core AGRO vocabulary. | SHIPPED | [Glossary](../glossary.md) shipped the descriptive vocabulary (#565). |
| 3 | AGRO documents a proposed `.oh` directory layout. | SHIPPED | [`.agro/` directory layout](../agro-directory-layout.md) shipped the descriptive map (#566). |
| 4 | AGRO documents a proposed `.agro/harness.yml` manifest with an example. | DONE-HERE | This task resolves the criterion with a descriptive example only. The example illustrates the current shape rather than a required schema, a registry-backed format, or a conformance target. |
| 5 | Agent profile, loop definition, policy model, trace event, and tool invocation envelope examples exist. | DEFERRED | These examples need a normalized spec. Per [Deferred scope](README.md#deferred-scope), AGRO needs a concrete future interoperability issue to define that spec before these examples become formal or schema-backed. |
| 6 | AGRO drafts a first-pass capability registry. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) explicitly defers formal registries and an IANA-style allocation authority. |
| 7 | A security considerations document exists. | SHIPPED | [Security considerations](../security-considerations.md) shipped the current enforced and recommended boundaries (#568). |
| 8 | AGRO defines `OH-Core` and `OH-Dev` compatibility profiles. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) explicitly defers conformance profiles. |
| 9 | The docs clearly separate model, agent CLI, harness, loop, policy, and trace layers. | DONE-HERE | This task resolves the separation as plain vocabulary and cross-references, not as a conformance profile. |

## Consequences

- The lightweight process remains: proposals live as `RFC:` / `ADR:` GitHub
  issues; AGRO indexes each notable proposal in the
  [RFC / ADR index](README.md).
- The current docs stay descriptive. They explain what AGRO does today;
  they do not create a standards authority.
- AGRO does not build deferred standards machinery to close #532. If a future
  operator needs registries, schemas, profiles, or trace protocols, that
  operator must propose and scope the need in a new issue.
