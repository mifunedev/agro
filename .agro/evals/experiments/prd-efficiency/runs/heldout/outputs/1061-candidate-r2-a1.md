# PRD: Resolve the deferred Open Harness name surfaces

Status: BLOCKED

## User Stories

### US-001: Decide the NOTICE files

**Description:** As an operator, I want one recorded NOTICE decision so that legal text changes only by intent.

**Acceptance Criteria:**

- [ ] The PR body records the decision for `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`, with its reasoning.
- [ ] If the operator does not approve a rename, `git diff development -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` prints nothing.
- [ ] The PR body marks the NOTICE class as permanently retained when the decision is "retain".
- [ ] `.agro/cli/legacy/NOTICE` keeps the "Open Harness" name in every outcome, because the legacy shim keeps that name.

### US-002: Decide the Slack manifest name

**Description:** As an operator, I want the manifest name checked against the live Slack app so that installs keep working.

**Acceptance Criteria:**

- [ ] The PR body records the registered name of the live Slack app, as the operator reports it.
- [ ] The PR body records the decision for `.pi/install/slack-manifest.json`, with its reasoning.
- [ ] If the decision has no explicit compatibility decision, `git diff development -- .pi/install/slack-manifest.json` prints nothing.
- [ ] If the manifest changes, `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] If the manifest changes, `docs/integrations/slack.md` names the same app name as the manifest.

### US-003: Rename the name in knowledge pages through /wiki

**Description:** As a knowledge reader, I want the knowledge pages renamed through /wiki so that each page stays verified.

**Acceptance Criteria:**

- [ ] `git grep -n 'Open Harness' -- .agro/knowledge/source/` prints only lines that quote an external source or a historical name.
- [ ] Each edited page follows the update procedure in `.agro/skills/wiki/references/schema.md`, including the `verified_at` step for each page with `kind: repo`.
- [ ] The /wiki lint freshness check reports no finding for the edited pages.
- [ ] `bash .agro/evals/probes/wiki-readme-index.sh` exits 0.
- [ ] The PR body lists each edited page and the re-verification result for the page.

## Summary

Issue 1061 splits four deferred surfaces out of issue 1058. The unit names stay, and this plan does not reopen them.

Verified state at the base commit:

- Each of the three NOTICE files holds "Open Harness" on line 1 and in the trademark clause on line 25.
- `.pi/install/slack-manifest.json` holds the name on lines 3, 4, 14, 20, and 25. `.agro/evals/probes/slack-admin-command-surface.sh` reads the manifest.
- `git grep` finds 17 hits in 5 knowledge pages. The issue reports 18 hits in 6 pages. `.agro/knowledge/source/recursive-language-models.md` has no hit now.
- The classification table named in the issue is gitignored and does not exist in this checkout.

The approach is three independent decisions. Each story ships on its own.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `NOTICE` | line 1 title, line 25 trademark clause | Root legal notice |
| `.agro/cli/NOTICE` | line 1, line 25 | CLI package legal notice |
| `.agro/cli/legacy/NOTICE` | line 1, line 25 | Legacy shim legal notice |
| `.pi/install/slack-manifest.json` | `name`, `description`, `display_name`, slash command descriptions | Slack app manifest |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST` | Probe that reads the manifest |
| `docs/integrations/slack.md` | Slack app setup steps | User doc that cites the manifest |
| `.agro/knowledge/source/molt-agentic-reinforcement-learning.md` | 8 hits | Knowledge page |
| `.agro/knowledge/source/managed-agents.md` | 4 hits, `verified_at` | Knowledge page |
| `.agro/knowledge/source/runtime-isolation-landscape.md` | 2 hits | Knowledge page |
| `.agro/knowledge/source/crabbox-remote-exec-control-plane.md` | 2 hits | Knowledge page |
| `.agro/knowledge/source/oh-cli-portable-lifecycle.md` | 1 hit | Knowledge page |
| `.agro/skills/wiki/references/schema.md` | update procedure, `verified_at` | Page update contract |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | freshness check | Re-verification against declared sources |
| `.agro/knowledge/AGENTS.md` | production contract | Scoped rules for knowledge edits |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| NOTICE files | Decision only, edit only by operator approval | Legal attribution text |
| Slack app manifest | Decision only, edit only with a compatibility decision | Published app name and descriptions |
| Knowledge pages | Prose edit through /wiki | Product name in page prose |
| systemd unit names | None | Out of scope by the earlier cutover |

## Storage

N/A. The task adds no persistent state. The PR body holds each decision record, because git ignores the classification table and the task folder.

## Architectural Decisions

- The operator owns the NOTICE decision and the Slack decision. The implementer records each decision and does not make it.
- A published artifact name changes only after an explicit compatibility decision.
- The /wiki procedure owns knowledge-page edits. A sweep edit does not replace the procedure.
- The legacy shim keeps its original name.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | manifest admin commands | The manifest stays valid after any edit |
| `.agro/evals/probes/wiki-readme-index.sh` | index rows | Knowledge index stays in sync |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | freshness of edited pages | Each edited page stays verified |
| full probe suite through /eval | all probes | No new regression against `.agro/evals/RESULTS.md` |

## Design Principles

- Change the smallest surface that the decision needs.
- Record a "retain" decision so that no later sweep reopens the class.
- Keep each decision independent. One blocked decision does not block the other stories.
- Quote external sources byte for byte, and keep historical names in quotes.

## Out of Scope

- The unit names `.devcontainer/openharness-cron.service` and `.devcontainer/openharness-bootstrap.service`.
- A rename of the live Slack app.
- The `stale` and `pinned` classes, which issue 1058 closed.
- Any change to the npm package name of the legacy shim.

## Open Questions

1. Does the product rename belong in the NOTICE files? Recommendation: retain all three files unchanged. The operator must confirm this legal decision.
2. What name does the live Slack app carry? Only the operator can check the Slack workspace.
3. The eval runner named in the issue does not exist in this checkout. Which command runs the full probe suite? Use `<eval runner command>` until the operator confirms it.
4. Git ignores the classification table, and this checkout has no copy. Does a "permanently retained" mark need a tracked home, or does the PR body suffice?

## Acceptance Criteria

- [ ] The PR body records each of the three decisions with its reasoning.
- [ ] The PR body marks each class that the operator retains permanently.
- [ ] No published artifact name changes without an explicit compatibility decision.
- [ ] Each knowledge-page edit follows the /wiki procedure, and each edited page passes the freshness check.
- [ ] `<eval runner command>` reports no new regression.
- [ ] The PR targets the development branch.

## Lessons

Filled by the advisor before undraft.
