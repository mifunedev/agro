# PRD: Resolve the deferred Open Harness name surfaces

Status: BLOCKED

## User Stories

### US-001: Record retention decisions for NOTICE files and the Slack manifest

**Description:** As an operator, I want each legal and Slack surface decided so that no published name drifts.

**Acceptance Criteria:**

- [ ] The PR body records one decision and one reason for the class that holds `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`.
- [ ] The PR body records one decision and one reason for `.pi/install/slack-manifest.json`, and names the live Slack app check that the operator ran.
- [ ] If the operator did not confirm a Slack app rename, `git diff development -- .pi/install/slack-manifest.json` prints nothing.
- [ ] If the operator did not approve a legal rename, `git diff development -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` prints nothing.
- [ ] `git diff development -- .devcontainer/openharness-cron.service .devcontainer/openharness-bootstrap.service` prints nothing.

### US-002: Rename the product name in six knowledge pages through the wiki procedure

**Description:** As an operator, I want knowledge pages renamed by procedure so that every page stays verified.

**Acceptance Criteria:**

- [ ] `git grep -n -i 'open harness' -- .agro/knowledge/source/` prints no line that names the product as current.
- [ ] Each edited page went through the /wiki ingest route, and each `kind: repo` page carries a `verified_at:` value equal to a commit on the branch.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports no freshness finding for the six pages.
- [ ] `bash .agro/evals/probes/wiki-readme-index.sh` exits 0.
- [ ] The /eval probe suite over `.agro/evals/probes/` reports no new REGRESSION against the `development` baseline.

## Summary

Issue 1061 holds four surfaces that issue 1058 deferred. The four surfaces are 3 NOTICE files, 1 Slack manifest, 2 systemd units, and 6 knowledge pages. Each NOTICE file names "Open Harness" on line 1 and in the trademark reservation on line 25. The Slack manifest sets `"name": "Open Harness"` on line 3 and names the product in 8 command descriptions. The unit names stay, and this task does not change them. The knowledge pages carry freshness contracts that `.agro/skills/wiki/scripts/knowledge-impact.sh` measures.

The selected approach keeps the legal files and the manifest unchanged by default. Each decision gets a reason. The knowledge-page rename goes through /wiki.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `NOTICE` | line 1 title, line 25 trademark reservation | Legal attribution; retain by default |
| `.agro/cli/NOTICE` | line 1, line 25 | Legal attribution; retain by default |
| `.agro/cli/legacy/NOTICE` | line 1, line 25 | Notice for the retained legacy shim; retain |
| `.pi/install/slack-manifest.json` | `display_information.name`, command descriptions | Slack app manifest; change only after a live app check |
| `.agro/skills/wiki/references/ingest.md` | `kind`, `verified_at` rules near line 496 | Procedure for each page edit |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | Freshness oracle for edited pages |
| `.agro/knowledge/AGENTS.md` | production contract | Rules for knowledge entries and the generated Index |
| `.agro/knowledge/source/molt-agentic-reinforcement-learning.md` | 8 hits | Page to rename |
| `.agro/knowledge/source/managed-agents.md` | 4 hits | Page to rename |
| `.agro/knowledge/source/runtime-isolation-landscape.md` | 2 hits | Page to rename |
| `.agro/knowledge/source/crabbox-remote-exec-control-plane.md` | 2 hits | Page to rename |
| `.agro/knowledge/source/recursive-language-models.md` | 1 hit | Page to rename |
| `.agro/knowledge/source/oh-cli-portable-lifecycle.md` | 1 hit | Page to rename |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Slack app display name | None by default | The manifest stays unchanged unless the operator confirms a coordinated Slack rename. |
| Legal notices | None by default | The notices stay unchanged unless the operator approves a legal rename. |
| systemd unit names | None | `.devcontainer/openharness-cron.service` and `.devcontainer/openharness-bootstrap.service` stay. |

## Storage

The knowledge pages under `.agro/knowledge/source/` are the only persistent state that changes. Each page keeps its frontmatter schema. Decisions go into the PR body and `progress.txt`, because git ignores the task folder.

## Architectural Decisions

- The repository stays the source of truth. The /wiki procedure owns each page edit and each `verified_at:` change.
- A published artifact name changes only after an explicit compatibility decision by the operator.
- The earlier identity cutover settled the unit names. This task does not reopen that decision.
- A historical mention of the retired name stays when the page describes the past, for example the legacy shim.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` on the branch | No stale page after the rename |
| `.agro/evals/probes/wiki-readme-index.sh` | full run | The generated Index stays valid |
| `.agro/evals/probes/spec-execute-knowledge-impact.sh` | full run | The freshness path still works |
| `.agro/evals/RESULTS.md` | /eval full probe run | No new REGRESSION against `development` |

## Design Principles

- Apply the smallest truthful change. Retain a surface when the rename adds risk and no value.
- Keep one decision per class, with a reason next to the decision.
- Change a canonical page only through its owning procedure.
- Write no explanatory comments into tracked files.

## Out of Scope

- Renaming `.devcontainer/openharness-cron.service` or `.devcontainer/openharness-bootstrap.service`.
- Renaming the Slack app in the Slack workspace.
- Legal review of license terms beyond the product name.
- Surfaces outside the four deferred classes.

## Open Questions

1. The classification table from issue 1058 is absent from this checkout, and git ignores the task folder. Which tracked location holds the "permanently retained" marks: the PR body, an issue comment, or a new tracked file at <path>?
2. Does the operator approve the default of keeping all three NOTICE files unchanged as a permanent retention?
3. Is "Open Harness" the registered display name of the live Slack app? The operator must check the app, because the agent has no Slack admin access.
4. This plan did not read the `kind` value of the six pages. Each `kind: repo` page needs a new `verified_at:` value.
5. The probe-suite runner that the issue names does not exist. Does the operator accept /eval, which writes `.agro/evals/RESULTS.md`, as the replacement?

## Acceptance Criteria
- [ ] The PR body records the NOTICE decision, the Slack manifest decision, and the knowledge-page decision, each with a reason.
- [ ] Each class decided as permanently retained carries a retained mark in the location that open question 1 selects.
- [ ] No published artifact name changes without an explicit compatibility decision in the PR body.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports no freshness finding for the six pages.
- [ ] The /eval probe suite reports no new REGRESSION. The runner named in the issue does not exist, so /eval replaces it.
- [ ] The PR targets the `development` branch.

## Lessons

Filled by the advisor before undraft.
