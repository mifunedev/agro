# PRD: Retire unproven skill machinery

Status: DRAFT

## User Stories

### US-001: Retire the zero-cascade skills

**Description:** As the operator, I want `sync`, `post-bridge`, `blog`, `fanout`, and `render-html` deleted so that the skill corpus holds no orphaned or topology-less machinery.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/sync`, `.agro/skills/post-bridge`, `.agro/skills/blog`, `.agro/skills/fanout`, and `.agro/skills/render-html` do not exist.
- [ ] The probes `.agro/evals/probes/sync-skill-contract.sh` and `.agro/evals/probes/post-bridge-publish-confirmation.sh` do not exist.
- [ ] `jq -e '.skills | has("post-bridge") or has("render-html") | not' .agro/skills.lock` exits 0.
- [ ] The dangling-reference check in the Test Plan reports no hit for the five names.

### US-002: Retire the cascading skills and their inbound references

**Description:** As the operator, I want five cascading skills and their inbound references deleted so that no surviving skill routes to a deleted skill.

**Acceptance Criteria:**

- [ ] The directories `.agro/skills/rlm`, `.agro/skills/weigh`, `.agro/skills/interview`, `.agro/skills/imagine`, and `.agro/skills/strategic-proposal` do not exist.
- [ ] The probes `.agro/evals/probes/rlm-context-budget.sh` and `.agro/evals/probes/weigh-scorer-contract.sh` do not exist.
- [ ] `jq -e '.skills | has("interview") or has("strategic-proposal") | not' .agro/skills.lock` exits 0.
- [ ] `.claude/protected-paths.txt` holds no `strategic-proposal` line, and `bash .agro/evals/probes/protected-paths-resolve.sh` exits 0.
- [ ] Each inbound reference in the Key Integration Points table for this story is removed or rewritten.
- [ ] `bash .agro/evals/probes/advisor-execution-contract.sh`, `bash .agro/evals/probes/audit-stale-references.sh`, and `bash .agro/evals/probes/wiki-readme-index.sh` each exit 0.
- [ ] The dangling-reference check in the Test Plan reports no hit for the five names.

### US-003: Rewrite the retro contract probe before the skill

**Description:** As the operator, I want the retro probe to pin the three preserved invariants so that the probe permits the strip and blocks regressions.

**Acceptance Criteria:**

- [ ] The rewritten probe pins no literal from this list: the 8-column table header, `STATUS: RETRO-DONE`, `--focus`, `report-schema.md`, `validate-retro-report.sh`, and `Bypassing the schema/scripts`.
- [ ] The probe asserts invariant 1: `.agro/skills/retro/SKILL.md` holds `It emits its report to the terminal and writes no file at all.` and `Inventing a file to save a lesson in.`
- [ ] The probe keeps the checks `ro-a`, `ro-b`, and `ro-d` against the deleted memory and context tiers.
- [ ] The probe asserts invariant 2: the SKILL.md holds the instruction to cite an existing probe id and skip, not double-write.
- [ ] The probe asserts invariant 3: the promotion-line template in `.agro/skills/retro/SKILL.md` is byte-identical to the template in `.agro/skills/wiki/references/compile.md`.
- [ ] The probe asserts invariant 3: the SKILL.md defines the per-lesson verdict and confidence tag with the verdicts `supported`, `refuted`, and `inconclusive`.
- [ ] The probe reads `RETRO_SKILL` and `COMPILE_REF` from the environment, with the canonical paths as defaults.
- [ ] Against the current, unmodified `.agro/skills/retro/SKILL.md`, the rewritten probe exits 1. This result proves that the probe pins the new contract.

### US-004: Strip the retro ceremony

**Description:** As the operator, I want `/retro` reduced to its proven node so that the report keeps the `/wiki compile` input and drops the unmeasured ceremony.

**Acceptance Criteria:**

- [ ] `.agro/skills/retro/SKILL.md` holds none of: the falsifiability gate, the 8-column hypothesis table, the five-subsystem lens, `STATUS: RETRO-DONE`, and `--focus`.
- [ ] `.agro/skills/retro/references/report-schema.md` and `.agro/skills/retro/scripts/validate-retro-report.sh` do not exist.
- [ ] The `argument-hint` reads `"[--task <slug>] [--dry-run] [auto-approve]"`.
- [ ] `.agro/scripts/link-providers.sh` and `.agro/scripts/__tests__/hermes-links.test.ts` do not name `validate-retro-report.sh`.
- [ ] `.agro/skills/wiki/references/compile.md` step 1 reads the verdict from the per-lesson tag, not from a `## Hypotheses` table.
- [ ] The step 2 gate table in `compile.md` is unchanged.
- [ ] `bash .agro/evals/probes/retro-deterministic-contract.sh` exits 0.
- [ ] `bash .agro/evals/probes/wiki-compile-contract.sh`, `bash .agro/evals/probes/roles-are-skills.sh`, and `bash .agro/evals/probes/spec-family-contract.sh` each exit 0.
- [ ] Each fault injection in the Test Plan makes the retro probe exit 1.

### US-005: Verify the whole retirement and re-score CB-005

**Description:** As the operator, I want one verification pass over the finished branch so that each issue #1124 Definition of Done item has evidence.

**Acceptance Criteria:**

- [ ] `bash .agro/skills/eval/run.sh` exits 0.
- [ ] The probe count in `.agro/evals/probes/` equals 159. The count on the base branch is 163.
- [ ] `bash .agro/scripts/link-providers.sh` exits 0, and `find -L .claude .agents -maxdepth 2 -type l` prints nothing.
- [ ] `jq -e . .agro/skills.lock` exits 0.
- [ ] `bash .agro/evals/capability/run.sh --task CB-005 <axis flags>` records a CB-005 score of 1.33 or higher.
- [ ] `CHANGELOG.md` holds one `### Removed` entry under `## [Unreleased]` that names the ten skills and links issue #1124.
- [ ] The PR body names `strategic-proposal` verbatim, and `bash .agro/evals/probes/protected-path-deletion.sh` exits 0.
- [ ] The PR body records the exit status of each command in this story and the fault-injection results of US-004.

## Summary

Issue #1124 retires ten skills and strips the `/retro` ceremony. The retirement standard comes from rows CB-003 and CB-004 in `.agro/evals/capability/RESULTS.md`. The standard retires unmeasured machinery. The standard keeps machinery with measured results. Issue #1124 keeps `/benchmark`.

Verified current state:

- `.agro/skills/` holds 37 skill directories. After this task, 27 remain.
- `.agro/evals/probes/` holds 163 probes. Four probes guard retiring skills.
- `.agro/skills.lock` holds entries for `interview`, `post-bridge`, `render-html`, and `strategic-proposal`. The other six retiring skills have no lock entry.
- `.claude/skills` and `.agents/skills` are directory symlinks to `.agro/skills`. A deleted skill directory leaves no per-skill mirror to repair.
- `.claude/protected-paths.txt:29` lists `strategic-proposal`. `protected-path-deletion.sh` requires the PR body to name each deleted protected path.
- The retro probe pins 8 literals in `.agro/skills/retro/SKILL.md`. The probe also runs `validate-retro-report.sh` against fixture reports.
- `link-providers.sh:22` lists `validate-retro-report.sh` in `required_execs`. `hermes-links.test.ts:114` lists the same path in a fixture.
- `compile.md:64` reads verdicts from the `## Hypotheses` table. `compile.md:65-67` holds the promotion-line template. `compile.md:74-79` holds the write gate.
- The issue cites `bash .agro/evals/run.sh`. That file does not exist. The probe runner is `.agro/skills/eval/run.sh`.
- The issue lists `rlm` at 268 lines and `weigh` at 450 lines. `wc -l` over each directory gives 1,357 and 1,177. The difference is scripts, tests, and fixtures.

Selected approach: delete in two waves, then rewrite the retro probe, then rewrite the retro skill. The probe rewrite comes first because the current probe blocks each ceremony edit.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/{sync,post-bridge,blog,fanout,render-html}/` | whole directory | US-001: delete. |
| `.agro/skills/{rlm,weigh,interview,imagine,strategic-proposal}/` | whole directory | US-002: delete. |
| `.agro/evals/probes/sync-skill-contract.sh`, `post-bridge-publish-confirmation.sh` | whole file | US-001: delete. |
| `.agro/evals/probes/rlm-context-budget.sh`, `weigh-scorer-contract.sh` | whole file | US-002: delete. |
| `.agro/skills.lock` | `.skills` keys | US-001 and US-002: remove four entries. |
| `.claude/protected-paths.txt` | line 29 | US-002: remove `strategic-proposal`. |
| `.agro/skills/council/SKILL.md` | lines 141-154 | US-002: remove the `/strategic-proposal` and `/weigh` rows and the weighting paragraph. |
| `.agro/skills/council/references/scenarios.md` | lines 74, 80, 94-95 | US-002: remove the `/strategic-proposal` scenario and the `/weigh` lines. |
| `.agro/skills/plan/SKILL.md` | line 207 | US-002: remove `/imagine`. |
| `.agro/skills/spec/references/plan.md` | line 35 | US-002: remove the `/imagine` example. |
| `.agro/skills/prompt-miner/references/scoring.md` | line 104 | US-002: remove the `weigh` comparison. |
| `crons/heartbeat.md` | line 73 | US-002: remove `/strategic-proposal`. |
| `.agro/evals/probes/advisor-execution-contract.sh` | `planning_command` at line 151 | US-002: remove `imagine` from the regex. |
| `.agro/evals/probes/audit-stale-references.sh` | caller list at lines 28-35 | US-002: remove `.agro/skills/weigh` and the knowledge-page path if that page changes. |
| `.agro/evals/probes/prompt-miner-symlink-entrypoint.sh` | comment at line 14 | US-002: remove the `rlm/` and `weigh/` mention. |
| `.agro/knowledge/source/recursive-language-models.md` | `## Relevant Source Files`, harness paragraphs | US-002: remove the harness-integration claims. Keep the external-paper summary. |
| `.agro/knowledge/README.md` | index row, line 60 | US-002: regenerate with `/wiki lint` if frontmatter changes. |
| `.agro/evals/probes/retro-deterministic-contract.sh` | whole file | US-003: rewrite. |
| `.agro/skills/retro/SKILL.md` | frontmatter, whole body | US-004: rewrite. |
| `.agro/skills/retro/references/report-schema.md` | whole file | US-004: delete. |
| `.agro/skills/retro/scripts/validate-retro-report.sh` | whole file | US-004: delete. |
| `.agro/scripts/link-providers.sh` | `required_execs`, line 22 | US-004: remove the validator path. |
| `.agro/scripts/__tests__/hermes-links.test.ts` | fixture `files`, line 114 | US-004: remove the validator path. |
| `.agro/skills/wiki/references/compile.md` | step 1 (line 64), step 3 (line 97) | US-004: read the verdict from the per-lesson tag. Remove the five-lens reference. |
| `.agro/skills/spec/references/retro.md` | ownership table, line 35 | US-004: reword the `/retro` row. |
| `.agro/skills/spec/references/execute.md` | step 8, line 558 | US-004: remove "falsifiable". |
| `.agro/evals/capability/RESULTS.md` | CB-005 row | US-005: re-score. |
| `CHANGELOG.md` | `## [Unreleased]` | US-005: add a `### Removed` entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slash commands `/sync`, `/post-bridge`, `/blog`, `/fanout`, `/render-html`, `/rlm`, `/weigh`, `/interview`, `/imagine`, `/strategic-proposal` | Removed | The ten skills stop loading in every harness. |
| `/retro` arguments | Changed | The skill drops `--focus <subsystem>`. `--task`, `--dry-run`, and `auto-approve` stay. |
| `/retro` report | Changed | The report drops the hypothesis table and the `STATUS: RETRO-DONE` line. Each lesson keeps a verdict and confidence tag. Each promotion line keeps the `compile.md` template. |
| `/wiki compile` input | Changed | Step 1 reads the verdict from the per-lesson tag. The step 2 gate stays unchanged. |
| `link-providers.sh` required executables | Changed | The list loses `validate-retro-report.sh`. |

## Storage

N/A. The task deletes tracked files and edits tracked Markdown and shell. It adds no persistence layer. `.agro/skills/eval/run.sh` regenerates `.agro/evals/RESULTS.md` from the probe directory.

## Architectural Decisions

- **Source of truth for the promotion line.** `compile.md:65-67` owns the template. `/retro` copies the template byte for byte. The retro probe compares the two copies, so drift fails a probe.
- **Verdict source.** `/retro` emits one tag per lesson, in the form `[<verdict> · <confidence>]`. `/wiki compile` step 1 reads the verdict from that tag. The step 2 gate table stays as the only gate.
- **Subsystem slot.** The promotion-line `<subsystem>` slot stays. With the five-lens taxonomy gone, the slot carries the knowledge-base vocabulary that `compile.md` step 3 already names: `evals`, `wiki`, `docs`, and `spec`.
- **Validator.** Delete `validate-retro-report.sh`. The validator enforces the schema that this task removes. The probe carries the three preserved invariants.
- **Knowledge page.** Keep `.agro/knowledge/source/recursive-language-models.md` as an external-paper summary. Remove the claims about `/rlm` and `/weigh`.
- **Excluded historical surfaces.** Do not edit `CHANGELOG.md` history, `docs/rfcs/preserved-changelog-rationale.md`, `.agro/evals/RESULTS.md` by hand, `.agro/evals/decisions/`, `.agro/tasks/archive/`, `.agro/knowledge/raw/`, `.agro/plans/archive/`, or `.agro/knowledge/patterns/pattern-evals-probe-failure-path-untested.md`. That pattern page quotes `/imagine` as the literal text of a past defect.
- **Execution location.** The application agent runs every edit and every check inside the sandbox, in a task worktree. The orchestrator owns the branch and the PR.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/retro-deterministic-contract.sh` | Run against the unmodified SKILL.md before US-004. Expect exit 1. | US-003: the probe pins the new contract. |
| `.agro/evals/probes/retro-deterministic-contract.sh` | Run after US-004. Expect exit 0. | US-004: the rewritten skill meets the contract. |
| `.agro/evals/probes/retro-deterministic-contract.sh` | Fault 1: set `RETRO_SKILL` to a copy with one changed character in the promotion line. Expect exit 1. | Invariant 3: template drift fails. |
| `.agro/evals/probes/retro-deterministic-contract.sh` | Fault 2: set `RETRO_SKILL` to a copy without the writes-no-file sentence. Expect exit 1. | Invariant 1: a ledger cannot return silently. |
| `.agro/evals/probes/retro-deterministic-contract.sh` | Fault 3: set `RETRO_SKILL` to a copy without the cite-and-skip instruction. Expect exit 1. | Invariant 2: double-write protection holds. |
| `.agro/evals/probes/retro-deterministic-contract.sh` | Fault 4: set `COMPILE_REF` to a copy with a changed template. Expect exit 1. | Invariant 3: drift on the compile side fails. |
| `.agro/evals/probes/wiki-compile-contract.sh` | Existing cases. Expect exit 0. | DoD 5. |
| `.agro/evals/probes/roles-are-skills.sh` | Existing cases. Expect exit 0. | DoD 4. |
| `.agro/evals/probes/spec-family-contract.sh` | Existing cases. Expect exit 0. | `spec/references/retro.md` holds no second retro ontology. |
| `.agro/evals/probes/protected-paths-resolve.sh`, `protected-path-deletion.sh` | Existing cases. Expect exit 0. | The PR body names the protected-path removal. |
| `.agro/scripts/__tests__/hermes-links.test.ts` | Run `pnpm vitest run .agro/scripts/__tests__/hermes-links.test.ts`. Expect exit 0. | The fixture no longer requires the validator. |
| Dangling-reference check | Run the command below from the worktree root. Expect no output. | DoD 3. |

Dangling-reference check:

```bash
names='sync|post-bridge|blog|fanout|render-html|rlm|weigh|interview|imagine|strategic-proposal'
git grep -nE "(skills/|\.\./)($names)(/|\b)|(^|[[:space:]\`(|])/($names)\b|^($names)$" -- . \
  ':!CHANGELOG.md' ':!docs/rfcs/preserved-changelog-rationale.md' ':!.agro/evals/RESULTS.md' \
  ':!.agro/evals/decisions' ':!.agro/tasks/archive' ':!.agro/knowledge/raw' ':!.agro/plans/archive' \
  ':!.agro/knowledge/patterns/pattern-evals-probe-failure-path-untested.md'
```

## Design Principles

- Delete obsolete paths. Leave no dormant alternative and no compatibility stub.
- Keep one source of truth for each contract. The promotion-line template lives in `compile.md`.
- Retire only machinery that was never measured. Keep `/benchmark`, `/council`, `/prd`, `/plan`, and `/prompt-miner`.
- Make a probe fail before the edit that the probe permits. Exercise each new failure branch by fault injection.
- Add no explanatory comments to tracked code.

## Out of Scope

- Retirement of `/benchmark`, `/prompt-miner`, `/council`, `/prd`, or `/plan`.
- Changes to the `/wiki compile` write gate in `compile.md` step 2.
- Changes to the `.agro/tasks/` layout or to the advisor and worker model of ADR #989.
- The companion ADR `retire unproven skill machinery, not proven nodes`.
- Edits to historical surfaces listed in Architectural Decisions.
- The rename of the `Hypotheses-Compiled` label in the `compile.md` step 6 report.

## Open Questions

1. The issue cites `bash .agro/evals/run.sh`. This plan uses `bash .agro/skills/eval/run.sh`. Confirm the substitution.
2. The issue names a per-lesson `[verdict · confidence]` tag. The current promotion line carries `[<subsystem> · <confidence> · <tier>]` and no verdict. This plan keeps the promotion line byte-identical and adds a separate verdict tag per lesson. Confirm this reading.
3. `.claude/protected-paths.txt` asks for removal "in a separate PR with a CHANGELOG entry". This plan removes `strategic-proposal` in the same PR and names it in the PR body. Confirm, or split the removal into its own PR.
4. The CB-005 scoring method requires a real run of the chain `/retro` → `/wiki compile` → `/builder` → `/benchmark`. That run writes a record to `.agro/evals/decisions/skill-impact.md`. Confirm that the operator authorizes this run inside this task.
5. The value of `<axis flags>` for the CB-005 re-score comes from that run. The plan does not predict it.
6. The plan runs `hermes-links.test.ts` with `pnpm vitest run .agro/scripts/__tests__/hermes-links.test.ts`. The root `package.json` maps `test` to `vitest run`. Confirm that the sandbox has `pnpm` installed.
7. This plan did not read `mifunedev/agro-web`. Confirm whether that repository names the ten skills or the `/retro` report shape.

## Acceptance Criteria

- [ ] `bash .agro/skills/eval/run.sh` exits 0, and the probe count drops from 163 to 159.
- [ ] None of the ten skill directories exists under `.agro/skills/`.
- [ ] The dangling-reference check prints no line.
- [ ] `bash .agro/evals/probes/roles-are-skills.sh` exits 0.
- [ ] `bash .agro/evals/probes/wiki-compile-contract.sh` exits 0, and the retro promotion-line template matches the `compile.md` template byte for byte.
- [ ] Each of the four fault injections makes `retro-deterministic-contract.sh` exit 1.
- [ ] The CB-005 row in `.agro/evals/capability/RESULTS.md` holds a score of 1.33 or higher.
- [ ] `bash .agro/scripts/link-providers.sh` exits 0, and no symlink under `.claude` or `.agents` is broken.
- [ ] `jq -e . .agro/skills.lock` exits 0, and the lock holds no key for a retired skill.

## Lessons

Filled by the advisor before undraft.
