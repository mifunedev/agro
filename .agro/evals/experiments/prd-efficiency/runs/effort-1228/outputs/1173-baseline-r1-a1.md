# PRD: README Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As an AGRO user, I want a Discussions link in the README so that I can ask questions and show my setup in public.

**Acceptance Criteria:**

- [ ] In `README.md`, line 341 under `## 🤝 Contributing & community` reads `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues) · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)`.
- [ ] `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`.
- [ ] `git diff --stat` on the task branch lists only `README.md`, `CHANGELOG.md`, and files under `.agro/tasks/readme-discussions-link/`.
- [ ] `CHANGELOG.md` holds exactly one new bullet for this task under `## [Unreleased]` in the `### Added` group, and the bullet links `https://github.com/mifunedev/agro/issues/<issue-number>`.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` each exit 0.

## Summary

GitHub Discussions now runs on `mifunedev/agro` with the default categories Q&A, Show and tell, and Ideas. The README gives no link to it.

Verified current state:

- `README.md:337` holds the heading `## 🤝 Contributing & community`.
- `README.md:341` holds one line with two links, separated by ` · `: the contributing guide and the GitHub issues page.
- `CHANGELOG.md:9` holds `## [Unreleased]`, and `CHANGELOG.md:11` holds its `### Added` group.
- No test, probe, or workflow reads the text of the community section. `git grep` for `Contributing & community` and for `discussions` matches only `README.md:337`.

Selected approach: append ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)` to `README.md:341`, after the issues link. Add one `### Added` bullet to `CHANGELOG.md`. One story covers both edits, because the change fits in one short session.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | `## 🤝 Contributing & community`, line 341 | Holds the community links. The new link goes after the issues link. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the user-facing change. |
| `package.json` | `scripts.lint`, `scripts.typecheck`, `scripts.test`, `scripts.build` | Defines the verification commands. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` community section | Additive | Adds one Markdown link to `https://github.com/mifunedev/agro/discussions`. |
| `CHANGELOG.md` | Additive | Adds one bullet under `## [Unreleased]` → `### Added`. |

## Storage

N/A. The change edits two Markdown files and stores no state.

## Architectural Decisions

- `README.md` stays the single source of the community links. The plan adds no second copy.
- Affected surfaces:
  - Host and sandbox: applied. The application agent edits the files inside the sandbox.
  - Lifecycle door: not applicable. No `agro` verb changes.
  - Canonical and provider surfaces: not applicable. The change touches no `.agro/` primitive.
  - Root and scaffold: applied to the root `README.md` only. Initialized projects do not copy this section.
  - Interactive and headless processes: not applicable. The task starts no process.
  - Local and remote operation: not applicable. The task starts no process.
  - Parallel operation: applied. The worker edits in its own worktree on the task branch.
  - Public documentation: see Open Questions for `mifunedev/agro-web`.
  - Verification: applied. See the Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A (shell check) | `grep -n 'agro/issues) · \[GitHub Discussions\](https://github.com/mifunedev/agro/discussions)' README.md` prints line 341 | The link sits after the issues link in the community section. Red before the edit, green after the edit. |
| N/A (shell check) | `sed -n '9,20p' CHANGELOG.md` shows the new bullet under `### Added` | The changelog entry exists in the correct group. |
| `package.json` scripts | `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build` | The repository checks stay green. |

No new automated test. A Markdown link needs no unit test, and a probe that pins README text adds maintenance cost with no behavior to guard.

## Design Principles

- Make the smallest realistic change: one link and one changelog bullet.
- Match the existing link style: Markdown text links separated by ` · `.
- Add no code comments and no new machinery.

## Out of Scope

- Discussion category setup, templates, or moderation settings on GitHub.
- Links to Discussions from `CONTRIBUTING.md`, `docs/contributing.md`, or issue templates.
- Changes to the badge row for Slack, X, Instagram, and LinkedIn.

## Open Questions

2. Does `mifunedev/agro-web` need a matching Discussions link? The plan assumes no change in `mifunedev/agro-web`.
2. Does `mifunedev/agro-web` need a matching Discussions link? This plan assumes no change there.

## Acceptance Criteria

- [ ] `README.md:341` ends with ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)`.
- [ ] `CHANGELOG.md` holds exactly one new `### Added` bullet under `## [Unreleased]` for this task.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` each exit 0.
- [ ] A draft PR from `task/<issue-number>-readme-discussions-link` to `development` exists.

## Lessons

Filled by the advisor before undraft.
