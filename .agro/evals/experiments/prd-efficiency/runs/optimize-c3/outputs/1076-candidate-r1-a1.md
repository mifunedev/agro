# PRD: Council skill for bounded deliberation

Status: DRAFT

## User Stories

### US-001: Run a council on the skill design

**Description:** As the advisor, I want a council verdict on the skill design so that the build follows a tested design.

**Acceptance Criteria:**

- [ ] The advisor runs at least three independent perspectives against one design question for the skill.
- [ ] Each perspective cites repository paths or trace evidence for each claim.
- [ ] The record states the accepted design, each dissent, and each evidence limit.
- [ ] The record lives in the PR body or in `progress.txt`, not in a new tracked file.
- [ ] The record quotes no raw prompt text or session content from a local trace.

### US-002: Add the canonical council skill

**Description:** As an operator, I want a canonical /council skill so that any harness can run a bounded deliberation.

**Acceptance Criteria:**

- [ ] The new file `.agro/skills/council/SKILL.md` exists, and /builder produced the file with the reference-skill protocol in `.agro/skills/builder/references/skill.md`.
- [ ] The frontmatter holds a TRIGGER list and a "Do NOT trigger" list that names /delegate, /architect, /audit, /strategic-proposal, /spec, and /supervisor.
- [ ] The skill caps the perspective count and the round count with explicit numbers.
- [ ] The skill requires a verdict with the accepted option, dissent, evidence, and evidence limits.
- [ ] The skill reads Claude and Pi traces only through aggregate output of the /prompt-miner engine, and the skill forbids quoting raw trace content.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0. The new file does not exist at the base commit.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-003: Guard the council contract with a probe

**Description:** As a maintainer, I want a deterministic probe so that council drift fails the eval suite.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/council-skill-contract.sh` exists and follows the header shape of `.agro/evals/probes/roles-are-skills.sh`.
- [ ] The probe fails when the skill loses the trigger list, the exclusion list, the caps, the verdict fields, or the raw-trace ban.
- [ ] The probe exits 0 against the committed skill and exits 1 against a copy with the exclusion list removed.
- [ ] `bash .agro/evals/probes/roles-are-skills.sh` exits 0, and no council agent file appears under a provider agents directory.
- [ ] `.agro/evals/RESULTS.md` shows the new probe as PASS after the /eval run.

## Summary

The issue asks for a reusable /council skill. The skill compares designs through independent perspectives before implementation. No council skill exists under `.agro/skills/`. Council behavior lives only inside `.agro/skills/strategic-proposal/SKILL.md`, which serves roadmaps only. Adjacent skills own other jobs. /delegate dispatches work. /architect decides structure. /weigh scores sampled trajectories. /prompt-miner mines Claude and Pi traces. The probe `.agro/evals/probes/roles-are-skills.sh` bans a council project agent, so the council role stays a skill. The approach runs a council on this design first, then adds one canonical skill and one probe. `.claude/skills` is a symlink to `.agro/skills`, so the provider link needs no new link.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/builder/references/skill.md` | Authoring protocol, Validate | The procedure that produces the skill |
| `.agro/skills/strategic-proposal/SKILL.md` | council and critic phases | The existing roadmap council to distinguish from |
| `.agro/skills/prompt-miner/SKILL.md` | trace engine, attribution flags | The only approved path to Claude and Pi traces |
| `.agro/skills/weigh/SKILL.md` | selection methods | The trajectory scorer to distinguish from |
| `.agro/skills/delegate/SKILL.md` | worker dispatch | The dispatch skill to distinguish from |
| `.agro/skills/architect/SKILL.md` | Architecture Brief | The structural decision skill to distinguish from |
| `.agro/evals/probes/roles-are-skills.sh` | role list with council | The guard against a council project agent |
| `.agro/scripts/link-providers.sh` | `--check` mode | The provider link verification |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| /council skill | New | The new file `.agro/skills/council/SKILL.md` adds the invocation surface. |
| Eval probe | New | The new file `.agro/evals/probes/council-skill-contract.sh` adds one tier A probe. |
| `CHANGELOG.md` | Update | One entry records the new skill. |
| Public docs | Open | See Open Questions for a matching change in mifunedev/agro-web. |

## Storage

N/A. The skill writes no persistent state. The council record goes to the PR body or `progress.txt`.

## Architectural Decisions

- The canonical source is the new file `.agro/skills/council/SKILL.md`. Provider directories reach the skill through the existing symlink.
- The council is a behavior of the active session. The skill defines no agent identity and no model.
- Perspectives run as bounded, read-only workers. Workers write no files.
- Trace access stays local and aggregate. The skill never publishes raw prompt text or session content.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/council-skill-contract.sh` | trigger list, exclusion list, caps, verdict fields, raw-trace ban | The skill contract |
| new file `.agro/evals/probes/council-skill-contract.sh` | copy with exclusion list removed exits 1 | The probe fails on drift |
| `.agro/evals/probes/roles-are-skills.sh` | no council agent file | The role stays a skill |
| `.agro/scripts/__tests__/standard-skills-link.test.ts` | existing cases | The provider links still resolve |

## Design Principles

- Keep one source of truth for each policy.
- Add no code comments to tracked files.
- Keep the skill smaller than the roadmap council. Reuse /prompt-miner for traces, and add no new trace engine.
- Run the council on its own design before the skill ships.

## Out of Scope

- Changes to /strategic-proposal, /weigh, or /prompt-miner behavior.
- A new trace parser or a new score function.
- A merge of the PR.
- Publication of any raw trace content.

## Open Questions

1. Does user-facing terminology require a matching page in mifunedev/agro-web?
2. What are the perspective cap and the round cap? The plan proposes 3 to 5 perspectives and 2 rounds.
3. Does the skill set `disable-model-invocation: true` as /weigh does, because each run starts three or more workers?
4. What is the command for the full /eval run? The plan found no runner script under `.agro/evals/`.

## Acceptance Criteria

- [ ] The PR body holds the council record with the accepted design, dissent, and evidence limits.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0. The new file does not exist at the base commit.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/evals/probes/council-skill-contract.sh` exits 0. The new file does not exist at the base commit.
- [ ] `bash .agro/evals/probes/roles-are-skills.sh` exits 0.
- [ ] The PR is ready for review, CI is green, and the PR is not merged.

## Lessons

Filled by the advisor before undraft.
