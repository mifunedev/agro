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
session model. Fork or override the model only when the target artifact has an
independently justified need.

Arguments received: `$ARGUMENTS`

## Dispatch

1. Treat the first whitespace-delimited argument as `TYPE`. Treat the remainder as
   the artifact name, request, or path.
2. Accept exactly these types:

   | Type | Read and follow |
   |------|-----------------|
   | `skill` | `references/skill.md` |
   | `command` | `references/command.md` |
   | `rule` | `references/rule.md` |

3. If `TYPE` is missing or unknown, print the following usage line and stop. If the
   remaining request is empty or holds only whitespace, print the same usage line
   and stop. In both cases, read no type reference and modify no file.

   ```text
   Usage: /builder <skill|command|rule> <name-or-request>
   ```

   `agent` is not an artifact type. Author a reusable role, procedure, or
   specialist judgment as a skill. A bounded isolated worker context is an
   execution choice that `/delegate` makes. That context is not a repository
   artifact.

4. Read the selected reference to the end. Then execute the protocol of that
   reference against the remainder of `$ARGUMENTS`. The selected reference is the
   authority for artifact shape and for type-specific validation.

## Shared protocol

For every valid type, apply these steps before the type-specific steps of the
selected reference.

### 1. Discover local authority

- Find and read each applicable `AGENTS.md` file, from the repository root down
  to the target directory. When two files conflict, the file closer to the target
  path wins.
- Identify the source-of-truth artifact directory. In AGRO and equipped projects,
  edit `.agro/skills/`. The link tooling generates or symlinks the provider
  directories `.claude/`, `.codex/`, and `.pi/`. Never edit those directories.
- Outside an AGRO layout, follow the canonical path that the target project
  documents. Do not create `.agro/` speculatively.
- Inspect two or three nearby artifacts of the same type. Reuse their naming,
  frontmatter, structure, tone, and validation conventions.
- Search for an existing artifact with the same purpose. Prefer a focused update or
  an explicit consolidation over a near-duplicate.
- Before you propose a change, consult the compiled harness patterns. Run
  `/wiki query <artifact-name-or-subsystem> --patterns` and read the result. Each
  page records a failure mode, the root cause, and a workaround that this harness
  already paid for. Cite the motivating `[[pattern-...]]` slugs in the report.
- Read `.agro/evals/decisions/skill-impact.md` for earlier proposals against the
  same target. A record marked `REJECTED` blocks the same proposal. Re-propose
  that change only when new evidence contradicts the recorded validation. In that
  case, cite the earlier record id.

### 2. Define the contract

Before you edit, state these items internally:

- the one-sentence purpose of the artifact and its concrete triggers;
- the actor that invokes or consumes the artifact;
- the scope, the exclusions, and the done condition;
- the minimum tools, context, side effects, and supporting resources that the job
  requires;
- the repository-specific behavior that you must ground in inspected files.

Ask a question only in two cases: an unresolved ambiguity changes the shape or
behavior of the artifact, or an unresolved ambiguity creates an unsafe side
effect. In every other case, use the request and the repository evidence.

### 3. Author narrowly

- Use lowercase kebab-case names. Write one artifact per coherent concern.
- Put the matching and trigger information in the frontmatter. The body alone is
  not enough.
- Use imperative, operational language. Remove generic expertise prose that
  changes no behavior.
- Choose the least privilege and the smallest context footprint that complete the
  job.
- Verify each local path and command before you cite the path or the command.
- Do not modify unrelated files, generated provider mirrors, or user work in the
  working tree.

### 4. Validate and report

- Validate the frontmatter delimiters and the required fields. Do not depend on an
  optional YAML library.
- Check every referenced path, invocation, tool, and supporting file.
- Enforce the size, safety, and semantic checks of the selected reference.
- If `.agro/scripts/link-providers.sh` exists and you changed a canonical `.agro/`
  primitive, run `bash .agro/scripts/link-providers.sh --check`.
- Inside a Git worktree, run `git diff --check`.
- Report the files that you created, updated, or removed. Report the resulting
  invocation or loading behavior, the key design choices, and the validation
  evidence. Never report a skipped check as run.
- When you edit a skill, append a `PROPOSED` record to
  `.agro/evals/decisions/skill-impact.md`. The record holds five items:
  1. the next `SI-nnnn` id;
  2. the one-sentence proposal;
  3. the single target artifact;
  4. the motivating pattern slugs;
  5. the unified diff, limited to the target path.
- If no pattern motivated the edit, record
  `motivating patterns: none (direct request)`. Do not invent a pattern to cite.
- Stage the ledger with a plain `git add`. Git tracks `.agro/evals/decisions/`.
- Report the allocated id.
- Never edit an existing record.
