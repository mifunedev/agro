# PRD: Resolve the deferred Open Harness surfaces

Status: BLOCKED

## User Stories

### US-001: Record the NOTICE decision

**Description:** As the operator, I want one recorded decision for the three NOTICE files so that the `external` NOTICE rows close with a stated reason.

**Acceptance Criteria:**

- [ ] `classification.md` holds a `## Decisions` section with a NOTICE entry. The entry names `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`.
- [ ] The NOTICE entry states the operator decision `<retain | rename>` and gives one reason.
- [ ] If the decision is `retain`, the three NOTICE rows move from `## external` to a class whose rule reads "Never rewritten".
- [ ] If the decision is `retain`, `git diff --stat -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` prints nothing.
- [ ] `.agro/cli/legacy/NOTICE` keeps the literal `Open Harness` for either decision, because the file belongs to the retained `@mifune/openharness` shim.

### US-002: Record the Slack manifest decision

**Description:** As the operator, I want a check of the live registered app before the Slack manifest decision. Then the tracked manifest stays in step with the installed app.

**Acceptance Criteria:**

- [ ] The `## Decisions` section of `classification.md` holds a Slack entry. The entry records the live app name that the operator reports: `<live Slack app name>`.
- [ ] The Slack entry states the decision `<retain | coordinated rename>` and gives one reason.
- [ ] If the decision is `retain`, `git diff --stat -- .pi/install/slack-manifest.json` prints nothing, and the manifest row moves to a "Never rewritten" class.
- [ ] If the decision is `coordinated rename`, the Slack entry names the compatibility step for existing installs, and `jq -e . .pi/install/slack-manifest.json` exits 0.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.

### US-003: Rename the deferred knowledge pages through /wiki

**Description:** As a knowledge reader, I want the six `deferred` pages to name AGRO through the `/wiki` update procedure so that each page stays verified.

**Acceptance Criteria:**

- [ ] `git grep -n "Open Harness" -- .agro/knowledge/source/` prints no line in the six pages that the `## deferred` table of `classification.md` lists.
- [ ] Each edited `kind: repo` page has `verified_at:` equal to a commit on the task branch and `updated:` equal to the edit date. The update follows `.agro/skills/wiki/references/schema.md` § 11.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports none of the six slugs as needs-review.
- [ ] `bash .agro/evals/probes/wiki-readme-index.sh` exits 0.
- [ ] No `sources:` entry and no `created:` value changes in the six pages.

### US-004: Close the classification and verify the suite

**Description:** As the operator, I want the classification to show the final class of each deferred surface. Then no follow-up issue reopens a settled surface.

**Acceptance Criteria:**

- [ ] The `## Decisions` section records that `.devcontainer/openharness-cron.service` and `.devcontainer/openharness-bootstrap.service` stay retained. The section cites the earlier identity cutover.
- [ ] The `## external` and `## deferred` tables of `classification.md` list no row without a decision.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION row that the base commit does not report.
- [ ] `git diff --name-only origin/development...HEAD` lists no file outside `classification.md`, the six knowledge pages, `.agro/knowledge/README.md`, and the files that a `rename` decision in US-001 or US-002 names.

## Summary

Issue #1061 tracks the `external` and `deferred` classes that #1058 left open. The input file is `work/issue-1061.md`. This plan covers three independent decisions and one closing record.

Verified current state at HEAD `567e893`:

- The classification lives at `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md`. Git tracks the file. The `## deferred` table lists six pages with 18 hits. The `## external` table lists six files with 17 hits.
- `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE` each name `Open Harness` on line 1 and in the trademark clause on line 25.
- `.pi/install/slack-manifest.json` names `Open Harness` in `name`, `description`, and seven slash-command descriptions. The `display_name` value is `OpenHarness`.
- A line-based `git grep` finds no `Open Harness` line in `recursive-language-models.md` or `oh-cli-portable-lifecycle.md`. The classification counts one hit in each file. Correction 1 of `classification.md` states that a line-based grep misses a wrapped phrase.
- The issue cites `bash .agro/evals/run.sh`. That file does not exist. The eval runner is `.agro/skills/eval/run.sh`, with a mirror at `.claude/skills/eval/run.sh`.

Selected approach: the operator makes the NOTICE and Slack decisions. The implementation owner records each decision in `classification.md`. The owner edits the knowledge pages only through the `/wiki ingest` update path. The unit names stay unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` | `## deferred`, `## external`, `## Classes` | Record of each class and each decision |
| `NOTICE`, `.agro/cli/NOTICE`, `.agro/cli/legacy/NOTICE` | line 1 product name; `Trademarks` clause | Legal attribution surfaces for US-001 |
| `.pi/install/slack-manifest.json` | `name`, `description`, `display_name`, slash-command `description` values | Slack app manifest for US-002 |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST` | Probe that reads the manifest |
| `.agro/knowledge/source/*.md` (six pages) | frontmatter `verified_at`, `updated`; body prose | Pages for US-003 |
| `.agro/skills/wiki/references/schema.md` | § 5 Freshness; § 11 body-merge strategy | Procedure for a page update |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | Freshness check |
| `.agro/evals/probes/wiki-readme-index.sh` | probe | Index check after metadata changes |
| `.agro/skills/eval/run.sh` | suite runner | Regression floor |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slack app manifest | Conditional | Changes only for a `coordinated rename` decision in US-002 |
| NOTICE files | Conditional | Change only for a `rename` decision in US-001 |
| Knowledge pages | Prose and frontmatter | Product name and `verified_at:` change through `/wiki` |
| `mifunedev/agro-web` | N/A | No user-facing behavior or term changes in this repository's docs |

## Storage

N/A. The task adds no persistent state. Git tracks `classification.md` and each knowledge page as Markdown.

## Architectural Decisions

- `classification.md` is the single record of each class and each decision.
- The `/wiki` update procedure owns every knowledge-page edit and every `verified_at:` change.
- A published artifact name changes only after an explicit compatibility decision in `## Decisions`.
- The systemd unit names stay retained. This task does not reopen the earlier cutover.
- Surfaces: host and sandbox, applied: all edits and checks run in the sandbox. Lifecycle door: not applicable. Canonical and provider surfaces: not applicable. Root and scaffold: not applicable. Interactive and headless processes: not applicable. Local and remote operation: not applicable. Parallel operation: applied, US-001, US-002, and US-003 own separate files except `classification.md`. Public documentation: not applicable. Verification: applied, see the Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | exit 0 | The manifest keeps its admin command surface |
| `.agro/skills/wiki/scripts/knowledge-impact.sh --verified` | no row for the six slugs | Each edited page stays verified |
| `.agro/evals/probes/wiki-readme-index.sh` | exit 0 | The generated index matches page metadata |
| `.agro/skills/eval/run.sh` | no new REGRESSION row | The regression floor holds |
| `git grep -n "Open Harness" -- .agro/knowledge/source/` | no line in the six pages | The rename reached each deferred page |

Red test for US-003: before the edit, `git grep -n "Open Harness" -- .agro/knowledge/source/molt-agentic-reinforcement-learning.md` prints lines. After the edit, the command prints nothing.

## Design Principles

- Apply the smallest change that closes each class.
- Record a decision instead of an edit when the edit carries legal or compatibility risk.
- Keep one source of truth: `classification.md` for classes, `/wiki` for pages.
- Add no comments to tracked code.

## Out of Scope

- Renaming `.devcontainer/openharness-cron.service` or `.devcontainer/openharness-bootstrap.service`.
- The `historical`, `compatibility`, and `test-fixture` classes.
- A rename of the live Slack app. This repository cannot perform that action.
- Changes to `mifunedev/agro-web`.

## Open Questions

1. Does the product rename belong in the NOTICE files?
   A. Retain all three files unchanged, and close the class permanently.
   B. Rename `NOTICE` and `.agro/cli/NOTICE`, and retain `.agro/cli/legacy/NOTICE`.
   C. Other: <specify>
2. What name does the live registered Slack app use, and does the operator coordinate a rename?
   A. Retain the manifest unchanged.
   B. Rename the manifest and the live app together.
   C. Other: <specify>
3. Where does the decision record live?
   A. Edit the archived `classification.md` in place.
   B. Copy `classification.md` into this task folder and edit the copy.
4. Does the regression criterion use `bash .agro/skills/eval/run.sh` in place of the missing `.agro/evals/run.sh`?
5. The line-based grep finds no hit in `recursive-language-models.md` and `oh-cli-portable-lifecycle.md`. Does US-003 still edit a wrapped phrase in those two pages?

## Acceptance Criteria

- [ ] `classification.md` records each of the three decisions with a reason.
- [ ] Each class that the operator retains permanently carries a "Never rewritten" rule in `classification.md`.
- [ ] No published artifact name changes without an explicit compatibility decision in `## Decisions`.
- [ ] Each knowledge-page edit follows `/wiki`, and `knowledge-impact.sh --verified` reports none of the six pages.
- [ ] `bash .agro/skills/eval/run.sh` reports no new REGRESSION row.
- [ ] The pull request targets `development`.

## Lessons

Filled by the advisor before undraft.
