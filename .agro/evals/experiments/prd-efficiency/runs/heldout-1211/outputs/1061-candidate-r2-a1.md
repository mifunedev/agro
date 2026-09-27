# PRD: Resolve the deferred Open Harness name surfaces

Status: BLOCKED

## User Stories

### US-001: Record the NOTICE decision

**Description:** As the operator, I want a recorded decision for the three NOTICE files so that the legal notice class closes with its reasoning.

**Acceptance Criteria:**

- [ ] The operator states one decision for `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`: retain, or rename with a compatibility decision.
- [ ] `classification.md` holds a `## Decisions` section with a NOTICE row. The row names the decision, the operator, and the reasoning.
- [ ] If the decision is retain, the `external` NOTICE rows carry the label `retained (permanent)`.
- [ ] If the decision is retain, `git diff development -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` prints nothing.
- [ ] `diff NOTICE .agro/cli/NOTICE` and `diff NOTICE .agro/cli/legacy/NOTICE` exit 0.

### US-002: Record the Slack manifest decision

**Description:** As the operator, I want a live Slack app check before the manifest decision so that the manifest matches the registered app.

**Acceptance Criteria:**

- [ ] The operator reports the display name of the live Slack app that `.pi/install/slack-manifest.json` installs.
- [ ] `classification.md` `## Decisions` holds a Slack manifest row with the observed live name, the decision, and the reasoning.
- [ ] If the decision is retain, `git diff development -- .pi/install/slack-manifest.json` prints nothing, and the manifest rows carry the label `retained (permanent)`.
- [ ] If the decision is rename, the row names the coordinated Slack app change, and the manifest `display_information.name` matches the live app name.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.

### US-003: Rename the product name in knowledge pages through /wiki

**Description:** As a knowledge reader, I want the five knowledge pages to use the current product name so that each page stays current and verified.

**Acceptance Criteria:**

- [ ] `git grep -c "Open Harness" -- .agro/knowledge/source/` prints no line for the five pages in the `deferred` class.
- [ ] Each edit follows the `/wiki ingest` update merge in `.agro/skills/wiki/references/schema.md` § 11, and each `updated:` field holds the edit date.
- [ ] `managed-agents.md` and `oh-cli-portable-lifecycle.md` hold a `verified_at:` value equal to the commit that re-checked the claims.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports 0 pages that need review.
- [ ] `bash .agro/evals/probes/wiki-readme-index.sh` exits 0.
- [ ] `classification.md` `## Decisions` holds a knowledge-page row that names `/wiki` as the procedure.

### US-004: Record the unit-name retention and close the task

**Description:** As the operator, I want the retained unit names recorded and the eval floor checked so that the `external` and `deferred` classes close with evidence.

**Acceptance Criteria:**

- [ ] The two `.devcontainer/openharness-*.service` rows in `classification.md` carry the label `retained (permanent)` and cite the earlier identity cutover.
- [ ] `git diff development -- .devcontainer/openharness-cron.service .devcontainer/openharness-bootstrap.service` prints nothing.
- [ ] `git diff development --name-only` lists no path under `.agro/cli/` other than a NOTICE file that a US-001 rename decision names.
- [ ] `bash .claude/skills/eval/run.sh` reports no new `REGRESSION` row compared to `.agro/evals/RESULTS.md` on `development`.
- [ ] The pull request targets `development`.

## Summary

Issue #1061 tracks four surfaces that #1058 deferred. The classification table for #1058 is at `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md`. The issue names the old path `.agro/tasks/retire-open-harness-name/classification.md`. The `cleanup-tasks` cron archived the task. Git tracks the archived file.

Verified current state:

- The three NOTICE files are byte-identical. Each file names `Open Harness` on line 1 and in the Trademarks clause on line 25.
- `.agro/cli/package.json` and `.agro/cli/legacy/package.json` list `NOTICE` in `files`. Both npm packages publish the NOTICE file.
- The Trademarks clause reserves the `Open Harness` product name. The legacy package `@mifune/openharness` still carries that name.
- `.pi/install/slack-manifest.json` holds 9 hits: `display_information.name` on line 3, the description on line 4, and 7 slash-command descriptions.
- The `deferred` class lists 18 hits in 6 pages. `git grep "Open Harness"` now finds 17 hits in 5 pages. `recursive-language-models.md` holds no line match.
- `managed-agents.md` and `oh-cli-portable-lifecycle.md` are `kind: repo` pages with `verified_at:`. The other four pages are `kind: external`.
- The issue cites `bash .agro/evals/run.sh`. That file does not exist. The eval runner is `bash .claude/skills/eval/run.sh`, per `.agro/skills/eval/SKILL.md`.

Selected approach: record each decision in a new `## Decisions` section of `classification.md`. Mark each retained class in place. Edit the knowledge pages through the `/wiki ingest` update merge. Change no published artifact name without an explicit compatibility decision.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` | `## external`, `## deferred`, new `## Decisions` | The record of each decision and each retained class |
| `NOTICE`, `.agro/cli/NOTICE`, `.agro/cli/legacy/NOTICE` | line 1, Trademarks clause | Legal attribution; ships in both npm packages |
| `.agro/cli/package.json`, `.agro/cli/legacy/package.json` | `files` | Puts NOTICE into the published packages |
| `.pi/install/slack-manifest.json` | `display_information.name`, slash-command `description` | Slack app manifest |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST` | Guards manifest and bridge handler alignment |
| `.agro/knowledge/source/{molt-agentic-reinforcement-learning,managed-agents,runtime-isolation-landscape,crabbox-remote-exec-control-plane,oh-cli-portable-lifecycle}.md` | body prose, `updated:`, `verified_at:` | The five pages with hits |
| `.agro/skills/wiki/references/schema.md` | § 5 Freshness, § 11 Body-merge strategy | The page update procedure |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | The one freshness check |
| `.devcontainer/openharness-cron.service`, `.devcontainer/openharness-bootstrap.service` | `Description=` | Retained unit surfaces |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| npm packages `@mifune/agro` and `@mifune/openharness` | None, or explicit decision | NOTICE text ships in each package. US-001 records the decision. |
| Slack app manifest | None, or coordinated rename | US-002 changes the manifest only after a live app check. |
| Knowledge pages | Prose update | US-003 changes page prose and freshness fields. |

## Storage

N/A. The task changes tracked text files only. No persistent store changes.

## Architectural Decisions

- `classification.md` is the one record for each decision and each retained class. The task keeps the archived path, because the issue names that file.
- `knowledge-impact.sh` is the one freshness check. The task does not advance `verified_at:` without a re-check of the claims.
- A NOTICE file and a Slack manifest are published artifacts. Each change needs an explicit compatibility decision from the operator.
- Unit names stay. This task does not reopen the earlier identity cutover.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Full probe | The manifest and bridge handlers stay aligned |
| `.agro/evals/probes/wiki-readme-index.sh` | Full probe | The generated wiki index stays valid |
| `.agro/evals/probes/knowledge-source-freshness.sh` | Full probe | Freshness detection still works |
| `.agro/skills/wiki/scripts/knowledge-impact.sh --verified` | 0 pages need review | Each edited page stays verified |
| `bash .claude/skills/eval/run.sh` | Full suite | No new regression |
| `git grep -c "Open Harness"` | Per-class counts | Only retained classes keep hits |

The task adds no new test. Each acceptance criterion runs an existing probe or a `git` command.

## Design Principles

- Code is the source of truth. Do not add comments to tracked code.
- Keep one record per decision.
- Change a published name only with an explicit compatibility decision.
- Run each knowledge edit through `/wiki`, not through a sweep.
- Prefer a recorded retain decision over a speculative rename.

## Out of Scope

- Renaming `openharness-cron.service` or `openharness-bootstrap.service`, or their `Description=` lines.
- The `historical`, `compatibility`, and `test-fixture` classes.
- Legal advice. The operator owns the NOTICE decision.
- A Slack app change outside the manifest file.
- Public documentation in `mifunedev/agro-web`.

## Open Questions

1. NOTICE decision: retain the name as the reserved trademark, or rename it?
   - A. Retain in all three files, and mark the class permanent. Recommended: the clause protects the retired mark, and the legacy package carries the name.
   - B. Rename in `NOTICE` and `.agro/cli/NOTICE`, and retain in `.agro/cli/legacy/NOTICE`.
   - C. Other: <specify>
2. What display name does the live Slack app show? The agent cannot read the Slack workspace. The operator reports `<live app name>`.
3. Slack manifest decision after the check:
   - A. Retain the manifest, and mark the class permanent.
   - B. Rename the manifest and the live app together.
4. The archived `classification.md` holds the record. Is an edit to an archived task file acceptable, or does the record move to a new path `<path>`?
5. The `deferred` class lists 1 hit in `recursive-language-models.md`. `git grep` finds none now. Confirm that the hit is a wrapped phrase, or that the page changed after base commit `e66b9627`.

## Acceptance Criteria

- [ ] `classification.md` records the NOTICE, Slack manifest, and knowledge-page decisions, each with its reasoning.
- [ ] Each class decided as retained carries the label `retained (permanent)` in `classification.md`.
- [ ] No published artifact name changes without a recorded compatibility decision.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports 0 pages that need review.
- [ ] `bash .claude/skills/eval/run.sh` reports no new `REGRESSION` row.
- [ ] The pull request targets `development`.

## Lessons

Filled by the advisor before undraft.
