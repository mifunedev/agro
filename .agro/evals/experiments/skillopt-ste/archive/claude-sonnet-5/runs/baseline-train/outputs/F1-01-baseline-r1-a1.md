# ADR-0001: #532 standards scope

Status: Accepted

Date: 2026-07-03

Related: [#532](https://github.com/mifunedev/agro/issues/532)

## Decision

AGRO keeps the lightweight `RFC:` / `ADR:` GitHub issue convention as its
standards process. AGRO will not build the deferred standards scope that #532
proposed. That scope holds a document-type taxonomy, formal registries, an
IANA-style allocation authority, conformance profiles, and a multi-stage
lifecycle.

A future operator can justify the deferred standards scope. That operator
must open a new proposed issue with concrete evidence first. Until an
operator opens that issue, the current `RFC:` / `ADR:` convention stays the
standards process.

## Context

Issue #532 proposed a broad standards model for AGRO. After issue #532, the
repository shipped four items: the vocabulary, the `.agro/` layout, the
security considerations, and the lightweight RFC / ADR index. The RFC / ADR
index already records the deferred standards scope in its
[Deferred scope](README.md#deferred-scope) section.

This decision closes #532 against the disposition table below. The decision
records what AGRO shipped. The decision adds only the descriptive pieces that
readers still need. The decision keeps AGRO's harness from becoming a
standards organization until an operator proposes a concrete need in a new
issue.

## #532 acceptance-criteria disposition

| # | #532 acceptance criterion | Disposition | Rationale |
|---|---|---|---|
| 1 | A standards process document exists for `OH-RFC` / `OH-STD` style proposals. | SHIPPED | The [RFC / ADR index](README.md) shipped a lighter `RFC:` / `ADR:` issue convention (#567/#569). The `OH-STD` taxonomy stays in the [deferred scope](README.md#deferred-scope). |
| 2 | A terminology document defines the core AGRO vocabulary. | SHIPPED | [Glossary](../glossary.md) shipped the descriptive vocabulary (#565). |
| 3 | Documentation covers a proposed `.oh` directory layout. | SHIPPED | [`.agro/` directory layout](../agro-directory-layout.md) shipped the descriptive map (#566). |
| 4 | Documentation covers a proposed `.agro/harness.yml` manifest with an example. | DONE-HERE | This task resolves the criterion as a descriptive example only. The example illustrates the current shape. The example sets no required schema, registry-backed format, or conformance target. |
| 5 | Agent profile, loop definition, policy model, trace event, and tool invocation envelope examples exist. | DEFERRED | These examples belong to the normalized spec surface. Per [Deferred scope](README.md#deferred-scope), these examples need a concrete future interoperability issue before AGRO builds them as formal examples or schemas. |
| 6 | A first-pass capability registry draft exists. | DEFERRED | Formal registries and an IANA-style allocation authority stay in the deferred scope. See the [RFC / ADR index](README.md#deferred-scope). |
| 7 | A security considerations document exists. | SHIPPED | [Security considerations](../security-considerations.md) shipped the current enforced and recommended boundaries (#568). |
| 8 | Definitions cover `OH-Core` and `OH-Dev` compatibility profiles. | DEFERRED | Conformance profiles stay in the deferred scope. See the [RFC / ADR index](README.md#deferred-scope). |
| 9 | The docs clearly separate model, agent CLI, harness, loop, policy, and trace layers. | DONE-HERE | This task resolves the separation as plain vocabulary and cross-references, not as a conformance profile. |

## Consequences

- The lightweight process remains. Proposals live as `RFC:` / `ADR:` GitHub
  issues. The RFC / ADR index indexes each notable proposal.
- The current docs stay descriptive. The docs explain what AGRO does today.
  The docs create no standards authority.
- No one may build deferred standards machinery as part of #532 closure. If a
  future operator needs registries, schemas, profiles, or trace protocols,
  that operator must propose and scope the need in a new issue.
