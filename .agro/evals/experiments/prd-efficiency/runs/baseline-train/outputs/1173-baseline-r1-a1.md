# PRD: README Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As an AGRO user, I want a Discussions link in the README so that I can ask questions and show my setup in public.

**Acceptance Criteria:**

- [ ] `README.md` line 341 reads `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues) · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)`.
- [ ] `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`.
- [ ] In `README.md`, the Discussions link comes after the GitHub issues link, and both links sit under the `## 🤝 Contributing & community` heading.
- [ ] `CHANGELOG.md` has exactly one new entry under `## [Unreleased]` → `### Added`. The entry links issue `#1173`.
- [ ] The new `CHANGELOG.md` entry is one sentence in the imperative mood and has 250 characters or fewer.
- [ ] `git diff --stat` for the story lists `README.md` and `CHANGELOG.md` only.

## Summary

The `mifunedev/agro` repository has GitHub Discussions with the default categories Q&A, Show and tell, and Ideas. The README has no link to Discussions.

Verified current state:

- `README.md:337` holds the heading `## 🤝 Contributing & community`.
- `README.md:341` holds `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues)`.
- `README.md`, `docs/`, and `CONTRIBUTING.md` contain no `discussions` link.
- `CHANGELOG.md` has a `## [Unreleased]` section with an `### Added` subsection.
- No test, probe, or script reads the README community section.

Selected approach: append ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)` to `README.md:341`. Add one `### Added` entry to `CHANGELOG.md`. The change uses the existing `·` separator and the existing `GitHub <noun>` link-text pattern.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | `## 🤝 Contributing & community`, line 341 | Holds the new Discussions link. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the user-visible change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` community links | Modify | Add a `GitHub Discussions` link after the `GitHub issues` link. |
| `CHANGELOG.md` | Modify | Add one `### Added` entry that links issue `#1173`. |

## Storage

N/A. The change edits documentation only and persists no data.

## Architectural Decisions

- **Source of truth**: `README.md` in `mifunedev/agro` owns the community links.
- **State management**: N/A. The change holds no state.
- **Auth / scoping**: N/A. The Discussions page is public.
- **Execution location**: The application agent edits the two files in the sandbox worktree for branch `task/1173-readme-discussions-link`.
- **Surfaces**:
  - Host and sandbox: applied. The edit occurs in the sandbox worktree.
  - Lifecycle door: not applicable. No `agro` verb changes.
  - Canonical and provider surfaces: not applicable. No `.agro/` primitive changes.
  - Root and scaffold: applied to the root `README.md` only.
  - Interactive and headless processes: not applicable. No process starts.
  - Local and remote operation: not applicable. No runtime behavior changes.
  - Parallel operation: not applicable. One story edits two files.
  - Public documentation: see Open Question 1.
  - Verification: applied. See the Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A: shell check | Before the edit, `grep -q 'https://github.com/mifunedev/agro/discussions' README.md` exits 1. After the edit, the same command exits 0. | The Discussions link exists in `README.md`. |
| N/A: shell check | `sed -n '/^## 🤝 Contributing & community/,/^## /p' README.md \| grep -F '[GitHub issues](https://github.com/mifunedev/agro/issues) · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)'` exits 0. | The link sits in the community section after the issues link. |
| `vitest.config.ts` suite | `pnpm test` | No regression in the existing suite. |
| N/A: repository commands | `pnpm lint`, `pnpm typecheck`, `pnpm build` | The repository commands pass. |

The change adds no logic. A new vitest test or eval probe for one README link adds machinery with no behavior to guard. The shell checks above serve as the red and green checks.

## Design Principles

- Make the smallest change that meets the issue: one line in `README.md`, one entry in `CHANGELOG.md`.
- Follow the existing link-line format: `·` separators and `GitHub <noun>` link text.
- Follow the `/git` § Changelog rules: one sentence, imperative mood, 250 characters or fewer, issue link.
- Add no test, probe, or comment for a static link.

## Out of Scope

- Changes to `docs/contributing.md`, `CONTRIBUTING.md`, or the docs index.
- Discussions category setup, templates, or moderation.
- Badge-style links next to the Slack and social badges.
- Changes in `mifunedev/agro-web`.

## Open Questions

1. Does `mifunedev/agro-web` mirror the README community links? If yes, does this task need a matching change there, or a follow-up issue?
   A. No change in `mifunedev/agro-web`.
   B. Open a follow-up issue in `mifunedev/agro-web`.

## Acceptance Criteria

- [ ] `README.md` section `## 🤝 Contributing & community` links `https://github.com/mifunedev/agro/discussions` after the GitHub issues link.
- [ ] `CHANGELOG.md` has one new entry under `## [Unreleased]` that links issue `#1173`.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] A draft PR exists with the title `FROM task/1173-readme-discussions-link TO development`.

## Lessons

Filled by the advisor before undraft.
