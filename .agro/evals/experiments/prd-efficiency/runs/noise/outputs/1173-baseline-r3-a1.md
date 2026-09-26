# PRD: README GitHub Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As an AGRO user, I want a Discussions link in the README so that I can ask questions and show my setup in public.

**Acceptance Criteria:**

- [ ] The link row of `README.md` in the section `## 🤝 Contributing & community` reads `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues) · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)`.
- [ ] `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`.
- [ ] `git diff --numstat development -- README.md` prints `1	1	README.md`.
- [ ] `CHANGELOG.md` has exactly one new entry for this change under `## [Unreleased]` in the `### Added` category.
- [ ] The new `CHANGELOG.md` entry is one imperative sentence, holds 250 characters or fewer, and links `https://github.com/mifunedev/agro/issues/1173`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` each exit 0 in the sandbox.

## Summary

The `mifunedev/agro` repository has GitHub Discussions turned on. The default categories are Q&A, Show and tell, and Ideas. The README does not link to Discussions.

Verified current state:

- `README.md` line 337 holds the heading `## 🤝 Contributing & community`.
- `README.md` line 341 holds the link row `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues)`.
- Lines 343 to 346 hold the Slack, X, Instagram, and LinkedIn badges.
- `CHANGELOG.md` has a `## [Unreleased]` section with an `### Added` category.
- No test and no probe under `.agro/evals/probes/` asserts the content of the README link row.

Selected approach: the application agent appends ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)` to the link row on line 341. The link uses the same `·` separator as the existing links. The badge rows stay unchanged. The agent then adds one `### Added` entry to `CHANGELOG.md` in the same commit.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | section `## 🤝 Contributing & community`, link row on line 341 | Receives the Discussions link. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the user-visible change. |
| `.agro/skills/git/SKILL.md` | § Changelog | Defines the entry format: one imperative sentence, 250 characters or fewer, with an issue link. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` on GitHub | Content addition | Adds one link to `https://github.com/mifunedev/agro/discussions`. |

## Storage

N/A. The change edits Markdown only and adds no persistent state.

## Architectural Decisions

- `README.md` stays the source of truth for the community links in this repository.
- The Discussions link joins the text link row, not the badge rows. The issue asks for the link next to the contributing guide and the issues links.
- The change needs no auth, scoping, or state management.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A | No new test file. The change is static Markdown, and no existing test covers the README link row. A new probe adds machinery with no regression value (YAGNI). | — |
| `README.md` (command check) | `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`. | The link exists once. |
| `README.md` (command check) | `sed -n '/^## 🤝 Contributing & community/,/^## 📄 License/p' README.md` shows the Discussions link after the GitHub issues link. | The link sits in the correct section and position. |
| Existing suite | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | The change breaks no existing check. |

## Design Principles

- Make the smallest realistic change: one edited line in `README.md` and one entry in `CHANGELOG.md`.
- Match the existing link-row format and the `·` separator.
- Add no comments, probes, or tests without regression value.
- The application agent edits the files inside the sandbox. The root orchestrator does not write the change.

Surface review:

- Host and sandbox: applied. The application agent edits the files and runs the checks in the sandbox.
- Lifecycle door: not applicable. No `agro` verb changes.
- Canonical and provider surfaces: not applicable. No `.agro/` primitive changes.
- Root and scaffold: applied to the root `README.md` only.
- Interactive and headless processes: not applicable. No process starts.
- Local and remote operation: not applicable.
- Parallel operation: applied. The work runs on the branch `task/1173-readme-discussions-link` in its own worktree.
- Public documentation: not applicable to this task. See Out of Scope.
- Verification: applied. See the Test Plan.

## Out of Scope

- Changes to `mifunedev/agro-web`.
- Changes to `docs/contributing.md` or `CONTRIBUTING.md`.
- A new badge for GitHub Discussions.
- Configuration of Discussions categories on GitHub.
- A new test or probe for README links.

## Open Questions

1. The issue metadata holds the placeholder `[issue#]`. This plan uses issue number `1173` from the input filename `work/issue-1173.md`. The operator confirms `1173` before conversion to `prd.json`.
2. Must `docs/contributing.md` or `mifunedev/agro-web` also link Discussions? This plan leaves both unchanged.

## Acceptance Criteria

- [ ] `README.md` section `## 🤝 Contributing & community` links `https://github.com/mifunedev/agro/discussions` after the GitHub issues link.
- [ ] `CHANGELOG.md` has one new entry for this change under `## [Unreleased]`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` each exit 0.
- [ ] A draft PR titled `FROM task/1173-readme-discussions-link TO development` is open.

## Lessons

Filled by the advisor before undraft.
