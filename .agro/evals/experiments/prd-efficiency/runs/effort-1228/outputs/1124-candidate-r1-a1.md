# PRD: Retire unproven skill machinery

Status: DRAFT

## User Stories

### US-001: Rewrite the retro contract probe first

**Description:** As the advisor, I want `retro-deterministic-contract.sh` to pin the three kept invariants so that the probe permits the ceremony removal and still blocks a regression.

**Acceptance Criteria:**

- [ ] The probe no longer pins the 8-column hypothesis table, `STATUS: RETRO-DONE`, the `--focus` flag, or `references/report-schema.md`.
- [ ] The probe pins the report-only contract line `It emits its report to the terminal and writes no file at all.` and the `Inventing a file to save a lesson in.` anti-pattern.
- [ ] The probe pins the no-double-write rule against an existing probe under `.agro/evals/probes/`.
- [ ] The probe pins the per-lesson `[verdict · confidence]` tag and the promotion-line form that `.agro/skills/wiki/references/compile.md` parses.
- [ ] Fault injection on a disposable copy of `SKILL.md` removes each pinned fragment in turn, and the probe exits 1 and names the fragment each time.
- [ ] The probe header keeps `# tier:`, `# source:`, and `# desc:` lines.

### US-002: Strip the retro ceremony

**Description:** As an operator, I want `/retro` to keep its node and drop its ceremony so that a retro costs less and still feeds `/wiki compile`.

**Acceptance Criteria:**

- [ ] `.agro/skills/retro/SKILL.md` contains no falsifiability gate, no 8-column hypothesis table, no five-subsystem lens section, no `STATUS: RETRO-DONE`, and no `--focus` flag.
- [ ] `.agro/skills/retro/references/report-schema.md` does not exist.
- [ ] `.agro/skills/retro/SKILL.md` exists, and `bash .agro/evals/probes/roles-are-skills.sh` exits 0.
- [ ] `bash .agro/evals/probes/retro-deterministic-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/wiki-compile-contract.sh` exits 0.
- [ ] `.agro/skills/wiki/references/compile.md` and the new `/retro` promotion line use the same tag form, and the `/wiki compile` eligibility table still gates on verdict and confidence.

### US-003: Retire the wave 1 skills

**Description:** As a maintainer, I want `sync`, `post-bridge`, `blog`, `fanout`, and `render-html` removed so that the corpus holds no zero-cascade dead machinery.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/{sync,post-bridge,blog,fanout,render-html}` do not exist.
- [ ] The probes `sync-skill-contract.sh` and `post-bridge-publish-confirmation.sh` do not exist.
- [ ] `.agro/skills.lock` holds no `post-bridge` entry and no `render-html` entry, and `jq -e . .agro/skills.lock` exits 0.
- [ ] The `/sync` references in `.agro/knowledge/source/agro-web-pipeline.md`, `.agro/knowledge/source/crabbox-remote-exec-control-plane.md`, and `docs/rfcs/rfc-runtime-support.md` are removed or rewritten.
- [ ] The retro docs lens at `.agro/skills/retro/SKILL.md:135` names no `/blog` skill.

### US-004: Retire the wave 2 skills

**Description:** As a maintainer, I want `rlm`, `weigh`, `interview`, `imagine`, and `strategic-proposal` removed so that the corpus holds no unmeasured cascade machinery.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/{rlm,weigh,interview,imagine,strategic-proposal}` do not exist.
- [ ] The probes `rlm-context-budget.sh` and `weigh-scorer-contract.sh` do not exist.
- [ ] `.agro/skills.lock` holds no `interview` entry and no `strategic-proposal` entry, and `jq -e . .agro/skills.lock` exits 0.
- [ ] `.agro/skills/council/SKILL.md`, `.agro/skills/council/references/scenarios.md`, `.agro/skills/plan/SKILL.md:207`, `.agro/skills/spec/references/plan.md:35`, and `crons/heartbeat.md:73` name no retired skill.
- [ ] `.agro/evals/probes/audit-stale-references.sh:30` names no `.agro/skills/weigh` path, and the probe exits 0.

### US-005: Verify the whole retirement

**Description:** As the advisor, I want one closing verification so that the Definition of Done in issue #1124 holds as a set.

**Acceptance Criteria:**

- [ ] `bash .agro/evals/run.sh` exits 0, and the probe count is exactly 4 lower than the count on the base commit.
- [ ] `git grep -nE '(/|skills/)(sync|post-bridge|blog|fanout|render-html|rlm|weigh|interview|imagine|strategic-proposal)\b'` over the working tree returns no match outside CHANGELOG, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/evals/RESULTS.md`, `.agro/evals/decisions/`, and `.agro/tasks/archive/**`.
- [ ] `bash .agro/scripts/link-providers.sh` exits 0, and `find .claude/skills -xtype l` prints nothing.
- [ ] The CB-005 row in `.agro/evals/capability/RESULTS.md` carries a new score of 1.33 or higher.

## Summary

Issue #1124 retires ten skills and strips the `/retro` ceremony. The standard comes from the CB-003 and CB-004 rows in `.agro/evals/capability/RESULTS.md`. That standard retires machinery that nobody measured and keeps machinery that produced results.

Verified state:

- All ten skill directories exist under `.agro/skills/`, and `.claude/skills/` mirrors each one.
- The four probes named in the issue exist under `.agro/evals/probes/`.
- `.agro/skills.lock` holds entries for `interview`, `post-bridge`, `render-html`, and `strategic-proposal`.
- `retro-deterministic-contract.sh` pins 8 literals in `.agro/skills/retro/SKILL.md`, including `STATUS: RETRO-DONE` and the `--focus` argument hint.
- `.agro/skills/wiki/references/compile.md` parses the promotion line and gates on verdict and confidence in its eligibility table.
- `roles-are-skills.sh:16` requires the `retro` skill.
- The task folder did not exist before this plan.

The selected approach runs in order. US-001 changes the probe first. US-002 then loosens `/retro`. US-003 and US-004 delete the skills and clean the references. US-005 verifies the set.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | pinned literals, validator fixtures | Blocks the ceremony removal until rewritten |
| `.agro/skills/retro/SKILL.md` | argument hint, Deterministic contract, five-subsystem lens, steps 4 to 7 | Ceremony to strip |
| `.agro/skills/retro/references/report-schema.md` | output schema | Delete |
| `.agro/skills/retro/scripts/validate-retro-report.sh` | report validator | Fate is an open question |
| `.agro/skills/wiki/references/compile.md` | promotion-line parse, eligibility table | Consumer of the kept invariant |
| `.agro/evals/probes/wiki-compile-contract.sh` | compile contract | Must stay green |
| `.agro/evals/probes/roles-are-skills.sh` | skill list at line 16 | Requires `retro` to survive |
| `.agro/evals/probes/audit-stale-references.sh` | path list at line 30 | Names `.agro/skills/weigh` |
| `.agro/skills.lock` | four retired entries | Remove entries |
| `.agro/scripts/link-providers.sh` | provider links | Rebuild the `.claude/skills` mirror |
| `.agro/evals/capability/RESULTS.md` | CB-005 row | Re-score |
| `.agro/skills/council/SKILL.md`, `.agro/skills/council/references/scenarios.md`, `.agro/skills/plan/SKILL.md`, `.agro/skills/spec/references/plan.md`, `crons/heartbeat.md` | inbound references | Remove retired names |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slash commands | Removal | Ten commands disappear from every provider mirror. |
| `/retro` arguments | Removal | The `--focus` flag disappears. |
| `/retro` report | Contract change | The report drops the hypothesis table and the terminal status line. The promotion line keeps its tag form. |
| `/spec plan --plan` | Documentation | The example that names `/imagine` changes. |
| `mifunedev/agro-web` | Documentation | Public skill pages for retired skills need removal in that repository. |

## Storage

N/A. The task deletes files and edits Markdown and shell. No persistent store changes.

## Architectural Decisions

- `.agro/skills/` stays the canonical source. The implementer edits `.agro/`, then runs `link-providers.sh`. Nobody edits `.claude/skills/` directly.
- Retirement means deletion. No dormant copy stays in the working tree.
- The `/retro` node stays. The `/retro` → `/wiki compile` → pattern → probe chain stays intact.
- `/benchmark` stays. It produced the retirement standard and is step 9.3 of `/spec execute`.
- Historical records stay unchanged: CHANGELOG, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/evals/RESULTS.md`, `.agro/evals/decisions/`, and `.agro/tasks/archive/**`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | pinned invariants present; each invariant removed by fault injection | US-001, US-002 |
| `.agro/evals/probes/wiki-compile-contract.sh` | compile contract | US-002 |
| `.agro/evals/probes/roles-are-skills.sh` | `retro` survives | US-002 |
| `.agro/evals/probes/audit-stale-references.sh` | no retired path | US-004 |
| `.agro/evals/run.sh` | full suite; probe count drops by 4 | US-005 |
| `git grep` command in US-005 | no dangling reference | US-005 |
| `.agro/scripts/link-providers.sh` | mirror links resolve | US-005 |

## Design Principles

- Delete obsolete paths. Do not leave dormant alternatives.
- Change the probe before the prose that the probe guards.
- Pin short semantic fragments, per `.agro/evals/AGENTS.md`.
- Add no explanatory comments to tracked code.
- Keep one source of truth for the promotion-line form.

## Out of Scope

- Retiring `/benchmark`, `/prompt-miner`, `/council`, `/prd`, or `/plan`.
- Changing the write gate of `/wiki compile`.
- Changing the `.agro/tasks/` layout or the advisor and worker model from ADR #989.
- Writing the companion ADR.

## Open Questions

2. `.agro/knowledge/source/recursive-language-models.md` and two files under `.agro/knowledge/raw/` name `rlm` and `weigh`. Does the implementer rewrite the three knowledge pages, or does the exclusion list grow to cover `.agro/knowledge/raw/`?
2. `.agro/knowledge/source/recursive-language-models.md` and two files under `.agro/knowledge/raw/` name `rlm` and `weigh`. Does the implementer rewrite these pages, or does the exclusion list grow to cover `.agro/knowledge/raw/`?
3. `docs/intro.md:71` and `docs/resources.md:10` link to the `agro-web` blog tree, not to the `/blog` skill. Does the dangling-reference check exempt these links?
4. Who runs the CB-005 re-score, and which trajectory counts as evidence: <CB-005 run procedure>?
5. Which `agro-web` pages list the retired skills: <agro-web paths>?

## Acceptance Criteria

- [ ] `bash .agro/evals/run.sh` exits 0, and the probe count drops by exactly 4.
- [ ] The ten skill directories do not exist under `.agro/skills/` or `.claude/skills/`.
- [ ] The US-005 `git grep` command returns no match outside the historical exclusions.
- [ ] `roles-are-skills.sh` and `wiki-compile-contract.sh` exit 0.
- [ ] The rewritten retro probe exits 1 under fault injection for each pinned invariant.
- [ ] CB-005 carries a score of 1.33 or higher.
- [ ] `link-providers.sh` exits 0, and every symlink resolves.
- [ ] `jq -e . .agro/skills.lock` exits 0, and the lock holds no retired entry.

## Lessons

Filled by the advisor before undraft.
