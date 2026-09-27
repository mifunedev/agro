# PRD: Resolve the deferred Open Harness surfaces

Status: BLOCKED

## User Stories

### US-001: Record the NOTICE file decision

**Description:** As the operator, I want one recorded NOTICE decision so that a legal notice changes only by a legal choice.

**Acceptance Criteria:**

- [ ] `classification.md` holds a `## Decisions` section with a `NOTICE files` entry that names `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`.
- [ ] The entry records the operator's answer to Open Question 1 and states the reason in one or more full sentences.
- [ ] The entry treats `.agro/cli/legacy/NOTICE` as retained, because the file ships inside the `@mifune/openharness` package.
- [ ] If the operator retains all three files, the `external` table marks each NOTICE row `permanently retained`.
- [ ] If the operator retains all three files, `git diff --stat` shows no change to any NOTICE file.
- [ ] If the operator approves a rename, the diff changes only the lines that the operator approved, and `.agro/cli/legacy/NOTICE` stays byte-identical.

### US-002: Record the Slack manifest decision

**Description:** As the operator, I want a live-app check before the manifest decision so that the manifest matches the registered app.

**Acceptance Criteria:**

- [ ] The `## Decisions` section in `classification.md` holds a `Slack manifest` entry for `.pi/install/slack-manifest.json`.
- [ ] The entry records the name that the live Slack application shows, as the operator reported it, and the date of that check.
- [ ] If the operator retains the manifest names, the `external` table marks the manifest row `permanently retained`.
- [ ] If the operator retains the manifest names, `git diff --stat` shows no change to `.pi/install/slack-manifest.json`.
- [ ] If the operator approves a rename, the entry names the compatibility decision, and `docs/integrations/slack.md` states the manifest update step for an existing app.
- [ ] `bash .claude/skills/eval/run.sh --probe slack-admin-command-surface` exits 0.

### US-003: Rename the knowledge pages through /wiki

**Description:** As the operator, I want each page rename to use the `/wiki` procedure so that each page stays verified.

**Acceptance Criteria:**

- [ ] Each page in this list changes through the update merge in `.agro/skills/wiki/references/schema.md` § 11: `crabbox-remote-exec-control-plane.md`, `managed-agents.md`, `molt-agentic-reinforcement-learning.md`, `runtime-isolation-landscape.md`.
- [ ] `oh-cli-portable-lifecycle.md` changes or stays the same according to the answer to Open Question 4.
- [ ] `git grep -c "Open Harness" -- .agro/knowledge/source/` prints no line, or prints only the page that Open Question 4 retains.
- [ ] Each changed `kind: repo` page carries a `verified_at:` value equal to the commit at which the implementation owner re-read the page claims.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports no `NEEDS-REVIEW` row for a changed page when the owner runs the script in a full clone.
- [ ] `/wiki lint` reports no schema, path, or link finding for a changed page.
- [ ] The `deferred` table in `classification.md` records `recursive-language-models.md` with 0 current hits.

### US-004: Close the classification record

**Description:** As the operator, I want `classification.md` to show a final state for every `external` and `deferred` row so that no later sweep reopens a settled surface.

**Acceptance Criteria:**

- [ ] The `external` table marks `.devcontainer/openharness-cron.service` and `.devcontainer/openharness-bootstrap.service` `permanently retained`, with a reference to the earlier identity cutover.
- [ ] Each row in the `external` table and the `deferred` table shows one final state: `permanently retained` or `renamed`.
- [ ] No published artifact name changes in the diff unless the `## Decisions` section records a compatibility decision for that artifact.
- [ ] `bash .claude/skills/eval/run.sh` exits 0.

## Summary

Issue #1061 tracks two classes that #1058 deferred. The classification record is `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md`. Git tracks that file. The issue body names the old path `.agro/tasks/retire-open-harness-name/classification.md`, and that path no longer exists.

Verified current state at commit `567e893`:

| Class | File | Current hits |
|---|---|---|
| `external` | `NOTICE` | 2 |
| `external` | `.agro/cli/NOTICE` | 2 |
| `external` | `.agro/cli/legacy/NOTICE` | 2 |
| `external` | `.pi/install/slack-manifest.json` | 9 |
| `external` | `.devcontainer/openharness-cron.service` | 1 |
| `external` | `.devcontainer/openharness-bootstrap.service` | 1 |
| `deferred` | `.agro/knowledge/source/molt-agentic-reinforcement-learning.md` | 8 |
| `deferred` | `.agro/knowledge/source/managed-agents.md` | 4 |
| `deferred` | `.agro/knowledge/source/runtime-isolation-landscape.md` | 2 |
| `deferred` | `.agro/knowledge/source/crabbox-remote-exec-control-plane.md` | 2 |
| `deferred` | `.agro/knowledge/source/oh-cli-portable-lifecycle.md` | 1 |
| `deferred` | `.agro/knowledge/source/recursive-language-models.md` | 0 |

The `deferred` class now holds 17 hits in 5 files. The issue states 18 hits in 6 files. `recursive-language-models.md` lost its hit after the classification.

Facts about the NOTICE files:

- The three NOTICE files are byte-identical.
- Each file opens with the heading `Open Harness`.
- The `Trademarks` section of each file names `"Open Harness"` as a Licensor product name.
- `.agro/cli/package.json` and `.agro/cli/legacy/package.json` list `NOTICE` in `"files"`. Each published npm package therefore ships its NOTICE file.
- `.agro/cli/legacy/package.json` publishes `@mifune/openharness`.

Facts about the Slack manifest:

- `.pi/install/slack-manifest.json` sets `"name": "Open Harness"` and `"display_name": "OpenHarness"`.
- Seven slash-command descriptions name `Open Harness`.
- `docs/integrations/slack.md` tells the operator to create or update the Slack app from this manifest.
- The probe `slack-admin-command-surface` checks the command literals, not the app name.

Facts about the knowledge pages:

- `managed-agents.md` and `oh-cli-portable-lifecycle.md` are `kind: repo` pages. `knowledge-impact.sh` measures their freshness against `verified_at:`.
- The other three pages with hits are `kind: external` pages. `knowledge-impact.sh` reports `NOT-APPLICABLE` for them.
- The hit in `oh-cli-portable-lifecycle.md` describes `agro migrate` behavior: "resolve to the Open Harness pack". That text can name a compatibility behavior, not only the product.
- This sandbox holds a shallow clone. In the shallow clone, `knowledge-impact.sh --verified` reports `NEEDS-REVIEW` for both `kind: repo` pages, because each `verified_at` commit is absent.

Selected approach: resolve each of the three decisions on its own story. Record each decision in a new `## Decisions` section of `classification.md`. Change a NOTICE file or the Slack manifest only after the operator answers the matching open question. Change knowledge pages only through the `/wiki ingest` update merge.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` | `## external`, `## deferred`, new `## Decisions` | The record of each class and each decision. |
| `NOTICE` | heading, `Trademarks` section | Root legal notice. |
| `.agro/cli/NOTICE` | heading, `Trademarks` section | Legal notice shipped in `@mifune/agro`. |
| `.agro/cli/legacy/NOTICE` | heading, `Trademarks` section | Legal notice shipped in `@mifune/openharness`. |
| `.pi/install/slack-manifest.json` | `display_information.name`, `bot_user.display_name`, slash-command `description` | Slack app manifest. |
| `docs/integrations/slack.md` | manifest setup and update steps | Operator procedure for the Slack app. |
| `.agro/knowledge/source/*.md` | frontmatter `updated:`, `verified_at:`, body | Knowledge pages with hits. |
| `.agro/skills/wiki/references/schema.md` | § 11 Body-merge strategy | Procedure for a page update. |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | Freshness check for `kind: repo` pages. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | manifest literals | Regression guard for the manifest. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| npm package `@mifune/agro` | Conditional | The shipped `NOTICE` changes only if the operator approves a rename. |
| npm package `@mifune/openharness` | None | The shipped `NOTICE` keeps the retired name. |
| Slack application manifest | Conditional | The app name and descriptions change only after the live-app check and an approved rename. |
| systemd unit names | None | `openharness-cron.service` and `openharness-bootstrap.service` stay. |
| `mifunedev/agro-web` | Not applicable | The change touches no user-facing term that the web documentation defines. |

## Storage

The only persistent record is the tracked file `classification.md`. The `## Decisions` section follows the table style of that file. Knowledge-page frontmatter stores `updated:` and `verified_at:` as defined in `.agro/skills/wiki/references/schema.md`.

## Architectural Decisions

- `classification.md` is the single source of truth for the final state of each deferred surface.
- The operator owns the NOTICE decision and the Slack decision. The implementation owner records each decision and does not choose it.
- `/wiki` owns every knowledge-page edit. A sweep edit to a page is out of bounds.
- Unit names stay. The earlier identity cutover settled that decision, and this task does not reopen it.
- The PR targets `development`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Manifest commands and docs stay aligned | US-002 manifest integrity |
| `.agro/skills/wiki/scripts/knowledge-impact.sh --verified` | No `NEEDS-REVIEW` row for a changed page in a full clone | US-003 page freshness |
| `/wiki lint` | No schema, path, or link finding | US-003 page validity |
| `git grep -c "Open Harness" -- NOTICE .agro/cli .pi/install .devcontainer .agro/knowledge/source` | Counts match the recorded final states | US-001 to US-004 |
| `bash .claude/skills/eval/run.sh` | Exit 0, no new regression | US-004 floor |

This task adds no new probe. A decision record carries no behavior for a probe to guard.

## Design Principles

- Apply the smallest change that the operator decision requires.
- Change no published artifact name without a recorded compatibility decision.
- Edit the canonical source. `classification.md` and the knowledge pages are canonical. No mirror changes.
- Keep a decision to retain a surface as a recorded outcome, not as a gap.

## Out of Scope

- The systemd unit names and their `Description=` lines.
- The `historical`, `test-fixture`, and `compatibility` classes.
- A rename of the live Slack application. The operator performs that step in Slack, outside the repository.
- Legal review of the NOTICE text beyond the product name.
- The eval probes that name `Open Harness` in failure messages. `classification.md` does not list them in these two classes.

## Open Questions

1. Does the product rename belong in the NOTICE files?
   A. Retain all three files. Mark the class permanently retained.
   B. Rename the heading of `NOTICE` and `.agro/cli/NOTICE` to `AGRO`. Keep the `Trademarks` clause for `"Open Harness"`. Retain `.agro/cli/legacy/NOTICE`.
   C. Rename the heading and the `Trademarks` clause of `NOTICE` and `.agro/cli/NOTICE`. Retain `.agro/cli/legacy/NOTICE`.
   D. Other: <specify>
2. What name does the live Slack application show, and does the operator want a rename?
   A. The live app shows `Open Harness`. Retain the manifest.
   B. The live app shows `Open Harness`. The operator renames the live app and the manifest together.
   C. The live app shows `<name>`. Align the manifest to `<name>`.
3. The issue names `bash .agro/evals/run.sh` as the eval command. That file does not exist. Is `bash .claude/skills/eval/run.sh` the accepted command?
4. The hit in `oh-cli-portable-lifecycle.md` describes the `agro migrate` link check ("resolve to the Open Harness pack"). Is that text a compatibility reference that stays, or product prose that changes?
5. The `/wiki ingest` update merge replaces `## Summary` and `## Detail` from a new source read. For a `kind: external` page, does a name-only edit need a new source snapshot, or does the merge proceed from the existing `raw/` snapshot?

## Acceptance Criteria

- [ ] `classification.md` records the NOTICE decision, the Slack decision, and the knowledge-page decision, each with its reason.
- [ ] Each class that the operator decides to retain carries the mark `permanently retained` in `classification.md`.
- [ ] No published artifact name changes without a recorded compatibility decision.
- [ ] Each knowledge-page edit follows the `/wiki` procedure, and each changed page passes `/wiki lint`.
- [ ] `bash .claude/skills/eval/run.sh` exits 0 with no new regression.
- [ ] The PR targets `development`.

## Lessons

Filled by the advisor before undraft.
