# PRD: README Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As a user, I want a Discussions link in the README so that I can ask questions in public.

**Acceptance Criteria:**

- [ ] Line 341 of `README.md` ends with ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)` after the GitHub issues link.
- [ ] `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`.
- [ ] The `## 🤝 Contributing & community` section keeps the contributing guide link, the GitHub issues link, and the four badge lines unchanged.
- [ ] `CHANGELOG.md` has exactly one new entry for this change under `## [Unreleased]`.
- [ ] The new changelog entry links the issue as `[#<issue-number>](https://github.com/mifunedev/agro/issues/<issue-number>)`.

## Summary

The mifunedev/agro repository has GitHub Discussions with the categories Q&A, Show and tell, and Ideas. The README does not link to Discussions. `git grep -n discussions` returns no match in the repository.

The `## 🤝 Contributing & community` section starts at line 337 of `README.md`. Line 341 holds the text links: `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues)`. The change appends one more link to that line with the same ` · ` separator.

`CHANGELOG.md` follows Keep a Changelog. The `## [Unreleased]` section at line 9 holds `### Added`, `### Removed`, and `### Changed` subsections. Put the new entry under `### Added`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | line 341 in `## 🤝 Contributing & community` | Holds the text links. The change appends the Discussions link. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the user-facing change. |
| `package.json` | `scripts.lint`, `scripts.typecheck`, `scripts.test`, `scripts.build` | Defines the repository checks. Each check must pass. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` | Documentation | Adds one public link to GitHub Discussions. |
| mifunedev/agro-web site | N/A | The issue scopes the change to the repository README. See the open questions. |

## Storage

N/A. The change edits documentation only and stores no state.

## Architectural Decisions

- `README.md` is the single source for the community links. No mirror or generated copy exists.
- The Discussions link goes after the GitHub issues link, as the issue requires.
- The link uses the text `GitHub Discussions` to match the text `GitHub issues`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A | No new test file | A documentation link needs no unit test. The grep checks in US-001 verify the change. |
| `package.json` | `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, `pnpm run build` | The existing checks, including `.agro/cli/src/__tests__/docs.test.ts`, still pass after the edit. |

## Design Principles

- Make the smallest change that satisfies the issue: one README line and one changelog entry.
- Match the existing link style and separator on line 341.
- Add no explanatory comments.

## Out of Scope

- Changes to `docs/contributing.md`.
- New badges for Discussions.
- Configuration of the Discussions categories on GitHub.
- Documentation changes in the mifunedev/agro-web site.

## Open Questions

1. The issue metadata holds the placeholder `[issue#]`. The input filename suggests issue `#1173`. The operator confirms the issue number for the branch `task/<issue-number>-readme-discussions-link` and for the changelog link.
2. The operator confirms that the mifunedev/agro-web site needs no matching Discussions link.

## Acceptance Criteria

- [ ] `README.md` links `https://github.com/mifunedev/agro/discussions` after the GitHub issues link in `## 🤝 Contributing & community`.
- [ ] `CHANGELOG.md` has one entry for this change under `## [Unreleased]`.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` each exit 0.
- [ ] A draft PR from `task/<issue-number>-readme-discussions-link` to `development` exists.

## Lessons

Filled by the advisor before undraft.
