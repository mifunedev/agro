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
