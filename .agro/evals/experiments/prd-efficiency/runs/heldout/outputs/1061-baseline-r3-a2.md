# PRD: Resolve the deferred Open Harness surfaces

Status: BLOCKED

## User Stories

### US-001: Record the NOTICE decision

**Description:** As the operator, I want one recorded decision for the three NOTICE files so that the NOTICE rows close on a recorded decision.

**Acceptance Criteria:**

- [ ] `.agro/tasks/open-harness-deferred-surfaces/decisions.md` holds a `NOTICE` section that names the operator decision: `retain` or `rename`.
- [ ] The `NOTICE` section cites the operator statement that made the decision, with the date.
- [ ] The `NOTICE` section states the reasoning for `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`, one row per file.
- [ ] If the decision is `retain`, `git diff development -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` prints no output.
- [ ] If the decision is `rename`, the diff changes only line 1 and line 25 of each file that the decision names.
- [ ] `.agro/cli/legacy/NOTICE` keeps `Open Harness` on line 1 in both outcomes, because the file ships with the retained `@mifune/openharness` package.

### US-002: Record the Slack manifest decision

**Description:** As the operator, I want the Slack manifest decision to follow the live Slack application. The tracked manifest then stays aligned with the installed app.

**Acceptance Criteria:**

- [ ] `decisions.md` holds a `Slack manifest` section that records the live display name of the registered Slack application, as the operator reports it.
- [ ] The `Slack manifest` section names the decision: `retain`, or `rename with coordinated Slack update`.
- [ ] If the decision is `retain`, `git diff development -- .pi/install/slack-manifest.json` prints no output.
- [ ] If the decision is `rename with coordinated Slack update`, the section names the operator who updates the live Slack app, and `jq -e . .pi/install/slack-manifest.json` exits 0.
- [ ] If the decision is `rename with coordinated Slack update`, every slash-command `command` value in `.pi/install/slack-manifest.json` stays unchanged.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.

### US-003: Rename the knowledge pages through /wiki

**Description:** As a knowledge-base reader, I want the remaining `Open Harness` prose in `.agro/knowledge/source/` updated by the `/wiki` procedure so that each page stays verified after the edit.

**Acceptance Criteria:**

- [ ] The agent updates each page in the Knowledge page table through the `/wiki ingest` update path in `.agro/skills/wiki/references/schema.md` § 11.
- [ ] `git grep -c "Open Harness" -- .agro/knowledge/source/` prints no line for a page whose decision in `decisions.md` is `rename`.
- [ ] `grep -Pzo 'Open[ \t]*\n[ \t#*>|-]*Harness' <page>` prints no match for each page whose decision is `rename`.
- [ ] Each updated `kind: repo` page carries a `verified_at:` value equal to a commit on the task branch.
- [ ] Each updated page carries `updated:` equal to the UTC date of the edit.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports no `NEEDS-REVIEW` row for an updated page.
- [ ] `decisions.md` holds a `Knowledge pages` section with one row per page: slug, `kind`, hit count before, decision, and reason.

### US-004: Close the classes in classification.md

**Description:** As a future maintainer, I want `classification.md` to mark each resolved class so that no later sweep reopens a settled surface.

**Acceptance Criteria:**

- [ ] `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` holds a `## Follow-up: #1061` section.
- [ ] The section marks each `external` and `deferred` file as `permanently retained`, `renamed`, or `retained by the earlier cutover`.
- [ ] The two `.devcontainer/openharness-*.service` rows read `retained by the earlier cutover`.
- [ ] The section links to `.agro/tasks/open-harness-deferred-surfaces/decisions.md`.
- [ ] `bash .agro/skills/eval/run.sh` exits 0.

## Summary

Issue #1061 tracks the `external` and `deferred` classes that #1058 left in place. The #1058 classification lives at `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md`. The issue names the pre-archive path `.agro/tasks/retire-open-harness-name/classification.md`, which no longer exists.

Verified state at commit `567e893`:

| Surface | Class | Current hits | Fact |
|---|---|---|---|
| `NOTICE` | `external` | 2 | Line 1 is the product title. Line 25 names `"Open Harness"` as a protected trade name. |
| `.agro/cli/NOTICE` | `external` | 2 | Byte-identical to `NOTICE`. |
| `.agro/cli/legacy/NOTICE` | `external` | 2 | Byte-identical to `NOTICE`. `.agro/cli/legacy/package.json` names `@mifune/openharness`. |
| `.pi/install/slack-manifest.json` | `external` | 9 | Line 3 holds the display name. Eight descriptions name the bridge. |
| `.devcontainer/openharness-cron.service` | `external` | 1 | Retained by the earlier identity cutover. Out of scope. |
| `.devcontainer/openharness-bootstrap.service` | `external` | 1 | Retained by the earlier identity cutover. Out of scope. |

The `deferred` class now holds 17 hits in 5 files, not 18 hits in 6 files. `recursive-language-models.md` holds no hit, line-based or wrapped, after a later rewrite.

| Knowledge page | `kind` | Hits | Note |
|---|---|---|---|
| `molt-agentic-reinforcement-learning.md` | `external` | 8 | Current recommendation prose. |
| `managed-agents.md` | `repo` | 4 | `verified_at: 1e3e040e`. |
| `runtime-isolation-landscape.md` | `external` | 2 | Current prose. |
| `crabbox-remote-exec-control-plane.md` | `external` | 2 | Current prose. |
| `oh-cli-portable-lifecycle.md` | `repo` | 1 | Describes `migrate.ts:257`, which prints the retained literal `Open Harness skill pack`. |

The selected approach records each decision in one new task file, `decisions.md`. The approach changes a published artifact only after an explicit operator decision. The approach sends each knowledge-page edit through `/wiki`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `NOTICE`, `.agro/cli/NOTICE`, `.agro/cli/legacy/NOTICE` | Title line, `Trademarks` section | Legal attribution under decision in US-001. |
| `.agro/cli/legacy/package.json` | `"name": "@mifune/openharness"` | Retained shim that ships `.agro/cli/legacy/NOTICE`. |
| `.pi/install/slack-manifest.json` | `display_information.name`, slash-command `description` values | Slack app manifest under decision in US-002. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST` checks | Guards manifest and bridge handler alignment. |
| `.agro/knowledge/source/*.md` | `updated:`, `verified_at:`, body prose | Pages under rename in US-003. |
| `.agro/skills/wiki/references/schema.md` | § 5 Freshness, § 11 Body-merge strategy | Procedure for a page update. |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | Freshness oracle for `kind: repo` pages. |
| `.agro/cli/src/lib/migrate.ts` | `preserveRetiredLink` message, line 257 | Retained literal that `oh-cli-portable-lifecycle.md` describes. |
| `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` | `## deferred`, `## external` | Class record that US-004 closes. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slack application display name | Conditional | Changes only if the operator selects `rename with coordinated Slack update` in US-002. |
| NOTICE legal text | Conditional | Changes only if the operator selects `rename` in US-001. |
| Published `@mifune/openharness` package | None | The package name and its NOTICE title stay unchanged. |
| systemd unit names | None | `openharness-cron.service` and `openharness-bootstrap.service` stay unchanged. |

## Storage

The task adds one tracked file, `.agro/tasks/open-harness-deferred-surfaces/decisions.md`. Git ignores task contents by default. Stage `decisions.md` with `git add -f`. The task appends one section to the tracked archived `classification.md`. The task holds no runtime state.

## Architectural Decisions

- `decisions.md` is the source of truth for the three decisions. `classification.md` links to `decisions.md` and holds only the class marks.
- The operator owns the NOTICE decision and the Slack decision. The implementation owner records each decision and never selects one.
- `/wiki` owns each knowledge-page edit. A plain text sweep over `.agro/knowledge/source/` is out of bounds.
- A page hit that describes a retained literal keeps the literal. The `oh-cli-portable-lifecycle.md` hit quotes the `migrate.ts` message, which the `compatibility` class retains.
- All work runs in the sandbox on the task branch. The PR targets `development`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Manifest and bridge handler alignment | US-002 leaves the slash-command surface intact. |
| `.agro/skills/wiki/scripts/knowledge-impact.sh --verified` | No `NEEDS-REVIEW` row for an updated page | US-003 leaves each page verified. |
| `.agro/evals/probes/spec-execute-knowledge-impact.sh` | Knowledge-impact gate | US-003 keeps the gate green. |
| `git grep -c "Open Harness"` plus the wrapped-phrase `grep -Pzo` scan | Counts per file | US-003 removes each renamed hit, including wrapped hits. |
| `bash .agro/skills/eval/run.sh` | Full probe suite | No new green-to-red regression. |

This task adds no new probe. Each decision is a one-time record, and the existing probes guard the changed surfaces.

## Design Principles

- Code is the source of truth. Add no explanatory comment to a tracked file.
- Keep one source of truth for each decision.
- Change no published artifact name without an explicit compatibility decision.
- Preserve human judgment where automation cannot prove the decision: legal text and live Slack state.
- Prefer a recorded `retain` over an unverified rename.

## Out of Scope

- Renaming `openharness-cron.service` or `openharness-bootstrap.service`. The earlier cutover settled both units.
- Renaming the `@mifune/openharness` package.
- The `historical`, `test-fixture`, and `compatibility` classes.
- The probe failure messages that `classification.md` names as a later sweep.
- Live Slack app changes. The operator performs any live change outside this repository.
- Documentation changes in `mifunedev/agro-web`.

## Open Questions

1. NOTICE: retain `Open Harness` in `NOTICE` and `.agro/cli/NOTICE`, or rename? The trademark clause on line 25 protects the name as a mark. A rename can weaken that protection. Recommendation: retain all three permanently.
2. Slack: what display name does the live registered Slack application carry? The repository cannot answer this question. The operator must check the Slack app configuration.
3. Slack: if the live name is `Open Harness`, retain the manifest, or rename both the manifest and the live app together?
4. `classification.md` path: append the follow-up section to the archived file, or copy the class record into the new task folder? The issue names a missing path. Recommendation: append to the archived file, because git tracks that file.
5. `oh-cli-portable-lifecycle.md`: retain the one hit because the hit quotes a retained literal? Recommendation: retain, and wrap the literal in inline code.
6. Eval command: the issue names `bash .agro/evals/run.sh`, which does not exist. This plan uses `bash .agro/skills/eval/run.sh`. Confirm the substitution.

## Acceptance Criteria

- [ ] `decisions.md` records the NOTICE, Slack manifest, and knowledge-page decisions, each with its reasoning.
- [ ] `classification.md` marks each class that a decision retains permanently.
- [ ] No published artifact name changes without an explicit operator decision in `decisions.md`.
- [ ] Each knowledge-page edit goes through `/wiki`, and `knowledge-impact.sh --verified` reports no `NEEDS-REVIEW` row for an updated page.
- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] The PR targets `development`.

## Lessons

Filled by the advisor before undraft.
