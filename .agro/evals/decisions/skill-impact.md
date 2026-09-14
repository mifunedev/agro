# skill-impact — the harness's skill-change ledger

Append-only. One record per skill-edit proposal, one record per verdict. Records are
appended at the end and never edited in place; `SI-nnnn` ids increase monotonically.

Written by exactly two skills: `/builder` appends the `PROPOSED` record at the moment
its edit lands, and `/benchmark` appends the matching `SI-nnnn-V` verdict record when
it scores that change. Read by `/builder`, before it proposes — a record marked
`REJECTED` is a change already tried and refused, and must not be re-proposed without
new evidence that contradicts the recorded validation.

This file carries **no YAML frontmatter** deliberately. Both `/wiki lint` § 3 and
`.oh/evals/probes/wiki-readme-index.sh` skip files with no `slug:` field, so the
ledger is excluded from the corpus index by construction. It is not an entity page
and is not returned by `/wiki query`.

Guarded by `.oh/evals/probes/wiki-skill-impact-append-only.sh`.

## Why this is not the deleted memory tier

The `.oh/memory` tier was removed as a concept because it held one entry per session,
keyed by date, gitignored, with nothing reading it. Every structural property here is
the opposite.

| `.oh/memory` (deleted) | `skill-impact.md` |
|---|---|
| One entry per **skill invocation** — every run, whatever the outcome | One record per **skill-edit proposal** — a durable change to a tracked artifact |
| Growth unbounded in sessions | Growth bounded by merged changes that edit `.oh/skills/` |
| No consumer; nothing read it | Two consumers: `/builder` reads it before proposing, `/benchmark` reads it for the redirect signal |
| Duplicated what `git log` already held | Holds what `git log` does **not**: the motivating pattern, the validation result, and — critically — **rejected proposals, which leave no git trace at all after a revert** |
| Any skill could write | Exactly two writers, both orchestrator-only |

The sharp test is `/retro`'s own anti-pattern, "inventing a file to save a lesson
in". This file saves no lessons — lessons live in `corpus/pattern-*.md`. It records
**decisions about skills**, which today live nowhere.

## Record format

A proposal record and its verdict record are two separate appends, never one record
mutated twice. `/builder` lands the edit; a human merges it; `/benchmark` scores it
later. Mutating the `PROPOSED` record in place to add a verdict would break
append-only and make the invariant unenforceable.

````markdown
## SI-nnnn · YYYY-MM-DD · builder · PROPOSED

- **proposal**: <one sentence — what changes and why it should help>
- **target**: <exactly one repo-relative artifact path>
- **motivating patterns**: [[pattern-slug]], [[pattern-slug]] — or `none (direct request)`
- **proposer**: /builder <type>, <session or issue reference>
- **diff**:

```diff
<git diff scoped to the target path>
```

## SI-nnnn-V · YYYY-MM-DD · benchmark · ACCEPTED

- **for**: SI-nnnn
- **floor**: /eval rc=<n>, <n> regressions (`.oh/evals/RESULTS.md`@<short-sha>)
- **ceiling**: suite score <before> → <after>; <task> <before> → <after>
- **verdict**: BENEFICIAL | NOT-BENEFICIAL — ACCEPTED | REJECTED
````

`motivating patterns: none (direct request)` is a legitimate value. Not every skill
edit answers a compiled pattern, and recording that honestly is better than inventing
a pattern to cite.

## Records

<!-- Appended below this line, oldest first. Never edit an existing record. -->

## SI-0001 · 2026-08-31 · builder · PROPOSED

- **proposal**: add a `related:`-slug resolution check to `/wiki lint` and a deterministic probe that fails on the findings, so an unrun report-only check cannot hide broken links
- **target**: `.oh/skills/wiki/references/lint.md`
- **motivating patterns**: [[pattern-wiki-ungated-check-drift]]
- **proposer**: /builder skill, wiki co-evolution change (branch `skill/wiki-coevolution`)
- **diff**: `8fab04ab` — `/wiki lint` § 7a plus `.oh/evals/probes/wiki-related-slugs.sh`

## SI-0001-V · 2026-08-31 · benchmark · ACCEPTED

- **for**: SI-0001
- **floor**: /eval rc=0, 0 regressions over 112 probes (`.oh/evals/RESULTS.md`@af1c14ec)
- **ceiling**: suite score 1.50 -> 1.22 — **not a comparable delta.** The suite gained CB-005 in the same change, so the mean is taken over a different task set than the 1.50 it is being compared to. The meaningful number is CB-005's own first score, 0.67, against an honest prior of 0.00.
- **verdict**: BENEFICIAL — ACCEPTED. The floor held, and the change moved the one axis it targeted from an unmeasured 0.00 to a measured 0.67. Recorded with the caveat above rather than as a clean ceiling rise, because a rise produced by adding a task the harness scores badly on is not the same evidence as a rise on a fixed task set.

## SI-0002 · 2026-08-31 · builder · PROPOSED

- **proposal**: close three ambiguities in `/wiki compile` § 3-4 that a delegated maintainer run hit — the slug subsystem vocabulary, per-retro fan-out, and dual shas for a defect observed and fixed in one session
- **target**: `.oh/skills/wiki/references/compile.md`
- **motivating patterns**: [[pattern-wiki-external-model-over-mapping]] — its workaround is that a mapping is complete only when its exclusions are written down in the local vocabulary; the slug-token mismatch is the same defect one level down, a foreign taxonomy left un-translated in the local procedure
- **proposer**: /builder skill, prompted by the delegated `/wiki compile` run's flagged judgment calls
- **diff**: `.oh/skills/wiki/references/compile.md` § 3 fan-out and subsystem-token rules, § 4 dual-sha rule

## SI-0003 · 2026-08-31 · builder · PROPOSED

- **proposal**: document fault injection and short-fragment pinning in the probe contract, and mint the two probes that guard them, closing the retro nominations in the same session that nominated them
- **target**: `.oh/evals/README.md`
- **motivating patterns**: [[pattern-evals-unexercised-oracle]], [[pattern-evals-prose-literal-pinning]]
- **proposer**: /builder skill, closing the `/retro` nominations rather than leaving them to decay
- **diff**: `.oh/evals/README.md` §§ "Fault injection" and "Pinning contract text"; `.oh/evals/probes/continual-learning-20260831.sh`; `.oh/evals/probes/eval-contract-text-20260831.sh`. Both probes had every REGRESSION branch driven against injected faults before landing (5 injections, 5 caught).

## SI-0004 · 2026-09-06 · builder · PROPOSED

- **proposal**: Add /plan for ignored local drafts with mandatory completion criteria, evidence, and an advisor orchestration strategy.
- **target**: `.oh/skills/plan/SKILL.md`
- **motivating patterns**: none (direct request)
- **proposer**: /builder command, operator request in the active session
- **diff**:

````diff
diff --git a/.oh/skills/plan/SKILL.md b/.oh/skills/plan/SKILL.md
new file mode 100644
index 00000000..a1453fd6
--- /dev/null
+++ b/.oh/skills/plan/SKILL.md
@@ -0,0 +1,179 @@
+---
+name: plan
+description: |
+  Create or revise a repository-grounded Markdown plan in .oh/plans/.
+  Always include a Definition of Done and an advisor orchestration strategy
+  that maps work and verification to each completion criterion. Apply /ste.
+  Plans are gitignored by default. Do not implement the plan.
+  TRIGGER when: /plan invoked, "write a plan", "create a plan",
+  or "save a plan in .oh/plans". Use /spec for task scaffolding or execution.
+argument-hint: "<request | existing-plan-path>"
+allowed-tools: Read, Write, Edit, Glob, Grep, Bash
+---
+
+# Plan
+
+Create one local planning document for the operator and the future implementation owner.
+Run inline in the active session.
+
+## Required contract
+
+- Write plans to `.oh/plans/<slug>.md` in the target repository.
+- Always include `## Definition of Done`, even in a short or blocked draft.
+- Always include `## advisor orchestration strategy`; this is not a separate agent role.
+- Read `.oh/skills/ste/SKILL.md` before drafting. Apply `/ste` to every plan and revision.
+- Keep plans gitignored by default. Never stage or force-add a plan without explicit operator approval.
+- Plan only. Do not implement, create task folders, launch implementation workers, commit, push, or start services.
+- Do not invoke `/spec` or `/delegate` automatically after writing a plan.
+- Do not change provider settings or move existing `.claude/plans/` files automatically.
+
+## 1. Resolve the request
+
+Arguments received: `$ARGUMENTS`
+
+1. Use the argument as a free-text request or an existing plan path.
+2. If the argument is empty, use the current conversation's explicit planning request.
+3. If neither source identifies a task, print `Usage: /plan <request | existing-plan-path>` and stop without writing.
+4. If the input names an existing file, read the complete file before drafting.
+5. Confirm the target repository from the request and current directory. Ask when the target is ambiguous.
+6. Read applicable `AGENTS.md`, `CLAUDE.md`, and directory `README.md` files for the affected paths.
+7. Derive a descriptive lowercase kebab-case slug from the topic. Use at most five words; reject path separators and traversal components.
+
+If the operator requests a revision, reuse the selected `.oh/plans/<slug>.md` file.
+If another plan occupies the derived path, ask before replacing that plan.
+For an input outside `.oh/plans/`, preserve the source and write the draft under `.oh/plans/`.
+Do not overwrite unrelated local work or write through symlinks outside the target repository.
+
+## 2. Ground the plan
+
+1. Read the code, tests, configuration, and documentation that control the requested behavior.
+2. Query `/wiki query <topic> --patterns` when tracked repository knowledge exists.
+3. Verify relevant recalled claims against current sources.
+4. Apply `/architect` when the request changes structural boundaries. Keep its decision in the active session.
+5. Separate verified facts from assumptions and open decisions.
+6. Ask only questions whose answers materially change scope, safety, or the completion criteria.
+
+Record unresolved values as explicit placeholders and questions. Never invent a missing command, path, threshold, permission, or test result.
+A draft with an unresolved required decision is `BLOCKED`, not ready for approval.
+Scale detail to the task, but never omit either required completion section.
+
+## 3. Define completion before sequencing work
+
+Write the Definition of Done before the implementation steps.
+Give each criterion a stable identifier such as `D1`.
+For every criterion, name:
+
+- the observable outcome;
+- the verification command or review procedure;
+- the expected result and evidence artifact;
+- the owner who produces or verifies the evidence.
+
+Map every requested requirement to at least one criterion.
+Include regression protection and negative cases where the changed behavior requires them.
+Name environment prerequisites for checks that require a host, sandbox, credentials, or external service.
+A missing prerequisite blocks its required gate. A skipped check does not satisfy that gate.
+Never substitute a worker's completion summary for verified evidence.
+
+## 4. Plan the orchestration
+
+Read `.oh/skills/delegate/SKILL.md` before writing the orchestration strategy.
+The advisor behavior belongs to the active session; it creates no persistent identity or competing worker hierarchy.
+This section describes future execution, not permission to start implementation.
+
+1. Name one implementation owner for coupled changes.
+2. Identify independent research that benefits from bounded read-only workers.
+3. Reconcile research in the active session before assigning writes.
+4. Sequence tasks by dependencies. Assign each task its files, execution context, output, and DoD identifiers.
+5. Use isolated worktrees for parallel writers. Keep overlapping file changes sequential.
+6. Schedule independent read-only evidence review after implementation.
+7. Return failed criteria to the same implementation owner for repair and verification.
+8. Stop dependent work when a prerequisite fails. Escalate unresolved scope or safety decisions to the operator.
+
+Use `/delegate` for worker limits, model inheritance, thinking levels, and recursion policy; do not redefine those policies here.
+Choose no workers when a small task gains nothing from delegation. State the reason and retain a separate evidence-review pass.
+During approved execution, `/spec` owns the build and `/delegate` owns its execution records under `.oh/tasks/<slug>/`.
+The draft remains planning input, not a second completion-state database.
+
+## 5. Write the draft
+
+1. Create `.oh/plans/` only inside the confirmed target repository.
+2. Check the destination with `git check-ignore --no-index -- <plan-path>` in a Git repository.
+3. If no ignore rule covers the destination, create `.oh/plans/.gitignore` containing `*` and a final newline.
+4. If an existing ignore file conflicts with that default, ask before changing it.
+5. If the destination is already tracked, report the conflict. Do not untrack the file automatically.
+6. Write the plan with the structure below. Replace placeholders with grounded content or explicit blocking questions.
+
+In a non-Git directory, create the same local ignore file and report that Git verification is unavailable.
+Do not edit the consumer repository's root `.gitignore` or provider configuration during plan creation.
+
+Use these sections in order.
+
+```markdown
+# Plan: <title>
+
+Status: DRAFT | BLOCKED
+
+## Goal and scope
+<Requested outcome, constraints, and explicit non-goals.>
+
+## Current state and decision
+<Source paths, verified behavior, selected approach, and assumptions.>
+
+## Definition of Done
+| ID | Observable outcome | Verification and expected result | Evidence | Owner |
+|---|---|---|---|---|
+| D1 | <Outcome.> | <Command or review procedure; required result.> | <Artifact.> | <Owner.> |
+
+## Implementation steps
+| Step | Action and files | Dependencies | Execution context | DoD IDs |
+|---|---|---|---|---|
+| 1 | <Bounded change.> | <None or step IDs.> | <Host or sandbox; target repository.> | D1 |
+
+## advisor orchestration strategy
+<One active owner; delegation choice and justification; evidence-review and repair sequence.>
+
+| Wave | Work and owner | Dependencies | Output or handoff | DoD IDs |
+|---|---|---|---|---|
+| 1 | <Research or owner task.> | <None or prior wave.> | <Source-backed result.> | D1 |
+
+## Affected surfaces
+<Mark each surface applied or not applicable, with a reason: host and sandbox;
+lifecycle door; canonical and provider surfaces; root and scaffold;
+interactive and headless processes; local and remote operation;
+parallel operation; public documentation; verification.>
+
+## Risks, rollback, and open questions
+<Failure modes, recovery steps, required permissions, and unresolved decisions. Write "None" when no questions remain.>
+
+## Approval and handoff
+<This draft does not authorize execution. Name the operator decisions required before the build.>
+```
+
+## 6. Verify and report
+
+1. Re-read the saved plan from disk.
+2. Confirm that both required sections contain task-specific content.
+3. Check every DoD identifier against the implementation and orchestration tables. Reject missing coverage or dangling identifiers.
+4. Confirm that each criterion has an observable pass condition, evidence, and an owner.
+5. Run `bash .oh/skills/ste/scripts/ste-check.sh <plan-path>` from the harness repository. Use an absolute plan path for another repository.
+6. Fix checker findings and review meaning with `/ste`'s ten-question check.
+7. In Git, confirm that an ignore rule covers the saved file and that `git ls-files -- <plan-path>` returns no entries.
+8. Report the path, status, unresolved questions, and validation results.
+
+Use `DRAFT` only when the plan passes validation and awaits operator approval.
+Use `BLOCKED` when a required decision, prerequisite, or validation remains unresolved.
+Report `UNCHANGED` when a requested revision needs no content changes and the existing plan passes validation.
+If writing fails, report `FAILED` with the cause. Do not claim that a plan exists without reading it back.
+To undo creation, remove only the new plan after operator confirmation; preserve other drafts and existing ignore rules.
+
+After approval, offer `/spec plan --plan .oh/plans/<slug>.md` for task scaffolding only.
+Offer `/spec .oh/plans/<slug>.md` only when the operator requests the approved build.
+Do not treat generating or revising a plan as approval.
+
+## Examples and boundaries
+
+- `/plan add retry limits to webhook delivery` creates a grounded draft without implementation.
+- `/plan .oh/plans/webhook-retry-limits.md` reads the existing draft before revision.
+- `/plan` without a planning request prints usage and writes nothing.
+- If a saved plan fails validation, revise that same plan and rerun the checks; do not create duplicate recovery drafts.
+- Use `/imagine` for a speculative PRD sketch, `/prd` for structured requirements, and `/spec plan` for an executable task folder.
````

## SI-0005 · 2026-09-06 · builder · PROPOSED

- **proposal**: Store each plan in its own slug directory with plan.md as the source and plan.html as an optional companion.
- **target**: `.oh/skills/plan/SKILL.md`
- **motivating patterns**: none (direct request)
- **proposer**: /builder command, operator request for per-plan directories
- **diff**:

````diff
--- a/.oh/skills/plan/SKILL.md
+++ b/.oh/skills/plan/SKILL.md
@@ -1,7 +1,7 @@
 ---
 name: plan
 description: |
-  Create or revise a repository-grounded Markdown plan in .oh/plans/.
+  Create or revise a repository-grounded Markdown plan at .oh/plans/<slug>/plan.md.
   Always include a Definition of Done and an advisor orchestration strategy
   that maps work and verification to each completion criterion. Apply /ste.
   Plans are gitignored by default. Do not implement the plan.
@@ -18,7 +18,8 @@

 ## Required contract

-- Write plans to `.oh/plans/<slug>.md` in the target repository.
+- Write plans to `.oh/plans/<slug>/plan.md` in the target repository.
+- Keep `plan.md` as the source of truth. Reserve sibling `plan.html` for an optional rendering; do not generate HTML during `/plan`.
 - Always include `## Definition of Done`, even in a short or blocked draft.
 - Always include `## advisor orchestration strategy`; this is not a separate agent role.
 - Read `.oh/skills/ste/SKILL.md` before drafting. Apply `/ste` to every plan and revision.
@@ -39,9 +40,10 @@
 6. Read applicable `AGENTS.md`, `CLAUDE.md`, and directory `README.md` files for the affected paths.
 7. Derive a descriptive lowercase kebab-case slug from the topic. Use at most five words; reject path separators and traversal components.

-If the operator requests a revision, reuse the selected `.oh/plans/<slug>.md` file.
+If the operator requests a revision, reuse the selected `.oh/plans/<slug>/plan.md` file.
 If another plan occupies the derived path, ask before replacing that plan.
-For an input outside `.oh/plans/`, preserve the source and write the draft under `.oh/plans/`.
+For an input in another layout, preserve the source and write the draft to `.oh/plans/<slug>/plan.md`.
+If the input is a companion rendering, read its sibling `plan.md` as the source before revision.
 Do not overwrite unrelated local work or write through symlinks outside the target repository.

 ## 2. Ground the plan
@@ -96,7 +98,7 @@

 ## 5. Write the draft

-1. Create `.oh/plans/` only inside the confirmed target repository.
+1. Create `.oh/plans/<slug>/` only inside the confirmed target repository.
 2. Check the destination with `git check-ignore --no-index -- <plan-path>` in a Git repository.
 3. If no ignore rule covers the destination, create `.oh/plans/.gitignore` containing `*` and a final newline.
 4. If an existing ignore file conflicts with that default, ask before changing it.
@@ -159,6 +161,7 @@
 6. Fix checker findings and review meaning with `/ste`'s ten-question check.
 7. In Git, confirm that an ignore rule covers the saved file and that `git ls-files -- <plan-path>` returns no entries.
 8. Report the path, status, unresolved questions, and validation results.
+9. If a Markdown revision changes the content, report any existing sibling `plan.html` as stale. Do not overwrite the rendering automatically.

 Use `DRAFT` only when the plan passes validation and awaits operator approval.
 Use `BLOCKED` when a required decision, prerequisite, or validation remains unresolved.
@@ -166,14 +169,15 @@
 If writing fails, report `FAILED` with the cause. Do not claim that a plan exists without reading it back.
 To undo creation, remove only the new plan after operator confirmation; preserve other drafts and existing ignore rules.

-After approval, offer `/spec plan --plan .oh/plans/<slug>.md` for task scaffolding only.
-Offer `/spec .oh/plans/<slug>.md` only when the operator requests the approved build.
+After approval, offer `/spec plan --plan .oh/plans/<slug>/plan.md` for task scaffolding only.
+Offer `/spec .oh/plans/<slug>/plan.md` only when the operator requests the approved build.
 Do not treat generating or revising a plan as approval.

 ## Examples and boundaries

 - `/plan add retry limits to webhook delivery` creates a grounded draft without implementation.
-- `/plan .oh/plans/webhook-retry-limits.md` reads the existing draft before revision.
+- `/plan .oh/plans/webhook-retry-limits/plan.md` reads the existing draft before revision.
+- `.oh/plans/webhook-retry-limits/plan.html` can hold an optional rendering of that same plan.
 - `/plan` without a planning request prints usage and writes nothing.
 - If a saved plan fails validation, revise that same plan and rerun the checks; do not create duplicate recovery drafts.
 - Use `/imagine` for a speculative PRD sketch, `/prd` for structured requirements, and `/spec plan` for an executable task folder.
````

## SI-0006 · 2026-09-07 · builder · PROPOSED

- **proposal**: Add a local Pandoc resume export skill with privacy, text, layout, and link checks before PDF delivery.
- **target**: `projects/ryaneggz/resume/.claude/skills/resume-pdf/SKILL.md` (ryaneggz/resume: `.claude/skills/resume-pdf/SKILL.md`)
- **motivating patterns**: none (direct request)
- **proposer**: /builder command, operator request in the active session
- **diff**:

````diff
diff --git a/projects/ryaneggz/resume/.claude/skills/resume-pdf/SKILL.md b/projects/ryaneggz/resume/.claude/skills/resume-pdf/SKILL.md
new file mode 100644
index 00000000..7d239bb5
--- /dev/null
+++ b/projects/ryaneggz/resume/.claude/skills/resume-pdf/SKILL.md
@@ -0,0 +1,117 @@
+---
+name: resume-pdf
+description: |
+  Convert a selected Markdown resume to a local, text-based PDF with Pandoc
+  for a job application upload. TRIGGER when: "export resume to PDF",
+  "convert resume markdown to pdf", "make an uploadable resume", or
+  /resume-pdf. Do not use for resume rewriting, HTML-only rendering, or submission.
+argument-hint: "<resume.md> [output.pdf]"
+allowed-tools: Read, Bash
+---
+
+# Resume PDF
+
+Use Pandoc: https://github.com/jgm/pandoc.
+Run inside the project sandbox, from the resume repository root.
+Keep Markdown as the source of truth. Ryan uploads the PDF; never submit an application.
+
+## 1. Select the source
+
+1. Parse `$ARGUMENTS` as one input path and one optional output path. Respect quoted paths; never use `eval`.
+2. If arguments are absent, use the single resume path explicitly selected in the conversation.
+3. If no single source is clear, print `Usage: /resume-pdf <resume.md> [output.pdf]` and ask which variant to export.
+4. Require an existing `.md` file. Default the output to the same directory and basename with a `.pdf` extension.
+5. Resolve paths within this repository. Reject an output that resolves to the input, a symlink, or a non-PDF filename.
+6. Read `README.md`, the selected source, and the privacy markers in `resume-master.md`.
+7. Use a submission variant under `applications/`. Do not export the internal master ledger or review notes as a resume.
+8. If the source contains blocked claims, internal notes, or unresolved privacy clearance, stop with `BLOCKED` before rendering.
+9. If the output exists, ask before replacing it. Preserve all unrelated working changes.
+
+Conversion does not grant content clearance. Use `.claude/skills/resume-gate/SKILL.md` for the separate resume review.
+If that gate references missing files or critics, report the missing prerequisites; never invent a passing verdict.
+Do not edit wording, claims, dates, links, or the existing HTML during conversion.
+
+## 2. Check dependencies
+
+Require `pandoc`, `xelatex`, `pdfinfo`, `pdftotext`, and `pdftoppm` on `PATH`.
+Check `pandoc --version` and `xelatex --version` before rendering.
+Pandoc needs a PDF engine; installing Pandoc alone does not provide XeLaTeX.
+
+If dependencies are missing, return `BLOCKED` with their names.
+Offer the following installation command only for a Debian or Ubuntu sandbox:
+
+```bash
+sudo apt-get update && sudo apt-get install -y pandoc texlive-xetex texlive-latex-recommended texlive-latex-extra fonts-lmodern poppler-utils
+```
+
+Ask before installing packages. Do not install on the host or change the sandbox image automatically.
+For other systems, use the official installation instructions at https://pandoc.org/installing.html.
+Never send private resume content to an online conversion service.
+
+## 3. Render a candidate
+
+1. Assign the resolved absolute input path to `source` and the chosen absolute output path to `output`.
+2. Create a private temporary directory with `mktemp -d`. Assign that path to `work`.
+3. Inspect the source for raw HTML, raw TeX, images, or YAML configuration. Stop for review if conversion could omit content or execute embedded instructions.
+4. Run the command below with the inspected source. Treat a nonzero exit or missing-glyph warning as `FAILED`.
+
+```bash
+pandoc --from=markdown+hard_line_breaks-smart-tex_math_dollars-raw_tex-raw_html-yaml_metadata_block \
+  --standalone --pdf-engine=xelatex \
+  --variable papersize=letter \
+  --variable geometry:margin=0.65in \
+  --variable fontsize=11pt \
+  --variable mainfont='Latin Modern Roman' \
+  --variable monofont='Latin Modern Mono' \
+  --variable colorlinks=true \
+  --variable urlcolor=black \
+  --variable pagestyle=empty \
+  --output "$work/resume.pdf" "$source"
+```
+
+The reader preserves the separate contact and skills lines in this repository.
+Disabling dollar math keeps compensation and financial amounts as text.
+Use a single-column layout with selectable text, not a screenshot or scanned PDF.
+Do not add a title block, table of contents, photograph, or decorative columns.
+Do not enable TeX shell escape or load unreviewed filters and templates.
+
+## 4. Verify before delivery
+
+Run these commands against the candidate, not an older destination PDF:
+
+```bash
+pdfinfo "$work/resume.pdf"
+pdftotext -layout "$work/resume.pdf" "$work/resume.txt"
+pdftoppm -scale-to 1600 -png "$work/resume.pdf" "$work/page"
+```
+
+1. Require a nonempty, unencrypted PDF with at least one page.
+2. Read the extracted text. Compare every section and bullet against the Markdown, allowing only layout whitespace and Markdown syntax differences.
+3. Check the name, contact details, dates, dollar amounts, Unicode characters, and reading order. Reject missing or garbled text.
+4. Inspect every rendered page with an available image viewer. Check clipping, blank pages, heading placement, bullet splits, and readable type.
+5. Inspect PDF link annotations or open the PDF in a viewer. Verify contact and portfolio destinations against the source.
+6. If the user supplies portal size and page limits, check the PDF against those limits. Report byte size and page count even when no limit is known.
+7. If the PDF exceeds a limit, report `REVISE`. Do not silently delete text or shrink type to force a fit.
+8. If layout needs adjustment, change only rendering options and repeat all checks. Ask before changing paper size or reducing the 11-point body font.
+9. If a required viewer or check is unavailable, report `BLOCKED`; do not call the PDF upload-ready.
+10. After verification, copy the candidate to the approved output path. Recheck overwrite permission if the destination appeared during rendering.
+11. Remove only this run's temporary files after delivery. Preserve an existing destination on failure.
+
+Text extraction is a parsing check, not a guarantee that every applicant tracking system accepts the PDF.
+An unchanged rerun still requires verification. An existing PDF does not prove that Pandoc used the current Markdown.
+Do not commit, push, or upload the artifact unless the user separately requests that action.
+
+## 5. Report
+
+Return one status: `EXPORTED`, `BLOCKED`, `FAILED`, or `REVISE`.
+For `EXPORTED`, report the output path, page count, byte size, Pandoc version, and completed text, visual, and link checks.
+Report content clearance separately. Say whether the resume gate passed for this exact source or remains pending.
+For other statuses, name the failed check or missing prerequisite and the next action.
+To undo a new export, remove only the generated PDF. Do not remove its Markdown source.
+
+## Examples
+
+- `/resume-pdf applications/portable/ai-engineer/resume.md` exports the selected variant to its sibling `resume.pdf`.
+- `/resume-pdf applications/portable/ai-engineer/resume.md Ryan-Eggleston-Resume.pdf` selects a custom upload filename.
+- `/resume-pdf resume-master.md` stops because the master ledger is not a submission variant.
+- A request to tailor resume wording uses the writing and review process, not this conversion skill.
````

## SI-0007 · 2026-09-07 · builder · PROPOSED

- **proposal**: Replace direct resume PDF rendering with Pandoc DOCX export and a Google Docs handoff for human layout review and PDF download.
- **target**: `projects/ryaneggz/resume/.claude/skills/resume-docx/SKILL.md` (renamed from `resume-pdf/SKILL.md`)
- **motivating patterns**: none (direct request)
- **proposer**: /builder command, operator request in the active session
- **diff**:

````diff
--- a/projects/ryaneggz/resume/.claude/skills/resume-pdf/SKILL.md
+++ b/projects/ryaneggz/resume/.claude/skills/resume-docx/SKILL.md
@@ -1,117 +1,120 @@
 ---
-name: resume-pdf
+name: resume-docx
 description: |
-  Convert a selected Markdown resume to a local, text-based PDF with Pandoc
-  for a job application upload. TRIGGER when: "export resume to PDF",
-  "convert resume markdown to pdf", "make an uploadable resume", or
-  /resume-pdf. Do not use for resume rewriting, HTML-only rendering, or submission.
-argument-hint: "<resume.md> [output.pdf]"
+  Convert a selected Markdown resume to editable DOCX with Pandoc for Google
+  Docs. TRIGGER when: "export resume to Word", "convert resume to docx",
+  "prepare resume for Google Docs", or /resume-docx. Ryan reviews the layout
+  in Google Docs and downloads the PDF. Do not render PDFs or submit applications.
+argument-hint: "<resume.md> [output.docx]"
 allowed-tools: Read, Bash
 ---
 
-# Resume PDF
+# Resume DOCX
 
-Use Pandoc: https://github.com/jgm/pandoc.
-Run inside the project sandbox, from the resume repository root.
-Keep Markdown as the source of truth. Ryan uploads the PDF; never submit an application.
+Use Markdown → Pandoc → DOCX → Google Docs → PDF.
+Run local commands inside the sandbox, from the resume repository root.
+Keep Markdown as the source of truth. Ryan controls Google Docs import and final PDF export.
+Never upload private content, submit applications, or generate a PDF during this skill.
 
 ## 1. Select the source
 
 1. Parse `$ARGUMENTS` as one input path and one optional output path. Respect quoted paths; never use `eval`.
 2. If arguments are absent, use the single resume path explicitly selected in the conversation.
-3. If no single source is clear, print `Usage: /resume-pdf <resume.md> [output.pdf]` and ask which variant to export.
-4. Require an existing `.md` file. Default the output to the same directory and basename with a `.pdf` extension.
-5. Resolve paths within this repository. Reject an output that resolves to the input, a symlink, or a non-PDF filename.
-6. Read `README.md`, the selected source, and the privacy markers in `resume-master.md`.
-7. Use a submission variant under `applications/`. Do not export the internal master ledger or review notes as a resume.
-8. If the source contains blocked claims, internal notes, or unresolved privacy clearance, stop with `BLOCKED` before rendering.
-9. If the output exists, ask before replacing it. Preserve all unrelated working changes.
+3. If no single source is clear, print `Usage: /resume-docx <resume.md> [output.docx]` and ask which variant to export.
+4. Require an existing `.md` submission variant under `applications/`. Do not export the master ledger or review notes.
+5. Default the output to the input directory and basename with a `.docx` extension.
+6. Resolve both paths within this repository. Reject symlink destinations, directory destinations, and output names without a `.docx` extension.
+7. If the output exists, ask before replacing it. Preserve unrelated working changes and existing HTML or PDF artifacts.
+8. Read `README.md`, the selected source, and the privacy markers in `resume-master.md`.
+9. If the source contains blocked claims, internal notes, or unresolved privacy clearance, return `BLOCKED` before conversion.
+10. Inspect for raw HTML, raw TeX, raw attribute blocks, images, YAML metadata, or tables. If any appear, stop for review instead of silently dropping or flattening content.
 
-Conversion does not grant content clearance. Use `.claude/skills/resume-gate/SKILL.md` for the separate resume review.
-If that gate references missing files or critics, report the missing prerequisites; never invent a passing verdict.
-Do not edit wording, claims, dates, links, or the existing HTML during conversion.
+Do not rewrite claims, dates, wording, or links during export.
+Conversion does not grant content clearance. Use `.claude/skills/resume-gate/SKILL.md` for the separate content review.
+If the gate requires missing files or critics, report that limitation; never invent a passing verdict.
 
-## 2. Check dependencies
+## 2. Check Pandoc
 
-Require `pandoc`, `xelatex`, `pdfinfo`, `pdftotext`, and `pdftoppm` on `PATH`.
-Check `pandoc --version` and `xelatex --version` before rendering.
-Pandoc needs a PDF engine; installing Pandoc alone does not provide XeLaTeX.
+Require `pandoc` on `PATH`. Record `pandoc --version`.
+DOCX export does not require XeLaTeX, a PDF engine, Poppler, or Microsoft Word.
+Use the official installation instructions at https://pandoc.org/installing.html when Pandoc is missing.
 
-If dependencies are missing, return `BLOCKED` with their names.
-Offer the following installation command only for a Debian or Ubuntu sandbox:
+On a Debian or Ubuntu sandbox, offer:
 
 ```bash
-sudo apt-get update && sudo apt-get install -y pandoc texlive-xetex texlive-latex-recommended texlive-latex-extra fonts-lmodern poppler-utils
+sudo apt-get update && sudo apt-get install -y pandoc
 ```
 
-Ask before installing packages. Do not install on the host or change the sandbox image automatically.
-For other systems, use the official installation instructions at https://pandoc.org/installing.html.
-Never send private resume content to an online conversion service.
+Ask before installing packages. Check `sudo -n true` before an agent-run installation.
+If sudo requires a password, give Ryan the commands to run interactively and return `BLOCKED`.
+Do not request a password in chat. Do not change the host or sandbox image.
 
-## 3. Render a candidate
+## 3. Convert a private candidate
 
-1. Assign the resolved absolute input path to `source` and the chosen absolute output path to `output`.
-2. Create a private temporary directory with `mktemp -d`. Assign that path to `work`.
-3. Inspect the source for raw HTML, raw TeX, images, or YAML configuration. Stop for review if conversion could omit content or execute embedded instructions.
-4. Run the command below with the inspected source. Treat a nonzero exit or missing-glyph warning as `FAILED`.
+1. Assign the resolved absolute paths to `source` and `output`.
+2. Create a private temporary directory with `mktemp -d`. Assign the path to `work`.
+3. Copy the inspected source to `$work/source.md`. Use this snapshot for conversion and verification.
+4. Run the following commands. A nonzero exit or conversion warning returns `FAILED`; preserve any existing destination.
 
 ```bash
-pandoc --from=markdown+hard_line_breaks-smart-tex_math_dollars-raw_tex-raw_html-yaml_metadata_block \
-  --standalone --pdf-engine=xelatex \
-  --variable papersize=letter \
-  --variable geometry:margin=0.65in \
-  --variable fontsize=11pt \
-  --variable mainfont='Latin Modern Roman' \
-  --variable monofont='Latin Modern Mono' \
-  --variable colorlinks=true \
-  --variable urlcolor=black \
-  --variable pagestyle=empty \
-  --output "$work/resume.pdf" "$source"
+reader='markdown+hard_line_breaks-smart-tex_math_dollars-raw_tex-raw_html-raw_attribute-yaml_metadata_block'
+pandoc --from="$reader" --to=docx --standalone --fail-if-warnings \
+  --output "$work/resume.docx" "$work/source.md"
+pandoc --from="$reader" --to=plain --wrap=none \
+  --output "$work/source.txt" "$work/source.md"
+pandoc --from=docx --to=plain --wrap=none --fail-if-warnings \
+  --output "$work/roundtrip.txt" "$work/resume.docx"
+pandoc --from=docx --to=json --fail-if-warnings \
+  --output "$work/roundtrip.json" "$work/resume.docx"
 ```
 
-The reader preserves the separate contact and skills lines in this repository.
-Disabling dollar math keeps compensation and financial amounts as text.
-Use a single-column layout with selectable text, not a screenshot or scanned PDF.
-Do not add a title block, table of contents, photograph, or decorative columns.
-Do not enable TeX shell escape or load unreviewed filters and templates.
+The reader preserves the separate contact and skills lines used in this repository.
+If the source uses editor-wrapped prose, review those line breaks before export. Do not silently rewrite the source.
+Disabling dollar math preserves financial amounts as text. Disabling raw attributes prevents raw-format blocks from passing through.
+Use Pandoc's default Word styles for editable headings, paragraphs, and lists.
+Do not add custom templates, filters, decorative columns, or a reference DOCX unless Ryan requests them.
 
-## 4. Verify before delivery
+## 4. Verify and deliver
 
-Run these commands against the candidate, not an older destination PDF:
+1. Require a nonempty DOCX that Pandoc can read without warnings.
+2. Compare `$work/source.txt` and `$work/roundtrip.txt`. Allow only whitespace and list-marker formatting differences.
+3. Preserve meaningful punctuation, hyphens, Unicode characters, and amounts during comparison. Do not strip punctuation to force a passing comparison.
+4. Check every heading, section, bullet, contact detail, and date against the source.
+5. Inspect `Link` entries in `$work/roundtrip.json`. Match their visible text and destinations against every source link, including repeated links.
+6. If text, links, or structure differ, return `FAILED` without delivering the candidate.
+7. Compare `$work/source.md` with the current source using `cmp`. If the source changed during conversion, return `REVISE` and restart from the new source.
+8. Deliver only to the approved output path. Use exclusive creation for a new destination; if another process created it, stop instead of overwriting it.
+9. For an approved replacement, recheck the destination and replace it atomically from a temporary sibling file. Do not follow symlinks.
+10. Confirm the delivered bytes match the verified candidate. Report the absolute output path, byte size, and Pandoc version.
+11. Remove only this run's temporary files after delivery. Do not commit, push, or remove older export artifacts.
 
-```bash
-pdfinfo "$work/resume.pdf"
-pdftotext -layout "$work/resume.pdf" "$work/resume.txt"
-pdftoppm -scale-to 1600 -png "$work/resume.pdf" "$work/page"
-```
+An existing DOCX does not prove that Pandoc used the current source. Verify each rerun.
+Do not report a final page count or Google Docs layout validation from a local DOCX conversion.
+Local checks prove content preservation, not final pagination or universal applicant-tracking-system compatibility.
 
-1. Require a nonempty, unencrypted PDF with at least one page.
-2. Read the extracted text. Compare every section and bullet against the Markdown, allowing only layout whitespace and Markdown syntax differences.
-3. Check the name, contact details, dates, dollar amounts, Unicode characters, and reading order. Reject missing or garbled text.
-4. Inspect every rendered page with an available image viewer. Check clipping, blank pages, heading placement, bullet splits, and readable type.
-5. Inspect PDF link annotations or open the PDF in a viewer. Verify contact and portfolio destinations against the source.
-6. If the user supplies portal size and page limits, check the PDF against those limits. Report byte size and page count even without a known limit.
-7. If the PDF exceeds a limit, report `REVISE`. Do not silently delete text or shrink type to force a fit.
-8. If layout needs adjustment, change only rendering options and repeat all checks. Ask before changing paper size or reducing the 11-point body font.
-9. If a required viewer or check is unavailable, report `BLOCKED`; do not call the PDF upload-ready.
-10. After verification, copy the candidate to the approved output path. Recheck overwrite permission if the destination appeared during rendering.
-11. Remove only this run's temporary files after delivery. Preserve an existing destination on failure.
+## 5. Hand off to Ryan
 
-Text extraction is a parsing check, not a guarantee that every applicant tracking system accepts the PDF.
-An unchanged rerun still requires verification. An existing PDF does not prove that Pandoc used the current Markdown.
-Do not commit, push, or upload the artifact unless the user separately requests that action.
+1. Download the generated `.docx` file from the sandbox.
+2. Upload the DOCX to Google Drive. Open the document with Google Docs, not Google Sheets.
+3. Review margins, fonts, contact lines, links, bullets, and every page break. Keep the layout single-column and readable.
+4. Check the application portal's stated file-size and page limits. Do not assume a universal page limit.
+5. In Google Docs, select **File → Download → PDF Document (.pdf)**.
+6. Open the downloaded PDF. Check all pages before uploading the PDF to the application portal.
 
-## 5. Report
+If Ryan changes resume wording in Google Docs, reconcile those changes into Markdown before the next export.
+Do not claim that Google Docs import, visual review, PDF export, or submission occurred unless Ryan confirms it.
+
+## Report and recovery
 
 Return one status: `EXPORTED`, `BLOCKED`, `FAILED`, or `REVISE`.
-For `EXPORTED`, report the output path, page count, byte size, Pandoc version, and completed text, visual, and link checks.
-Report content clearance separately. Say whether the resume gate passed for this exact source or remains pending.
-For other statuses, name the failed check or missing prerequisite and the next action.
-To undo a new export, remove only the generated PDF. Do not remove its Markdown source.
+For `EXPORTED`, report the DOCX path, size, Pandoc version, and text, structure, and link check results.
+State that Google Docs layout review and PDF export remain with Ryan. Report content clearance separately.
+For other statuses, name the missing prerequisite or failed check and the next action.
+To undo a new export, remove only its generated DOCX. Preserve the Markdown source.
 
 ## Examples
 
-- `/resume-pdf applications/portable/ai-engineer/resume.md` exports the selected variant to its sibling `resume.pdf`.
-- `/resume-pdf applications/portable/ai-engineer/resume.md Ryan-Eggleston-Resume.pdf` selects a custom upload filename.
-- `/resume-pdf resume-master.md` stops because the master ledger is not a submission variant.
-- A request to tailor resume wording uses the writing and review process, not this conversion skill.
+- `/resume-docx applications/portable/ai-engineer/resume.md` writes a sibling `resume.docx`.
+- `/resume-docx applications/portable/ai-engineer/resume.md Ryan-Eggleston-Resume.docx` chooses a custom filename.
+- `/resume-docx resume-master.md` stops because the ledger is not a submission variant.
+- A request to rewrite a resume uses the writing and content-review process, not this conversion skill.
````

## SI-0008 · 2026-09-12 · builder · PROPOSED

- **proposal**: Add `/supervisor`, a skill that owns build sessions from outside them — start at the harness root, brief by pointer, monitor from artifacts, own the context budget, and escalate to the operator.
- **target**: `.agro/skills/supervisor/SKILL.md` (new)
- **motivating patterns**: `[[pattern-evals-prose-literal-pinning]]`, `[[pattern-evals-unexercised-oracle]]`
- **proposer**: /spec execute for #1057, operator request in the active session
- **diff**:

````diff
diff --git a/.agro/skills/supervisor/SKILL.md b/.agro/skills/supervisor/SKILL.md
new file mode 100644
index 00000000..53ffc90f
--- /dev/null
+++ b/.agro/skills/supervisor/SKILL.md
@@ -0,0 +1,313 @@
+---
+name: supervisor
+description: |
+  Own an advisor session that runs in another Herdr pane, without writing code
+  and without reviewing code. Start the advisor at the harness root, brief the
+  advisor with a pointer to the contract, monitor progress from artifacts, own
+  the advisor's context budget, and carry a blocker to the operator.
+  TRIGGER when: asked to supervise, babysit, watch, or drive an agent in
+  another pane; asked to "run this build in a second pane and keep it on
+  track"; asked to own a long build to its Definition of Done from outside the
+  implementing session; an advisor session needs a brief, a compaction
+  decision, or an escalation route; asked "what is the advisor doing" or "is
+  the advisor still on the contract".
+  Do NOT trigger when the active session implements the work itself, when the
+  request asks for a code review, when the request asks to dispatch bounded
+  workers inside one session (use /delegate), or when the request asks to run
+  a single `herdr` command (use /herdr).
+allowed-tools: Bash, Read, Grep
+---
+
+# Supervisor
+
+The supervisor owns one or more advisor sessions in other Herdr panes. Each
+advisor owns one contract and one Definition of Done. The supervisor stays
+accountable for every owned advisor reaching that Definition of Done.
+
+## Role boundary
+
+Read the role boundary before any procedure.
+
+- The supervisor writes no application code.
+- The supervisor reviews no code.
+- The supervisor changes no file the advisor owns.
+- The supervisor stays accountable for the advisor reaching its Definition of
+  Done.
+
+Three actors carry three jobs. Keep the three apart.
+
+| Actor | Owns | Never does |
+|---|---|---|
+| Supervisor | The brief, the monitoring loop, the context budget, the escalation | Implementation, code review |
+| Advisor | One contract, judgment, verification, acceptance | Silent scope change |
+| Worker | One bounded implementation assignment from its advisor | Judgment, acceptance |
+
+`/delegate` owns the worker boundary and the fan-out policy. Read `/delegate`
+for worker limits and model policy. Restate neither here.
+
+`/spec` owns the build loop the advisor runs. `/prd` and `/plan` own the
+contract documents. `/herdr` owns the full pane command catalog. `/escalate`
+owns the operator channel. `/ste` owns the prose of every artifact.
+
+## Duty 1 — start an advisor session
+
+Start the advisor at the harness root. A tab that opens in a project clone puts
+the advisor below the sandbox boundary, where the advisor edits application
+code outside its worktree.
+
+Read the supervisor's own pane id first.
+
+```bash
+herdr pane current | jq -r '.result.pane.pane_id'
+```
+
+Start the advisor with the harness root and the supervisor pane in its
+environment.
+
+```bash
+herdr agent start advisor-1 \
+  --cwd /home/sandbox/harness \
+  --env AGRO_SUPERVISOR_PANE=w6:p5 \
+  --no-focus -- claude
+```
+
+`AGRO_SUPERVISOR_PANE` names the supervisor's own pane. `/escalate` reads that
+variable, so the advisor resolves its supervisor without a flag.
+
+A tab carries the same two options when the advisor needs its own tab.
+
+```bash
+herdr tab create --cwd /home/sandbox/harness \
+  --env AGRO_SUPERVISOR_PANE=w6:p5 --label advisor-1 --no-focus
+```
+
+Confirm the resolved working directory after creation.
+
+```bash
+herdr pane get w6:p7 | jq -r '.result.pane.cwd, .result.pane.foreground_cwd'
+```
+
+The creation payload reports the requested `--cwd`. The creation payload proves
+no resolved working directory. Only `herdr pane get <pane>` reports the pane
+state the shell resolved. Read `/herdr` for every other pane command.
+
+## Duty 2 — brief the advisor
+
+A brief points at the contract. A brief copies no contract. The contract sits
+on disk, and a restated PRD spends the context the supervisor exists to
+protect.
+
+### The brief template
+
+1. Name the contract file and the exact section. Example: `plan.md`, section
+   Definition of Done, D1 through D11.
+2. Name the route file and its story range. Example: `prd.md`, US-001 through
+   US-016.
+3. Define done: the named command ran, the expected result appeared, and the
+   output landed in `evidence.md` under its D-ID.
+4. Name the escalation triggers from Duty 5.
+5. List every criterion the run already meets.
+6. State every fact the advisor cannot read from a file. Example: the database
+   URI the sandbox needs differs from the default line in `.env.example`.
+7. Name the role: the advisor assigns tracked edits to bounded workers, and the
+   advisor keeps judgment and acceptance.
+
+### The verb selects the role
+
+A brief that says "implement" produces an implementer. A first brief that said
+"implement, gates green, commit" named no orchestration, so the advisor wrote
+every file itself through two stories. Write step 7 in these words instead:
+
+```text
+You are the advisor. Assign every tracked edit to a bounded worker through
+/delegate. Keep goal interpretation, verification, and acceptance. Run each
+gate command yourself.
+```
+
+`/delegate` owns the worker count, the wave policy, and the model policy. Name
+none of those numbers in the brief.
+
+### Send the brief in two steps
+
+`herdr agent send` writes literal text into the pane. `herdr agent send`
+submits nothing. Send the text, then submit with a separate call.
+
+```bash
+herdr agent send w6:p7 "$(cat /tmp/brief.txt)"
+herdr pane send-keys w6:p7 Enter
+```
+
+`herdr pane run <pane> <command>` sends command text plus Enter. Use
+`herdr pane run` against a shell. Use the two-step send against a running
+agent. A message that arrives while the advisor works queues and runs on the
+advisor's next turn.
+
+## Duty 3 — monitor
+
+Read the pane. Never attach. `herdr agent attach` takes over the operator's
+client.
+
+```bash
+herdr agent list | jq -r '.result.agents[] | "\(.pane_id)\t\(.agent_status)"'
+herdr pane read w6:p7 --source recent --lines 120
+herdr agent wait w6:p7 --status idle --timeout 900000
+```
+
+`herdr pane read` returns plain text. Every other group returns one JSON line.
+
+Read three signals in one look:
+
+1. `agent_status` from `herdr agent list`.
+2. The context percentage in the status line.
+3. The last screen from `herdr pane read`.
+
+The status line carries the percentage in this shape:
+
+```text
+[<model>] 15% context | <branch>
+```
+
+Judge role fidelity from artifacts, not from the pane's claims. Read three
+artifacts:
+
+- the commit log, which shows who wrote each tracked edit;
+- the `passes` flags in `prd.json`, which record criterion completion;
+- `progress.txt`, which records the advisor's own narrative.
+
+An announcement interrupt costs more than the announcement delivers. A file on
+disk needs no message. Point at the file at the next seam.
+
+## Duty 4 — own the context budget
+
+The supervisor decides when the advisor compacts.
+
+| Context | Supervisor action |
+|---|---|
+| Below 50% | Take no action |
+| 50% to 70% | Watch for the next story boundary |
+| 70% to 80% | Direct a compaction at the first clean seam |
+| Above 85% | Direct a compaction at the next safe stop, and tell the operator |
+
+A clean seam holds four conditions at once:
+
+1. The advisor committed the current story.
+2. The gates report green.
+3. No half-written edit remains open.
+4. No worker still runs.
+
+Direct the compaction with an explicit carry-forward. The carry-forward names
+five items:
+
+- the contract path;
+- the current story and its criteria;
+- the invariants;
+- the decisions since the last compaction;
+- the open deviations.
+
+The compaction drops tool output and file dumps. Re-anchor the advisor
+afterward by pointing at the files. A file read costs less than a file dump
+that survived the compaction.
+
+Durable state belongs in files. An advisor that appends `progress.txt` and
+`evidence.md` once per story loses little to a compaction.
+
+## Duty 5 — escalate
+
+Escalate on three triggers:
+
+1. A blocked prerequisite.
+2. A decision outside the contract.
+3. A criterion that fails twice.
+
+Quote the pane output the escalation rests on. Never report an agent state
+without the `herdr agent list` output or the `herdr pane read` output behind
+the claim.
+
+An advisor escalation arrives at the supervisor first. The supervisor holds the
+contract and the run history, so the supervisor answers most advisor questions
+without a person. When the operator reads the supervisor's own session, ask the
+operator there and skip the channel.
+
+`/escalate` delivers to the supervisor pane first and sends the Slack
+notification second. The Slack notification no-ops when no channel exists. On a
+no-op the operator returns to the session to decide, so record the blocker in
+`evidence.md`. Read `/escalate` for the flags, the exit codes, and the
+destination contract. Repeat no gateway detail here.
+
+## Supervise more than one advisor
+
+Each advisor owns one branch and one worktree. Two advisors never share one
+checkout, because a branch switch in a shared checkout destroys the other
+advisor's uncommitted work. `/worktrees` owns the worktree layout.
+
+Cap one supervisor at **three advisors**. One poll cycle costs the supervisor a
+120-line pane read plus three artifact reads per advisor. At four advisors the
+supervisor fills its own context before the slowest advisor reaches its first
+seam, and a supervisor that compacts mid-run loses the run history the
+escalations rest on.
+
+Poll in this order, and stop at the first advisor that ranks:
+
+1. Any advisor with `agent_status` of `blocked`.
+2. Any advisor above 85% context.
+3. Any advisor idle at a story boundary.
+4. Any advisor above 70% context.
+5. The advisor with the oldest last read.
+
+A supervisor supervises no supervisor. The chain ends at the operator.
+
+## Failure modes
+
+Five failures came out of the first supervised run. Each entry names the
+symptom, the cause, and the correction.
+
+**1. A brief that says "implement" produces an implementer.**
+Symptom: the advisor wrote every tracked file itself through two stories.
+Cause: the first brief said "implement, gates green, commit" and named no
+orchestration. Correction: the brief states that the advisor assigns tracked
+edits to bounded workers and keeps judgment and acceptance. The correction cost
+one story of discarded work.
+
+**2. A child tab starts below the harness root.**
+Symptom: a tab opened in the project clone put the advisor below the sandbox
+boundary. Cause: the creation payload reported the requested `--cwd`, and the
+shell resolved a different directory. Correction: run `herdr pane get <pane>`
+after creation and read the resolved `cwd`.
+
+**3. An interrupt for an announcement costs more than the announcement
+delivers.**
+Symptom: a mid-turn message queued and displaced the advisor's next action.
+Cause: the supervisor announced a file the advisor could read. Correction:
+write the file, then point at the file at the next seam.
+
+**4. A task contract without `prd.json` records no completion.**
+Symptom: the run reached story four with no machine-readable completion state.
+Cause: the task folder carried `prd.md` alone. Correction: generate `prd.json`
+with `/ralph` when the PRD lands.
+
+**5. `herdr agent send` types text without submitting.**
+Symptom: the brief sat unsent in the advisor's prompt. Cause: `agent send`
+writes literal text. Correction: send the text, then send
+`herdr pane send-keys <pane> Enter`.
+
+## What the first run got right
+
+- The advisor repaired a worker's gaps with the same worker, not a fresh one.
+- The advisor ran the gate commands itself, and trusted no worker summary.
+- The supervisor caught the delegation gap at story two, not at story ten.
+
+## Composition
+
+`/supervisor` composes and forks nothing.
+
+| Skill | Owns |
+|---|---|
+| `/delegate` | Fan-out policy, worker limits, model policy |
+| `/spec` | The build loop the advisor runs |
+| `/prd` and `/plan` | The contract documents |
+| `/herdr` | The pane command catalog |
+| `/escalate` | The operator channel |
+| `/worktrees` | The worktree layout |
+| `/ste` | The prose of every artifact |
+
+Read the owning skill before restating any rule from the table.

````

## SI-0009 · 2026-09-12 · builder · PROPOSED

- **proposal**: Give `/escalate` a supervisor destination delivered before Slack, report a per-destination outcome, and move the quiet-window check ahead of every delivery.
- **target**: `.agro/skills/escalate/SKILL.md` and `.agro/skills/escalate/scripts/escalate.sh`
- **motivating patterns**: `[[pattern-scripts-sibling-dependency-standalone-copies]]`
- **proposer**: /spec execute for #1057, operator request in the active session
- **diff**: see `.agro/skills/escalate/` in PR #1059 (211 lines of SKILL.md, 206 of escalate.sh); the full hunk set exceeds the ledger inline budget


## SI-0010 · 2026-09-13 · builder · PROPOSED

- **proposal**: Keep `/supervisor` metadata within the provider description limit and rewrite its changed prose in Simplified Technical English, so the skill loads without a conflict and passes the prose gate.
- **target**: `.agro/skills/supervisor/SKILL.md`
- **motivating patterns**: `none (direct request)`
- **proposer**: /builder skill supervisor for #1062, with `/ste`
- **diff**:

````markdown
```diff
diff --git a/.agro/skills/supervisor/SKILL.md b/.agro/skills/supervisor/SKILL.md
index 402d5708..9bfdb89a 100644
--- a/.agro/skills/supervisor/SKILL.md
+++ b/.agro/skills/supervisor/SKILL.md
@@ -4,15 +4,3 @@ description: |
-  Own a build session from outside it, without writing code and without
-  reviewing code. The owned session carries the advisor behavior and occupies
-  its own Herdr pane. Start that session at the harness root, brief it with a
-  pointer to the contract, monitor progress from artifacts, own its context
-  budget, and carry a blocker to the operator.
-  TRIGGER when: asked to supervise, babysit, watch, or drive an agent in
-  another pane; asked to "run this build in a second pane and keep it on
-  track"; asked to own a long build to its Definition of Done from outside the
-  implementing session; an advisor session needs a brief, a compaction
-  decision, or an escalation route; asked "what is the advisor doing" or "is
-  the advisor still on the contract".
-  Do NOT trigger when the active session implements the work itself, when the
-  request asks for a code review, when the request asks to dispatch bounded
-  workers inside one session (use /delegate), or when the request asks to run
-  a single `herdr` command (use /herdr).
+  Supervise advisor sessions from outside them. Do not write or review code. Start each advisor in a new Herdr tab at the harness root with bypass permissions. Brief each advisor with a contract pointer. Monitor artifacts, own context budgets, and carry blockers to the operator.
+  TRIGGER when: asked to supervise, babysit, watch, or drive an agent in another pane; asked to "run this build in a second pane and keep it on track"; asked to own a long build to its Definition of Done from outside the implementing session; an advisor needs a brief, a compaction decision, or an escalation route; asked "what is the advisor doing" or "is the advisor still on the contract".
+  Do NOT trigger when the active session implements the work; when the request asks for a code review; when the request asks to dispatch bounded workers inside one session (use /delegate); or when the request asks to run a single `herdr` command (use /herdr).
@@ -56,3 +44,2 @@ owns the operator channel. `/ste` owns the prose of every artifact.
-Start the advisor at the harness root. A tab that opens in a project clone puts
-the advisor below the sandbox boundary, where the advisor edits application
-code outside its worktree.
+Start the advisor in a new tab in the supervisor's own workspace, at the harness
+root, in bypass permissions mode. Three conditions hold together.
@@ -60 +47,11 @@ code outside its worktree.
-Read the supervisor's own pane id first.
+- **A new tab, never a split pane.** A split divides the supervisor's own tab
+  and shrinks both. `herdr agent start` splits by default, so create the tab
+  first and launch the harness inside it.
+- **The harness root.** A tab that opens in a project clone puts the advisor
+  below the sandbox boundary, where the advisor edits application code outside
+  its worktree.
+- **Bypass permissions.** An advisor runs unattended. A manual permission prompt
+  blocks the advisor on a person who is not watching, and the run stalls with no
+  signal to the supervisor.
+
+Read the supervisor's own pane id and workspace first.
@@ -63 +60 @@ Read the supervisor's own pane id first.
-herdr pane current | jq -r '.result.pane.pane_id'
+herdr pane current | jq -r '.result.pane.pane_id, .result.pane.workspace_id'
@@ -66,2 +63 @@ herdr pane current | jq -r '.result.pane.pane_id'
-Start the advisor with the harness root and the supervisor pane in its
-environment.
+Create the tab in that workspace.
@@ -70,4 +66,2 @@ environment.
-herdr agent start advisor-1 \
-  --cwd /home/sandbox/harness \
-  --env AGRO_SUPERVISOR_PANE=w6:p5 \
-  --no-focus -- claude
+herdr tab create --workspace w7 --cwd /home/sandbox/harness \
+  --env AGRO_SUPERVISOR_PANE=w7:p1 --label advisor-1 --no-focus
@@ -79 +73 @@ variable, so the advisor resolves its supervisor without a flag.
-A tab carries the same two options when the advisor needs its own tab.
+Confirm the resolved working directory before you launch the harness.
@@ -82,2 +76 @@ A tab carries the same two options when the advisor needs its own tab.
-herdr tab create --cwd /home/sandbox/harness \
-  --env AGRO_SUPERVISOR_PANE=w6:p5 --label advisor-1 --no-focus
+herdr pane get w7:p4 | jq -r '.result.pane.cwd, .result.pane.foreground_cwd'
@@ -86 +79,5 @@ herdr tab create --cwd /home/sandbox/harness \
-Confirm the resolved working directory after creation.
+The creation payload reports the requested `--cwd`. The creation payload proves
+no resolved working directory. Only `herdr pane get <pane>` reports the pane
+state the shell resolved.
+
+Launch the coding harness in bypass permissions mode.
@@ -89 +86 @@ Confirm the resolved working directory after creation.
-herdr pane get w6:p7 | jq -r '.result.pane.cwd, .result.pane.foreground_cwd'
+herdr pane run w7:p4 "claude --dangerously-skip-permissions"
@@ -92,3 +89,23 @@ herdr pane get w6:p7 | jq -r '.result.pane.cwd, .result.pane.foreground_cwd'
-The creation payload reports the requested `--cwd`. The creation payload proves
-no resolved working directory. Only `herdr pane get <pane>` reports the pane
-state the shell resolved. Read `/herdr` for every other pane command.
+Wait for the harness, then read the mode from the status line before you brief.
+
+```bash
+herdr agent wait w7:p4 --status idle --timeout 90000
+herdr pane read w7:p4 --source recent --lines 5
+```
+
+The status line reports the mode in this shape:
+
+```text
+bypass permissions on (shift+tab to cycle)
+```
+
+A status line that reports no bypass mode means the advisor runs in manual mode.
+Close the tab and start again. Never brief an advisor in manual mode.
+
+Name the agent last, so `herdr agent list` reports the advisor by its role.
+
+```bash
+herdr agent rename w7:p4 advisor-1
+```
+
+Read `/herdr` for every other pane command.
@@ -146,0 +164,22 @@ advisor's next turn.
+### Confirm the prompt targets the advisor before every send
+
+An advisor that dispatches workers can leave its own prompt addressed to a
+worker. The prompt then reads `Message @general-purpose…` instead of the
+default placeholder, and `herdr agent send` delivers into the worker channel.
+The worker receives supervisor text its dispatcher never sent, acts on it, and
+reports work the advisor cannot account for.
+
+Check the prompt before every send, not only the first.
+
+```bash
+herdr pane read <pane> --source visible | grep -c 'Message @'
+```
+
+A count of `0` means the prompt targets the advisor. Any other count means the
+prompt targets a worker. Press `Left` to leave the agent selector, confirm the
+count returns to `0`, then send.
+
+Never send to an advisor pane without this check. A misrouted brief is
+indistinguishable, from the advisor's side, from a worker that invented its own
+instructions.
+
@@ -263 +302 @@ A supervisor supervises no supervisor. The chain ends at the operator.
-Five failures came out of the first supervised run. Each entry names the
+Eight failures came out of the supervised runs so far. Each entry names the
@@ -294,0 +334,25 @@ writes literal text. Correction: send the text, then send
+**6. An advisor in manual permission mode blocks with no signal.**
+Symptom: the advisor sat at a permission prompt and reported `idle`, so the
+supervisor read the status as progress. Cause: the harness launched without
+bypass permissions. Correction: launch with
+`claude --dangerously-skip-permissions`, and read `bypass permissions on` from
+the status line before the brief.
+
+**7. `herdr agent start` splits the supervisor's own tab.**
+Symptom: the advisor landed as a pane inside the supervisor's tab and halved
+the supervisor's own view. Cause: `herdr agent start` splits by default.
+Correction: create the tab with `herdr tab create --workspace <id>`, then launch
+the harness in it with `herdr pane run`.
+
+**8. A send to an advisor pane reaches the advisor's worker.**
+Symptom: the advisor escalated that a bounded worker had edited a tracked file
+on instructions its dispatcher never sent, and suspected the worker of
+confabulating an operator reply. Cause: the supervisor ran `herdr agent send`
+while the advisor's prompt targeted `@general-purpose`, so Herdr delivered the
+supervisor's escalation reply into the worker channel. The worker acted
+faithfully on real instructions that reached it through no legitimate route.
+Correction: grep the visible pane for `Message @` before every send, and clear
+the agent selector with `Left` until the count is `0`. Tell the advisor when the
+provenance surfaces. If the advisor cannot source an instruction, the advisor
+must revert the work and stop.
+
```
````

## SI-0011 · 2026-09-13 · builder · PROPOSED

- **proposal**: Require supervisor-created tabs to use `agent-*` names for agent tabs and `dev-*` names for development environment tabs, so tab purpose stays visible in Herdr.
- **target**: `.agro/skills/supervisor/SKILL.md`
- **motivating patterns**: `none (direct request)`
- **proposer**: /builder skill supervisor for #1062, with `/ste`
- **diff**:

````markdown
```diff
diff --git a/.agro/skills/supervisor/SKILL.md b/.agro/skills/supervisor/SKILL.md
index 9bfdb89a..6bf5abdc 100644
--- a/.agro/skills/supervisor/SKILL.md
+++ b/.agro/skills/supervisor/SKILL.md
@@ -55,0 +56,3 @@ root, in bypass permissions mode. Three conditions hold together.
+- **Tab names.** Prefix every created tab with its purpose. Use an `agent-*` name
+  for an agent tab. Use a `dev-*` name for a development environment tab. Put
+  the prefix in the tab name or label.
@@ -67 +70 @@ herdr tab create --workspace w7 --cwd /home/sandbox/harness \
-  --env AGRO_SUPERVISOR_PANE=w7:p1 --label advisor-1 --no-focus
+  --env AGRO_SUPERVISOR_PANE=w7:p1 --label agent-advisor-1 --no-focus
```
````

## SI-0012 · 2026-09-14 · builder · PROPOSED

- **proposal**: Require bounded supervisor monitors and advisor output reports to prevent polling and reverse Herdr messages while preserving supervisor-owned escalation.
- **target**: `.agro/skills/supervisor/SKILL.md`
- **motivating patterns**: none (direct request)
- **proposer**: /builder skill supervisor, bounded writer T5 for `.agro/tasks/supervisor-monitor-contract/prd.md`
- **scope**: The proposal diff excludes concurrent unrelated section 10 and its general-form paragraph. The accepted patch leaves both unchanged.
- **diff**: Compare the HEAD supervisor with the current supervisor minus that concurrent block in scratch.

````diff
--- a/.agro/skills/supervisor/SKILL.md
+++ b/.agro/skills/supervisor/SKILL.md
@@ -1,10 +1,10 @@
 ---
 name: supervisor
 description: |
-  Supervise advisor sessions from outside them. Do not write or review code. Start each advisor in a new Herdr tab at the harness root with bypass permissions. Brief each advisor with a contract pointer. Monitor artifacts, own context budgets, and carry blockers to the operator.
+  Supervise advisor sessions from outside them. Require MonitorCreate with onDone for all advisor observation and readiness waits, status checks, and output reads. Require MonitorList and MonitorStop for handle control. Never use LoopCreate or polling. Use inline Herdr commands for launch and guarded downward steering only. Block reverse Herdr messages from advisors and workers. Do not write or review code. Own context budgets and operator escalation.
   TRIGGER when: asked to supervise, babysit, watch, or drive an agent in another pane; asked to "run this build in a second pane and keep it on track"; asked to own a long build to its Definition of Done from outside the implementing session; an advisor needs a brief, a compaction decision, or an escalation route; asked "what is the advisor doing" or "is the advisor still on the contract".
   Do NOT trigger when the active session implements the work; when the request asks for a code review; when the request asks to dispatch bounded workers inside one session (use /delegate); or when the request asks to run a single `herdr` command (use /herdr).
-allowed-tools: Bash, Read, Grep
+allowed-tools: Bash, Read, Grep, MonitorCreate, MonitorList, MonitorStop
 ---

 # Supervisor
@@ -22,13 +22,29 @@
 - The supervisor changes no file the advisor owns.
 - The supervisor stays accountable for the advisor reaching its Definition of
   Done.
+- Require `MonitorCreate`, `MonitorList`, and `MonitorStop` before launching or
+  claiming supervision. If any tool is unavailable, stop and report the blocker.
+- Use `MonitorCreate` with `onDone` for all advisor observation, readiness waits,
+  status checks, output reads, and progress or evidence reads.
+- Never call `LoopCreate`, including event variants. Never use a recurring
+  scheduler, shell polling, sleep loops, or a blocking Bash wait fallback.
+- Use inline Herdr commands only for launch and guarded downward steering.
+  Short launch, working-directory, and send-target checks can use Bash as action
+  prerequisites. These checks are not a monitoring fallback.
+  Run all Herdr observation commands through `MonitorCreate`.
+- Advisors and workers must not send Herdr messages back to the supervisor.
+  This ban includes direct sends, `/escalate --supervisor`, inherited destinations,
+  and relays. Workers report to the advisor through native worker output only.
+  Advisors report through normal output and own existing progress/evidence files.
+- The supervisor owns operator escalation. Advisors and workers must not bypass
+  the supervisor through Slack or invoke `/escalate` to notify the supervisor.

 Three behaviors carry three jobs. Keep the three apart. Each name below is a
 behavior, not an identity, a model, or a terminal.

 | Behavior | Owns | Never does |
 |---|---|---|
-| supervisor | The brief, the monitoring loop, the context budget, the escalation | Implementation, code review |
+| supervisor | The brief, bounded monitors, the context budget, the escalation | Implementation, code review |
 | advisor | One contract, judgment, verification, acceptance | Silent scope change |
 | worker | One bounded implementation assignment from its advisor | Judgment, acceptance |

@@ -67,11 +83,10 @@

 ```bash
 herdr tab create --workspace w7 --cwd /home/sandbox/harness \
-  --env AGRO_SUPERVISOR_PANE=w7:p1 --label agent-advisor-1 --no-focus
+  --env AGRO_SUPERVISOR_PANE= --label agent-advisor-1 --no-focus
 ```

-`AGRO_SUPERVISOR_PANE` names the supervisor's own pane. `/escalate` reads that
-variable, so the advisor resolves its supervisor without a flag.
+Clear the inherited supervisor destination in the tab environment.

 Confirm the resolved working directory before you launch the harness.

@@ -83,17 +98,23 @@
 no resolved working directory. Only `herdr pane get <pane>` reports the pane
 state the shell resolved.

-Launch the coding harness in bypass permissions mode.
+Launch the coding harness in bypass permissions mode. Use the same sanitized
+command on every restart.

 ```bash
-herdr pane run w7:p4 "claude --dangerously-skip-permissions"
+herdr pane run w7:p4 "env -u AGRO_SUPERVISOR_PANE claude --dangerously-skip-permissions"
 ```

-Wait for the harness, then read the mode from the status line before you brief.
+Submit this finite readiness command through `MonitorCreate`, not inline Bash.
+Record its handle as Duty 3 requires. Inspect the mode before briefing.

-```bash
-herdr agent wait w7:p4 --status idle --timeout 90000
-herdr pane read w7:p4 --source recent --lines 5
+```json
+{
+  "command": "bash -c 'set +e; herdr agent wait w7:p4 --status idle --timeout 90000; wait_rc=$?; herdr agent list; herdr pane read w7:p4 --source recent --lines 5; exit \"$wait_rc\"'",
+  "description": "advisor-1 readiness at w7:p4",
+  "timeout": 120000,
+  "onDone": "Reconcile this monitor ID with advisor-1 at w7:p4. Review the wait result and fresh status/output. Verify root and bypass mode before the first brief. Startup idle is not brief completion. Apply Duty 3 failure rules; do not retry or relaunch automatically."
+}
 ```

 The status line reports the mode in this shape:
@@ -102,8 +123,9 @@
 bypass permissions on (shift+tab to cycle)
 ```

-A status line that reports no bypass mode means the advisor runs in manual mode.
-Close the tab and start again. Never brief an advisor in manual mode.
+If fresh output does not confirm bypass mode, do not brief the advisor.
+If the output confirms manual mode, close the owned tab and start again with
+the sanitized launch command. Apply Duty 3 to observation failures.

 Name the agent last, so `herdr agent list` reports the advisor by its role.

@@ -133,6 +155,8 @@
    URI the sandbox needs differs from the default line in `.env.example`.
 7. Name the role: the advisor assigns tracked edits to bounded workers, and the
    advisor keeps judgment and acceptance.
+8. Include the communication boundary below. Require the advisor to pass this
+   boundary to every worker.

 ### The verb selects the role

@@ -144,6 +168,15 @@
 You are the advisor. Assign every tracked edit to a bounded worker through
 /delegate. Keep goal interpretation, verification, and acceptance. Run each
 gate command yourself.
+
+You and your workers must not send Herdr messages back to the supervisor.
+Do not use direct sends, /escalate --supervisor, AGRO_SUPERVISOR_PANE,
+other inherited destinations, or relays. Do not invoke /escalate to notify
+this supervisor. Do not bypass the supervisor through Slack.
+Workers report to you through native worker output only. You own the existing
+progress/evidence files and report progress, blockers, and decisions there
+and in your normal output. Required decisions remain blocked until supervisor
+direction. The supervisor owns operator escalation.
 ```

 `/delegate` owns the worker count, the wave policy, and the model policy. Name
@@ -188,22 +221,54 @@

 ## Duty 3 — monitor

-Read the pane. Never attach. `herdr agent attach` takes over the operator's
-client.
-
-```bash
-herdr agent list | jq -r '.result.agents[] | "\(.pane_id)\t\(.agent_status)"'
-herdr pane read w6:p7 --source recent --lines 120
-herdr agent wait w6:p7 --status idle --timeout 900000
-```
-
-`herdr pane read` returns plain text. Every other group returns one JSON line.
-
-Read three signals in one look:
-
-1. `agent_status` from `herdr agent list`.
-2. The context percentage in the status line.
-3. The last screen from `herdr pane read`.
+Never attach. `herdr agent attach` takes over the operator's client.
+Submit observation commands through `MonitorCreate`; never run observation inline.
+Keep one active monitor per advisor, including readiness and artifact reads.
+Record the monitor ID, advisor pane ID, contract path, and expected wait state
+in the supervisor's run record.
+
+For a working advisor, submit this `MonitorCreate` call. Substitute the owned
+pane and contract before submission.
+
+```json
+{
+  "command": "bash -c 'set +e; herdr agent wait w6:p7 --status idle --timeout 900000; wait_rc=$?; herdr agent list; herdr pane read w6:p7 --source recent --lines 120; exit \"$wait_rc\"'",
+  "description": "advisor at w6:p7: bounded idle wait",
+  "timeout": 930000,
+  "onDone": "Reconcile this monitor ID, pane w6:p7, and the recorded contract. Review the real wait exit, status list, pane snapshot, and fresh artifacts. Judge completion, context, and blockers. Apply Duty 3 state and failure rules. Re-arm only after judgment if unfinished and unblocked; otherwise stop. Never infer Definition of Done from idle or the wait exit."
+}
+```
+
+The Herdr wait blocks server-side for at most 900000 milliseconds. The monitor
+allows 30000 additional milliseconds for snapshots. The command attempts both
+snapshots even after a nonzero wait exit and preserves the real wait exit.
+Inspect snapshot errors separately; the final exit reports only the wait.
+`herdr pane read` returns plain text. `herdr agent list` returns JSON.
+`onDone` can internally schedule a completion wake. Never add a separate
+`LoopCreate` call or claim monitor persistence beyond the `MonitorCreate` contract.
+
+### Choose the next observation
+
+1. After the brief or another downward send, first wait for `working` through
+   a bounded monitor. Startup `idle` does not mean the brief completed.
+2. If the advisor is working, use the bounded `idle` wait above.
+3. If the advisor is already idle, inspect output and artifacts once. Decide
+   whether to accept, stop, or steer. After steering, wait for `working` first.
+   Never repeatedly arm an `idle` wait against an idle advisor.
+4. Treat a timeout as an inspection checkpoint. Read fresh output and artifacts
+   through a finite monitor. A fast transition can finish before detection;
+   never resend the brief automatically because detection missed a transition.
+5. On connection errors, malformed output, unknown state, or a missing pane,
+   stop the retry chain and report a blocker. Do not relaunch automatically.
+6. Re-arm only after judging fresh evidence and finding unfinished, unblocked
+   work. Stop monitoring after acceptance, cancellation, or an operator blocker.
+
+An idle state, a successful wait, or a timeout proves no Definition of Done.
+Review three signals from monitor output together:
+
+- `agent_status` from `herdr agent list`;
+- the context percentage in the status line;
+- the last screen from `herdr pane read`.

 The status line carries the percentage in this shape:

@@ -211,12 +276,26 @@
 [<model>] 15% context | <branch>
 ```

-Judge role fidelity from artifacts, not from the pane's claims. Read three
-artifacts:
-
-- the commit log, which shows who wrote each tracked edit;
-- the `passes` flags in `prd.json`, which record criterion completion;
-- `progress.txt`, which records the advisor's own narrative.
+Read existing artifacts through finite monitors, not inline observation tools.
+Use read-only commands such as `git log`, `jq`, and `cat` against the advisor's
+worktree and recorded contract paths. Inspect the commit log for edit ownership,
+`prd.json` for `passes` flags, and `progress.txt` for the advisor's narrative.
+Read the contract's existing evidence artifact for criterion results. Judge role
+fidelity and completion from these artifacts, not from pane claims. Review no code.
+
+### Reconcile handles and resume
+
+Use `MonitorList` before creating or replacing a monitor. Match each handle to
+its recorded pane and contract. Use `MonitorStop` to stop duplicate or obsolete
+handles before creating a replacement. Stop remaining handles at terminal states.
+
+On a late callback, compare its monitor ID with the current record. Ignore stale
+callbacks for steering and re-arming. After a supervisor restart, reconcile
+`MonitorList` with the record. Keep a matching active monitor and review its
+output when it completes. Then inspect fresh artifacts through a finite monitor.
+If no matching monitor exists, inspect the pane and artifacts through one finite
+monitor before deciding the next wait. Never duplicate a launch because a monitor
+handle is missing. Herdr session persistence does not prove monitor persistence.

 An announcement interrupt costs more than the announcement delivers. A file on
 disk needs no message. Point at the file at the next seam.
@@ -240,13 +319,18 @@
 4. No worker still runs.

 Direct the compaction with an explicit carry-forward. The carry-forward names
-five items:
+six items:

 - the contract path;
 - the current story and its criteria;
 - the invariants;
 - the decisions since the last compaction;
-- the open deviations.
+- the open deviations;
+- the communication boundary: workers report to advisors through native worker
+  output only. Advisors own progress/evidence files and report there and in normal
+  output. Both roles must not use reverse Herdr sends, `/escalate --supervisor`,
+  inherited destinations, relays, or a Slack bypass. Required decisions remain
+  blocked until supervisor direction. The supervisor owns operator escalation.

 The compaction drops tool output and file dumps. Re-anchor the advisor
 afterward by pointing at the files. A file read costs less than a file dump
@@ -267,16 +351,27 @@
 without the `herdr agent list` output or the `herdr pane read` output behind
 the claim.

-An advisor escalation arrives at the supervisor first. The supervisor holds the
-contract and the run history, so the supervisor answers most advisor questions
-without a person. When the operator reads the supervisor's own session, ask the
-operator there and skip the channel.
-
-`/escalate` delivers to the supervisor pane first and sends the Slack
-notification second. The Slack notification no-ops when no channel exists. On a
-no-op the operator returns to the session to decide, so record the blocker in
-`evidence.md`. Read `/escalate` for the flags, the exit codes, and the
-destination contract. Repeat no gateway detail here.
+The supervisor reads blockers in advisor output and existing artifacts through
+monitors. Prohibit reverse Herdr notifications. Answer within the contract
+through guarded downward steering. If the decision needs the operator, keep the
+advisor blocked. Ask in the supervisor's own session when the operator reads it.
+Otherwise, the supervisor uses the sanitized Slack-only escalation command:
+
+```bash
+env -u AGRO_SUPERVISOR_PANE bash .agro/skills/escalate/scripts/escalate.sh \
+  --summary "<blocker>" --needs "<operator decision>" \
+  --tried "<attempts and results>" --key "<stable-blocker-key>"
+```
+
+Do not pass `--supervisor`. Advisors and workers must not send this escalation
+or use Slack as a bypass. This restriction belongs to the supervisor workflow;
+other callers retain the general `/escalate` contract.
+
+Check actual Slack delivery in `.destinations.slack.ok` and read the reason.
+Exit 0 alone proves no delivery. On a no-op or failure, preserve the blocker and
+delivery evidence in the supervisor's run record and surface it to the operator.
+Keep the advisor blocked until direction arrives. Read `/escalate` for flags,
+exit codes, deduplication, and delivery evidence.

 ## Supervise more than one advisor

@@ -284,26 +379,20 @@
 checkout, because a branch switch in a shared checkout destroys the other
 advisor's uncommitted work. `/worktrees` owns the worktree layout.

-Cap one supervisor at **three advisors**. One poll cycle costs the supervisor a
-120-line pane read plus three artifact reads per advisor. At four advisors the
-supervisor fills its own context before the slowest advisor reaches its first
-seam, and a supervisor that compacts mid-run loses the run history the
-escalations rest on.
-
-Poll in this order, and stop at the first advisor that ranks:
+Cap one supervisor at **three advisors**. Keep one active monitor per advisor.
+If multiple monitors complete, review their results in this priority order:

 1. Any advisor with `agent_status` of `blocked`.
 2. Any advisor above 85% context.
 3. Any advisor idle at a story boundary.
 4. Any advisor above 70% context.
-5. The advisor with the oldest last read.
+5. The advisor whose evidence has waited longest for review.

 A supervisor supervises no supervisor. The chain ends at the operator.

 ## Failure modes

-Eight failures came out of the supervised runs so far. Each entry names the
-symptom, the cause, and the correction.
+Each entry names a symptom, a cause, and a correction.

 **1. A brief that says "implement" produces an implementer.**
 Symptom: the advisor wrote every tracked file itself through two stories.
@@ -338,8 +427,8 @@
 Symptom: the advisor sat at a permission prompt and reported `idle`, so the
 supervisor read the status as progress. Cause: the harness launched without
 bypass permissions. Correction: launch with
-`claude --dangerously-skip-permissions`, and read `bypass permissions on` from
-the status line before the brief.
+`env -u AGRO_SUPERVISOR_PANE claude --dangerously-skip-permissions`, and read
+`bypass permissions on` through the readiness monitor before the brief.

 **7. `herdr agent start` splits the supervisor's own tab.**
 Symptom: the advisor landed as a pane inside the supervisor's tab and halved
@@ -359,6 +448,12 @@
 provenance surfaces. If the advisor cannot source an instruction, the advisor
 must revert the work and stop.

+**9. A reverse message can remain in the supervisor's input.**
+Symptom: the supervisor sees no actionable completion notice. Cause: reverse
+Herdr text enters an input buffer instead of a monitor completion callback.
+Correction: prohibit advisor and worker reverse sends. Read their output and
+artifacts through monitors; keep operator escalation with the supervisor.
+
 ## What the first run got right

 - The advisor repaired a worker's gaps with the same worker, not a fresh one.
````
