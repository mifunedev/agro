# PRD: Evidence story fresh state and preflight

Status: DRAFT

## User Stories

### US-001: Require fresh state and a preflight in the evidence story

**Description:** As a plan author, I want stricter evidence-story rules so that evidence catches first-run bugs and live spend waits for a working path.

**Acceptance Criteria:**

- [ ] In `.agro/skills/prd/SKILL.md` § Stories, the bullet for a server, CLI, or API change states this rule. The transcript runs each command through the entry point that a user types, for example `pnpm <script> <flags>`. The run starts from fresh state with at least one input path that does not exist yet. The story creates a new temp path for that input and deletes no existing data.
- [ ] In the same section, the bullet for a live or local resource states this rule. Before the story creates a live resource, the story runs one read-only check that costs nothing, through the same path that the resource uses. If the check fails, the story sets `blocked` and creates nothing.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry that links the task issue.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/prd/SKILL.md` reports no finding.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `git diff --check` exits 0.

## Summary

A downstream session on `mifunedev/agro-console` on 2026-10-31 showed two gaps in the evidence-story rules of `/prd`:

- The `dev-tunnel-setup` plan named the `pnpm dev:tunnel:setup` entry point, but the evidence used a file that already existed. A bug that appears only for a missing path shipped in PR #623 and needed PR #631.
- The `prebuilt-node-runtime` plan required operator approval for three nodes but no check of the control-plane path. A shared tunnel blocked registration, and the nodes ran until the 15-minute limit.

Verified current state at `196e4ad`:

- `.agro/skills/prd/SKILL.md:176` asks for "a command transcript" for a server, CLI, or API change.
- `.agro/skills/prd/SKILL.md:177` asks for operator approval and cleanup for a live or local resource.
- `.agro/skills/delegate/SKILL.md:23` sets `blocked` for live spend. The file has no preflight rule.

The five-lens `/improve` council of 2026-10-31 recommended one edit in `/prd` § Stories.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/prd/SKILL.md` | § Stories, evidence-story bullets | The two rules |
| `CHANGELOG.md` | `[Unreleased]` | Change record |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/prd` evidence story | Modify | Fresh state with a missing input; a no-cost preflight before a live resource |

## Storage

N/A. The task changes skill text only.

## Architectural Decisions

- The rules live in `/prd` § Stories only. The plan copies the rules into acceptance criteria, and `/delegate` reruns those criteria at acceptance.
- `.agro/skills/git/references/manual-review.md` stays unchanged, because Close reads the file after the evidence runs.
- The task changes no hook. A hook false positive is a hook bug with its exact blocked string.

## Test Plan (TDD)

N/A. No test covers skill prose. The checks are `ste-check.sh`, `link-providers.sh --check`, and `git diff --check`.

## Design Principles

- Edit the canonical `.agro/` skill, not a provider mirror.
- Keep the change to two clauses in one section.

## Out of Scope

- The evidence story: the change has no user interface and no server, CLI, or API change. The checks in US-001 prove the change.
- Changes to `.agro/skills/delegate/SKILL.md`, `.agro/skills/git/references/manual-review.md`, and the hooks.

## Open Questions

- None.

## Acceptance Criteria

- [ ] `/prd` § Stories requires fresh state with a missing input for a server, CLI, or API evidence story.
- [ ] `/prd` § Stories requires a no-cost preflight before a live resource.
- [ ] CI passes on the task PR.

## Lessons
