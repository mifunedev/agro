# PRD: README GitHub Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As an AGRO user, I want a Discussions link in the README so that I can ask questions and show my setup in public.

**Acceptance Criteria:**

- [ ] In `README.md`, the `## 🤝 Contributing & community` section has a link to `https://github.com/mifunedev/agro/discussions`.
- [ ] The Discussions link is on the same line as the `[Contributing guide](docs/contributing.md)` link and the `[GitHub issues](https://github.com/mifunedev/agro/issues)` link. The Discussions link comes after the GitHub issues link, with the ` · ` separator.
- [ ] `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`.
- [ ] `CHANGELOG.md` has one new entry under `## [Unreleased]` that names the Discussions link and links issue `#1173`.
- [ ] The new `CHANGELOG.md` entry is one imperative sentence with 250 characters or fewer.
- [ ] No other line of `README.md` changes.

## Summary

The `mifunedev/agro` repository has GitHub Discussions turned on. Discussions has the categories Q&A, Show and tell, and Ideas. The README does not link to Discussions.

Verified current state:

- `README.md` line 337 holds `## 🤝 Contributing & community`.
- `README.md` line 341 holds `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues)`.
- `CHANGELOG.md` has a `## [Unreleased]` heading with `### Added`, `### Removed`, and `### Changed` subsections.
- No test and no probe under `.agro/evals/probes/` asserts the content of the Contributing & community section.

Selected approach: append ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)` to line 341 of `README.md`. Add one entry under `### Added` in `## [Unreleased]` of `CHANGELOG.md`.

Proposed entry:

```markdown
- Link GitHub Discussions from the README Contributing & community section ([#1173](https://github.com/mifunedev/agro/issues/1173)).
```

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | `## 🤝 Contributing & community`, line 341 | Holds the new Discussions link. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the user-visible change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` on GitHub | Documentation link | Adds a link to `https://github.com/mifunedev/agro/discussions`. |

## Storage

N/A. The change edits documentation only and stores no state.

## Architectural Decisions

- `README.md` stays the source of truth for the community links.
- The link format matches the existing inline links on line 341. The change adds no badge.
- The task branch is `task/1173-readme-discussions-link`. The pull request targets `development`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A | `grep -n 'https://github.com/mifunedev/agro/discussions' README.md` | The link exists once, on the same line as the issues link. |
| N/A | `git diff --stat` | Only `README.md` and `CHANGELOG.md` change, with one line each. |
| `vitest.config.ts` suites | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | The repository commands exit 0 after the change. |

The change adds no code, so the plan adds no new test file.

## Design Principles

- Make the smallest change that meets the issue.
- Match the existing link style in the section.
- Keep one `CHANGELOG.md` entry per user-visible change.
- Apply `/ste` to the changelog entry.

## Out of Scope

- Changes to `docs/contributing.md` or `CONTRIBUTING.md`.
- A Discussions badge in the badge row.
- Configuration of the Discussions categories.
- Changes to `mifunedev/agro-web`.
- The draft pull request. The advisor offers the "Draft PR for a task" procedure in `.agro/skills/git/SKILL.md` after the operator approves this plan.

## Open Questions

1. The issue metadata shows `[issue#]`. The input file name is `issue-1173.md`. This plan uses issue `#1173` for the branch and the changelog link. Confirm the issue number.
2. The issue does not request a Discussions link in `docs/contributing.md` or on the `mifunedev/agro-web` site. This plan excludes both. Confirm the exclusion.

## Acceptance Criteria

- [ ] `README.md` section `## 🤝 Contributing & community` links `https://github.com/mifunedev/agro/discussions` after the GitHub issues link.
- [ ] `CHANGELOG.md` has one new entry under `## [Unreleased]`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` each exit 0.
- [ ] A draft pull request `FROM task/1173-readme-discussions-link TO development` exists after operator approval.

## Lessons

Filled by the advisor before undraft.
