# PRD: README Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As a user, I want a Discussions link in the README so that I can ask questions in public.

**Acceptance Criteria:**

- [ ] Line 341 of `README.md` ends with ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)` after the GitHub issues link.
- [ ] `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`.
- [ ] `CHANGELOG.md` has exactly one new bullet under `## [Unreleased]` in the `### Added` subsection, and the bullet links issue `<N>`.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` each exit 0.

## Summary

GitHub Discussions is active on mifunedev/agro with the categories Q&A, Show and tell, and Ideas. The `## 🤝 Contributing & community` section of `README.md` starts at line 337. Line 341 holds two links separated by ` · `: the contributing guide and the GitHub issues page. No link to Discussions exists. The change appends a third link to line 341 with the same separator. The change also adds one `CHANGELOG.md` bullet under `### Added` in `## [Unreleased]`, in the existing bullet format with an issue link.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | line 341 in `## 🤝 Contributing & community` | Holds the community link row. |
| `CHANGELOG.md` | `### Added` under `## [Unreleased]` | Records the user-facing change. |
| `package.json` | `lint`, `typecheck`, `test`, `build` scripts | Define the gate commands. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` | Documentation link | Adds one GitHub Discussions link. |

## Storage

N/A. The change edits documentation only and stores no state.

## Architectural Decisions

The README link row stays the single source for community links in the README. The new link reuses the ` · ` separator and the `[Label](url)` form of line 341. The change adds no badge, because the badges below line 341 cover external channels only.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A | `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` | The README holds one Discussions link. |
| N/A | `pnpm test` | The existing suite stays green. |

No test file applies, because the change edits Markdown only.

## Design Principles

- Make the smallest realistic change.
- Match the existing link format and separator.
- Add no explanatory comments.

## Out of Scope

- Changes to `docs/contributing.md`.
- Discussion categories, templates, or repository settings.
- Matching changes in mifunedev/agro-web.

## Open Questions

1. The issue number `<N>` for the branch name, the PR title, and the changelog link is absent from the input. The operator supplies `<N>`.
2. Does mifunedev/agro-web need a matching Discussions link? This plan excludes that change.

## Acceptance Criteria

- [ ] `README.md` links `https://github.com/mifunedev/agro/discussions` after the GitHub issues link in `## 🤝 Contributing & community`.
- [ ] `CHANGELOG.md` has one new entry under `## [Unreleased]`.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` each exit 0.
- [ ] A draft PR from task/<N>-readme-discussions-link to development is open.

## Lessons

Filled by the advisor before undraft.
