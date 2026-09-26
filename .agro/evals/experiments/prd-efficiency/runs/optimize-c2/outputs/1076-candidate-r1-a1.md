# PRD: Council skill for bounded deliberation

Status: DRAFT

## User Stories

### US-001: Run the design council

**Description:** As the advisor, I want a council to pick the skill design so that the build follows a compared choice.

**Acceptance Criteria:**

- [ ] The advisor runs one council with at least three independent perspectives before any file under the new directory `.agro/skills/council` (absent at base) exists.
- [ ] Each perspective receives the same design question and the same evidence bundle.
- [ ] The evidence bundle includes aggregate output from `node .agro/skills/prompt-miner/scripts/mine-traces.mjs` over Claude and Pi traces, run without `--include-prompt-text`.
- [ ] The council record states the accepted design, each dissent, and the evidence limits.
- [ ] The council record contains no raw prompt text, no transcript excerpt, and no home-directory trace path.
- [ ] The advisor copies the council record into `progress.txt` and into the PR body.

### US-002: Add the council contract probe

**Description:** As a maintainer, I want a contract probe for /council so that drift fails the eval suite.

**Acceptance Criteria:**

- [ ] New file `.agro/evals/probes/council-skill-contract.sh` exists and carries `# tier: A`, `# source:`, and `# desc:` headers.
- [ ] The probe fails when `.agro/skills/council/SKILL.md` is absent.
- [ ] The probe fails when the frontmatter omits `name: council`, `TRIGGER when:`, or an `allowed-tools:` line.
- [ ] The probe fails when the skill omits a boundary line for each of /delegate, /architect, /audit, /strategic-proposal, /spec, and /supervisor.
- [ ] The probe fails when the skill omits the output fields for decision, dissent, and evidence limits.
- [ ] The probe fails when the skill omits the rule that forbids raw trace content in output.
- [ ] The probe fails when new file `.claude/skills/council/SKILL.md` does not resolve.
- [ ] `bash .agro/evals/probes/council-skill-contract.sh` exits 1 before US-003 lands.

### US-003: Author the council skill

**Description:** As an operator, I want a /council skill so that I can compare designs before implementation.

**Acceptance Criteria:**

- [ ] The implementer creates new file `.agro/skills/council/SKILL.md` through `/builder skill council`.
- [ ] The skill follows the checklist in `.agro/skills/builder/references/skill.md`.
- [ ] The skill implements the design that the US-001 council accepted.
- [ ] The skill caps the number of perspectives and the number of rounds with explicit numbers.
- [ ] The skill requires each perspective to cite evidence and to state what the evidence cannot prove.
- [ ] The skill output lists the decision, each dissent, and the evidence limits.
- [ ] The skill forbids raw prompt text and transcript excerpts in any tracked file or posted body.
- [ ] The description holds at least three positive trigger examples and at least three negative trigger examples.
- [ ] Each negative trigger names the skill that owns the request instead.
- [ ] The skill creates no project-agent file, and `bash .agro/evals/probes/roles-are-skills.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0.
- [ ] `bash .agro/evals/probes/council-skill-contract.sh` exits 0.

### US-004: Register the skill and verify regressions

**Description:** As a maintainer, I want the skill registered and checked so that provider links and probes stay green.

**Acceptance Criteria:**

- [ ] `.agro/skills.lock` holds a `council` entry in the same shape as the `strategic-proposal` entry.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` exits 0 and reports no new regression.
- [ ] `CHANGELOG.md` holds one entry for /council under the unreleased heading.
- [ ] The implementer runs each positive and each negative trigger example from the skill description, and the PR body records the skill that each example selected.
- [ ] The implementer runs two failure cases: a council with no evidence, and a request to publish trace text. The PR body records that the skill refused or stopped in each case.

### US-005: Deliver the pull request

**Description:** As the operator, I want a ready PR with green CI so that I can review the skill.

**Acceptance Criteria:**

- [ ] The PR follows the procedure in `.agro/skills/git/SKILL.md`.
- [ ] The PR is ready for review and not a draft.
- [ ] Every required CI check on the PR head commit reports success.
- [ ] Nobody merges the PR.

## Summary

The operator asks for a reusable /council skill. The skill runs a bounded deliberation that compares designs before implementation. The source is the issue file work/issue-1076.md.

Verified current state:

- The directory `.agro/skills/council` is absent.
- `.agro/skills/strategic-proposal/SKILL.md` already runs a council, but only for roadmaps and the V2MOM variant.
- `.agro/skills/weigh/SKILL.md` scores sampled trajectories with a fixed weight function. The weigh skill selects outputs and does not deliberate.
- `.agro/skills/architect/SKILL.md` returns one Architecture Brief from the active session. The architect skill runs no independent perspectives.
- `.agro/skills/delegate/SKILL.md` assigns implementation to bounded workers.
- `.agro/skills/prompt-miner/scripts/mine-traces.mjs` mines Claude and Pi traces. The engine omits prompt text unless the caller passes `--include-prompt-text`.
- `.agro/evals/probes/roles-are-skills.sh` fails when a `council` project-agent file exists.
- `.claude/skills` is a symlink to `.agro/skills`, so a new canonical skill resolves for Claude without a new link.

Selected approach: run the council first. Then write a red contract probe. Then author the skill through /builder. Last, register the skill and run the checks.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| new file `.agro/skills/council/SKILL.md` | frontmatter, boundary section, output fields | Canonical skill |
| new file `.agro/evals/probes/council-skill-contract.sh` | contract checks | Regression probe |
| `.agro/evals/probes/architect-skill-contract.sh` | `fail`, frontmatter `awk` block | Pattern for the new probe |
| `.agro/evals/probes/roles-are-skills.sh` | `council` role loop | Blocks a project-agent file |
| `.agro/skills/builder/references/skill.md` | skill checklist, trigger examples | Authoring procedure |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `--harness`, `--include-prompt-text` | Trace evidence source |
| `.agro/skills/strategic-proposal/SKILL.md` | council and critic steps | Boundary neighbor |
| `.agro/skills/weigh/SKILL.md` | trajectory selection | Boundary neighbor |
| `.agro/skills.lock` | `strategic-proposal` entry | Registration pattern |
| `.agro/scripts/link-providers.sh` | `--check` | Provider link check |
| `.agro/skills/eval/run.sh` | suite runner | Regression floor |
| `CHANGELOG.md` | unreleased entries | Release notes |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| /council slash command | New | Operator runs a bounded design deliberation |
| Skill listing | New entry | Description lists positive and negative triggers |
| Eval suite | New probe | `council-skill-contract` row in `.agro/evals/RESULTS.md` |

## Storage

N/A. The skill writes no persistent state. The council record lives in `progress.txt` and the PR body. Git ignores the task directory, so the plan declares no tracked evidence file there.

## Architectural Decisions

- The canonical source is new file `.agro/skills/council/SKILL.md`. Provider surfaces reach the skill through existing symlinks.
- The council is a skill, not a project agent. This follows `.agro/evals/probes/roles-are-skills.sh`.
- The active session stays the advisor. The council gives a recommendation, and the advisor accepts or rejects the recommendation.
- Trace mining reuses `mine-traces.mjs`. The skill adds no second trace parser.
- The skill publishes aggregate numbers only. Raw prompt text stays on the local machine.
- Host and sandbox: every command in this plan runs in the sandbox.
- Lifecycle door: not applicable. No `agro` verb changes.
- Root and scaffold: the skill ships in the `.agro/` pack, so initialized projects receive the skill.
- Interactive and headless processes: not applicable. The skill runs inline and starts no persistent process.
- Parallel operation: council perspectives read shared evidence and write no shared file.
- Public documentation: open question 3.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/council-skill-contract.sh` | skill absent exits 1; frontmatter, boundaries, output fields, privacy rule, and provider path present exit 0 | US-002, US-003 contract |
| `.agro/evals/probes/roles-are-skills.sh` | no `council` project-agent file | US-003 role rule |
| `.agro/skills/ste/scripts/ste-check.sh` | new file `.agro/skills/council/SKILL.md` exits 0 | US-003 prose rule |
| `.agro/scripts/link-providers.sh` | `--check` exits 0 | US-004 provider links |
| `.agro/skills/eval/run.sh` | full suite, no new regression | US-004 regression floor |

## Design Principles

- Keep the smallest skill that makes deliberation bounded and evidence-based.
- Reuse existing primitives. Add no new script unless the council accepts a need for one.
- State each boundary with the skill that owns the neighboring request.
- Keep private session content off every tracked file and every posted body.
- Add no explanatory comments to tracked code.

## Out of Scope

- A change to /strategic-proposal, /weigh, /architect, or /delegate behavior.
- A new trace-mining engine or a change to `mine-traces.mjs`.
- A project-agent definition for a council role.
- A merge of the PR.

## Open Questions

1. Must `.claude/protected-paths.txt` list `council`? That file lists `architect` and `strategic-proposal`. The implementer reads the file purpose before the edit.
2. Does /strategic-proposal keep its own council steps, or does /strategic-proposal later call /council? This plan keeps both unchanged.
3. Does mifunedev/agro-web need a page for /council?
4. Which CI checks does branch protection require on the PR? The plan uses `<required checks>` until the implementer reads the branch protection.

## Acceptance Criteria

- [ ] The PR body records the council decision, each dissent, and the evidence limits.
- [ ] new file `.agro/skills/council/SKILL.md` exists, and `bash .agro/evals/probes/council-skill-contract.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` exits 0.
- [ ] No tracked file and no PR text holds raw prompt text or a transcript excerpt.
- [ ] The PR is ready for review, `<required checks>` report success, and the PR is not merged.

## Lessons

Filled by the advisor before undraft.
