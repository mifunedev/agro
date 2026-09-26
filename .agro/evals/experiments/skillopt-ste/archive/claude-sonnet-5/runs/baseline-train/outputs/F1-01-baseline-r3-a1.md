# ADR-0001: #532 standards scope

Status: Accepted

Date: 2026-07-03

Related: [#532](https://github.com/mifunedev/agro/issues/532)

## Decision

AGRO keeps the lightweight `RFC:` / `ADR:` GitHub issue convention as the
standards process. This decision defers the broader standards body that #532
proposed: document-type taxonomy, formal registries, an IANA-style allocation
authority, conformance profiles, and a multi-stage lifecycle. AGRO does not
build these here.

If a future need justifies heavier process, the operator must open a new
issue with concrete evidence. Until an operator opens that issue, AGRO keeps
the existing convention.

## Context

Issue #532 proposed a broad standards model for AGRO. Since #532, the repo
has shipped four pieces: a vocabulary document, the `.agro/` layout document,
a security-considerations document, and the lightweight RFC / ADR index. The
index already records the deferred heavy scope in its
[Deferred scope](README.md#deferred-scope) section.

This decision closes #532. This decision records what shipped, adds only the
small descriptive pieces useful to readers, and avoids building a standards
organization until a concrete need exists.

## #532 acceptance-criteria disposition

| # | #532 acceptance criterion | Disposition | Rationale |
|---|---|---|---|
| 1 | Issue #532 asks for a standards process document for `OH-RFC` / `OH-STD` style proposals. | SHIPPED | The [RFC / ADR index](README.md) shipped a lighter `RFC:` / `ADR:` issue convention (#567/#569); the [Deferred scope](README.md#deferred-scope) section lists the `OH-STD` taxonomy. |
| 2 | Issue #532 asks for a terminology document that defines the core AGRO vocabulary. | SHIPPED | The [Glossary](../glossary.md) shipped the descriptive vocabulary (#565). |
| 3 | Issue #532 asks for a proposed `.oh` directory layout document. | SHIPPED | The [`.agro/` directory layout](../agro-directory-layout.md) document shipped the descriptive map (#566). |
| 4 | Issue #532 asks for a proposed `.agro/harness.yml` manifest with an example. | DONE-HERE | This task resolves the manifest as a descriptive example, not a required schema. The manifest is not a registry-backed format or a conformance target. |
| 5 | Issue #532 asks for agent-profile, loop-definition, policy-model, trace-event, and tool-invocation-envelope examples. | DEFERRED | These examples target a normalized spec surface. Before these examples become formal examples or schemas, the [Deferred scope](README.md#deferred-scope) section requires a concrete future interoperability issue. |
| 6 | Issue #532 asks for a first-pass capability-registry draft. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) explicitly defers formal registries and an IANA-style allocation authority. |
| 7 | Issue #532 asks for a security-considerations document. | SHIPPED | The [Security considerations](../security-considerations.md) document shipped the current enforced and recommended boundaries (#568). |
| 8 | Issue #532 asks for `OH-Core` and `OH-Dev` compatibility profiles. | DEFERRED | The [RFC / ADR index](README.md#deferred-scope) explicitly defers conformance profiles. |
| 9 | Issue #532 asks the docs to separate the model, agent-CLI, harness, loop, policy, and trace layers. | DONE-HERE | This task resolves the separation as plain vocabulary and cross-references, not as a conformance profile. |

## Consequences

- The lightweight process stays: proposals live as `RFC:` / `ADR:` GitHub
  issues, and the AGRO maintainers index each notable issue.
- The current docs stay descriptive. The docs explain what AGRO does today;
  the docs do not create a standards authority.
- The #532 closure does not add deferred standards machinery. If a future operator needs registries, schemas, profiles, or trace protocols, the operator must propose and scope that need in a new issue.
