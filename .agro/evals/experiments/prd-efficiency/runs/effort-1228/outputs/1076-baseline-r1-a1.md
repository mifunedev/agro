# PRD: Council skill for bounded deliberation

Status: DRAFT

Source: GitHub issue #1076 (`work/issue-1076.md`).

## User Stories

### US-001: Record the council decision for this design

**Description:** As the operator, I want a recorded council decision on the `/council` design so that the skill ships from an accepted design with named dissent.

**Acceptance Criteria:**

- [ ] `.agro/tasks/council-skill/council.md` exists before any file under `.agro/skills/council/` exists on the task branch.
- [ ] `council.md` holds the sections `## Question`, `## Options`, `## Perspectives`, `## Accepted Design`, `## Dissent`, and `## Evidence Limits`.
- [ ] `## Perspectives` lists at least 3 independent perspectives, and each perspective cites at least one repository path.
- [ ] `## Evidence Limits` states whether trace mining ran, and names the harness filter and the time window when trace mining ran.
- [ ] `grep -nE 'promptText|"role": *"user"' .agro/tasks/council-skill/council.md` prints no line.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/council-skill/council.md` exits 0.

### US-002: Author the canonical council skill

**Description:** As an advisor, I want a `/council` skill that runs bounded, evidence-based deliberation so that I can compare designs before implementation.

**Acceptance Criteria:**

- [ ] The implementation owner creates `.agro/skills/council/SKILL.md` through `/builder skill council`.
- [ ] The frontmatter has `name: council`, a `description` with `TRIGGER when:` and `Do NOT trigger`, and an `allowed-tools` line.
- [ ] The `allowed-tools` line names neither `Write` nor `Edit`.
- [ ] The `Do NOT trigger` text names `/delegate`, `/architect`, `/audit`, `/strategic-proposal`, `/spec`, and `/supervisor`.
- [ ] The body states a perspective cap, a single critic pass, and a single synthesis pass.
- [ ] The body defines one output contract with the sections `Accepted Design`, `Dissent`, and `Evidence Limits`.
- [ ] The body defines the result tags `RESULT: DECIDED`, `RESULT: SPLIT`, `RESULT: BLOCKED`, and `RESULT: USAGE`.
- [ ] The body calls `.agro/skills/prompt-miner/scripts/mine-traces.mjs` for trace evidence and does not copy the trace-mining logic.
- [ ] The body forbids `--include-prompt-text` and forbids a commit of a trace-derived file.
- [ ] `wc -l < .agro/skills/council/SKILL.md` prints a number below 500.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0.

### US-003: Add the council contract probe

**Description:** As a maintainer, I want a deterministic probe for the `/council` contract so that a later edit cannot remove a boundary without a regression.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/council-skill-contract.sh` exists, is executable, and declares the `# tier: A`, `# source:`, and `# desc:` lines.
- [ ] The probe checks each criterion of US-002 that a text match can prove.
- [ ] The probe checks that `.claude/skills/council/SKILL.md` and `.agents/skills/council/SKILL.md` resolve.
- [ ] The probe checks that no `council.md` file exists under `.agro/agents`, `.claude/agents`, `.codex/agents`, or `.pi/agents`.
- [ ] On the US-002 skill, `bash .agro/evals/probes/council-skill-contract.sh` exits 0.
- [ ] On a copy of the skill without the `Do NOT trigger` line, the probe exits 1. The implementation owner records the command and the exit code in the PR body.
- [ ] On a copy of the skill with `Write` in `allowed-tools`, the probe exits 1. The implementation owner records the command and the exit code in the PR body.

### US-004: Validate the change and open a ready PR

**Description:** As the operator, I want a ready-for-review PR with green CI so that I can review the skill without a merge.

**Acceptance Criteria:**

- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no `REGRESSION` row, and `.agro/evals/RESULTS.md` holds a `council-skill-contract` row with `PASS`.
- [ ] `bash .agro/evals/probes/roles-are-skills.sh` exits 0.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `.agro/evals/decisions/skill-impact.md` ends with one new `PROPOSED` record for `.agro/skills/council/SKILL.md`, and no earlier record changes.
- [ ] `git diff --check` exits 0.
- [ ] The PR is ready for review, the PR body closes #1076, and `/ci-status` reports all checks green.
- [ ] The PR stays unmerged.

## Summary

Verified current state:

- No `council` skill exists in `.agro/skills/`. `.claude/skills` is a symlink to `../.agro/skills`. `.agro/scripts/link-providers.sh` declares `.agents/skills` and `.claude/skills` as provider links to `.agro/skills`.
- `/strategic-proposal` runs a council, but only for a roadmap or a V2MOM. The skill publishes a pinned GitHub issue.
- `/weigh` scores N sampled trajectories with the frozen scorer `scripts/score-trajectories.mjs`. `/weigh` selects an output. `/weigh` does not deliberate on a design.
- `/architect` returns one Architecture Brief from one inline session. `/architect` has no independent perspectives.
- `/prompt-miner` owns `scripts/mine-traces.mjs`. The engine reads Claude traces under `~/.claude/projects/` and Pi traces under the Pi `sessions` directory. By default the engine emits feature vectors and metadata, not prompt text. The engine writes only to `$TMPDIR`.
- `.agro/evals/probes/roles-are-skills.sh` already rejects `council.md` as a project-agent file under each provider `agents` directory.
- `.agro/evals/probes/delegate-worker-boundary.sh` rejects a `council` subagent type inside `/delegate`.

Selected approach:

1. The advisor runs a council on the `/council` design before the skill exists, and records the decision in the task folder.
2. The implementation owner authors one inline skill at `.agro/skills/council/SKILL.md` through `/builder`.
3. The skill frames one question, gathers repository evidence, and runs trace mining only through `mine-traces.mjs`.
4. The skill spawns a capped set of independent perspectives in parallel, runs one critic pass, and writes one synthesis.
5. The skill emits the council record to the terminal. The caller persists the record where the caller owns the path.
6. One Tier-A probe guards the contract.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/council/SKILL.md` | frontmatter `name`, `description`, `allowed-tools`; output contract; result tags | New canonical skill. |
| `.agro/skills/builder/SKILL.md` | Shared protocol steps 1 to 4 | Authoring procedure, link check, and ledger append. |
| `.agro/skills/builder/references/skill.md` | `## Validate` checklist | Size, frontmatter, and trigger checks. |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | CLI flags `--harness`, `--hours`, `--since`, `--until`, `--last-n`, `--report-only` | Trace evidence source. The council calls the engine and does not copy the engine. |
| `.agro/skills/prompt-miner/SKILL.md` | `## Privacy contract` | Privacy rules that the council inherits. |
| `.agro/skills/strategic-proposal/SKILL.md` | expert council, Strategic Critic | Sibling boundary: roadmap only. |
| `.agro/skills/architect/SKILL.md` | Architecture Brief | Sibling boundary: one brief, one session. |
| `.agro/skills/weigh/SKILL.md` | `score-trajectories.mjs` | Sibling boundary: selection among outputs. |
| `.agro/skills/delegate/SKILL.md` | worker waves | Sibling boundary: implementation dispatch. |
| `.agro/scripts/link-providers.sh` | `provider_links`, `--check` | Provider exposure check. |
| `.agro/evals/probes/roles-are-skills.sh` | role loop with `council` | Existing guard against a council agent file. |
| `.agro/evals/probes/architect-skill-contract.sh` | frontmatter and marker checks | Pattern for the new probe. |
| `.agro/evals/decisions/skill-impact.md` | `SI-nnnn` records | Append-only ledger for the skill edit. |
| `.agro/skills/eval/run.sh` | `--probe <id>` | Probe runner. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/council <question \| plan-path \| issue-number>` | New command skill | Runs one bounded deliberation and prints one council record with a result tag. |
| `.claude/skills/council/`, `.agents/skills/council/` | Provider exposure | Resolve through the existing directory symlinks. No new link. |
| `.agro/evals/RESULTS.md` | New row | `council-skill-contract` row after `/eval` runs. |
| `mifunedev/agro-web` | Public documentation | Open Question 3 decides the change. |

## Storage

The skill stores no state. The skill prints the council record to the terminal. Trace-mining output stays in `$TMPDIR`, as the `/prompt-miner` privacy contract requires. The task-level record at `.agro/tasks/council-skill/council.md` follows the existing task-folder pattern. The ledger append follows the `/builder` step 4 pattern.

## Architectural Decisions

- **Source of truth:** `.agro/skills/council/SKILL.md` is the only owner of council behavior. Provider directories expose the file through symlinks.
- **Execution model:** The skill runs inline in the active session. The active session stays the advisor and owns acceptance. Perspective workers are an execution choice inside one run. The change adds no agent definition file.
- **Least privilege:** `allowed-tools` excludes `Write` and `Edit`. The caller persists the record.
- **Evidence reuse:** Trace evidence comes only from `mine-traces.mjs`. The council adds no second trace reader.
- **Privacy:** The council uses feature vectors and metadata only. The council never passes `--include-prompt-text`. The council never commits a trace-derived artifact.
- **Bounds:** A fixed perspective cap, one critic pass, and one synthesis pass bound cost. Open Question 1 sets the cap values.
- **Invocation:** The skill sets `disable-model-invocation: true`, as `/weigh` and `/prompt-miner` do, because the skill spawns workers. Open Question 2 confirms this choice.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/council-skill-contract.sh` | Probe exits 1 before `.agro/skills/council/SKILL.md` exists. | Red state for US-002. |
| `.agro/evals/probes/council-skill-contract.sh` | Frontmatter name, `TRIGGER when:`, `Do NOT trigger` with six sibling names, `allowed-tools` without `Write` or `Edit`. | Trigger cases and least privilege. |
| `.agro/evals/probes/council-skill-contract.sh` | Output sections, four result tags, perspective cap text, single critic text. | Output contract and bounds. |
| `.agro/evals/probes/council-skill-contract.sh` | `mine-traces.mjs` reference present; `--include-prompt-text` appears only in a prohibition. | Evidence reuse and privacy. |
| `.agro/evals/probes/council-skill-contract.sh` | Mutated copy without `Do NOT trigger`; mutated copy with `Write`. | Failure cases exit 1. |
| `.agro/evals/probes/roles-are-skills.sh` | Existing run. | No council agent file. |
| `.agro/evals/probes/delegate-worker-boundary.sh` | Existing run. | `/delegate` keeps no council role. |
| `.agro/scripts/link-providers.sh --check` | Existing run. | Provider links resolve. |
| `.agro/skills/ste/scripts/ste-check.sh` | Run on `SKILL.md` and `council.md`. | STE compliance. |

## Design Principles

- Keep one owner for each behavior. The council deliberates. `/architect` decides structure. `/delegate` implements. `/weigh` selects outputs.
- Keep perspectives independent. No perspective reads another perspective before the critic pass.
- State the evidence limits. A record without trace evidence states that trace mining did not run.
- Keep private session content out of git.
- Add no comments to tracked code.
- Apply `/ste` to the skill, the record, and this plan.

## Out of Scope

- A change to `/strategic-proposal`, `/weigh`, `/architect`, or `/delegate`.
- A change to `mine-traces.mjs`.
- A persistent council ledger or a new storage directory.
- A cron that runs the council.
- A merge of the PR.

## Open Questions

1. What are the perspective cap values?
   A. Default 3, maximum 5.
   B. Default 5, maximum 7.
   C. Other: <specify>
2. Does the skill set `disable-model-invocation: true`?
   A. Yes, like `/weigh` and `/prompt-miner`.
   B. No. The model can invoke the skill from the trigger text.
3. Does `mifunedev/agro-web` need a matching page for `/council`?
   A. Yes, as a follow-up issue.
   B. No.

The plan uses 1A and 2A until the operator answers.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `.agro/tasks/council-skill/council.md` records the accepted design, the dissent, and the evidence limits.
- [ ] `.agro/skills/council/SKILL.md` is the only new skill file, and no provider mirror holds a copied file.
- [ ] No tracked file holds raw prompt text from a Claude or Pi trace.
- [ ] The PR for #1076 is ready for review with green CI and stays unmerged.

## Lessons

Filled by the advisor before undraft.
