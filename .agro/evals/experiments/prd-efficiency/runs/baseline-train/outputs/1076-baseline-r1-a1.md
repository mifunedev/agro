# PRD: council skill

Status: BLOCKED

Source: `work/issue-1076.md` (issue #1076).

## User Stories

### US-001: Record the council design with a council run

**Description:** As the operator, I want a bounded council run to choose the `/council` design. The accepted design then carries its dissent and its evidence limits.

**Acceptance Criteria:**

- [ ] `.agro/tasks/council-skill/council.md` exists.
- [ ] `council.md` names the question, each option, and each perspective.
- [ ] Each perspective in `council.md` states one position and cites at least one repository path or one trace metric.
- [ ] `council.md` has the sections `## Decision`, `## Dissent`, and `## Evidence Limits`.
- [ ] `## Dissent` records each rejected position with its reason, or states "No dissent" with the vote.
- [ ] `grep -nE '"(promptText|text|content)"' .agro/tasks/council-skill/council.md` returns no match.
- [ ] `council.md` contains no raw prompt text, no transcript line, and no session identifier from `~/.claude` or `~/.pi` traces.

### US-002: Scaffold the canonical skill through `/builder`

**Description:** As a harness maintainer, I want `/council` at the canonical `.agro/skills/` path so that each provider surface resolves to one source.

**Acceptance Criteria:**

- [ ] The implementation owner creates `.agro/skills/council/SKILL.md` with `/builder command council`.
- [ ] The frontmatter carries `name: council`, `argument-hint`, `allowed-tools`, and a `description` with `TRIGGER when:` and `Do NOT trigger`.
- [ ] `name` matches the directory name.
- [ ] Each argument in `argument-hint` has a matching step in the body.
- [ ] `.claude/skills/council/SKILL.md` and `.agents/skills/council/SKILL.md` resolve to the canonical file.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `.agro/skills/council/SKILL.md` has fewer than 500 lines.

### US-003: Define the deliberation procedure

**Description:** As an advisor, I want an ordered council procedure so that independent perspectives compare designs before implementation starts.

**Acceptance Criteria:**

- [ ] The body gives numbered steps: frame the question, ground the evidence, run independent perspectives, run one critic, and write the decision.
- [ ] The body requires each perspective to form a position before the perspective reads another position.
- [ ] The body caps the number of perspectives at `<max perspectives>`.
- [ ] The body caps the number of rounds at `<max rounds>`.
- [ ] The body gives a Council Record template with the sections `Question`, `Options`, `Perspectives`, `Evidence`, `Decision`, `Dissent`, and `Evidence Limits`.
- [ ] The body ends each run with exactly one result tag from `RESULT: DECIDED | NO-DECISION | REFUSED`.
- [ ] The body states that the council decides and writes no implementation.

### US-004: Mine local traces without publishing private content

**Description:** As the operator, I want the council to cite local Claude and Pi traces so that positions rest on past sessions.

The council keeps private session content off every tracked surface.

**Acceptance Criteria:**

- [ ] The body calls `node .agro/skills/prompt-miner/scripts/mine-traces.mjs --harness all` and restates no engine logic.
- [ ] The body forbids `--include-prompt-text` in a council run.
- [ ] The body writes each trace artifact under `$TMPDIR` and forbids staging a trace artifact.
- [ ] The body limits trace evidence in the Council Record to aggregate metrics and feature vectors.
- [ ] If the miner finds no trace, the body tells the council to record "no trace evidence" under `Evidence Limits` and continue.

### US-005: Separate deliberation from neighboring skills

**Description:** As an advisor, I want a boundary table so that I choose `/council` only for deliberation.

**Acceptance Criteria:**

- [ ] The body has a table that names `/delegate`, `/architect`, `/audit`, `/strategic-proposal`, `/spec`, `/supervisor`, and `/weigh`.
- [ ] Each table row states what the neighbor owns and when the advisor uses `/council` instead.
- [ ] The `description` routes implementation dispatch to `/delegate` and roadmap work to `/strategic-proposal`.
- [ ] The body defines no project-agent file, and `bash .agro/evals/probes/roles-are-skills.sh` exits 0.

### US-006: Define the failure cases

**Description:** As an advisor, I want explicit failure handling so that a weak council never reports a false decision.

**Acceptance Criteria:**

- [ ] If the request is not a decision between options, the body prints a usage message, emits `RESULT: REFUSED`, and writes nothing.
- [ ] If fewer than `<quorum>` perspectives return a position, the body emits `RESULT: NO-DECISION`.
- [ ] If no option has cited evidence, the body emits `RESULT: NO-DECISION` and names the missing evidence.
- [ ] If every perspective agrees in the first round, the body requires the critic to state the strongest counterposition before the decision.

### US-007: Add the regression probe

**Description:** As a harness maintainer, I want a deterministic probe so that a later edit cannot remove the council contract without a red check.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/council-skill-contract.sh` exists with the `tier`, `source`, and `desc` header lines.
- [ ] The probe resolves the repository root from `${BASH_SOURCE[0]}`.
- [ ] The probe checks the frontmatter, the trigger text, the boundary table, the Council Record sections, the result tags, and the privacy rules.
- [ ] The probe exits 0 on the new skill.
- [ ] The probe exits 1 when the implementation owner deletes the `Dissent` section from a scratch copy of the skill.
- [ ] The probe exits 1 when the implementation owner deletes the `--include-prompt-text` prohibition from a scratch copy of the skill.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

### US-008: Record the change

**Description:** As a reviewer, I want the change recorded in the standard ledgers so that the release notes and the skill-impact history show `/council`.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` has one `/council` entry under `## [Unreleased]`.
- [ ] `.agro/evals/decisions/skill-impact.md` has a new `PROPOSED` record with the next `SI-nnnn` id and the target `.agro/skills/council/SKILL.md`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0.
- [ ] `git diff --check` exits 0.

## Summary

The harness has no reusable skill for bounded deliberation. Council behavior exists only inside `/strategic-proposal` (`.agro/skills/strategic-proposal/SKILL.md`). That skill ties the council to roadmap output and to a pinned GitHub issue. `/weigh` scores sampled trajectories with a fixed scorer. `/weigh` does not deliberate. `/architect` returns one Architecture Brief from the active session. `/architect` runs no independent perspectives.

The trace engine exists at `.agro/skills/prompt-miner/scripts/mine-traces.mjs`. The engine reads Claude and Pi JSONL traces. By default, the engine omits prompt text and writes under `$TMPDIR/oh-prompt-miner/<UTC-date>/`. `/council` composes this engine and adds no trace parser.

The selected approach:

1. The implementation owner runs one council on the `/council` design itself (US-001).
2. The implementation owner writes the accepted design as a task-style skill through `/builder command` (US-002 to US-006).
3. A probe guards the contract (US-007).
4. The ledgers record the change (US-008).

The branch follows `/git` conventions. The assumed branch name is `skill/1076-council-skill`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/council/SKILL.md` | frontmatter, procedure, Council Record template | New canonical skill |
| `.agro/skills/builder/references/command.md` | task-style authoring protocol | Authoring procedure for US-002 |
| `.agro/skills/ste/scripts/ste-check.sh` | checker | Prose gate |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `--harness`, `--hours`, `--since`, `--out`, `--include-prompt-text` | Trace evidence engine |
| `.agro/skills/strategic-proposal/SKILL.md` | council and critic flow | Prior council pattern and boundary neighbor |
| `.agro/skills/delegate/SKILL.md`, `.agro/skills/architect/SKILL.md`, `.agro/skills/audit/SKILL.md`, `.agro/skills/spec/SKILL.md`, `.agro/skills/supervisor/SKILL.md`, `.agro/skills/weigh/SKILL.md` | descriptions | Boundary neighbors for US-005 |
| `.agro/scripts/link-providers.sh` | `--check` | Provider link verification |
| `.agro/evals/probes/council-skill-contract.sh` | probe | New regression probe |
| `.agro/evals/probes/roles-are-skills.sh` | `council` role guard | Existing guard against a `council` project agent |
| `.agro/evals/decisions/skill-impact.md` | `SI-nnnn` records | Skill-impact ledger |
| `CHANGELOG.md` | `## [Unreleased]` | Release notes |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/council` slash invocation | New | Claude Code, Codex, and Pi load the skill through `.claude/skills` and `.agents/skills` |
| `argument-hint` | New | `<question>` plus `<optional flags>`; the council run in US-001 fixes the flags |
| Council Record | New | Markdown output with seven fixed sections |
| Result tag | New | `RESULT: DECIDED | NO-DECISION | REFUSED` |

## Storage

The skill writes no tracked state by default. The skill prints the Council Record. When the council serves a task, the advisor writes the record to `.agro/tasks/<slug>/council.md` and adds the file with `git add -f`, per `.agro/tasks/README.md`. Trace artifacts stay under `$TMPDIR` and never enter git.

## Architectural Decisions

- The canonical source is `.agro/skills/council/SKILL.md`. Provider directories are symlinks.
- The council is a skill, not a project agent. `roles-are-skills.sh` already forbids `council.md` under each agent directory.
- The active session owns the decision. Perspectives are bounded workers that return positions only. Perspectives edit no file.
- `mine-traces.mjs` owns trace parsing and redaction. `/council` consumes the engine output only.
- `/council` stops at a decision. `/spec` and `/delegate` own the build that follows.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/council-skill-contract.sh` | skill present; frontmatter fields; `TRIGGER when:`; boundary table names; Council Record sections; result tags; privacy rules | US-002 to US-007 |
| `.agro/evals/probes/council-skill-contract.sh` | fault injection: remove `Dissent`; remove the `--include-prompt-text` prohibition | Probe turns red on regression |
| `.agro/evals/probes/roles-are-skills.sh` | existing | No `council` project agent |
| `bash .agro/scripts/link-providers.sh --check` | provider links | US-002 |
| `bash .agro/skills/ste/scripts/ste-check.sh` | `SKILL.md`, `council.md` | `/ste` gate |
| Manual trigger check in `evidence.md` | 3 prompts select `/council`; 3 prompts select `/delegate`, `/architect`, or `/strategic-proposal` | Trigger cases |

The implementation owner writes the probe first. The probe must exit 1 before the skill exists. Then author the skill.

## Design Principles

- Keep work in the sandbox. Keep comments out of tracked code.
- Compose `/prompt-miner`, `/builder`, `/ste`, and `/delegate`. Restate none of them.
- Keep one source of truth for each rule.
- Prefer the smallest procedure that yields a decision with dissent and evidence limits.
- Treat trace privacy as a hard constraint.

## Out of Scope

- Changes to `/strategic-proposal`, `/weigh`, or `/prompt-miner` behavior.
- A new trace parser or a new redaction pass.
- A scheduled or cron council.
- Implementation of any design that a council selects.
- Merge of the pull request.

## Open Questions

1. How many perspectives and rounds does a council allow? The plan uses `<max perspectives>`, `<max rounds>`, and `<quorum>`.
   A. 3 perspectives, 1 round plus 1 critic, quorum 2
   B. 5 perspectives, 2 rounds, quorum 3
   C. Other: <specify>
2. Does `/council` allow model invocation?
   A. Allow model invocation, as `/architect` does
   B. Set `disable-model-invocation: true`, as `/weigh` and `/prompt-miner` do, because a run spawns workers
3. Where does the accepted design for this task live?
   A. `.agro/tasks/council-skill/council.md` only
   B. Also an ADR under `docs/rfcs/`
4. Which trace window does the US-001 council mine? The plan uses `<trace window>`.
5. Does `/council` join `.claude/protected-paths.txt` as a load-bearing skill?
6. Does `mifunedev/agro-web` need a matching documentation change?
7. Is the branch `skill/1076-council-skill`? The input file name implies issue #1076. No source confirms it.

## Acceptance Criteria

- [ ] Each story in this plan passes.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `.agro/tasks/council-skill/evidence.md` maps each criterion to a command and its exit status.
- [ ] A ready-for-review pull request exists for the task branch, and each CI check in `.github/workflows/ci-harness.yml` is green.
- [ ] The pull request is not merged.

## Lessons

Filled by the advisor before undraft.
