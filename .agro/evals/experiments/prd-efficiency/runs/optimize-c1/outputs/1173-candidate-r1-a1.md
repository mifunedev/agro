# PRD: README Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As an AGRO user, I want a README Discussions link so that I can ask questions and show my setup in public.

**Acceptance Criteria:**

- [ ] In `README.md`, the `## 🤝 Contributing & community` section links `https://github.com/mifunedev/agro/discussions`.
- [ ] The Discussions link comes after the `[GitHub issues](https://github.com/mifunedev/agro/issues)` link on the same line, with the ` · ` separator.
- [ ] `CHANGELOG.md` has exactly one new entry for this change under `## [Unreleased]`, in the `### Added` subsection.
- [ ] The changelog entry links the GitHub issue for this task in the `([#<N>](https://github.com/mifunedev/agro/issues/<N>))` form.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` each exit 0.

## Summary

GitHub Discussions is active on `mifunedev/agro`. The default categories are Q&A, Show and tell, and Ideas. The README does not link to Discussions.

Verified current state:

- `README.md` line 337 holds the heading `## 🤝 Contributing & community`.
- `README.md` line 341 holds `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues)`.
- `CHANGELOG.md` has a `## [Unreleased]` section with `### Added`, `### Removed`, and `### Changed` subsections.
- No tracked file outside `CHANGELOG.md` and `.agro/tasks` contains the string `discussions`.
- No test asserts the content of the README community section.

Selected approach: append ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)` to line 341 of `README.md`. Add one bullet under `### Added` in `CHANGELOG.md`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | `## 🤝 Contributing & community`, line 341 | Line 341 receives the new link. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the user-facing change. |
| `package.json` | `lint`, `typecheck`, `test`, `build` scripts | Supplies the verification commands. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` community section | Modified | Adds a GitHub Discussions link after the GitHub issues link. |
| `CHANGELOG.md` | Modified | Adds one `### Added` entry under `## [Unreleased]`. |

## Storage

N/A. The change edits documentation only and stores no state.

## Architectural Decisions

- `README.md` stays the single source for the community links.
- The new link uses the same Markdown link form and ` · ` separator as the existing links on line 341.
- The change adds no badge. The badges below line 341 cover external channels, and the issue asks for a text link next to the issues link.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A (no test file) | `grep -n 'https://github.com/mifunedev/agro/discussions' README.md` prints one match on the community link line. | The README links Discussions in the correct section. |
| N/A (no test file) | `pnpm test` exits 0. | The documentation change breaks no existing test. |

No automated test covers README content. A new test for one static link adds machinery with no benefit, so this task adds no test file.

## Design Principles

- Make the smallest change that meets the issue.
- Match the existing link style on the same line.
- Write the changelog entry in the imperative form that the other `## [Unreleased]` entries use.
- Add no code comments and no new files.

## Out of Scope

- Changes to the README header badges.
- Changes to `docs/contributing.md`.
- Changes to the public documentation site in `mifunedev/agro-web`.
- Configuration of GitHub Discussions categories.

## Open Questions

1. The issue metadata uses the placeholder `[issue#]`. The implementer needs the GitHub issue number `<N>` for the branch name `task/<N>-readme-discussions-link` and for the changelog link.
2. Does `mifunedev/agro-web` need a matching Discussions link? This plan treats the public site as out of scope.

## Acceptance Criteria

- [ ] `README.md` links `https://github.com/mifunedev/agro/discussions` in the `## 🤝 Contributing & community` section, after the GitHub issues link.
- [ ] `CHANGELOG.md` has one new entry for this change under `## [Unreleased]`.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` each exit 0.
- [ ] A draft PR from `task/<N>-readme-discussions-link` to `development` exists.

## Lessons

Filled by the advisor before undraft.
