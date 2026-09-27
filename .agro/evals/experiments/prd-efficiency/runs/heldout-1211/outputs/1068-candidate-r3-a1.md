# PRD: Shorten the supervisor skill description

Status: DRAFT

Issue: [#1068](https://github.com/mifunedev/agro/issues/1068)
Source: `work/issue-1068.md`

## User Stories

### US-001: Fit the supervisor description inside the Pi limit

**Description:** As an operator who runs Pi, I want a shorter `/supervisor` description so that Pi loads the skill without a warning.

**Acceptance Criteria:**

- [ ] Red test: before the edit, the length command in the Test Plan prints `1103` for `.agro/skills/supervisor/SKILL.md`.
- [ ] After the edit, the same length command prints a number that is 1024 or less.
- [ ] The diff touches only the `description:` block of `.agro/skills/supervisor/SKILL.md`, between the two `---` lines.
- [ ] The `name:` value stays `supervisor`, and the `allowed-tools:` line stays `Bash, Read, Grep, MonitorCreate, MonitorList, MonitorStop`.
- [ ] The description keeps the `TRIGGER when:` clause for these triggers: supervise, babysit, watch, or drive an agent in another pane; own a long build to its Definition of Done; an advisor needs a brief, a compaction decision, or an escalation route; "what is the advisor doing".
- [ ] The description keeps the `Do NOT trigger when` clause for these cases: the active session implements the work; a code review; bounded workers inside one session, with `/delegate`; a single `herdr` command, with `/herdr`.
- [ ] The description keeps these role boundaries: `MonitorCreate` with `onDone` for observation, `MonitorList` and `MonitorStop` for handle control, no `LoopCreate` and no polling, Herdr for launch and downward steering only, no reverse Herdr messages from advisors or workers, no code writing or code review, and supervisor ownership of context budgets and operator escalation.
- [ ] Before the edit, the Pi skill loader reports `description exceeds 1024 characters (1103)` for the supervisor skill. After the edit, the Pi skill loader reports no diagnostic for the supervisor skill. The operator records both outputs in `.agro/tasks/supervisor-description-length/evidence.md`.
- [ ] `readlink -f .claude/skills/supervisor/SKILL.md` and `readlink -f .agents/skills/supervisor/SKILL.md` both print the absolute path of `.agro/skills/supervisor/SKILL.md`.

## Summary

Verified current state:

- `.agro/skills/supervisor/SKILL.md:3-6` holds the description as a YAML literal block (`|`). The block holds three lines: the role rules, the `TRIGGER when:` clause, and the `Do NOT trigger when` clause.
- The parsed description holds 1103 characters, with the trailing newline that the `|` block keeps. The issue gives the limit as 1,024 characters.
- Pi 0.87.1 is installed at `/home/sandbox/.local/lib/node_modules/@earendil-works/pi-coding-agent`. The Pi bundle rejects a long description with this template: `description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${description.length})`.
- `.claude/skills` and `.agents/skills` are symlinks to `../.agro/skills`. Pi discovers skills through `.agents/skills`, per `PI_DISCOVERY_ROOTS` in `.agro/scripts/__tests__/standard-skills-link.test.ts:28`. No `.pi/skills` link exists.
- No probe and no test reads the supervisor description text.

Selected approach: cut at least 79 characters from the first line of the description. The first line repeats rules that the `## Role boundary` section of the body states in full. Compress that line, and keep each role rule as a short phrase. Keep the `TRIGGER when:` and `Do NOT trigger when` clauses. Shorten words in those clauses only when the first line cannot give enough characters. Target 1000 characters or less, so that a later small edit keeps a margin.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description:` (lines 3-6) | Canonical source. The only file that this task changes. |
| `.claude/skills` | symlink to `../.agro/skills` | Claude Code mirror. No change. |
| `.agents/skills` | symlink to `../.agro/skills` | Pi and Codex discovery root. No change. |
| `.agro/scripts/link-providers.sh` | `--init` mode | Creates the provider links. CI runs it in `.github/workflows/ci-harness.yml:78`, `:128`, and `:157`. |
| `@earendil-works/pi-coding-agent/dist/bundle/cli.js` | `MAX_DESCRIPTION_LENGTH` check | Emits the diagnostic. External to this repository. No change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Skill listing in Claude Code, Codex, and Pi | Text change | The shorter description appears in each harness skill list. The trigger meaning stays the same. |
| Pi skill loader diagnostic | Removed | The loader stops the `description exceeds` report for `supervisor`. |

## Storage

N/A. The task changes one text field in a tracked Markdown file. The task adds no state.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` stays the one source of truth. The provider paths resolve to this file through directory symlinks.
- The body section `## Role boundary` stays the full statement of the role rules. The description carries a short index of those rules and the trigger rules.
- This task adds no new length probe. The issue limits the scope to one frontmatter edit. Open Question 2 asks the operator about a guard.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A: shell command | `node -e 'const s=require("fs").readFileSync(".agro/skills/supervisor/SKILL.md","utf8");const fm=s.split("\n---\n")[0];const m=fm.match(/description: \|\n((?:  .*\n?)+)/);const d=m[1].split("\n").map(l=>l.replace(/^  /,"")).join("\n").replace(/\n+$/,"")+"\n";console.log(d.length)'` | Prints `1103` before the edit. Prints 1024 or less after the edit. |
| N/A: Pi skill loader | `<pi skill-load diagnostic command>`, run in the sandbox at the repository root, before and after the edit | Shows the `description exceeds` diagnostic before the edit and no diagnostic after the edit. |
| `.agro/scripts/__tests__/standard-skills-link.test.ts` | the full file, through `pnpm test:scripts` | Provider links still expose the canonical skills. |
| `.agro/evals/probes/*.sh` | `bash .agro/skills/eval/run.sh` | The probe suite reports no new regression. |
| `.github/workflows/ci-harness.yml` | all jobs on the pull request head SHA | CI passes on the exact head SHA. |

## Design Principles

- Change the canonical `.agro/` source. Do not patch a provider mirror.
- Apply the smallest realistic change: one frontmatter field in one file.
- Keep the trigger meaning. A shorter description must route the same requests to `/supervisor`, and must refuse the same requests.
- Keep the text free of explanatory comments.

## Out of Scope

- A redesign of the supervisor skill, or any edit to the skill body.
- Edits to other skills, to provider mirrors, or to `.agro/scripts/link-providers.sh`.
- Changes to the Pi package or to `MAX_DESCRIPTION_LENGTH`.
- Merge, release, force push, and unrelated changes. The issue does not authorize them.

## Open Questions

1. Which command shows the Pi skill-loader diagnostic in the sandbox? The plan writes `<pi skill-load diagnostic command>`. The implementation owner must name the exact command and record its output before and after the edit.
2. Does the operator want a probe that holds every `.agro/skills/*/SKILL.md` description at 1024 characters or less? The issue scope excludes it. This plan leaves it out.

## Acceptance Criteria

- [ ] The parsed `/supervisor` description holds 1024 characters or less.
- [ ] The Pi skill loader reports no diagnostic for the supervisor skill after the edit.
- [ ] `.claude/skills/supervisor/SKILL.md` and `.agents/skills/supervisor/SKILL.md` resolve to `.agro/skills/supervisor/SKILL.md`.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` exits 0, before and after the edit.
- [ ] CI on the pull request head SHA passes.
- [ ] A non-draft pull request names its exact head SHA.
- [ ] The pull request diff changes only `.agro/skills/supervisor/SKILL.md` and files under `.agro/tasks/supervisor-description-length/`.

## Lessons

Filled by the advisor before undraft.
