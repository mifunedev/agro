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

Build one artifact through the matching type reference. Run the command inline
in the current session. Use the session model. Do not fork a new session or
override the model unless the artifact needs a different model for a stated
reason.

Arguments received: `$ARGUMENTS`

## Dispatch

1. Treat the first whitespace-delimited argument as `TYPE` and the remainder as
   the artifact name, request, or path.
2. Accept exactly these types:

   | Type | Read and follow |
   |------|-----------------|
   | `skill` | `references/skill.md` |
   | `command` | `references/command.md` |
   | `rule` | `references/rule.md` |

3. If `TYPE` is missing or unknown, or the remaining request is empty or only
   whitespace, print the following text. Stop. Do not read a type reference.
   Do not modify a file.

   ```text
   Usage: /builder <skill|command|rule> <name-or-request>
   ```

   `agent` is not an artifact type. Author a reusable role, procedure, or
   specialist judgment as a skill. `/delegate` creates a bounded, isolated
   worker context as an execution choice; that worker context is not a
   repository artifact.

4. Read the selected reference completely. Execute its protocol against the
   remainder of `$ARGUMENTS`. The selected reference is authoritative for
   artifact shape and type-specific validation.

## Shared protocol

Apply these steps for every valid type before the selected reference's
type-specific steps.

### 1. Discover local authority

- Find applicable `AGENTS.md` files from the repository root through the
  target directory. Read each file. When two instructions conflict, the
  instruction in the more local file overrides the instruction in the less
  local file.
- Identify the source-of-truth artifact directory. In AGRO and
  AGRO-equipped projects, edit files under `.agro/skills/`. A provider-link
  operation generates or symlinks provider directories such as `.claude/`,
  `.codex/`, and `.pi/` as exposure surfaces. Do not edit a provider directory
  directly.
- Outside an AGRO layout, follow the target project's documented canonical
  path. Do not create `.agro/` speculatively.
- Inspect two or three nearby artifacts of the same type. Reuse their naming,
  frontmatter, structure, tone, and validation conventions.
- Search for an existing artifact with the same purpose. Prefer a focused
  update or explicit consolidation over a near-duplicate.
- Before proposing a change, consult compiled harness patterns. Run
  `/wiki query <artifact-name-or-subsystem> --patterns`. Read the returned
  pages. Each page records a failure mode, the failure mode's root cause, and
  a workaround this harness already paid for. Cite the motivating
  `[[pattern-...]]` slugs in the report.
- Read `.agro/evals/decisions/skill-impact.md` for prior proposals against the
  same target. Do not re-propose a change that a record marks `REJECTED`,
  unless new evidence contradicts the recorded validation. When new evidence
  justifies the re-proposal, cite the prior record id.

### 2. Define the contract

Before editing, state internally:

- the artifact's one-sentence purpose and concrete triggers;
- who invokes or consumes it;
- what is in scope, out of scope, and considered done;
- the minimum tools, context, side effects, and supporting resources required;
- which behavior is repository-specific and must be grounded in inspected files.

Ask a question only when an unresolved ambiguity would change the artifact
materially or create an unsafe side effect. Otherwise, use the request and the
repository evidence.

### 3. Author narrowly

- Use lowercase kebab-case names. Scope one artifact to one coherent concern.
- Put matching and trigger information in frontmatter, not only in the body.
- Use imperative, operational language. Remove generic expertise prose that
  does not change behavior.
- Prefer the least privilege and smallest context footprint that completes
  the job.
- Verify a local path or command before you cite it.
- Do not modify an unrelated file, a generated provider mirror, or user work
  in the working tree.

### 4. Validate and report

- Validate frontmatter delimiters and required fields. Do not assume that the
  environment has optional YAML libraries installed.
- Check every referenced path, invocation, tool, and supporting file.
- Enforce the selected reference's size, safety, and semantic checks.
- When `.agro/scripts/link-providers.sh` exists and you changed a canonical
  `.agro/` primitive, run `bash .agro/scripts/link-providers.sh --check`.
- When you work inside a Git worktree, run `git diff --check`.
- Report:
  - the files you created, updated, or removed;
  - the resulting invocation or loading behavior;
  - the key design choices;
  - the validation evidence.

  If a check did not run, do not claim that it ran.
- When a skill edit lands, append a `PROPOSED` record to
  `.agro/evals/decisions/skill-impact.md`. Include:
  - the next `SI-nnnn` id;
  - the one-sentence proposal;
  - the single target artifact;
  - the motivating pattern slugs;
  - the unified diff scoped to that target path.

  `motivating patterns: none (direct request)` is a legitimate value for the
  motivating pattern slugs. Record this value rather than invent a pattern to
  cite. Stage the ledger with `git add` (`.agro/evals/decisions/` is a tracked
  directory). Report the allocated id. Do not edit an existing record.
