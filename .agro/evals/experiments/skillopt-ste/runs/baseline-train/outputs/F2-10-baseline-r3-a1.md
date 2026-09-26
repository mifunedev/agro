---
name: builder
description: |
  Author and refine reference skills, task-style command skills, and path-scoped
  rules using one repository-grounded workflow. TRIGGER when: asked to create,
  build, scaffold, convert, review, or update a skill, command, workflow, rule,
  coding standard, or contextual instruction. Skills are the canonical primitive
  for a reusable role, procedure, or body of judgment — there is no project-agent
  artifact type.
argument-hint: "skill|command|rule <name-or-request>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Builder

Create one artifact through the matching type reference. Run inline and use the
session model. Do not fork the session. Do not override the model. Break these two
rules only when the new artifact has an independently justified need for a fork or
for a different model.

Arguments received: `$ARGUMENTS`

## Dispatch

1. Read the first whitespace-delimited argument as `TYPE`. Read the rest of the
   arguments as the artifact name, the request, or the path.
2. Accept only these types:

   | Type | Read and obey |
   |------|-----------------|
   | `skill` | `references/skill.md` |
   | `command` | `references/command.md` |
   | `rule` | `references/rule.md` |

3. If `TYPE` is missing or unknown, print the usage line below and stop. If the
   rest of the request is empty or holds only whitespace, print the usage line
   below and stop. In both cases, read no type reference and change no file.

   ```text
   Usage: /builder <skill|command|rule> <name-or-request>
   ```

   `agent` is not an artifact type. Write a reusable role, procedure, or specialist
   judgment in the form of a skill. A bounded isolated worker context is not a
   repository artifact. `/delegate` makes that execution choice.

4. Read the selected reference to the end.
5. Run the protocol of the selected reference against the rest of `$ARGUMENTS`.
   The selected reference owns the artifact shape and the type-specific validation.

## Shared protocol

For every valid type, do these steps before the type-specific steps of the selected
reference.

### 1. Discover local authority

- Find each applicable `AGENTS.md` file from the repository root down to the target
  directory. Read each file. When two files conflict, the file nearer the target
  wins.
- Identify the source-of-truth artifact directory. In AGRO and equipped projects,
  edit `.agro/skills/`. Provider directories such as `.claude/`, `.codex/`, and
  `.pi/` hold only generated files or symlinks. Do not edit those directories.
- Outside an AGRO layout, use the canonical path that the target project documents.
  Do not create `.agro/` without a documented reason.
- Inspect two or three nearby artifacts of the same type. Reuse the naming,
  frontmatter, structure, tone, and validation conventions of those artifacts.
- Search for an existing artifact with the same purpose. If one exists, make a
  focused update or an explicit consolidation. Do not add a near-duplicate.
- Before you propose a change, read the compiled harness patterns. Run
  `/wiki query <artifact-name-or-subsystem> --patterns`. Read each returned page.
  Each page records one failure mode, its root cause, and one workaround that this
  harness already paid for. Cite each motivating `[[pattern-...]]` slug in the
  report.
- Read `.agro/evals/decisions/skill-impact.md` for earlier proposals against the
  same target. If a record there marks a change `REJECTED`, do not propose that
  change again. Break this rule only when new evidence contradicts the recorded
  validation. In that case, cite the id of the earlier record.

### 2. Define the contract

Before you edit, decide each of these for yourself:

- the purpose of the artifact in one sentence, and the concrete triggers;
- the actor that invokes or consumes the artifact;
- the scope, the exclusions, and the definition of done;
- the minimum tools, context, side effects, and supporting resources;
- the repository-specific behavior that you must ground in inspected files.

Ask the operator a question only in two cases:

- an open ambiguity would change the artifact;
- an open ambiguity would cause an unsafe side effect.

In every other case, use the request and the repository evidence.

### 3. Author narrowly

- Use lowercase kebab-case names. Write one artifact for each coherent concern.
- Put the matching and trigger information in the frontmatter. The body alone is
  not enough.
- Use imperative, operational language. Remove generic expertise prose that does
  not change behavior.
- Choose the least privilege and the smallest context footprint that complete the
  job.
- Verify each local path and each command before you cite it.
- Do not change unrelated files, generated provider mirrors, or user work in the
  working tree.

### 4. Validate and report

- Validate the frontmatter delimiters and the required fields. Do not depend on
  optional YAML libraries.
- Verify every referenced path, invocation, tool, and supporting file.
- Enforce the size, safety, and semantic checks of the selected reference.
- If `.agro/scripts/link-providers.sh` exists and you changed canonical `.agro/`
  primitives, run `bash .agro/scripts/link-providers.sh --check`.
- Inside a Git worktree, run `git diff --check`.
- Report the files that you created, updated, or removed. Report the resulting
  invocation or loading behavior. Report the main design choices. Report the
  validation evidence. Report a validation step only when that step ran.
- When a skill edit lands, append a `PROPOSED` record to
  `.agro/evals/decisions/skill-impact.md`. The record holds five items:
  1. the next `SI-nnnn` id;
  2. the proposal in one sentence;
  3. the single target artifact;
  4. the motivating pattern slugs;
  5. the unified diff, limited to the target path.

  If no pattern motivated the edit, record `motivating patterns: none (direct request)`.
  Do not invent a pattern to cite. Git tracks `.agro/evals/decisions/`, so stage the
  ledger with a plain `git add`. Report the allocated id. Never edit an existing
  record.
