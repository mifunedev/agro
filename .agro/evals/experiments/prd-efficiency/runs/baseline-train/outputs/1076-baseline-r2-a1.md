# PRD: council skill

Status: DRAFT

Issue: #1076
Branch: `skill/1076-council-skill`
Source: `work/issue-1076.md`

## User Stories

### US-001: Mine local traces for deliberation evidence

**Description:** As the advisor, I want findings from local Claude and Pi traces so that observed sessions ground the council design without private content.

**Acceptance Criteria:**

- [ ] The advisor reads the Claude traces under `~/.claude/projects/*/*.jsonl` inside the sandbox.
- [ ] The advisor reads the Pi traces under `~/.pi/agent/sessions/*/*.jsonl` inside the sandbox.
- [ ] `evidence.md` records under D-US-001 the trace count per provider and the date range.
- [ ] `evidence.md` records each finding as a paraphrase with a count, and quotes no session text.
- [ ] `evidence.md` names each evidence limit, for example a provider with zero traces or a truncated session.
- [ ] `git diff development -- . | grep -E '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl'` returns no line.
- [ ] No tracked file, PR body, or issue comment contains a trace file path under `~/.claude/projects/` or `~/.pi/agent/sessions/`.

### US-002: Run a council on the skill design

**Description:** As the operator, I want a council to compare candidate designs for `/council` so that the accepted design carries its dissent and its evidence limits.

**Acceptance Criteria:**

- [ ] The advisor runs the council before any edit under `.agro/skills/council/`.
- [ ] The council compares at least two candidate designs against the same evidence packet.
- [ ] Each perspective produces its position without reading another perspective's output.
- [ ] `evidence.md` records under D-US-002 the question, the options, the accepted design, and the reason.
- [ ] `evidence.md` records each dissent with the perspective that raised the dissent.
- [ ] `evidence.md` records the evidence limits of the decision.
- [ ] `evidence.md` records the perspective count and the round count that the run used.

### US-003: Scaffold the canonical skill through `/builder`

**Description:** As a harness maintainer, I want `/council` at the canonical path so that Claude Code, Codex, and Pi resolve one source.

**Acceptance Criteria:**

- [ ] The advisor authors the skill with `/builder skill council`.
- [ ] `.agro/skills/council/SKILL.md` exists.
- [ ] The frontmatter carries `name: council`, a `description` with `TRIGGER when:`, and `allowed-tools`.
- [ ] `allowed-tools` names neither `Write` nor `Edit`.
- [ ] The frontmatter carries no `context: fork`.
- [ ] `.claude/skills/council/SKILL.md` and `.agents/skills/council/SKILL.md` resolve to the canonical file.
- [ ] No file exists at `.agro/agents/council.md`, `.claude/agents/council.md`, `.codex/agents/council.md`, or `.pi/agents/council.md`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `SKILL.md` stays below 500 lines.

### US-004: Define the bounded deliberation procedure

**Description:** As an advisor, I want one bounded procedure so that a council ends with one decision and a known cost.

**Acceptance Criteria:**

- [ ] The body states that `/council` runs inline in the active session and that the active session owns the decision.
- [ ] The body states the perspective cap and the round cap, each with a reason.
- [ ] The body requires one shared evidence packet that every perspective receives.
- [ ] The body requires each perspective to answer before it reads another perspective's answer.
- [ ] The body requires each claim to cite a file path, a command output, or a trace finding.
- [ ] The body requires one adversarial critic pass before the decision.
- [ ] The body states that perspectives read and do not edit files.
- [ ] If the coding harness cannot start an isolated worker, the body requires sequential perspective passes and a recorded independence limit.
- [ ] The body defines a stop condition that ends the council without a decision and names the escalation route.

### US-005: Define the Council Record output

**Description:** As the operator, I want one output shape so that I can review the decision, the dissent, and the evidence limits in one place.

**Acceptance Criteria:**

- [ ] The body carries a `## Council Record` template.
- [ ] The template carries the sections Question, Options, Perspectives, Accepted Design, Dissent, Evidence, and Evidence Limits.
- [ ] The body states that the Dissent section lists "None" only when no perspective dissented.
- [ ] The body names the location of the record for a task: `.agro/tasks/<slug>/evidence.md`.
- [ ] The body forbids session text and trace file paths in the record.

### US-006: Separate `/council` from neighboring skills

**Description:** As a coding agent, I want explicit skill boundaries so that the `/council` skill does not replace delegation, architecture, audits, roadmaps, builds, or supervision.

**Acceptance Criteria:**

- [ ] The `description` carries a `Do NOT trigger` clause.
- [ ] The body carries a boundary table with one row each for `/delegate`, `/architect`, `/audit`, `/strategic-proposal`, `/spec`, and `/supervisor`.
- [ ] Each row names what the neighbor owns and what `/council` owns.
- [ ] The body carries at least three positive trigger cases and at least six negative trigger cases.
- [ ] Each negative case names the skill that owns the case.
- [ ] The body states that council perspectives are not `/delegate` worker types.
- [ ] `bash .agro/evals/probes/delegate-worker-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/roles-are-skills.sh` exits 0.

### US-007: Record the failure cases

**Description:** As a reader, I want the known council failure modes so that I do not repeat them.

**Acceptance Criteria:**

- [ ] The body carries a failure-mode section.
- [ ] Each entry states the symptom, the cause, and the correction.
- [ ] The section covers these cases: perspectives that converge on the first answer, an unbounded debate, a claim without evidence, a decision that drops dissent, and private trace content in a published artifact.
- [ ] Each entry rests on a D-US-001 finding or a D-US-002 observation, and invents no case.

### US-008: Add the contract probe

**Description:** As a maintainer, I want a deterministic probe so that a structural regression of `/council` turns the suite red.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/council-skill-contract.sh` exists and is executable.
- [ ] The probe fails when `.agro/skills/council/SKILL.md` is missing.
- [ ] The probe fails when `allowed-tools` names `Write` or `Edit`.
- [ ] The probe fails when the frontmatter carries `context: fork`.
- [ ] The probe fails when a council agent file exists under a provider `agents/` directory.
- [ ] The probe fails when the Council Record template omits the Dissent section or the Evidence Limits section.
- [ ] `evidence.md` records under D-US-008 one failing run per fault above, with the command and the exit code.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.

### US-009: Pass the prose gates

**Description:** As a maintainer, I want the skill to read one way so that each sentence resolves one way.

**Acceptance Criteria:**

- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0.
- [ ] If `.agro/skills/council/references/` exists, `ste-check.sh` exits 0 on each file under that directory.
- [ ] `git diff --check` reports no whitespace error.

### US-010: Land the PR

**Description:** As the operator, I want a ready-for-review PR with green CI so that I can review and merge the change myself.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` carries one entry for `/council` under `## [Unreleased]`, at most 250 characters, with a link to the PR.
- [ ] `.agro/evals/decisions/skill-impact.md` carries a `PROPOSED` record with id `SI-0015` or the next free id.
- [ ] `prd.md`, `prd.json`, `progress.txt`, and `evidence.md` are staged with `git add -f`.
- [ ] The PR title reads `FROM skill/1076-council-skill TO development`.
- [ ] The PR body carries `Closes #1076`.
- [ ] The PR is ready for review and is not a draft.
- [ ] `/ci-status` reports green.
- [ ] The PR stays unmerged.

## Summary

Issue #1076 asks for a reusable `/council` skill. The skill runs bounded, evidence-based deliberation. Independent perspectives compare designs before implementation. The task also mines local Claude and Pi traces, and publishes no private session content.

Verified current state:

- No `/council` skill exists. `.agro/skills/` has no `council/` directory.
- `/strategic-proposal` runs an "AI council" for roadmaps and a V2MOM variant. That council publishes a pinned roadmap issue. The council is not a general design tool.
- `/architect` returns one Architecture Brief for a structural decision. `/architect` runs inline and forks no context.
- `/delegate` starts bounded workers for implementation. `.agro/evals/probes/delegate-worker-boundary.sh` fails when `/delegate` names `council` as a worker type.
- `.agro/evals/probes/roles-are-skills.sh` fails when `council.md` exists under a provider `agents/` directory.
- `.claude/skills` and `.agents/skills` link to `.agro/skills`. `link-providers.sh --check` verifies the links.
- Claude traces exist at `~/.claude/projects/<dir>/<uuid>.jsonl`. Pi traces exist at `~/.pi/agent/sessions/<dir>/<timestamp>_<uuid>.jsonl`. `.pi/.gitignore` excludes `sessions/`.
- `docs/rfcs/rfc-trace-ledger.md` sets the rule that the ledger stores no secrets and no large raw transcripts by default.
- The last ledger id in `.agro/evals/decisions/skill-impact.md` is `SI-0014`.
- CI runs `bash .agro/skills/eval/run.sh` in `.github/workflows/ci-harness.yml`.

Selected approach:

1. The advisor mines the traces first and records paraphrased findings only.
2. The advisor runs a council on the `/council` design itself. This run proves the procedure before the skill exists.
3. The advisor authors the skill through `/builder` from the accepted design.
4. A contract probe guards the structural facts with a recorded fault for each check.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/council/SKILL.md` | frontmatter, procedure, Council Record template, boundary table | New canonical skill |
| `.agro/skills/builder/SKILL.md` | shared protocol, validate list | Authoring procedure for the skill |
| `.agro/skills/builder/references/skill.md` | Validate checklist | Skill shape rules |
| `.agro/skills/ste/scripts/ste-check.sh` | checker | Prose gate |
| `.agro/scripts/link-providers.sh` | `--check` | Provider link gate |
| `.agro/evals/probes/council-skill-contract.sh` | probe | New structural probe |
| `.agro/evals/probes/delegate-worker-boundary.sh` | role grep | Existing guard against `council` as a worker type |
| `.agro/evals/probes/roles-are-skills.sh` | agent-file check | Existing guard against a council agent file |
| `.agro/skills/strategic-proposal/SKILL.md` | "AI council" | Neighbor with the same word and a roadmap scope |
| `.agro/skills/architect/SKILL.md` | Architecture Brief | Neighbor for structural decisions |
| `.agro/skills/delegate/SKILL.md` | worker boundary | Neighbor for implementation workers |
| `.agro/skills/audit/SKILL.md`, `.agro/skills/spec/SKILL.md`, `.agro/skills/supervisor/SKILL.md` | descriptions | Neighbors for audits, builds, and supervision |
| `.agro/evals/decisions/skill-impact.md` | `SI-nnnn` ledger | Skill-impact record |
| `CHANGELOG.md` | `## [Unreleased]` | Changelog entry |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/council` slash command | New | Claude Code, Codex, and Pi list the skill through the provider links. |
| Skill listing description | New | The description carries the triggers and the `Do NOT trigger` clause. |
| Council Record | New output format | The operator reads the decision, the dissent, and the evidence limits. |
| `mifunedev/agro-web` | Unverified | The advisor checks whether the site lists skills. Open question 4 owns the decision. |

## Storage

The skill stores no state. The Council Record lives in `.agro/tasks/<slug>/evidence.md` for a task. For a free-standing question, the record is the chat reply. Trace findings live only in `evidence.md` as paraphrases. Raw traces stay in `~/.claude/projects/` and `~/.pi/agent/sessions/` on the sandbox home volume. The task copies no trace into the repository.

## Architectural Decisions

- **Source of truth:** `.agro/skills/council/SKILL.md` owns the behavior. Provider directories link to the file.
- **Role model:** `/council` is a skill, not an agent. The active session owns the question, the decision, and acceptance. Perspectives are bounded read-only passes.
- **Independence:** Each perspective receives the same evidence packet and answers alone. If the harness cannot isolate a perspective, the record states the independence limit.
- **Bounds:** The skill states a perspective cap and a round cap. US-002 sets both values from the observed run.
- **Privacy:** Trace evidence enters artifacts as counts and paraphrases. No artifact carries session text, a session id, or a trace path.
- **Scope split:** `/strategic-proposal` keeps roadmaps. `/architect` keeps the Architecture Brief. `/council` compares options for one question and hands the decision to the owning skill.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/council-skill-contract.sh` | missing `SKILL.md`; `Write` or `Edit` in `allowed-tools`; `context: fork`; council agent file; template without Dissent; template without Evidence Limits | US-003, US-005, US-008 |
| `.agro/evals/probes/delegate-worker-boundary.sh` | existing cases | US-006 |
| `.agro/evals/probes/roles-are-skills.sh` | existing cases | US-003, US-006 |
| `.agro/skills/ste/scripts/ste-check.sh` | `SKILL.md` and each reference file | US-009 |
| `.agro/scripts/link-providers.sh --check` | provider links | US-003 |
| `bash .agro/skills/eval/run.sh` | full suite | US-008 |
| `evidence.md` D-US-006 | each trigger case from the body, with the skill a fresh session selects | US-006 |

Write the probe first. Run the probe against the empty tree and record the failure. Then author the skill.

## Design Principles

- Apply the non-negotiables in `AGENTS.md`: sandbox work, one canonical source, no explanatory comments in tracked code.
- Compose the neighbor skills. Restate none of their procedures.
- Keep the skill small. Ship no script unless US-002 shows that a deterministic step repeats.
- Treat a council as a cost. Stop at the cap and decide.
- Publish evidence, not transcripts.
- Keep human judgment where the council cannot prove a decision.

## Out of Scope

- A trace-mining script or a trace ledger. `docs/rfcs/rfc-trace-ledger.md` owns that design.
- Edits to `/strategic-proposal`, `/architect`, `/delegate`, `/audit`, `/spec`, or `/supervisor`, unless open question 2 finds a trigger collision.
- A project-agent definition for the council or for any perspective.
- A trigger-selection eval harness.
- Merging the PR.

## Open Questions

1. What are the perspective cap and the round cap? US-002 observes one run. The advisor sets both caps from that run and records the reason in D-US-002.
2. Does a trigger collision with `/strategic-proposal` require a `Do NOT trigger` line in that skill? The default is no edit. The advisor edits `/strategic-proposal` only if a D-US-006 case selects the wrong skill.
3. Does the accepted `/council` design need an `ADR:` issue under `docs/rfcs/README.md`? The default is no. `/architect` step 4 requires a record only for an expensive, architecturally significant decision.
4. Does `mifunedev/agro-web` list skills? If the site lists skills, the task needs a matching docs change.
5. Does `/council` accept trace findings as an evidence source in general use, or only in this task? The default is: the skill allows trace findings under the privacy rule and ships no mining procedure.

## Acceptance Criteria

- [ ] `.agro/tasks/council-skill/evidence.md` holds a Council Record with the accepted design, each dissent, and the evidence limits.
- [ ] `.agro/skills/council/SKILL.md` exists, and the advisor authored the file through `/builder`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] The skill body separates `/council` from `/delegate`, `/architect`, `/audit`, `/strategic-proposal`, `/spec`, and `/supervisor`.
- [ ] No tracked file, PR body, or issue comment carries trace text, a session id, or a trace path.
- [ ] The PR `FROM skill/1076-council-skill TO development` is ready for review, `/ci-status` reports green, and the PR stays unmerged.

## Lessons

Filled by the advisor before undraft.
