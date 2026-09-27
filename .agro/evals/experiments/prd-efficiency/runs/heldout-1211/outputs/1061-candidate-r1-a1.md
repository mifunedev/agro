# PRD: Resolve the deferred Open Harness surfaces

Status: BLOCKED

## User Stories

### US-001: Decide the NOTICE files

**Description:** As the operator, I want a recorded decision for the three NOTICE files so that the legal attribution class closes on purpose.

**Acceptance Criteria:**

- [ ] `classification.md` holds one decision row for `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`, with the reasoning.
- [ ] The decision row names the operator answer to Open Question 1.
- [ ] If the operator retains the name, the `external` section marks the NOTICE rows `retained permanently`, and `git diff development -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` prints nothing.
- [ ] If the operator renames `NOTICE` or `.agro/cli/NOTICE`, the PR body quotes the compatibility decision, because `.agro/cli/package.json` publishes `NOTICE` in `files`.
- [ ] `.agro/cli/legacy/NOTICE` keeps `Open Harness` on line 1, because the `@mifune/openharness` shim owns that name.

### US-002: Decide the Slack manifest

**Description:** As the operator, I want the Slack manifest decision to follow the live registered application. The repository manifest then stays aligned with the installed app.

**Acceptance Criteria:**

- [ ] `classification.md` records the live Slack application name and display name that the operator reports for Open Question 2.
- [ ] If the live app keeps `Open Harness`, `git diff development -- .pi/install/slack-manifest.json` prints nothing, and the `external` section marks the row `retained permanently`.
- [ ] If the operator coordinates a rename, the manifest `name` and `display_name` values match the live app, and the PR body quotes the compatibility decision.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0 after the change.

### US-003: Rename the knowledge pages through /wiki

**Description:** As a knowledge maintainer, I want the `/wiki` merge procedure to own each deferred knowledge-page edit. Each page then keeps a valid provenance and freshness contract.

**Acceptance Criteria:**

- [ ] `git grep -n -i 'open harness' -- .agro/knowledge/source` prints only the lines that Open Question 3 retains.
- [ ] Each edited page carries `updated:` equal to the edit date in UTC.
- [ ] `managed-agents.md` and `oh-cli-portable-lifecycle.md` carry `verified_at:` equal to the commit that the `/wiki` re-check read.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports neither `managed-agents` nor `oh-cli-portable-lifecycle` as needs-review.
- [ ] No edit changes `created:` or removes a `sources:` entry.
- [ ] `classification.md` marks the `deferred` class resolved and names the retained lines.

### US-004: Close the task

**Description:** As the operator, I want one verified PR against `development` so that the three decisions land together with evidence.

**Acceptance Criteria:**

- [ ] `.devcontainer/openharness-cron.service` and `.devcontainer/openharness-bootstrap.service` show no diff against `development`.
- [ ] `bash .claude/skills/eval/run.sh` reports no probe that turned from PASS to REGRESSION.
- [ ] The PR base is `development`.
- [ ] The PR body lists each decision and the reasoning for each decision.

## Summary

Issue #1061 splits four deferred surfaces out of #1058. The #1058 table now lives at `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md`, not at the path in the issue. Git tracks that archived file.

Verified current state:

- `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE` each hold 2 hits, on line 1 and line 25.
- `.agro/cli/package.json` (`@mifune/agro`) and `.agro/cli/legacy/package.json` (`@mifune/openharness`) list `NOTICE` in `files`. Each NOTICE file is therefore a published artifact.
- `.pi/install/slack-manifest.json` holds 9 hits: `name` on line 3, `display_name` `OpenHarness` on line 14, and 7 descriptions.
- The two unit files hold 1 hit each, in `Description=`. The issue keeps both unit files unchanged.
- The `deferred` class now holds 17 hits in 5 files. `recursive-language-models.md` holds 0 hits, because PR #1130 rewrote the page.
- `managed-agents.md` and `oh-cli-portable-lifecycle.md` are `kind: repo` pages with `verified_at:`. The other 3 pages are `kind: external`, so the freshness contract does not apply to them.
- The issue cites `bash .agro/evals/run.sh`. That file does not exist. The eval runner is `.claude/skills/eval/run.sh`.

Selected approach: take one decision per class, record each decision in the archived `classification.md`, and change a file only when the decision says rename.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` | `## deferred`, `## external` sections | Decision record for each class |
| `NOTICE`, `.agro/cli/NOTICE`, `.agro/cli/legacy/NOTICE` | lines 1 and 25 | Legal attribution text |
| `.agro/cli/package.json`, `.agro/cli/legacy/package.json` | `files` entry `NOTICE` | Publishes each NOTICE file to npm |
| `.pi/install/slack-manifest.json` | `name`, `display_name`, command `description` values | Slack application manifest |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST` | Probe that reads the manifest |
| `.agro/knowledge/source/{molt-agentic-reinforcement-learning,managed-agents,runtime-isolation-landscape,crabbox-remote-exec-control-plane,oh-cli-portable-lifecycle}.md` | `updated:`, `verified_at:`, `## Summary`, `## Detail` | Deferred knowledge pages |
| `.agro/skills/wiki/references/schema.md` | section 5, section 11 merge steps | Freshness and merge contract |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | Freshness check |
| `.claude/skills/eval/run.sh` | suite runner | Regression floor |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| npm packages `@mifune/agro`, `@mifune/openharness` | Conditional | The NOTICE text changes only after an explicit compatibility decision. |
| Slack application manifest | Conditional | The manifest changes only when the live app changes with the manifest. |
| systemd unit names | None | `openharness-cron.service` and `openharness-bootstrap.service` stay. |

## Storage

Git holds all persistent state for this task. `classification.md` holds the decisions. The knowledge pages hold `updated:` and `verified_at:` frontmatter. Section 11 of `schema.md` governs each frontmatter update.

## Architectural Decisions

- `classification.md` is the single record for each class decision. The PR body references the file and does not hold a second table.
- The live Slack app is the source of truth for the Slack name. The manifest follows the live app.
- The `/wiki` merge procedure owns each knowledge-page edit. A sed sweep does not edit a knowledge page.
- The legacy shim keeps its name. `.agro/cli/legacy/NOTICE` names the `@mifune/openharness` product.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Manifest admin command surface | The Slack manifest stays valid for the bridge |
| `.agro/skills/wiki/scripts/knowledge-impact.sh --verified` | No edited `kind: repo` page is needs-review | Freshness contract after the edits |
| `.agro/evals/probes/knowledge-source-freshness.sh` | Freshness probe | The knowledge freshness machinery stays green |
| `.claude/skills/eval/run.sh` | Full suite | No new REGRESSION |
| `git grep -n -i 'open harness'` over the 13 surface files | Hit count per class | Each retained hit matches a recorded decision |

## Design Principles

- Change a published or registered name only after an explicit compatibility decision.
- Record a retain decision as a permanent class, so that later sweeps skip the class.
- Follow the canonical `/wiki` procedure. Do not bypass the procedure for a text rename.
- Keep the change to the smallest set of files that the decisions require.

## Out of Scope

- The systemd unit names and the unit `Description=` lines.
- The `stale`, `pinned`, `compatibility`, `test-fixture`, and `historical` classes from #1058.
- The package name `@mifune/openharness`.
- A rename of the live Slack app by the agent. Only the operator acts on the live app.
- Public documentation in `mifunedev/agro-web`. No user-facing term changes unless the Slack decision renames the app.

## Open Questions

1. NOTICE files: does the product rename belong in `NOTICE` and `.agro/cli/NOTICE`? Recommended answer: retain both, and mark the class permanently retained. A legal notice records attribution history, and both files ship in published npm packages.
2. Slack manifest: what `name` and `display_name` does the live registered Slack app carry? The agent has no access to the live app. The operator must report the values or coordinate the rename.
3. Knowledge pages: does `Open Harness pack` on line 110 of `oh-cli-portable-lifecycle.md` name a retained legacy surface? Recommended answer: re-check the claim against `.agro/cli/src/commands/migrate.ts` during the `/wiki` re-check, and keep the name if the code checks for that pack.
4. Decision record location: does the operator accept an edit to the archived `classification.md`, or require a new copy under this task folder? Recommended answer: edit the archived file, because git tracks the archived file.

## Acceptance Criteria

- [ ] `classification.md` records each of the three decisions with the reasoning.
- [ ] `classification.md` marks each class that the operator retains as `retained permanently`.
- [ ] No published artifact name changes without an explicit compatibility decision in the PR body.
- [ ] Each knowledge-page edit follows the `/wiki` merge procedure, and `knowledge-impact.sh --verified` reports no edited page as needs-review.
- [ ] `bash .claude/skills/eval/run.sh` reports no new REGRESSION.
- [ ] The PR targets `development`.

## Lessons

Filled by the advisor before undraft.
