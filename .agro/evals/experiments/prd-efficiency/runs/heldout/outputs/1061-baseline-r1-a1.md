# PRD: Resolve the deferred Open Harness surfaces

Status: BLOCKED

Source: issue [#1061](https://github.com/mifunedev/agro/issues/1061), split out of #1058.

## User Stories

### US-001: Record the NOTICE decision

**Description:** As the operator, I want one recorded decision for the three NOTICE files so that no later sweep reopens a legal text by accident.

**Acceptance Criteria:**

- [ ] `classification.md` holds a `## Decisions (#1061)` section with a `NOTICE` entry.
- [ ] The `NOTICE` entry names the chosen option from Open Question 1 and gives the reason in two sentences or fewer.
- [ ] If the operator chose option 1A, `git diff development -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` prints nothing.
- [ ] If the operator chose option 1A, the `external` table marks the three NOTICE rows `retained permanently`.
- [ ] `diff NOTICE .agro/cli/NOTICE` exits 0.
- [ ] `git diff development -- .agro/cli/legacy/NOTICE` prints nothing, whatever option the operator chose.

### US-002: Record the Slack manifest decision

**Description:** As the operator, I want a recorded Slack manifest decision so that no existing Slack app drifts from the repository.

**Acceptance Criteria:**

- [ ] The `## Decisions (#1061)` section holds a `slack-manifest.json` entry that names the chosen option from Open Question 2 and gives the reason.
- [ ] The entry states that each operator creates a separate Slack app from the manifest, per `docs/integrations/slack.md` § 2.
- [ ] If the operator chose option 2A, `git diff development -- .pi/install/slack-manifest.json` prints nothing.
- [ ] If the operator chose option 2C, `jq -r '.display_information.name, .features.bot_user.display_name' .pi/install/slack-manifest.json` prints `Open Harness` and `OpenHarness`.
- [ ] If the operator chose option 2C, `jq -r '.. | .description? // empty' .pi/install/slack-manifest.json | grep -c "Open Harness"` prints `0`.
- [ ] If the operator chose option 2B, the bot `display_name` and the `/invite @<bot display name>` row in `docs/integrations/slack.md` carry the same name.
- [ ] `jq -e . .pi/install/slack-manifest.json` exits 0.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.

### US-003: Rename the knowledge pages through `/wiki`

**Description:** As a knowledge reader, I want each deferred page rewritten through `/wiki ingest` so that each page keeps a valid freshness contract.

**Acceptance Criteria:**

- [ ] The `## Decisions (#1061)` section holds a knowledge-pages entry that names the chosen option from Open Question 3 and gives the reason.
- [ ] Each page edit follows `.agro/skills/wiki/references/ingest.md` § 6b and sets `updated:` to the edit date.
- [ ] `created:` stays unchanged on each of the six pages.
- [ ] For `managed-agents` and `oh-cli-portable-lifecycle`, the implementation owner re-reads every citation on the page before the owner sets `verified_at:` to the new commit.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports `FRESH` for `managed-agents` and for `oh-cli-portable-lifecycle` in a full clone.
- [ ] The same command reports `NOT-APPLICABLE` for the four `kind: external` pages.
- [ ] `git grep -c "Open Harness" -- .agro/knowledge/source/` output matches the hits that the chosen option retains, and the decision entry lists each retained hit.
- [ ] `/wiki lint` reports no schema, path, link, or `related:` finding on the six pages.
- [ ] `.agro/knowledge/README.md` comes from `/wiki lint` § 9 regeneration, not from a hand edit.
- [ ] `bash .agro/evals/probes/knowledge-source-freshness.sh` exits 0.

### US-004: Close the retained classes and verify the suite

**Description:** As the advisor, I want every deferred row closed in `classification.md` and the probe suite green so that issue #1061 closes with no open surface.

**Acceptance Criteria:**

- [ ] The `external` table marks both `openharness-*.service` rows `retained permanently`, with a reference to the earlier identity cutover.
- [ ] Each of the 12 rows in the `external` and `deferred` tables shows `retained permanently`, `renamed`, or `renamed in part`.
- [ ] `git diff development -- .devcontainer/openharness-cron.service .devcontainer/openharness-bootstrap.service` prints nothing.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION` that `development` does not also report.
- [ ] The pull request targets `development`.

## Summary

Issue #1058 retired the `Open Harness` product name from current prose. That change deferred 12 files in two classes, `external` (17 hits, 6 files) and `deferred` (18 hits, 6 files). This plan resolves those 12 files. Commit `567e893` still holds all 35 hits.

The class table lives at `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md`. The `cleanup-tasks` cron moved the task folder under `archive/2026-09-21/`. Git tracks the archived file.

Verified facts that shape the decisions:

- **NOTICE files.** The three NOTICE files hold identical text. Line 1 names the product. Line 25 names `Open Harness` as a Licensor trade name inside the Apache-2.0 Section 6 trademark clause. The published `@mifune/openharness` package ships `.agro/cli/legacy/NOTICE` through its `files` array. The published `@mifune/agro` package ships `.agro/cli/NOTICE`.
- **Slack manifest.** `.pi/install/slack-manifest.json` is a creation template. Each operator pastes the manifest into Slack to create a separate app, per `docs/integrations/slack.md` § 2. No single live app exists for the repository to check. A manifest edit does not change an app that an operator created earlier. The bot `display_name` is `OpenHarness`. `docs/integrations/slack.md:358` tells the reader to run `/invite @OpenHarness`. The probe `slack-admin-command-surface.sh` asserts the slash commands and the `message.im` event, not the names.
- **Knowledge pages.** Four of the six pages are `kind: external`. Per `schema.md` § 5, freshness does not apply to those four pages. Two pages are `kind: repo`: `managed-agents` and `oh-cli-portable-lifecycle`. A `verified_at` change on a repo page asserts that the owner re-checked every claim on the page, per the pattern `pattern-wiki-verified-at-advanced-over-unread-citations`.
- **Compatibility coupling.** The `oh-cli-portable-lifecycle` hit says "must resolve to the Open Harness pack". That sentence paraphrases the retained compatibility string at `.agro/cli/src/lib/migrate.ts:257`.
- **Shallow clone.** This checkout is a shallow clone. `knowledge-impact.sh --verified` reports `NEEDS-REVIEW` for both repo pages, because the pinned `verified_at` commits are absent. The implementation owner needs a full clone to verify both pages.
- **Eval command.** The issue names `bash .agro/evals/run.sh`. That file does not exist. The runner is `bash .agro/skills/eval/run.sh`.
- **Unit names.** The issue keeps `openharness-cron.service` and `openharness-bootstrap.service` out of scope. This plan also keeps their `Description=` lines unchanged.

Selected approach: the operator answers Open Questions 1 to 3. The implementation owner records each answer in one `## Decisions (#1061)` section of the archived `classification.md`. The owner applies only the edits that each answer allows. Each knowledge-page edit goes through `/wiki ingest` § 6b. The owner then runs `/wiki lint` and the probe suite.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` | `## external`, `## deferred`, new `## Decisions (#1061)` | Single record of each decision and each row disposition. |
| `NOTICE`, `.agro/cli/NOTICE`, `.agro/cli/legacy/NOTICE` | Line 1 header, line 25 trademark clause | Legal attribution text. The npm packages ship the two CLI copies. |
| `.agro/cli/legacy/package.json` | `name`, `files` | Proves that `@mifune/openharness` ships `NOTICE`. |
| `.pi/install/slack-manifest.json` | `display_information.name`, `features.bot_user.display_name`, slash-command `description` | Slack app creation template. |
| `docs/integrations/slack.md` | § 2, troubleshooting row at line 358 | Setup procedure and the `/invite @OpenHarness` instruction. |
| `.agro/knowledge/source/*.md` (six pages) | Frontmatter `updated`, `verified_at`; `## Summary`, `## Detail` | Pages under rename. |
| `.agro/skills/wiki/references/ingest.md` | § 6b, § 7, § 8 | Update procedure, index regeneration, orchestrator-only write gate. |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | Freshness oracle: `FRESH`, `NEEDS-REVIEW`, `NOT-APPLICABLE`. |
| `.agro/cli/src/lib/migrate.ts` | Line 257 message string | Retained compatibility string that one knowledge hit paraphrases. |
| `.agro/skills/eval/run.sh` | Suite runner | Writes `.agro/evals/RESULTS.md`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| npm package `@mifune/openharness` | None | The legacy `NOTICE` stays unchanged under every option. |
| npm package `@mifune/agro` | Conditional | Changes only under option 1B. |
| Slack app creation template | Conditional | Options 2B and 2C change the text that new Slack apps receive. Existing apps do not change. |
| `docs/integrations/slack.md` | Conditional | Changes only under option 2B, to keep `/invite @<name>` aligned with the bot name. |
| Public site `mifunedev/agro-web` | Conditional | Open Question 4 applies only under option 2B. |
| systemd units | None | Unit names and `Description=` lines stay unchanged. |

## Storage

Git holds every artifact. The decisions live in the tracked archived `classification.md`. The knowledge pages keep their frontmatter contract from `.agro/skills/wiki/references/schema.md`. The task adds no runtime state.

## Architectural Decisions

- **One decision record.** `classification.md` already owns the class of each hit. The decisions go into the same file. The task creates no second decision document.
- **Compatibility first.** A published artifact name changes only under an explicit operator option in Open Questions 1 and 2. The legacy NOTICE and the unit names stay unchanged in every option.
- **Procedure owns knowledge writes.** Only the orchestrator writes `.agro/knowledge/`, per `ingest.md` § 8. A worker proposes a draft to `$TMPDIR/oh-wiki-drafts/<slug>.md`, and the orchestrator promotes the draft with `/wiki ingest --from-draft <slug>`.
- **Whole-page verification.** A `verified_at` change on a repo page follows a full re-read of the page citations. A partial re-read keeps the old pin, and the page stays `NEEDS-REVIEW`.
- **Execution location.** The implementation owner runs every edit and check inside the sandbox, in a task worktree under `.worktrees/`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Manifest slash commands and `message.im` event | The manifest edit keeps the bridge command surface. |
| `.agro/evals/probes/knowledge-source-freshness.sh` | Every `sources:` entry resolves; freshness oracle behavior | The page edits keep provenance valid. |
| `.agro/skills/wiki/scripts/knowledge-impact.sh --verified` | `FRESH` for two repo pages; `NOT-APPLICABLE` for four external pages | Each renamed page leaves the task verified. |
| `/wiki lint` | Six checks on the six pages | Schema, paths, links, `related:`, index. |
| `.agro/scripts/__tests__/version-parity-contract.test.ts` | Existing cases | The NOTICE decision keeps the package contract. The owner runs this test only under option 1B. |
| `.agro/skills/eval/run.sh` | Full suite | No new `REGRESSION` against `development`. |

The task adds no new probe. Each decision is a one-time record, and the grep and `jq` checks in the stories verify each record.

## Design Principles

- Follow the root `AGENTS.md`: smallest change that preserves operator intent, one source of truth, no explanatory comments in tracked code.
- Retain a surface when the rename changes a legal or registered identity without a compatibility decision.
- Use the `/wiki` procedure for every knowledge write. A sweep never edits `.agro/knowledge/`.
- Record a retained class once, so that no later sweep reopens the class.

## Out of Scope

- Renaming `openharness-cron.service` or `openharness-bootstrap.service`, or changing their `Description=` lines.
- The `historical`, `test-fixture`, and `compatibility` classes.
- The `OpenHarness` spellings outside the Slack manifest, such as `not an OpenHarness-equipped repo` in `.agro/cli/src/lib/project.ts`.
- The probe failure-message prose that `classification.md` already defers.
- A rename of any Slack app that an operator created earlier.
- A new probe or a new classification script.

## Open Questions

1. What does the task do with the three NOTICE files?
   - A. Retain all three verbatim and mark the NOTICE class `retained permanently`. Recommended: the text is legal attribution, and the trademark clause protects the retained `@mifune/openharness` name.
   - B. Rename the line 1 header in `NOTICE` and `.agro/cli/NOTICE` to `AGRO`. Keep the line 25 trademark clause. Keep `.agro/cli/legacy/NOTICE` verbatim.
   - C. Other: `<operator or counsel decision>`.
2. What does the task do with `.pi/install/slack-manifest.json`?
   - A. Retain the manifest verbatim and mark the class `retained permanently`.
   - B. Rename `name`, `display_name`, and the seven descriptions to AGRO forms, and update `/invite @OpenHarness` in `docs/integrations/slack.md`.
   - C. Rename the seven slash-command descriptions only. Keep `name` and `display_name`, because each operator app already carries those names. Recommended.
   - D. Other: `<specify>`.
3. What does the task do with the six knowledge pages?
   - A. Rename all 18 hits through `/wiki`.
   - B. Rename 17 hits through `/wiki`. Retain the `oh-cli-portable-lifecycle` hit, because the hit paraphrases the compatibility string at `migrate.ts:257`. Recommended.
   - C. Retain all 18 hits as dated synthesis and mark the class `retained permanently`.
4. If the operator chose option 2B, does `mifunedev/agro-web` carry the `/invite @OpenHarness` instruction? The answer decides whether a matching `agro-web` change joins this task.

## Acceptance Criteria

- [ ] `classification.md` records the NOTICE, Slack manifest, and knowledge-page decisions, each with a reason.
- [ ] Each class that a decision retains shows `retained permanently` in `classification.md`.
- [ ] `git diff development --stat` lists no published artifact file other than the files that options 1B, 2B, or 2C name.
- [ ] Each knowledge-page edit follows `/wiki ingest` § 6b, and `knowledge-impact.sh --verified` reports no `NEEDS-REVIEW` for the six pages in a full clone.
- [ ] `bash .agro/skills/eval/run.sh` reports no new `REGRESSION`.
- [ ] The pull request targets `development`.

## Lessons

Filled by the advisor before undraft.
