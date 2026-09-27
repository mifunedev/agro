# PRD: Resolve deferred Open Harness surfaces

Status: BLOCKED

Source: issue [#1061](https://github.com/mifunedev/agro/issues/1061), split out of #1058.

## User Stories

### US-001: Record the NOTICE decision

**Description:** As the operator, I want a recorded decision for the three `NOTICE` files so that the `external` NOTICE rows close with a stated reason.

**Acceptance Criteria:**

- [ ] `classification.md` holds one decision row for each of `NOTICE`, `.agro/cli/NOTICE`, and `.agro/cli/legacy/NOTICE`.
- [ ] Each row states the decision (`retained` or `renamed`) and one reason sentence.
- [ ] If the operator answers Q1 with "retain", `git diff <base>..HEAD -- NOTICE .agro/cli/NOTICE .agro/cli/legacy/NOTICE` prints nothing.
- [ ] If the operator answers Q1 with "rename", the PR body names the compatibility decision for `@mifune/agro`. The `.agro/cli/legacy/NOTICE` file keeps `Open Harness` in both cases.

### US-002: Record the Slack manifest decision

**Description:** As the operator, I want a Slack manifest decision that matches the live app so that the manifest stays aligned with Slack.

**Acceptance Criteria:**

- [ ] `classification.md` records the live display name of the registered Slack app, the operator who checked the name, and the check date.
- [ ] `classification.md` records the decision for `.pi/install/slack-manifest.json` (`retained` or `renamed`) with one reason sentence.
- [ ] If the decision is `retained`, `git diff <base>..HEAD -- .pi/install/slack-manifest.json` prints nothing.
- [ ] If the decision is `renamed`, the PR body names the coordinated Slack app rename step. `bash .agro/skills/eval/run.sh --probe slack-admin-command-surface` reports PASS.

### US-003: Mark the unit files as retained

**Description:** As the operator, I want the two unit rows marked permanently retained so that a later sweep leaves the unit cutover closed.

**Acceptance Criteria:**

- [ ] `classification.md` marks `.devcontainer/openharness-cron.service` and `.devcontainer/openharness-bootstrap.service` as permanently retained. Each row cites the earlier identity cutover as the reason.
- [ ] `git diff <base>..HEAD -- .devcontainer/` prints nothing.

### US-004: Rename the knowledge pages through /wiki

**Description:** As the operator, I want the `/wiki` procedure to rename the retired product in each knowledge page so that each page stays verified.

**Acceptance Criteria:**

- [ ] The orchestrator updates each page in the Summary table through the `/wiki ingest` update path (`ingest.md` § 6b). A direct text sweep is not allowed.
- [ ] `git grep -c "Open Harness" -- .agro/knowledge/source/` prints nothing.
- [ ] `grep -Pzo 'Open[ \t]*\n[ \t#*>|-]*Harness' .agro/knowledge/source/*.md` prints nothing.
- [ ] Each `kind: repo` page in the table (`managed-agents.md`, `oh-cli-portable-lifecycle.md`) carries a `verified_at:` value equal to the commit at which the orchestrator re-checked its claims.
- [ ] Each updated page carries `updated:` equal to the UTC date of the update. No page changes its `created:` value.
- [ ] `bash .agro/skills/wiki/scripts/knowledge-impact.sh --verified` reports no stale page among the five updated pages.
- [ ] `/wiki lint` regenerates `.agro/knowledge/README.md`, and `bash .agro/skills/eval/run.sh --probe wiki-readme-index` reports PASS.
- [ ] `classification.md` marks the `deferred` class as resolved and lists the five updated pages.

## Summary

Issue #1061 tracks four surfaces that #1058 deferred. The classification table lives at `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md`. The issue cites the pre-archive path `.agro/tasks/retire-open-harness-name/classification.md`, which no longer exists. Git tracks the archived file.

Verified current state at commit `567e893`:

| Class | File | Current hits | Fact |
|---|---|---|---|
| `external` | `NOTICE` | 2 | Line 1 names the Work. The trademark clause names `Open Harness` as a Licensor mark. |
| `external` | `.agro/cli/NOTICE` | 2 | The `files` array of `.agro/cli/package.json` (`@mifune/agro`) publishes this file to npm. |
| `external` | `.agro/cli/legacy/NOTICE` | 2 | The `files` array of `.agro/cli/legacy/package.json` (`@mifune/openharness`) publishes this file. The retired name is correct for this package. |
| `external` | `.pi/install/slack-manifest.json` | 9 | `display_information.name` is `Open Harness`. Eight description strings name the product. |
| `external` | `.devcontainer/openharness-cron.service` | 1 | The hit is the `Description=` line. |
| `external` | `.devcontainer/openharness-bootstrap.service` | 1 | The hit is the `Description=` line. |
| `deferred` | `.agro/knowledge/source/molt-agentic-reinforcement-learning.md` | 8 | `kind: external` |
| `deferred` | `.agro/knowledge/source/managed-agents.md` | 4 | `kind: repo`, `verified_at: 1e3e040e` |
| `deferred` | `.agro/knowledge/source/crabbox-remote-exec-control-plane.md` | 2 | `kind: external` |
| `deferred` | `.agro/knowledge/source/runtime-isolation-landscape.md` | 2 | `kind: external` |
| `deferred` | `.agro/knowledge/source/oh-cli-portable-lifecycle.md` | 1 | `kind: repo`, `verified_at: bed2d90c` |
| `deferred` | `.agro/knowledge/source/recursive-language-models.md` | 0 | A later change removed the one hit that #1058 counted. |

The `deferred` class now holds 17 hits in 5 files, not 18 hits in 6 files.

The selected approach resolves three independent decisions:

1. NOTICE files. The recommended default is `retained`. A NOTICE records attribution and licensor marks. The `Open Harness` mark stays a Licensor mark after the product rename. Two of the three files ship inside published npm packages. The operator confirms or overrides this default in Q1.
2. Slack manifest. The agent cannot read the live Slack app registration. The operator checks the registered display name, then chooses `retained` or `renamed` in Q2.
3. Knowledge pages. The orchestrator runs the rename through the `/wiki ingest` update path. Each `kind: repo` page gets a fresh `verified_at:`.

The unit files stay unchanged. The issue excludes them from reopening.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/archive/2026-09-21/retire-open-harness-name/classification.md` | `## deferred`, `## external` tables | Records each decision and each retained class. |
| `NOTICE`, `.agro/cli/NOTICE`, `.agro/cli/legacy/NOTICE` | Line 1, `Trademarks` section | Legal attribution surfaces under decision Q1. |
| `.agro/cli/package.json`, `.agro/cli/legacy/package.json` | `files` array | Publishes each `NOTICE` to npm. |
| `.pi/install/slack-manifest.json` | `display_information.name`, `features.slash_commands[].description` | Slack app manifest under decision Q2. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `need_literal "$MANIFEST" ...` | Guards manifest and bridge-handler alignment. |
| `.devcontainer/openharness-cron.service`, `.devcontainer/openharness-bootstrap.service` | `Description=` | Retained unit surfaces. |
| `.agro/knowledge/source/*.md` (five pages above) | Body prose, `updated:`, `verified_at:` | Pages under rename. |
| `.agro/skills/wiki/references/ingest.md` | § 6b Existing entry (update) | The only authorized write path for knowledge pages. |
| `.agro/skills/wiki/scripts/knowledge-impact.sh` | `--verified` | The one freshness check. |
| `.agro/skills/eval/run.sh` | whole suite, `--probe <id>` | Regression floor. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| npm package `@mifune/agro` | None (default) | `NOTICE` ships in the package. A rename needs the Q1 compatibility decision. |
| npm package `@mifune/openharness` | None | The legacy shim keeps the retired name. |
| Slack app manifest | None (default) or renamed | Q2 decides. A rename needs a coordinated change to the live Slack app. |
| systemd units | None | Unit names and descriptions stay. |
| Public documentation (`mifunedev/agro-web`) | Not applicable | No user-facing behavior or term changes, unless Q2 renames the Slack app. |

## Storage

The task stores decisions in the tracked file `classification.md`. The task stores knowledge updates in tracked pages under `.agro/knowledge/source/` and in the generated index `.agro/knowledge/README.md`. The task adds no new persistence layer.

## Architectural Decisions

- `classification.md` stays the one source of truth for the class of every `Open Harness` hit.
- `/wiki ingest` stays the one write path for `.agro/knowledge/`. `knowledge-impact.sh` stays the one freshness check.
- The operator owns the legal decision (Q1) and the Slack registration check (Q2). The agent records the operator's answers and does not infer them.
- A published artifact name changes only with an explicit compatibility decision recorded in the PR body.
- The PR targets `development`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/eval/run.sh` | Full suite | No new green-to-red regression. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Manifest literals | The manifest still matches the bridge handlers. |
| `.agro/evals/probes/wiki-readme-index.sh` | Index drift | `.agro/knowledge/README.md` matches the tracked pages. |
| `.agro/evals/probes/cron-systemd-service.sh` | Unit files | The unit contract still holds. |
| `.agro/skills/wiki/scripts/knowledge-impact.sh --verified` | Five updated pages | Each `kind: repo` page is fresh. |
| `git grep` and the wrap-aware `grep -Pzo` scan | `.agro/knowledge/source/` | No retired name remains on a single line or across a wrap. |

This task adds no test file. The task changes prose and recorded decisions, not behavior.

## Design Principles

- Apply the repository principles: code is the source of truth, one source of truth per policy, and the smallest realistic change.
- Record a decision instead of editing a surface when the edit carries legal or registration risk.
- Change no published artifact name without an explicit compatibility decision.
- Route knowledge edits through the `/wiki` procedure so that re-verification happens by procedure.

## Out of Scope

- Rename of the systemd unit files or their `Description=` lines.
- Rename of the npm package `@mifune/openharness` or its `NOTICE`.
- The `historical`, `compatibility`, and `test-fixture` classes.
- The three probe failure messages that `classification.md` notes under "A note on the probe failure messages".
- Changes to the live Slack app. The operator performs any coordinated rename outside this repository.

## Open Questions

1. Q1 (NOTICE): Does the product rename belong in the `NOTICE` files?
   - A. Retain all three files unchanged, and mark the class permanently retained. This is the recommended default.
   - B. Rename line 1 in `NOTICE` and `.agro/cli/NOTICE`, keep the trademark clause, and retain `.agro/cli/legacy/NOTICE`.
   - C. Other: `<specify>`.
2. Q2 (Slack): What display name does the live registered Slack app use, and what is the decision?
   - A. The live name is `Open Harness`. Retain the manifest unchanged.
   - B. The live name is `Open Harness`. Rename the manifest and the live app together on `<date>`.
   - C. The live name is already `<new name>`. Align the manifest to the live name.
3. Q3 (record location): `classification.md` lives under `.agro/tasks/archive/2026-09-21/`. Does the operator accept edits to that archived, tracked file?
   - A. Edit the archived `classification.md` in place. This is the recommended default, because the issue acceptance criteria name that file.
   - B. Write the decisions to `.agro/tasks/resolve-deferred-open-harness-surfaces/classification.md`, and add a pointer line to the archived file.
4. Q4 (unit descriptions): Does "unit names stay" also retain the `Description=Open Harness ...` lines? This plan assumes yes.
5. Q5 (eval command): The issue names `bash .agro/evals/run.sh`. That file does not exist. This plan uses `bash .agro/skills/eval/run.sh`. Confirm the substitution.

## Acceptance Criteria

- [ ] `classification.md` records the NOTICE, Slack manifest, and knowledge-page decisions, each with a reason.
- [ ] `classification.md` marks each class decided as permanently retained.
- [ ] No published artifact name changes unless the PR body records an explicit compatibility decision.
- [ ] Each knowledge-page edit goes through `/wiki`, and `knowledge-impact.sh --verified` reports every updated page fresh.
- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] The PR targets `development`.

## Lessons

Filled by the advisor before undraft.
