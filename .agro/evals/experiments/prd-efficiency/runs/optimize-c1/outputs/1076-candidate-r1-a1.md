# PRD: Council skill for bounded deliberation

Status: DRAFT

## User Stories

### US-001: Add the council contract probe

**Description:** As the advisor, I want a deterministic probe for the `/council` contract so that an edit that drops a rule turns the probe red.

**Acceptance Criteria:**

- [ ] New file `.agro/evals/probes/council-skill-contract.sh` exists, is executable, and carries the `# tier: A`, `# source:`, and `# desc:` header lines that other probes carry.
- [ ] Before US-002 lands, `bash .agro/evals/probes/council-skill-contract.sh` exits 1 and names the missing file `.agro/skills/council/SKILL.md` on stderr.
- [ ] The probe exits 1 when the frontmatter `name` is not exactly `council`.
- [ ] The probe exits 1 when the frontmatter omits `TRIGGER when:` or omits `Do NOT trigger`.
- [ ] The probe exits 1 when `allowed-tools` lists `Write` or `Edit`.
- [ ] The probe exits 1 when the frontmatter holds `context:`.
- [ ] The probe exits 1 when the skill body omits a route to any of `/delegate`, `/architect`, `/audit`, `/strategic-proposal`, `/spec`, `/supervisor`, and `/weigh`.
- [ ] The probe exits 1 when the skill body omits the record headings `### Accepted Design`, `### Dissent`, or `### Evidence Limits`.
- [ ] The probe exits 1 when the skill body omits the privacy marker `never raw prompt text`.
- [ ] The probe exits 1 when the new provider paths `.claude/skills/council/SKILL.md` or `.agents/skills/council/SKILL.md` do not resolve.

### US-002: Author the canonical `/council` skill

**Description:** As an operator, I want a `/council` skill that runs a bounded, evidence-based deliberation so that competing designs meet independent challenge before implementation starts.

**Acceptance Criteria:**

- [ ] The implementer authors new file `.agro/skills/council/SKILL.md` through the `/builder` reference-skill procedure in `.agro/skills/builder/references/skill.md`.
- [ ] The frontmatter sets `name: council`, a description with `TRIGGER when:` cases and `Do NOT trigger` cases, and `allowed-tools: Read, Grep, Bash, Agent`.
- [ ] The skill runs inline in the active session. The skill launches between 2 and 5 read-only perspective workers in one parallel wave.
- [ ] Each perspective worker receives the same question and the same evidence list. No worker receives the output of another worker in the first round.
- [ ] The skill allows at most one rebuttal round. After that round, the active session decides.
- [ ] The skill output is one Council Record with the headings `### Question`, `### Perspectives`, `### Evidence`, `### Positions`, `### Accepted Design`, `### Dissent`, and `### Evidence Limits`.
- [ ] Each claim in `### Positions` cites a repository path, a command result, or a trace feature. A claim without a citation moves to `### Evidence Limits`.
- [ ] The skill ends with one result tag: `RESULT: ACCEPTED | SPLIT | INSUFFICIENT-EVIDENCE | ROUTED`.
- [ ] The skill states failure cases: fewer than 2 workers return, no evidence exists, or the request is a build, audit, roadmap, or supervision request. Each failure case names its result tag.
- [ ] The skill contains a routing table that separates `/council` from `/delegate`, `/architect`, `/audit`, `/strategic-proposal`, `/spec`, `/supervisor`, and `/weigh`.
- [ ] `bash .agro/evals/probes/council-skill-contract.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0.
- [ ] `.agro/skills/council/SKILL.md` has fewer than 500 lines.

### US-003: Mine local traces without publishing private content

**Description:** As an operator, I want local Claude and Pi traces as council evidence so that no session content leaks.

**Acceptance Criteria:**

- [ ] The skill calls `.agro/skills/prompt-miner/scripts/mine-traces.mjs` for trace evidence. The skill adds no second trace parser.
- [ ] The skill never passes `--include-prompt-text` to `mine-traces.mjs`.
- [ ] The skill states the marker `never raw prompt text` and forbids a quote from a transcript in the Council Record, a commit, a PR body, or a GitHub comment.
- [ ] The skill writes trace output only to scratch under `$TMPDIR`, outside the repository.
- [ ] If the engine finds zero sessions, the skill records the gap in `### Evidence Limits` and continues without trace evidence.
- [ ] `git status --porcelain` shows no new file outside the new skill directory, `.agro/evals/probes/`, `.agro/evals/RESULTS.md`, and `CHANGELOG.md` after a council run.

### US-004: Run a council on the skill design and verify the pack

**Description:** As the advisor, I want one real council run on this design so that review sees the accepted design and its dissent.

**Acceptance Criteria:**

- [ ] The advisor runs `/council` once on the question "What contract must `/council` hold?" and records the Council Record in `progress.txt` and in the PR body.
- [ ] The Council Record in the PR body holds a non-empty `### Dissent` section and a non-empty `### Evidence Limits` section.
- [ ] The PR body contains no raw prompt text and no transcript quote.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/evals/probes/roles-are-skills.sh` exits 0, and no file exists at `.claude/agents/council.md`.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION, and `.agro/evals/RESULTS.md` lists `council-skill-contract` as PASS.
- [ ] `git diff --check` exits 0.
- [ ] `CHANGELOG.md` holds one `### Added` entry for `/council` under `## [Unreleased]`.
- [ ] The advisor opens a ready-for-review PR through `/git`. CI is green on the PR head. Nobody merges the PR.

## Summary

The issue asks for a reusable `/council` skill. The skill compares designs through independent perspectives before implementation. The skill also mines local Claude and Pi traces, and never publishes private session content.

Verified current state at commit `1317f35`:

- No council skill exists. `.agro/skills/` holds 36 skills, and none is named `council`.
- `.agro/skills/strategic-proposal/SKILL.md` already runs a "council" and a critic, but only for roadmap and V2MOM work. The new skill does not replace that flow.
- `.agro/skills/weigh/SKILL.md` selects among sampled trajectories with a deterministic scorer. Selection is not deliberation.
- `.agro/skills/prompt-miner/SKILL.md` owns a privacy contract for traces. The engine `.agro/skills/prompt-miner/scripts/mine-traces.mjs` emits feature vectors and omits prompt text by default.
- `.agro/evals/probes/roles-are-skills.sh` line 20 forbids a `council` project-agent file. A skill is the allowed primitive.
- `.agro/evals/probes/architect-skill-contract.sh` is the pattern for a skill-contract probe.
- `.claude/skills` and `.agents/skills` link to `.agro/skills`. `bash .agro/scripts/link-providers.sh --check` verifies the links.

Selected approach: add one inline skill, one contract probe, one changelog entry, and one real council run as evidence. Reuse `mine-traces.mjs` for traces. Reuse the Agent tool for bounded workers.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| new file `.agro/skills/council/SKILL.md` | frontmatter, procedure, routing table, Council Record | Canonical skill source |
| new file `.agro/evals/probes/council-skill-contract.sh` | `fail`, frontmatter parse, marker checks | Contract regression probe |
| `.agro/evals/probes/architect-skill-contract.sh` | frontmatter `awk` block, `fail` | Probe pattern to copy |
| `.agro/evals/probes/roles-are-skills.sh` | role loop at line 20 | Guard against a `council` agent file |
| `.agro/skills/builder/references/skill.md` | reference-skill procedure | Authoring procedure for US-002 |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | trace engine | Trace evidence source for US-003 |
| `.agro/skills/prompt-miner/SKILL.md` | Privacy contract section | Privacy rules to cite, not copy |
| `.agro/skills/strategic-proposal/SKILL.md` | council and critic steps | Boundary: roadmap deliberation stays there |
| `.agro/skills/weigh/SKILL.md` | selection contract | Boundary: trajectory selection stays there |
| `.agro/scripts/link-providers.sh` | `--check` | Provider link verification |
| `.agro/skills/eval/run.sh` | probe runner | Writes `.agro/evals/RESULTS.md` |
| `CHANGELOG.md` | `## [Unreleased]` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/council` slash command | New | Claude, Codex, and Pi resolve the skill through `.claude/skills` and `.agents/skills` |
| Council Record | New output format | Terminal and PR-body Markdown with seven fixed headings and one result tag |
| `mine-traces.mjs` | Consumed, unchanged | The skill calls the engine with default flags |
| Agent tool | Consumed, unchanged | The skill launches 2 to 5 read-only workers |

## Storage

N/A. The skill is stateless. Trace output goes to scratch under `$TMPDIR`. The Council Record goes to the terminal, to `progress.txt`, and to the PR body. Git ignores the task directory, so the task declares no tracked evidence file there.

## Architectural Decisions

- Source of truth: `.agro/skills/council/SKILL.md` owns the behavior. `.claude/skills/council` and `.agents/skills/council` resolve through the existing directory links. Nobody edits a mirror.
- Execution model: the active session runs the skill inline and owns the decision. Workers argue positions. Workers do not decide, write files, or implement.
- Bounds: 2 to 5 workers, one independent round, at most one rebuttal round, then a decision.
- Privacy scope: trace evidence is feature vectors only. The skill never reads raw prompt text into the Council Record.
- Reuse: the skill composes `/prompt-miner` data and the Agent tool. The skill does not fork `/weigh` scoring or `/strategic-proposal` roadmap flow.
- Primitive: `/council` is a skill, not a project agent, per ADR #929 as `.agro/evals/probes/roles-are-skills.sh` enforces.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/council-skill-contract.sh` | missing skill exits 1; each missing marker exits 1; full skill exits 0 | US-001, US-002, US-003 contract |
| `.agro/evals/probes/roles-are-skills.sh` | no `council` agent file | Skill-not-agent boundary |
| `.agro/skills/ste/scripts/ste-check.sh` | skill prose and plan prose | `/ste` compliance |
| `.agro/scripts/link-providers.sh` | `--check` | Provider links resolve |
| `.agro/skills/eval/run.sh` | full probe suite | No regression in the floor |

Red-first order: write the probe in US-001 and record its exit 1 in `progress.txt`. Then author the skill in US-002 and record exit 0.

## Design Principles

- Follow the `AGENTS.md` non-negotiables: work stays in the sandbox, canonical sources live under `.agro/`, and tracked code carries no explanatory comments beyond the probe header lines.
- Keep one owner per behavior. `/council` deliberates. `/delegate` dispatches. `/architect` classifies and records structure. `/audit` judges promotability. `/strategic-proposal` builds roadmaps. `/spec` builds. `/supervisor` watches sessions. `/weigh` scores trajectories.
- Keep independence real: the first round shares no worker output.
- Separate evidence from opinion: an uncited claim moves to `### Evidence Limits`.
- Record dissent. An accepted design without recorded dissent hides risk.
- Apply YAGNI: add no scorer, no persistence layer, and no new trace parser.

Surface review:

- Host and sandbox: applied. All edits and checks run in the sandbox.
- Lifecycle door: not applicable. No `agro` verb changes.
- Canonical and provider surfaces: applied. The skill lives in `.agro/skills/`, and `link-providers.sh --check` verifies the links.
- Root and scaffold: applied. The skill ships in the vendored pack to initialized projects.
- Interactive and headless processes: not applicable. The skill starts no persistent process.
- Local and remote operation: applied. The skill runs in one session and holds no terminal state.
- Parallel operation: applied. Workers are read-only, so they share no mutable state.
- Public documentation: open question 2.
- Verification: applied. See the Test Plan.

## Out of Scope

- Changes to `/strategic-proposal`, `/weigh`, or `/prompt-miner` behavior.
- A new trace parser, a scorer, or a persisted council archive.
- A `council` project-agent file for any provider.
- A cron or unattended council run.
- A merge of the PR.

## Open Questions

1. Does `/council` set `disable-model-invocation: true`, as `/weigh` does, because the skill spawns workers? This plan keeps the skill model-invocable, because the issue asks for trigger cases.
2. Does `mifunedev/agro-web` need a page or glossary entry for `/council`? Does `docs/glossary.md` need an entry? This plan changes neither file.
3. Does the skill fix a default perspective set, or does the active session choose the perspectives per question? This plan lets the active session choose 2 to 5 perspectives and name each one in `### Perspectives`.

## Acceptance Criteria

- [ ] New file `.agro/skills/council/SKILL.md` exists and resolves through the new provider paths `.claude/skills/council/SKILL.md` and `.agents/skills/council/SKILL.md`.
- [ ] `bash .agro/evals/probes/council-skill-contract.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] The PR body holds one Council Record with an accepted design, dissent, and evidence limits, and no raw prompt text.
- [ ] The PR is ready for review, CI is green, and the PR is not merged.

## Lessons

Filled by the advisor before undraft.
