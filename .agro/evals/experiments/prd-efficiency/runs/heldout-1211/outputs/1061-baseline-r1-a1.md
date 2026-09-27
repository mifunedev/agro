# PRD: Resolve the deferred Open Harness name surfaces

Status: BLOCKED

## User Stories

### US-001: Record the NOTICE decision

**Description:** As the operator, I want one recorded decision for the three NOTICE files so that the `external` NOTICE rows close with a stated reason.

**Acceptance Criteria:**

- [ ] The decision record names `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`, and states one outcome for each file: `retained` or `rewritten`.
- [ ] The decision record states the reason for each outcome and names the operator decision that approved the outcome.
- [ ] If the outcome for a file is `retained`, `classification.md` marks that file as permanently retained.
- [ ] If the outcome for a file is `rewritten`, `NOTICE` and `.agro/cli/NOTICE` stay byte-identical after the edit. `diff NOTICE .agro/cli/NOTICE` exits 0.
- [ ] `.agro/cli/legacy/NOTICE` keeps the string `Open Harness`. `git grep -c "Open Harness" -- .agro/cli/legacy/NOTICE` prints `2`.
- [ ] `.agro/scripts/__tests__/version-parity-contract.test.ts` passes.

### US-002: Record the Slack manifest decision

**Description:** As the operator, I want a recorded compatibility decision for `.pi/install/slack-manifest.json` so that no Slack app name changes by accident.

**Acceptance Criteria:**

- [ ] The decision record states the result of the operator check of the live registered Slack application: `<registered app name>` or `no live app`.
- [ ] The decision record states one outcome for each of four field groups: `display_information.name`, `display_information.description`, `features.bot_user.display_name`, and the seven slash-command `description` strings.
- [ ] If the outcome keeps `display_information.name` or `features.bot_user.display_name`, the file keeps each kept value byte for byte.
- [ ] If the outcome changes a field group, the decision record names the compatibility decision that approved the change.
- [ ] `jq . .pi/install/slack-manifest.json` exits 0.
- [ ] `bash .agro/skills/eval/run.sh --probe slack-admin-command-surface` reports PASS.
- [ ] `classification.md` records the manifest outcome.

### US-003: Rename the knowledge pages through /wiki

**Description:** As a harness maintainer, I want the knowledge-page rename to run through `/wiki` so that each page keeps a valid provenance and freshness state.

**Acceptance Criteria:**

- [ ] Before the edit, the owner reruns `git grep -c "Open Harness" -- .agro/knowledge/source` and the wrap-aware scan from `classification.md`, and records the current hit list.
- [ ] The owner classifies the hit in `.agro/knowledge/source/oh-cli-portable-lifecycle.md` ("the Open Harness pack") against `.agro/cli/src/lib/migrate.ts` and `.agro/cli/src/lib/product.ts`. The record states `stale` or `compatibility`.
- [ ] Each page edit comes from `/wiki ingest` under the body-merge rules of `.agro/skills/wiki/references/schema.md` § 11. No page receives a hand edit.
- [ ] After the edit, `git grep -c "Open Harness" -- .agro/knowledge/source` reports no hit outside the hits that US-003 classifies as `compatibility`.
- [ ] For each edited `kind: repo` page, `verified_at:` equals the commit that the owner checked the claims against.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports no edited page as needs-review.
- [ ] `bash .agro/evals/probes/wiki-readme-index.sh` exits 0.
- [ ] `classification.md` moves each resolved knowledge-page row out of the `deferred` class.

### US-004: Close the classification and verify the suite

**Description:** As the operator, I want `classification.md` to show a final class for every deferred row so that issue #1061 closes with no open surface.

**Acceptance Criteria:**

- [ ] `classification.md` holds a section `Follow-up decisions (#1061)` that links each decision record from US-001, US-002, and US-003.
- [ ] No row remains in the `external` class or the `deferred` class without a final disposition.
- [ ] `.devcontainer/openharness-cron.service` and `.devcontainer/openharness-bootstrap.service` are unchanged. `git diff --stat development -- .devcontainer/` prints nothing.
- [ ] `bash .agro/skills/eval/run.sh` reports no probe that moves from PASS to REGRESSION against the base commit.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each prose file that this task writes.
- [ ] The pull request targets `development`.

## Summary

Issue #1061 tracks the surfaces that #1058 deferred. #1058 rewrote the `stale` and `pinned` classes. The `external` class and the `deferred` class remain. The issue asks for three decisions. The issue keeps the two systemd unit names out of scope.

Verified current state at `567e893`:

- The classification record is at `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md`. Git tracks the file. The `cleanup-tasks` cron moved the file from the path that the issue names.
- The three NOTICE files are byte-identical. Line 1 is the header `Open Harness`. Line 25 names `"Mifune" and "Open Harness"` in a trademark clause that withholds trademark rights.
- `.agro/cli/package.json` publishes `NOTICE` in `@mifune/agro`. `.agro/cli/legacy/package.json` publishes `NOTICE` in `@mifune/openharness`. `version-parity-contract.test.ts` expects `NOTICE` in the shim files.
- `.pi/install/slack-manifest.json` holds 9 hits: `display_information.name`, `display_information.description`, and the descriptions of the 7 slash commands. `features.bot_user.display_name` holds `OpenHarness` with no space. The grep for `Open Harness` does not count that value.
- `docs/integrations/slack.md` tells each operator to create or update a Slack app from the manifest. The repository holds no record of one central registered app. A manifest change reaches an existing app only when an operator applies the manifest again.
- The probe `slack-admin-command-surface.sh` reads the manifest. The probe asserts no app name.
- The knowledge pages now hold 17 hits in 5 files. `recursive-language-models.md` holds 0 hits. The issue lists 18 hits in 6 files.
- `managed-agents.md` and `oh-cli-portable-lifecycle.md` are `kind: repo` pages with a `verified_at:` pin. `crabbox-remote-exec-control-plane.md`, `molt-agentic-reinforcement-learning.md`, and `runtime-isolation-landscape.md` are `kind: external` pages. Schema § 5 applies freshness only to `kind: repo` pages.
- The issue names `bash .agro/evals/run.sh`. That path does not exist. The runner is `.agro/skills/eval/run.sh`.

Selected approach: the owner collects each operator decision first, then records it. The owner edits a file only when a recorded decision allows the edit. The knowledge pages go through `/wiki ingest`. The unit names stay.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` | `## external`, `## deferred` tables | Record of each class and each final disposition |
| `NOTICE` | header line 1, trademark clause line 25 | Root legal notice |
| `.agro/cli/NOTICE` | same lines | Notice published in `@mifune/agro` |
| `.agro/cli/legacy/NOTICE` | same lines | Notice published in the retained `@mifune/openharness` shim |
| `.agro/cli/package.json`, `.agro/cli/legacy/package.json` | `files` array | Publish `NOTICE` in each npm package |
| `.agro/scripts/__tests__/version-parity-contract.test.ts` | `shimFiles` | Asserts the shim ships `NOTICE` |
| `.pi/install/slack-manifest.json` | `display_information`, `features.bot_user`, `features.slash_commands` | Slack app manifest |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST` | Guards manifest and bridge handler alignment |
| `.agro/knowledge/source/*.md` (5 pages) | frontmatter `kind`, `verified_at`, `updated`, `sources` | Knowledge pages with deferred hits |
| `.agro/skills/wiki/references/ingest.md` | § 5, § 6 | The only authorized write path into `.agro/knowledge/` |
| `.agro/skills/wiki/references/schema.md` | § 5, § 11 | Freshness rule and body-merge rule |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | Freshness check |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| npm package `@mifune/agro` | conditional | `NOTICE` text changes only if US-001 records `rewritten` for `.agro/cli/NOTICE`. |
| npm package `@mifune/openharness` | none | The shim keeps its `NOTICE`. The retired name is the correct name for that package. |
| Slack app manifest | conditional | Field groups change only as US-002 records. Existing Slack apps change only when an operator applies the manifest again. |
| systemd units | none | `openharness-cron.service` and `openharness-bootstrap.service` keep their names. |
| Public documentation `mifunedev/agro-web` | none expected | No user-facing verb or term changes. If US-002 renames the Slack app, the owner checks `<agro-web Slack setup page>` for the old name. |

## Storage

N/A. The task changes tracked text files only. It adds no persistence layer.

## Architectural Decisions

- `classification.md` is the single source of truth for the class of each hit. The owner appends the follow-up decisions to the archived file. The owner does not copy the file into this task folder.
- A legal notice and an external app registration change only with an explicit operator decision. The owner records the decision before the edit.
- `/wiki ingest` is the sole writer of `.agro/knowledge/`. The owner re-checks each `kind: repo` page against its `sources:` before the owner moves `verified_at:`.
- The earlier identity cutover owns the systemd unit names. This task does not reopen that decision.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/version-parity-contract.test.ts` | existing shim-file cases | The shim still ships `NOTICE` (US-001) |
| `.agro/evals/probes/slack-admin-command-surface.sh` | existing probe | Manifest and bridge handlers stay aligned (US-002) |
| `jq . .pi/install/slack-manifest.json` | parse check | The manifest stays valid JSON (US-002) |
| `.agro/skills/wiki/scripts/knowledge-impact.sh --verified` | freshness check | No edited `kind: repo` page is needs-review (US-003) |
| `.agro/evals/probes/wiki-readme-index.sh` | existing probe | The generated knowledge index stays valid (US-003) |
| `git grep -c "Open Harness"` plus the wrap-aware scan | before and after counts | Each remaining hit maps to a retained class (US-003, US-004) |
| `.agro/skills/eval/run.sh` | full suite | No new regression (US-004) |

The task adds no new test. Each change is a recorded decision or a prose edit, and the existing tests and probes guard each affected surface.

## Design Principles

- Code is the source of truth. Add no comment to tracked code.
- A decision comes before an edit. A recorded `retained` outcome is a complete result.
- Make the smallest change that each decision allows.
- Keep one source of truth for each class: `classification.md`.
- Surfaces:
  - Host and sandbox: applied. All edits and checks run in the sandbox checkout.
  - Lifecycle door: not applicable. No `agro` verb changes.
  - Canonical and provider surfaces: not applicable. No skill or hook changes.
  - Root and scaffold: applied. `NOTICE` and the manifest ship in initialized projects.
  - Interactive and headless processes: not applicable. No process changes.
  - Local and remote operation: not applicable.
  - Parallel operation: applied. US-001, US-002, and US-003 touch separate files. US-004 depends on all three.
  - Public documentation: applied. See the Slack row in Interface Integration Points.
  - Verification: applied. See the Test Plan.

## Out of Scope

- Renaming `openharness-cron.service` or `openharness-bootstrap.service`.
- Any change to the `historical`, `test-fixture`, or `compatibility` classes.
- The failure-message prose in the three probes that `classification.md` names.
- Renaming the npm package `@mifune/openharness`.
- A rename of the live Slack app in a Slack workspace. The operator owns that action.
- A change to `LICENSE`.

## Open Questions

1. NOTICE outcome. The operator decides for each file. The `Open Harness` string in the trademark clause withholds rights to that mark. A removal can narrow the reservation. Options:
   A. Retain all three files unchanged, and close the class permanently.
   B. Rewrite the line 1 header in `NOTICE` and `.agro/cli/NOTICE` only. Keep the trademark clause.
   C. Rewrite the header, and add `AGRO` to the trademark clause next to `Open Harness`.
   D. Other: `<specify>`.
2. Live Slack app. The operator checks `<Slack workspace>` for an app created from this manifest and reports its name. Options:
   A. Retain the manifest unchanged.
   B. Rewrite the 7 slash-command descriptions and the app description only. Keep `name` and `display_name`.
   C. Rewrite all fields, and coordinate the rename of the live app.
   D. Other: `<specify>`.
3. `/wiki` route for a prose-only edit. `ingest.md` § 5 adds the draft path to `sources:`. For a `kind: repo` page, that entry is not a repository dependency. The owner must confirm the route before US-003 starts:
   A. Re-ingest each `kind: repo` page from its existing repository `sources:`, and re-ingest each `kind: external` page from its existing `raw/` snapshot.
   B. Use `--from-draft`, then remove the draft path from `sources:` by procedure.
   C. Other: `<specify>`.
4. Record location. The issue names `.agro/tasks/retire-open-harness-name/classification.md`. The file now sits under `.agro/tasks/archive/2026-09-21/`. Confirm that an append to the archived file is acceptable.
   A. Append to the archived file.
   B. Write the decisions in this task folder, and link them from the archived file.

## Acceptance Criteria

- [ ] Each of the three decisions (NOTICE, Slack manifest, knowledge pages) is recorded with its reason.
- [ ] `classification.md` marks each permanently retained class.
- [ ] No published artifact name changes without an explicit compatibility decision.
- [ ] Each knowledge-page edit goes through `/wiki`, and `knowledge-impact.sh --verified` reports no edited page as needs-review.
- [ ] `bash .agro/skills/eval/run.sh` reports no new regression.
- [ ] The two systemd unit files are unchanged.
- [ ] The pull request targets `development`.

## Lessons

Filled by the advisor before undraft.
