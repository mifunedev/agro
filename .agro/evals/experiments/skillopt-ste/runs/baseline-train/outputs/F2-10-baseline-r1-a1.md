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

Build one artifact by following the reference that matches the requested type.
Run the builder inline. Inherit the session model. When the artifact you are
authoring has a documented, independent need for a different model, fork or
override the model.

Arguments received: `$ARGUMENTS`

## Dispatch

1. Treat the first whitespace-delimited argument in `$ARGUMENTS` as `TYPE`. Treat
   the remaining text as the artifact name, request, or path.
2. Accept exactly these types:

   | Type | Read and follow |
   |------|-----------------|
   | `skill` | `references/skill.md` |
   | `command` | `references/command.md` |
   | `rule` | `references/rule.md` |

3. If `TYPE` is missing or unknown, or if the remaining request is empty or
   contains only whitespace, print the usage line below. Stop. Do not read a
   type reference. Do not modify a file.

   ```text
   Usage: /builder <skill|command|rule> <name-or-request>
   ```

   `agent` is not an artifact type. The builder authors a reusable role,
   procedure, or specialist judgment as a skill. A bounded, isolated worker
   context is an execution choice that `/delegate` makes, not a repository
   artifact.

4. Read the selected reference completely. Then execute its protocol against
   the remainder of `$ARGUMENTS`. The selected reference governs artifact
   shape and type-specific validation.

## Shared protocol

Apply these steps for every valid type. Apply them before the selected
reference's type-specific steps.

### 1. Discover local authority

- Find every applicable `AGENTS.md` file from the repository root through the
  target directory. Read each file. When two instructions conflict, follow the
  more local instruction.
- Identify the source-of-truth artifact directory. In an AGRO project or an
  equipped project, edit `.agro/skills/`. `.agro/scripts/link-providers.sh`
  generates or symlinks provider directories such as `.claude/`, `.codex/`,
  and `.pi/` from `.agro/`. Do not edit those directories directly.
- Outside an AGRO layout, follow the target project's documented canonical
  path. Do not create `.agro/` without a documented reason.
- Inspect two or three nearby artifacts of the same type. Reuse their naming,
  frontmatter, structure, tone, and validation conventions.
- Search for an existing artifact with the same purpose. Prefer a focused
  update or explicit consolidation over a near-duplicate.
- Consult compiled harness patterns before proposing a change. Run
  `/wiki query <artifact-name-or-subsystem> --patterns`. Read the returned
  pages. Each page records a failure mode, its root cause, and a workaround
  the harness already adopted. Cite the motivating `[[pattern-...]]` slugs in
  the report.
- Read `.agro/evals/decisions/skill-impact.md` for prior proposals against the
  same target. Do not re-propose a change recorded there as `REJECTED`, unless
  new evidence contradicts the recorded validation. If new evidence
  contradicts the recorded validation, cite the prior record id.

### 2. Define the contract

Before editing, state internally:

- the artifact's one-sentence purpose and concrete triggers;
- who invokes or consumes it;
- what is in scope, out of scope, and considered done;
- the minimum tools, context, side effects, and supporting resources required;
- which behavior is repository-specific and must be grounded in inspected
  files.

When unresolved ambiguity would materially change the artifact or create
unsafe side effects, ask a question. Otherwise use the request and repository
evidence.

### 3. Author narrowly

- Use lowercase kebab-case names. Scope each artifact to one coherent concern.
- Put matching and trigger information in frontmatter, not only in the body.
- Use imperative, operational language. Remove generic expertise prose that
  does not change behavior.
- Prefer the least privilege and smallest context footprint that completes the
  job.
- Verify a local path or command before citing it.
- Do not modify unrelated files, generated provider mirrors, or user work in
  the working tree.

### 4. Validate and report

- Validate frontmatter delimiters and required fields. Do not assume the
  environment includes optional YAML libraries.
- Check every referenced path, invocation, tool, and supporting file.
- Enforce the selected reference's size, safety, and semantic checks.
- When `.agro/scripts/link-providers.sh` exists and you changed a canonical
  `.agro/` primitive, run `bash .agro/scripts/link-providers.sh --check`.
- When inside a Git worktree, run `git diff --check`.
- Report the following:
  - the files created, updated, or removed
  - the resulting invocation or loading behavior
  - key design choices
  - validation evidence

  Never claim a check ran when the check did not run.
- When a skill edit lands, append a `PROPOSED` record to
  `.agro/evals/decisions/skill-impact.md`. Include: the next `SI-nnnn` id, the
  one-sentence proposal, the single target artifact, the motivating pattern
  slugs, and the unified diff scoped to that target path.
  `motivating patterns: none (direct request)` is a legitimate value. Record
  that value instead of inventing a pattern to cite. Stage the ledger. Because
  `.agro/evals/decisions/` is a tracked directory, a plain `git add` stages
  it. Report the allocated id. Never edit an existing record.
