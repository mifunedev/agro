# PRD: Resolve the deferred Open Harness name surfaces

Status: DRAFT

## User Stories

### US-001: Record the NOTICE file decision

**Description:** As the operator, I want a recorded NOTICE decision so that legal text changes only by intent.

**Acceptance Criteria:**

- [ ] The PR body records the decision for `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`, with the reasoning.
- [ ] The reasoning addresses line 1 (the product title) and line 25 (the trademark reservation) of each NOTICE file.
- [ ] If the operator decides to retain the name, `git diff development -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` prints nothing.
- [ ] `.agro/cli/legacy/NOTICE` keeps the retired name, because the retained `@mifune/openharness` shim uses that name.

### US-002: Record the Slack manifest decision

**Description:** As the operator, I want the Slack manifest checked against the live app so that installs keep working.

**Acceptance Criteria:**

- [ ] The operator reports the display name of the live registered Slack app, and the PR body records that name.
- [ ] The PR body records one decision for `.pi/install/slack-manifest.json`: retain the name, or rename in coordination with the live app.
- [ ] If the decision is to retain the name, `git diff development -- .pi/install/slack-manifest.json` prints nothing.
- [ ] If the decision is to rename, the PR body records the compatibility decision for the live app before the manifest changes.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` reports PASS.

### US-003: Rename the knowledge pages through the wiki procedure

**Description:** As a wiki reader, I want the knowledge pages renamed by procedure so that each page stays verified.

**Acceptance Criteria:**

- [ ] Each edit to a page in `.agro/knowledge/source/` follows the update strategy in section 11 of `.agro/skills/wiki/references/schema.md`.
- [ ] `.agro/knowledge/source/managed-agents.md` and `.agro/knowledge/source/oh-cli-portable-lifecycle.md` each set `verified_at:` to the commit that re-checked the claims.
- [ ] Each changed page sets `updated:` to the UTC date of the edit, and `created:` stays unchanged.
- [ ] `grep -c 'Open Harness'` on each of the six pages returns 0, or the PR body names each retained hit with its reason.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports no stale page among the six pages.
- [ ] `bash .agro/evals/probes/wiki-readme-index.sh` reports PASS.

## Summary

Issue 1058 retired the Open Harness name from current prose. That work deferred three classes of surface. This task makes one recorded decision for each class. The systemd unit names stay, and this task does not reopen them.

Verified state: each NOTICE file holds the name on line 1 and in the trademark reservation on line 25. The Slack manifest holds 9 hits, and a probe reads the manifest. Four knowledge pages have `kind: external`, and two pages have `kind: repo` with `verified_at:`. The grep at the base commit finds no hit in `.agro/knowledge/source/recursive-language-models.md`.

The classification table from issue 1058 is absent at the base commit. The eval runner named in the issue does not exist.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `NOTICE` | lines 1 and 25 | Legal attribution and trademark reservation |
| `.agro/cli/NOTICE` | lines 1 and 25 | Same content as the root NOTICE file |
| `.agro/cli/legacy/NOTICE` | lines 1 and 25 | NOTICE for the retained legacy shim |
| `.pi/install/slack-manifest.json` | `name`, `description` keys | Slack app manifest with 9 hits |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST` | Probe that reads the Slack manifest |
| `.agro/skills/wiki/references/schema.md` | section 5, section 11 | Freshness contract and update strategy |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | Freshness check for `kind: repo` pages |
| `.agro/knowledge/source/molt-agentic-reinforcement-learning.md` | body text | 8 hits, `kind: external` |
| `.agro/knowledge/source/managed-agents.md` | `verified_at:` | 4 hits, `kind: repo` |
| `.agro/knowledge/source/runtime-isolation-landscape.md` | body text | 2 hits, `kind: external` |
| `.agro/knowledge/source/crabbox-remote-exec-control-plane.md` | body text | 2 hits, `kind: external` |
| `.agro/knowledge/source/oh-cli-portable-lifecycle.md` | `verified_at:` | 1 hit, `kind: repo` |
| `.agro/knowledge/source/recursive-language-models.md` | body text | 0 hits at the base commit |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Slack app manifest | Decision, with an optional rename | The manifest changes only after the live app check |
| Knowledge pages | Content update | Prose rename through the wiki procedure |
| NOTICE files | Decision only | No edit without an explicit legal decision |

## Storage

N/A. The task changes tracked text files only. The task adds no persistent state.

## Architectural Decisions

- The live Slack app is the source of truth for the display name. The manifest follows the live app.
- The wiki schema owns the page update procedure. A sweep does not edit a knowledge page.
- The PR body holds the decision record, because the task folder is gitignored.
- The systemd unit names stay unchanged.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Manifest declares the admin commands | The Slack decision keeps the command surface |
| `.agro/evals/probes/wiki-readme-index.sh` | Index matches the page metadata | The page edits keep the generated index valid |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` on the two `kind: repo` pages | Each re-verified page is fresh |
| `.agro/evals/probes/` | The full probe suite through /eval | No new regression |

## Design Principles

- Make the smallest change that records each decision.
- Change no published artifact name without an explicit compatibility decision.
- Keep one source of truth for each decision.
- Add no comments to tracked code.

## Out of Scope

- Renaming `.devcontainer/openharness-cron.service` or `.devcontainer/openharness-bootstrap.service`.
- Renaming the Slack app in the Slack workspace.
- Any edit to the LICENSE file.
- Pages outside the six named knowledge pages.

## Open Questions

1. The classification table from issue 1058 is absent at the base commit, and git ignores the task folder. Where does the implementer mark each permanently retained class? The default is the PR body.
2. The eval runner named in the issue does not exist. Is the /eval skill over `.agro/evals/probes/` the replacement check?
3. Who decides the legal question for the NOTICE files? The trademark reservation on line 25 protects the name, and a rename can remove the protection.
4. The base commit shows 0 hits in `.agro/knowledge/source/recursive-language-models.md`, but the issue counts 1 hit. Does the page need an edit?
5. What is the display name of the live registered Slack app? Only the operator can check the Slack workspace.

## Acceptance Criteria
- [ ] The PR body records each of the three decisions with its reasoning.
- [ ] The PR body marks each class that the operator retains permanently.
- [ ] No published artifact name changes without an explicit compatibility decision in the PR body.
- [ ] Each knowledge page edit follows the wiki procedure, and each changed page passes the freshness check.
- [ ] The /eval probe suite reports no new regression against the base commit.
- [ ] The PR targets `development`.

## Lessons

Filled by the advisor before undraft.
