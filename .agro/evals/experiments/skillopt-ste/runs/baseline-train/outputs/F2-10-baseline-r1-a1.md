---
name: builder
description: |
  Author and refine reference skills, task-style command skills, and path-scoped
  rules through one repository-grounded workflow. TRIGGER when: asked to create,
  build, scaffold, convert, review, or update a skill, command, workflow, rule,
  coding standard, or contextual instruction. A skill is the canonical primitive
  for a reusable role, procedure, or body of judgment. No project-agent artifact
  type exists.
argument-hint: "skill|command|rule <name-or-request>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Builder

Build one artifact through the matching type reference. Run inline and inherit the
session model. Do not fork the session. Do not override the model. If the artifact
under authoring has an independently justified need for a fork or for a different
model, fork the session or override the model for that artifact only.

Arguments received: `$ARGUMENTS`

## Dispatch

1. Treat the first whitespace-delimited argument as `TYPE`. Treat the remainder as
   the artifact name, the request, or the path.
2. Accept exactly these types:

   | Type | Read and follow |
   |------|-----------------|
   | `skill` | `references/skill.md` |
   | `command` | `references/command.md` |
   | `rule` | `references/rule.md` |

3. If `TYPE` is missing or unknown, print the following usage line and stop. If
   the remainder is empty or holds only whitespace, print the same usage line and
   stop. In both cases, read no type reference and modify no file.

   ```text
   Usage: /builder <skill|command|rule> <name-or-request>
   ```

   `agent` is not an artifact type. Author a reusable role, procedure, or
   specialist judgment as a skill. A bounded isolated worker context is an
   execution choice that `/delegate` makes. That context is not a repository
   artifact.

4. Read the selected reference to the end. Then execute the protocol of that
   reference against the remainder of `$ARGUMENTS`. The selected reference is
   the authority for artifact shape and for type-specific validation.

## Shared protocol

For every valid type, apply these steps before the type-specific steps of the
selected reference.

### 1. Discover local authority

- Find and read each applicable `AGENTS.md` file, from the repository root down
  to the target directory. If two instructions conflict, the instruction closer
  to the target directory wins.
- Identify the source-of-truth artifact directory. In AGRO and in equipped
  projects, edit `.agro/skills/`. The provider directories `.claude/`,
  `.codex/`, and `.pi/` hold generated files or symlinks that expose the
  canonical primitives. Do not edit the provider directories.
- Outside an AGRO layout, follow the canonical path that the target project
  documents. Do not create `.agro/` speculatively.
- Inspect two or three nearby artifacts of the same type. Reuse their naming,
  frontmatter, structure, tone, and validation conventions.
- Search for an existing artifact with the same purpose. If one exists, prefer a
  focused update or an explicit consolidation over a near-duplicate.
- Before you propose a change, consult the compiled harness patterns. Run
  `/wiki query <artifact-name-or-subsystem> --patterns` and read the result.
  Each page records a failure mode, the root cause, and a workaround that this
  harness already paid for. Cite each motivating `[[pattern-...]]` slug in the
  report.
- Read `.agro/evals/decisions/skill-impact.md` for prior proposals against the
  same target. Do not re-propose a change that the ledger records as `REJECTED`.
  The one exception is new evidence that contradicts the recorded validation. In
  that case, cite the prior record id.

### 2. Define the contract

Before you edit, state these items internally:

- the one-sentence purpose of the artifact and its concrete triggers;
- the actor who invokes or consumes the artifact;
- the scope, the exclusions, and the completion criteria;
- the minimum tools, context, side effects, and supporting resources that the
  artifact requires;
- the repository-specific behavior that you must ground in inspected files.

Ask a question only in two cases: an unresolved ambiguity changes the artifact
in substance, or an unresolved ambiguity creates an unsafe side effect. In every
other case, use the request and the repository evidence.

### 3. Author narrowly

- Use lowercase kebab-case names. Write one artifact per coherent concern.
- Put matching and trigger information in the frontmatter, not only in the body.
- Use imperative, operational language. Remove generic expertise prose that
  changes no behavior.
- Choose the least privilege and the smallest context footprint that complete
  the job.
- Verify each local path and each command before you cite it.
- Do not modify unrelated files, generated provider mirrors, or user work in the
  working tree.

### 4. Validate and report

- Validate the frontmatter delimiters and the required fields. Do not depend on
  an optional YAML library.
- Check every referenced path, invocation, tool, and supporting file.
- Enforce the size, safety, and semantic checks of the selected reference.
- If `.agro/scripts/link-providers.sh` exists and you changed a canonical
  `.agro/` primitive, run `bash .agro/scripts/link-providers.sh --check`.
- If you work inside a Git worktree, run `git diff --check`.
- Report these items: the files that you created, updated, or removed; the
  resulting invocation or loading behavior; the key design choices; and the
  validation evidence. Never claim that a check ran when the check did not run.
- When a skill edit lands, append a `PROPOSED` record to
  `.agro/evals/decisions/skill-impact.md`. The record holds the next `SI-nnnn`
  id, the one-sentence proposal, the single target artifact, the motivating
  pattern slugs, and the unified diff scoped to that target path. The value
  `motivating patterns: none (direct request)` is legitimate. Record that value
  rather than invent a pattern to cite.
- Stage the ledger with a plain `git add`. Git tracks `.agro/evals/decisions/`.
  Report the allocated id.
- Never edit an existing record.
