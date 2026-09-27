# PRD: Council skill for bounded deliberation

Status: DRAFT

## User Stories

### US-001: Run a grounding council and record the design

**Description:** As an operator, I want one council run before the skill exists so that the skill design rests on recorded evidence and dissent.

**Acceptance Criteria:**

- [ ] `.agro/tasks/council-skill/council-record.md` exists and names at least three independent perspectives.
- [ ] The record states the accepted design, each dissent, and each evidence limit in separate sections.
- [ ] The record cites trace evidence only as aggregate counts or `/prompt-miner` report fields, and holds no raw prompt text.
- [ ] `git grep -n 'promptText' .agro/tasks/council-skill/` returns no match.

### US-002: Author the canonical `/council` skill

**Description:** As an agent, I want a canonical `.agro/skills/council/SKILL.md` so that every coding harness runs the same bounded deliberation procedure.

**Acceptance Criteria:**

- [ ] The implementation owner authors `.agro/skills/council/SKILL.md` through the `/builder` procedure.
- [ ] The frontmatter holds `name: council`, `description`, `allowed-tools`, and `disable-model-invocation: true`.
- [ ] The description holds a `TRIGGER when:` clause and a `Do NOT trigger` clause.
- [ ] The body sets a fixed perspective count cap, a round cap, and one output record shape with accepted design, dissent, and evidence limits.
- [ ] The body names `/delegate`, `/architect`, `/audit`, `/strategic-proposal`, `/spec`, `/supervisor`, and `/weigh`, and states the boundary to each skill.
- [ ] The body routes trace mining through `/prompt-miner` and forbids `--include-prompt-text` output in a tracked file or a GitHub body.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0, and `.claude/skills/council/SKILL.md` resolves.

### US-003: Add a council contract probe

**Description:** As a maintainer, I want a deterministic council contract probe so that a later edit cannot drop the boundaries or the privacy rule.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/council-skill-contract.sh` exists with `# tier: A`, `# source:`, and `# desc:` headers.
- [ ] The probe exits 1 when a trigger clause, a boundary skill name, the caps, or the privacy rule is absent from `.agro/skills/council/SKILL.md`.
- [ ] The probe exits 1 when `.agro/agents/council.md` or `.claude/agents/council.md` exists.
- [ ] A red run against a copy of the skill without the `Do NOT trigger` clause exits 1 before the skill lands.
- [ ] `bash .claude/skills/eval/run.sh --probe council-skill-contract` reports PASS.
- [ ] `bash .claude/skills/eval/run.sh` reports no new REGRESSION, including `roles-are-skills` and `delegate-worker-boundary`.

### US-004: Deliver a ready-for-review pull request

**Description:** As an operator, I want a ready-for-review pull request with green CI so that I review the change before any merge.

**Acceptance Criteria:**

- [ ] The pull request links issue #1076 and follows the `/git` title and body conventions.
- [ ] The pull request body passes `bash .agro/skills/ste/scripts/ste-check.sh` on a saved copy.
- [ ] `/ci-status` reports all checks green on the pull request head.
- [ ] The pull request is ready for review and stays unmerged.

## Summary

Issue #1076 (`work/issue-1076.md`) asks for a reusable `/council` skill. The skill runs bounded, evidence-based deliberation across independent perspectives before implementation.

Verified current state:

- No `.agro/skills/council/` directory exists. `.claude/skills` is a symlink to `../.agro/skills`.
- `/strategic-proposal` already runs a council, but only for roadmaps and V2MOM work.
- `/weigh` selects among sampled trajectories with a deterministic scorer. `/weigh` does not deliberate on a design.
- `/prompt-miner` mines Claude and Pi traces. The engine omits `promptText` unless `--include-prompt-text` is passed.
- `.agro/evals/probes/roles-are-skills.sh` fails when `council` exists as a project-agent file. The council must stay a skill.

Selected approach: run one council first, record the result, then encode that design as a manual-invoke skill with one contract probe.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/council/SKILL.md` | new skill | Canonical council procedure |
| `.agro/skills/builder/SKILL.md` | authoring and validation steps | Required authoring procedure |
| `.agro/skills/ste/scripts/ste-check.sh` | checker | Prose gate for the skill and the record |
| `.agro/skills/prompt-miner/SKILL.md` | `--include-prompt-text`, `mine-traces.mjs` | Trace evidence source and privacy rule |
| `.agro/skills/weigh/SKILL.md` | description | Boundary: selection, not deliberation |
| `.agro/skills/strategic-proposal/SKILL.md` | council variant | Boundary: roadmap council |
| `.agro/scripts/link-providers.sh` | `--check` | Provider link verification |
| `.agro/evals/probes/roles-are-skills.sh` | role loop, line 20 | Guard against a council project agent |
| `.agro/evals/probes/delegate-worker-boundary.sh` | `roles` check, line 141 | Guard against `council` as a `/delegate` worker type |
| `.claude/skills/eval/run.sh` | `--probe` | Probe runner |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `/council` slash command | New | Manual-invoke deliberation skill |
| `.claude/skills/council` | New symlink path | Exposed through the existing `.claude/skills` symlink |
| `.agro/evals/RESULTS.md` | Updated row | New probe row from the runner |

## Storage

Each council run writes one Markdown record into the task folder of the caller, for example `.agro/tasks/<slug>/council-record.md`. The skill stores no trace content. Trace evidence stays in the untracked `/prompt-miner` output directory.

## Architectural Decisions

- The source of truth is `.agro/skills/council/SKILL.md`. Provider paths are symlinks.
- The council is a skill, not a project agent, per `roles-are-skills.sh`.
- The active session owns the decision. Council perspectives advise and write no tracked file.
- The skill sets `disable-model-invocation: true`, because each run spawns several agents. `/weigh` and `/prompt-miner` follow the same rule.
- Privacy scope: only aggregate trace data enters a tracked file or a GitHub body.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/council-skill-contract.sh` | trigger clauses, boundary names, caps, privacy rule, no agent file | Skill contract |
| `.agro/evals/probes/roles-are-skills.sh` | existing | No council project agent |
| `.agro/evals/probes/delegate-worker-boundary.sh` | existing | `/delegate` names no council worker |
| `.agro/skills/ste/scripts/ste-check.sh` | skill file, council record | STE prose |
| `.agro/scripts/link-providers.sh --check` | existing | Provider links resolve |

## Design Principles

- Apply the AGENTS.md rules: sandbox work, canonical `.agro/` source, no code comments, one source of truth.
- Keep deliberation bounded by fixed caps.
- Record dissent. Do not average it away.
- State each evidence limit next to the claim that depends on it.
- Reuse `/prompt-miner` for traces. Do not add a second trace parser.

## Out of Scope

- A new trace-mining engine.
- Changes to `/strategic-proposal`, `/weigh`, or `/delegate` behavior.
- A council project-agent definition.
- Documentation changes in `mifunedev/agro-web`, unless Open Question 2 decides otherwise.
- The pull request merge.

## Open Questions

1. What are the perspective count cap and the round cap? The issue gives no values. The US-001 council proposes `<perspective cap>` and `<round cap>`, and the operator accepts them.
2. Does `mifunedev/agro-web` list skills? If the site lists skills, `/council` needs a matching public entry.
3. Does the US-001 council record stay in the task folder after the build, or does `/spec retro` archive it?

## Acceptance Criteria
- [ ] `.agro/tasks/council-skill/council-record.md` holds the accepted design, dissent, and evidence limits.
- [ ] `.agro/skills/council/SKILL.md` exists, and `ste-check.sh` exits 0 on it.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports PASS for `council-skill-contract` and no new REGRESSION.
- [ ] A ready-for-review pull request for issue #1076 has green CI and stays unmerged.

## Lessons

Filled by the advisor before undraft.
