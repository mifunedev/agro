# PRD: README GitHub Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As an AGRO user, I want a README link to GitHub Discussions so that I can ask questions and show my setup.

**Acceptance Criteria:**

- [ ] In `README.md`, the `## 🤝 Contributing & community` section contains the link `[GitHub Discussions](https://github.com/mifunedev/agro/discussions)`.
- [ ] The Discussions link follows the GitHub issues link on the same line, separated by ` · `.
- [ ] `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`.
- [ ] `CHANGELOG.md` has exactly one new entry for this change under `## [Unreleased]` in `### Added`.
- [ ] The changelog entry is one imperative sentence of 250 characters or fewer and links `[#1173](https://github.com/mifunedev/agro/issues/1173)`.
- [ ] `git diff --name-only development...HEAD` lists only `README.md`, `CHANGELOG.md`, and files under `.agro/tasks/readme-discussions-link/`.

## Summary

The maintainers enabled GitHub Discussions on `mifunedev/agro` with the default categories Q&A, Show and tell, and Ideas. The README does not link to GitHub Discussions.

Verified current state:

- `README.md` line 337 holds the heading `## 🤝 Contributing & community`.
- `README.md` line 341 holds `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues)`.
- `README.md` contains no `discussions` link.
- `CHANGELOG.md` has a `## [Unreleased]` section with an existing `### Added` subsection.

Selected approach: append ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)` to line 341 of `README.md`. Add one `### Added` entry to `CHANGELOG.md`. The change is one story because the story touches two lines of documentation.

Target line after the change:

```markdown
[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues) · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)
```

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | `## 🤝 Contributing & community`, line 341 | Holds the community link row that receives the Discussions link |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the user-visible change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` community link row | Modify | Add the GitHub Discussions link after the GitHub issues link |
| `CHANGELOG.md` | Modify | Add one `### Added` entry |

## Storage

N/A. The change edits documentation only and persists no data.

## Architectural Decisions

- **Source of truth**: `README.md` owns the community link row. The GitHub repository settings own the Discussions categories.
- **State management**: N/A. The change holds no runtime state.
- **Auth / scoping**: N/A. The Discussions page is public.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A | `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `0` before the edit and `1` after the edit | The README links GitHub Discussions |
| N/A | `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` exit 0 | The documentation change breaks no existing check |

The change adds no logic. A new vitest file or probe for one static link adds maintenance cost. The plan adds no new test.

## Design Principles

- Make the least change that meets the goal: one appended link and one changelog entry.
- Follow the existing link-row format: `[label](url)` items separated by ` · `.
- Follow the `/git` changelog rules: one imperative sentence, 250 characters or fewer, with an issue link.
- Add no tracked comments and no new tests for static documentation.

## Out of Scope

- Changes to the GitHub Discussions categories or repository settings.
- Changes to `docs/contributing.md`, `CONTRIBUTING.md`, or the social badges.
- Changes to the public site in `mifunedev/agro-web`.
- A probe or test that guards the README link.

## Open Questions

1. The issue metadata writes `[issue#]` as a placeholder. This plan takes the issue number `1173` from the input file name `work/issue-1173.md`. The operator confirms `1173` before conversion to `prd.json` with `--issue 1173 --prefix task`.

## Acceptance Criteria

- [ ] US-001 passes every acceptance criterion.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] The branch is `task/1173-readme-discussions-link`.
- [ ] A draft PR exists with the title `FROM task/1173-readme-discussions-link TO development`.

## Lessons

Filled by the advisor before undraft.
