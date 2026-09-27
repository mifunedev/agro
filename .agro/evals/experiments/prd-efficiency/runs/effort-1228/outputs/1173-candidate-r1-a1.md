# PRD: README Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As a user, I want a Discussions link in the README so that I can ask questions and show my setup in public.

**Acceptance Criteria:**

- [ ] `README.md` line 341 in section `## 🤝 Contributing & community` reads `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues) · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)`.
- [ ] `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`.
- [ ] `CHANGELOG.md` holds one new entry under `## [Unreleased]` in the `### Added` subsection, and the entry links the task issue as `([#<issue>](https://github.com/mifunedev/agro/issues/<issue>))`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` each exit 0.

## Summary

GitHub Discussions is live on `mifunedev/agro` with the categories Q&A, Show and tell, and Ideas. The README does not link to Discussions. `README.md:341` holds the contributing guide link and the GitHub issues link, with ` · ` between them. The change appends a third link to that line with the same separator. `CHANGELOG.md:9` opens `## [Unreleased]`, and that section already holds an `### Added` subsection.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | section `## 🤝 Contributing & community`, line 341 | Holds the community links. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` rendered on GitHub | Added link | Adds `[GitHub Discussions](https://github.com/mifunedev/agro/discussions)` after the GitHub issues link. |

## Storage

N/A. The change edits documentation only and stores no state.

## Architectural Decisions

`README.md` stays the source of truth for the community links. The new link reuses the existing ` · ` separator and the `GitHub <noun>` label pattern.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A | `grep -n 'agro/discussions' README.md` before and after the edit | The link is absent before the edit and present once after the edit. A unit test for one README link adds no value. |
| `package.json` scripts | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | The repository stays green. |

## Design Principles

- Make the smallest change that meets the issue.
- Match the existing link style on line 341.
- Add no explanatory comments.

## Out of Scope

- Changes to the public documentation in `mifunedev/agro-web`.
- Discussion category setup or GitHub repository settings.
- Changes to `docs/contributing.md`.
- Badge changes on lines 343 to 346.

## Open Questions

- The issue number is a placeholder `<issue>` in the branch name `task/<issue>-readme-discussions-link` and in the changelog link. The operator supplies the number before conversion to `prd.json`.

## Acceptance Criteria

- [ ] `README.md` links `https://github.com/mifunedev/agro/discussions` after the GitHub issues link in section `## 🤝 Contributing & community`.
- [ ] `CHANGELOG.md` has one new entry under `## [Unreleased]`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` each exit 0.
- [ ] A draft PR exists from `task/<issue>-readme-discussions-link` to `development`.

## Lessons

Filled by the advisor before undraft.
