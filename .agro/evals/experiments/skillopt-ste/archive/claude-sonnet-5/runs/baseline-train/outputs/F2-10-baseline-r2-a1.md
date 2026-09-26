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

Build one artifact through the matching type reference. Run the builder inline.
Inherit the session model. Do not fork or override the model. Override the model
only when the artifact you are building has an independently justified need for a
different model.

Arguments received: `$ARGUMENTS`

## Dispatch

1. Treat the first whitespace-delimited argument as `TYPE`. Treat the remainder of
   `$ARGUMENTS` as the artifact name, request, or path.
2. Accept exactly these types:

   | Type | Read and follow |
   |------|-----------------|
   | `skill` | `references/skill.md` |
   | `command` | `references/command.md` |
   | `rule` | `references/rule.md` |

3. When `TYPE` is missing or unknown, or when the remaining request is empty or
   only whitespace, print the following text, then stop. Do not read a type
   reference. Do not modify a file.

   ```text
   Usage: /builder <skill|command|rule> <name-or-request>
   ```

   `agent` is not an artifact type. Author a reusable role, procedure, or
   specialist judgment as a skill. A bounded isolated worker context is an
   execution choice that `/delegate` makes, not a repository artifact.

4. Read the selected reference completely. Then execute the reference's protocol
   against the remainder of `$ARGUMENTS`. The selected reference is authoritative
   for artifact shape and type-specific validation.

## Shared protocol

Apply these steps for every valid type. Apply them before the selected reference's
type-specific steps.

### 1. Discover local authority

- Find and read applicable `AGENTS.md` files from the repository root through the
  target directory. When two instructions conflict, the more local instruction
  wins.
- Identify the source-of-truth artifact directory. In AGRO and equipped
  projects, edit `.agro/skills/`. The link-providers script generates or
  symlinks provider directories such as `.claude/`, `.codex/`, and `.pi/` as
  exposure surfaces; do not edit them directly.
- Outside an AGRO layout, follow the target project's documented canonical
  path. Do not create `.agro/` speculatively.
- Inspect two or three nearby artifacts of the same type. Reuse their naming,
  frontmatter, structure, tone, and validation conventions.
- Search for an existing artifact with the same purpose. Prefer a focused update or
  an explicit consolidation over a near-duplicate.
- Before you propose a change, run `/wiki query <artifact-name-or-subsystem>
  --patterns` and read the compiled harness patterns it returns. Each page records
  a failure mode, the failure's root cause, and a workaround this harness already
  paid for. Cite the motivating `[[pattern-...]]` slugs in the report.
- Read `.agro/evals/decisions/skill-impact.md` for prior proposals against the same
  target. Do not re-propose a change recorded there as `REJECTED`. When new
  evidence contradicts the recorded validation, you may re-propose the change;
  cite the prior record id.

### 2. Define the contract

Before editing, state internally:

- the artifact's one-sentence purpose and concrete triggers;
- who invokes or consumes it;
- what is in scope, out of scope, and considered done;
- the minimum tools, context, side effects, and supporting resources required;
- which behavior is repository-specific and must be grounded in inspected files.

When unresolved ambiguity would materially change the artifact or create unsafe
side effects, ask a question. Otherwise, use the request and the repository
evidence.

### 3. Author narrowly

- Use lowercase kebab-case names.
- Author one artifact per coherent concern.
- Put matching and trigger information in frontmatter, not only in the body.
- Use imperative, operational language. Remove generic expertise prose that does
  not change behavior.
- Prefer the least privilege and the smallest context footprint that completes
  the job.
- Verify each local path and command before you cite it.
- Do not modify an unrelated file, a generated provider mirror, or the user's
  work in the working tree.

### 4. Validate and report

- Validate the frontmatter delimiters and required fields. Do not assume the
  environment provides an optional YAML library.
- Check every referenced path, invocation, tool, and supporting file.
- Enforce the selected reference's size, safety, and semantic checks.
- When `.agro/scripts/link-providers.sh` exists and the change touched a
  canonical `.agro/` primitive, run `bash .agro/scripts/link-providers.sh
  --check`.
- When you work inside a Git worktree, run `git diff --check`.
- Report the files you created, updated, or removed. Report the resulting
  invocation or loading behavior, the key design choices, and the validation
  evidence. Never claim that a check ran when the check did not run.
- When a skill edit lands, append a `PROPOSED` record to
  `.agro/evals/decisions/skill-impact.md`: the next `SI-nnnn` id, the
  one-sentence proposal, the single target artifact, the motivating pattern
  slugs, and the unified diff scoped to that target path.
  `motivating patterns: none (direct request)` is a legitimate value. Record
  that value rather than inventing a pattern to cite.
- Stage the ledger with a plain `git add` (`.agro/evals/decisions/` is tracked).
  Report the allocated id. Never edit an existing record.
