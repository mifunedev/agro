# PRD: Supervisor description length

Status: DRAFT

## User Stories

### US-001: Shorten the supervisor frontmatter description

**Description:** As a Pi operator, I want a `/supervisor` description within the Pi limit so that Pi loads the skill without a warning.

**Acceptance Criteria:**

- [ ] The parsed `description` value in `.agro/skills/supervisor/SKILL.md` has at most 1,024 characters. The Pi loader reports the length that it measures.
- [ ] The Pi loader probe in the Test Plan exits 0 and prints `[]` after the change.
- [ ] The Pi loader probe exits 1 and prints `description exceeds 1024 characters (1103)` on the base commit `a33545a`.
- [ ] The description keeps a `TRIGGER when:` clause. The clause covers these cases: supervise, babysit, watch, or drive an agent in another pane; run a build in a second pane; own a long build to its Definition of Done from outside the session; an advisor needs a brief, a compaction decision, or an escalation route; the operator asks what the advisor is doing.
- [ ] The description keeps a `Do NOT trigger when:` clause. The clause covers these cases: the active session implements the work; a code review; bounded workers inside one session, with a pointer to `/delegate`; a single `herdr` command, with a pointer to `/herdr`.
- [ ] The description keeps these role boundaries: `MonitorCreate` with `onDone` for advisor observation; `MonitorList` and `MonitorStop` for handle control; no `LoopCreate` and no polling; inline Herdr commands only for launch and guarded downward steering; no reverse Herdr messages from advisors and workers; no code writes and no code review; the supervisor owns context budgets and operator escalation.
- [ ] `git diff --stat a33545a -- .` lists only `.agro/skills/supervisor/SKILL.md`, and the diff changes only lines inside the `description:` block.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `readlink .claude/skills` and `readlink .agents/skills` each print `../.agro/skills`.

## Summary

Issue #1068 reports a Pi skill-loader warning for `/supervisor`. Verified current state:

- `.agro/skills/supervisor/SKILL.md` declares `description: |`. The literal block holds three long lines: a role summary, a `TRIGGER when:` clause, and a `Do NOT trigger when:` clause.
- The Pi loader at `~/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js` sets `MAX_DESCRIPTION_LENGTH = 1024`. The loader compares the parsed string length, including the trailing newline of the literal block.
- On `a33545a`, `loadSkillsFromDir` returns one warning: `description exceeds 1024 characters (1103)`, path `.agro/skills/supervisor/SKILL.md`.
- `.claude/skills` and `.agents/skills` are symlinks to `../.agro/skills`. `bash .agro/scripts/link-providers.sh --check` exits 0.
- No probe under `.agro/evals/probes/` asserts the supervisor description text or any skill description length.

Selected approach: the implementation owner rewrites the role-summary sentence of the description to remove text that the body `## Role boundary` section already holds. The owner keeps each trigger phrase and each negative trigger. The owner removes at least 80 characters. A target of 950 characters or fewer leaves margin for later edits. The skill body stays unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/supervisor/SKILL.md` | frontmatter `description` | Canonical source. The only file that changes. |
| `~/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js` | `loadSkillsFromDir`, `MAX_DESCRIPTION_LENGTH` | Pi loader. Emits the warning. Read only. |
| `.agro/scripts/link-providers.sh` | `--check` | Verifies the provider symlinks without a change. |
| `.claude/skills`, `.agents/skills` | symlinks | Provider mirrors. No edit. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Skill listing in Claude Code, Codex, and Pi | Text change | The shorter description appears in each provider skill list. The skill name and the trigger set stay the same. |

## Storage

N/A. The change edits one text field in a tracked Markdown file. No persistent state changes.

## Architectural Decisions

- `.agro/skills/supervisor/SKILL.md` stays the single source of truth. Provider directories reach the file through symlinks, so no mirror edit occurs.
- The Pi loader limit of 1,024 characters is the acceptance bound. The plan does not change the loader.
- Surface review:
  - Host and sandbox: applied. The implementation owner edits the file and runs the checks inside the sandbox.
  - Lifecycle door: not applicable. No `agro` verb changes.
  - Canonical and provider surfaces: applied. The edit occurs in `.agro/`. `link-providers.sh --check` verifies the symlinks.
  - Root and scaffold: applied. Initialized projects receive the vendored `.agro/skills/` pack, so the fix reaches both.
  - Interactive and headless processes: not applicable. No process starts.
  - Local and remote operation: not applicable. The change is static text.
  - Parallel operation: applied. The owner works in one isolated worktree on one task branch.
  - Public documentation: not applicable. The skill description is not documented in `mifunedev/agro-web`.
  - Verification: applied. See the Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| Inline Node probe (below), run from the repository root | Base commit: exit 1 with the 1103-character warning. After the change: exit 0 with `[]`. | The actual Pi loader diagnostic is absent. |
| `bash .agro/scripts/link-providers.sh --check` | Exit 0 before and after the change. | Canonical and provider symlinks stay intact. |
| `bash .claude/skills/eval/run.sh` | Exit 0. No new green-to-red transition in `.agro/evals/RESULTS.md`. | The regression floor stays green. |
| `pnpm test` | Exit 0. | The script tests stay green. |
| CI workflow `ci-harness.yml` on the PR head SHA | All jobs pass. | CI is green on the exact head. |

The Pi loader probe:

```bash
node --input-type=module -e '
import { loadSkillsFromDir } from "'"$HOME"'/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js";
const r = loadSkillsFromDir({ dir: ".agro/skills", source: "project" });
const d = r.diagnostics.filter((x) => x.path.includes("supervisor"));
console.log(JSON.stringify(d));
process.exit(d.length ? 1 : 0);
'
```

## Design Principles

- Edit the canonical `.agro/` source. Never patch a provider mirror.
- Add no explanatory comments to tracked code.
- Keep the smallest change that clears the diagnostic. Do not redesign the skill.
- Keep each trigger and each negative trigger. A shorter description must still route the same requests.

## Out of Scope

- Changes to the supervisor skill body, procedures, or `allowed-tools`.
- Changes to other skills, including any other skill that exceeds the Pi limit.
- A new probe or checker for description length across all skills.
- Changes to the Pi loader or to `link-providers.sh`.
- Merge, release, force push, or unrelated changes.

## Open Questions

1. Does the operator want a regression probe that fails when any skill description exceeds 1,024 characters? The issue scope limits the edit to one file, so this plan excludes the probe. A follow-up issue can add the probe.

## Acceptance Criteria

- [ ] The Pi loader probe exits 0 on the PR head and exits 1 on `a33545a`.
- [ ] The parsed supervisor description has at most 1,024 characters.
- [ ] The PR diff touches only `.agro/skills/supervisor/SKILL.md`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` exits 0.
- [ ] `ci-harness.yml` passes on the PR head SHA.
- [ ] A non-draft PR targets `development`, references issue #1068, and states its exact head SHA in the PR body.

## Lessons

Filled by the advisor before undraft.
