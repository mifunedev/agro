# PRD: Resolve the deferred Open Harness surfaces

Status: BLOCKED

Source: issue [#1061](https://github.com/mifunedev/agro/issues/1061), split out of [#1058](https://github.com/mifunedev/agro/issues/1058).

## User Stories

### US-001: Record the systemd unit descriptions as permanently retained

**Description:** As the operator, I want the two unit-file hits marked as permanently retained so that no later sweep reopens the unit-name decision.

**Acceptance Criteria:**

- [ ] `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` has a `## Resolution (#1061)` section.
- [ ] That section lists `.devcontainer/openharness-cron.service` and `.devcontainer/openharness-bootstrap.service` as `retained permanently`, with the reason: the earlier identity cutover placed both units out of scope.
- [ ] `git diff --stat <base>...HEAD -- .devcontainer/` lists no change.

### US-002: Record the NOTICE decision

**Description:** As the operator, I want one legal decision for the three NOTICE files so that the NOTICE class closes or changes explicitly.

**Acceptance Criteria:**

- [ ] The `## Resolution (#1061)` section records the operator decision for `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`, with the reasoning.
- [ ] `.agro/cli/legacy/NOTICE` keeps the string `Open Harness` on line 1 and line 25, because the file ships in the published `@mifune/openharness` package.
- [ ] If the decision is "retain", `git diff <base>...HEAD -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` is empty, and the section marks the NOTICE rows `retained permanently`.
- [ ] If the decision is "rename", the PR body names the compatibility decision for the published `@mifune/agro` package, and `cmp NOTICE .agro/cli/NOTICE` exits 0.

### US-003: Record the Slack manifest decision

**Description:** As the operator, I want a check of the live Slack application first so that the manifest does not drift from that application.

**Acceptance Criteria:**

- [ ] The `## Resolution (#1061)` section records the display name of the live Slack application, as the operator reads the name from the Slack application settings, and the date of that check.
- [ ] The section records one decision for `.pi/install/slack-manifest.json`: retain, or rename with a coordinated update of the live application.
- [ ] If the decision is "retain", `git diff <base>...HEAD -- .pi/install/slack-manifest.json` is empty, and the section marks the manifest row `retained permanently`.
- [ ] If the decision is "rename", `jq -e . .pi/install/slack-manifest.json` exits 0, and `bash .agro/skills/eval/run.sh --probe slack-admin-command-surface` reports `PASS`.

### US-004: Rename the knowledge pages through `/wiki`

**Description:** As the operator, I want each deferred knowledge page updated through the `/wiki ingest` update path so that each page's verification happens by procedure.

**Acceptance Criteria:**

- [ ] Each page update follows `.agro/skills/wiki/references/ingest.md` § 6b and sets `updated:` to the edit date.
- [ ] Each `kind: repo` page (`managed-agents`, `oh-cli-portable-lifecycle`) has its claims re-checked against every entry in `sources:`, and has `verified_at:` set to the commit of that check.
- [ ] In a non-shallow clone, `bash .agro/skills/wiki/scripts/knowledge-impact.sh --format slugs` prints neither `managed-agents` nor `oh-cli-portable-lifecycle`.
- [ ] `git grep -c "Open Harness" -- .agro/knowledge/source/` prints only the hits that the `## Resolution (#1061)` section lists as retained, each with a reason.
- [ ] No file under `.agro/knowledge/raw/` changes.
- [ ] `bash .agro/evals/probes/wiki-readme-index.sh` exits 0.

## Summary

Issue #1061 holds the `external` and `deferred` classes from the #1058 classification. Git tracks the classification file at `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md`. The issue names the path `.agro/tasks/retire-open-harness-name/classification.md`, but the `cleanup-tasks` cron moved the task into the archive.

Verified current state at commit `567e893`:

| Surface | Files | Hits now | Fact |
|---|---|---|---|
| NOTICE | 3 | 6 | The three files are byte-identical. Line 1 is the product name. Line 25 is a trademark reservation for "Mifune" and "Open Harness". Both `.agro/cli/package.json` (`@mifune/agro`) and `.agro/cli/legacy/package.json` (`@mifune/openharness`) list `NOTICE` in `files`, so each NOTICE file ships in a published package. |
| Slack manifest | 1 | 9 | `display_information.name` is `Open Harness`. The other 8 hits are description strings. The probe `slack-admin-command-surface.sh` reads the manifest but asserts no display name. `docs/integrations/slack.md`, `docs/connecting.md`, and `docs/harnesses/pi.md` tell the operator to create or update the Slack app from this manifest. |
| Unit files | 2 | 2 | Each hit is the `Description=` line. The unit names stay. |
| Knowledge pages | 5 | 17 | `molt-agentic-reinforcement-learning` (8), `managed-agents` (4), `runtime-isolation-landscape` (2), `crabbox-remote-exec-control-plane` (2), `oh-cli-portable-lifecycle` (1). |

Two facts drift from the issue:

- `recursive-language-models.md` has 0 hits now. The classification counted 1. The page has `updated: 2026-09-21`. The knowledge-page total is 17 hits in 5 files, not 18 hits in 6 files.
- The eval command `bash .agro/evals/run.sh` does not exist. The canonical runner is `bash .agro/skills/eval/run.sh`.

Three knowledge pages are `kind: external`. `knowledge-impact.sh` reports them `NOT-APPLICABLE`, so their freshness gate does not apply. Two pages are `kind: repo` and carry `verified_at:`. This checkout is a shallow clone. In this checkout, `knowledge-impact.sh` reports both `kind: repo` pages `NEEDS-REVIEW` because their `verified_at` commits are absent from the shallow history.

Selected approach: resolve each surface as an independent decision. Record every decision in one new `## Resolution (#1061)` section of the tracked classification file. Change a published or registered artifact only after an explicit operator decision.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` | `## deferred`, `## external`, new `## Resolution (#1061)` | Decision record for every class |
| `NOTICE`, `.agro/cli/NOTICE`, `.agro/cli/legacy/NOTICE` | line 1, `Trademarks` section | Legal attribution in the repository and in two published packages |
| `.agro/cli/package.json`, `.agro/cli/legacy/package.json` | `files` | Proves that each NOTICE file ships |
| `.pi/install/slack-manifest.json` | `display_information.name`, `features.slash_commands[].description` | Slack application manifest |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST` | Probe that reads the manifest |
| `.devcontainer/openharness-cron.service`, `.devcontainer/openharness-bootstrap.service` | `Description=` | Retained unit files |
| `.agro/knowledge/source/*.md` (5 pages) | frontmatter `updated:`, `verified_at:`, `sources:` | Knowledge pages to rename |
| `.agro/skills/wiki/references/ingest.md` | § 6b Existing entry (update) | Procedure for a page update |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified`, `--format slugs` | Freshness check for `kind: repo` pages |
| `.agro/skills/eval/run.sh` | whole suite, `--probe <id>` | Regression floor |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slack application display name | Conditional | Changes only if the operator selects "rename" in US-003 and updates the live application. |
| Published npm package `@mifune/agro` | Conditional | The packaged NOTICE changes only if the operator selects "rename" in US-002. |
| Published npm package `@mifune/openharness` | None | The legacy NOTICE keeps the retired name. |
| systemd units | None | Unit names and descriptions stay. |
| Public documentation (`mifunedev/agro-web`) | Conditional | If the Slack display name changes, the Slack setup page in `agro-web` needs a matching change. Otherwise N/A. |

## Storage

N/A. The task adds no persistence layer. The decision record is Markdown in the tracked classification file.

## Architectural Decisions

- **Source of truth:** the `## Resolution (#1061)` section of the classification file owns each decision. The PR body links to that section and does not duplicate the decisions.
- **Decision owner:** the operator owns the NOTICE decision and the Slack decision. The implementation owner does not select either option.
- **Knowledge writes:** only the `/wiki ingest` update path writes `.agro/knowledge/source/`. A sweep or `sed` edit is not permitted.
- **Legacy shim:** `.agro/cli/legacy/NOTICE` keeps the retired name in every option, because the retired name is the correct name of that package.
- **Unit names:** the earlier cutover settled the unit names. This task does not reopen that decision.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | run by `bash .agro/skills/eval/run.sh --probe slack-admin-command-surface` | The manifest keeps its admin command surface |
| `.agro/evals/probes/wiki-readme-index.sh` | whole probe | The generated knowledge index stays valid after the page updates |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--format slugs` in a non-shallow clone | Both `kind: repo` pages are fresh |
| `.agro/skills/eval/run.sh` | whole suite | No new `REGRESSION` against `.agro/evals/RESULTS.md` at `<base>` |

The task adds no new probe. Each decision is a one-time record, and a probe for a record adds machinery with no benchmark movement.

## Design Principles

- Code is the source of truth. Add no comment to a tracked file.
- Change a published or registered name only under an explicit compatibility decision.
- Run each knowledge edit through the canonical `/wiki` procedure.
- Keep each decision independent. One blocked decision does not block the other stories.
- Record a retained hit with its reason. A retained hit without a reason reopens the question.

## Out of Scope

- Renaming `openharness-cron.service` or `openharness-bootstrap.service`, or their `Description=` lines.
- The `historical`, `test-fixture`, and `compatibility` classes.
- Files under `.agro/knowledge/raw/`. Raw snapshots are immutable provenance.
- A rename of the `@mifune/openharness` package.
- Probe messages that name "Open Harness", for example in `.agro/evals/probes/cron-systemd-service.sh`. The #1058 classification did not list these messages in the `external` or `deferred` class.

## Open Questions

1. **NOTICE decision (blocks US-002).** Select one option:
   - A. Retain all three NOTICE files. Mark the class `retained permanently`. Recommended: the trademark clause reserves the name as a mark, and a mark reservation stays valid after a product rename.
   - B. Rename line 1 of `NOTICE` and `.agro/cli/NOTICE`. Keep the trademark clause and `.agro/cli/legacy/NOTICE` unchanged.
   - C. Other: <specify>.
2. **Slack decision (blocks US-003).** The operator reads the display name of the live Slack application. Then select one option:
   - A. Retain the manifest. Mark the manifest row `retained permanently`.
   - B. Rename the manifest, and update the live application in the same change window.
   - C. Other: <specify>.
3. **`oh-cli-portable-lifecycle` hit.** The single hit names "the Open Harness pack" in a migration description. Is the hit historical and retained, or stale and renamed? The implementation owner classifies the hit during US-004 and records the reason.
4. **`recursive-language-models` drift.** The page has 0 hits now. Confirm that the resolution section records the page as already resolved, with no edit.
5. **Base commit.** `<base>` is the tip of `development` at branch creation. The implementation owner records the value in `progress.txt`.

## Acceptance Criteria

- [ ] The `## Resolution (#1061)` section records the NOTICE, Slack manifest, and knowledge-page decisions, each with its reasoning.
- [ ] Each class that the operator decides to retain permanently is marked `retained permanently` in the classification file.
- [ ] No published package file and no registered Slack name changes without an explicit operator compatibility decision in the resolution section.
- [ ] All knowledge-page edits go through `/wiki ingest` § 6b, and `knowledge-impact.sh --format slugs` in a non-shallow clone lists none of the edited `kind: repo` pages.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION` that is absent from `.agro/evals/RESULTS.md` at `<base>`.
- [ ] The PR targets `development`.

## Lessons

Filled by the advisor before undraft.
