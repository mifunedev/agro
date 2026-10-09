# PRD: The onboarding banner reports each harness from its binary

Status: DRAFT

## User Stories

### US-001: Detect a harness only from its binary

**Description:** As a sandbox user, I want the `agro shell` banner to show the true state of each harness, so that I know which harness to install.

**Acceptance Criteria:**

- [ ] `.agro/install/banner.sh` marks a harness as installed only when an executable file for the harness exists on `PATH`. An alias or a shell function does not count.
- [ ] For `claude`, `codex`, and `pi`, the banner shows `not installed — run: agro harness install <id>` when the binary is absent. The banner shows the authentication state only when the binary exists.
- [ ] For `opencode` and `agy`, the banner shows `not installed` when only an alias exists.
- [ ] The `Recovery commands` line lists only the commands that have a binary.
- [ ] A test in `.agro/scripts/__tests__/boot-banner.test.ts` runs `banner.sh` in an interactive shell with a temporary `HOME`. The test covers a harness with only an alias and a harness with a binary. The test fails before the fix.
- [ ] `pnpm test:scripts` and `pnpm typecheck` exit 0.

### US-002: Record the manual review and retake the quickstart screenshot

**Description:** As a reviewer, I want the banner on a real sandbox before and after the fix, so that I can see the corrected states.

**Acceptance Criteria:**

- [ ] `.agro/tasks/banner-alias-harness/evidence/manual-review.md` holds the banner output from a new exe.dev VM, before and after the fix.
- [ ] If the docs-capture node runs, `docs/img/quickstart-shell.png` shows the corrected banner, as a 1920x1080 PNG, with a `Callouts:` line in `docs/quickstart.md`. If the node does not run, the PR lists the retake as unverified.
- [ ] The VM is destroyed after the run, and the driver log ends with `remaining agro-matrix resources on exedev: 0`.

## Summary

Each interactive shell runs `.agro/install/banner.sh`. The shell defines aliases for `claude`, `codex`, and `agy` in `.agro/install/.zshrc` and in the `.bashrc` that `.devcontainer/Dockerfile` writes. The banner tests `opencode`, `grok`, `agy`, and `hermes` with `command -v`. In an interactive shell, the builtin `command -v` also prints an alias. The banner then marks an alias-only harness as installed. The banner tests `claude`, `codex`, and `pi` only for an authentication file. The banner then shows "not authenticated" for a harness without a binary. The fix adds one helper that accepts only a path from `command -v`. The fix also adds an installed check for `claude`, `codex`, and `pi`.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/install/banner.sh` | the harness status blocks, the `Recovery commands` loop | Harness detection |
| `.agro/install/.zshrc` | the harness aliases | The aliases that cause the false result |
| `.agro/scripts/__tests__/boot-banner.test.ts` | banner tests | The test file |
| `docs/img/quickstart-shell.png` | screenshot | Shows the banner |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| The onboarding banner of `agro shell` | Behavior fix | Each harness shows its true install state |

## Storage
N/A. The banner reads files and writes nothing.

## Architectural Decisions
The banner keeps one detection helper for every harness and command. The helper accepts only an executable path.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/boot-banner.test.ts` | An alias `agy` with no binary | The banner shows `not installed` for `agy` |
| `.agro/scripts/__tests__/boot-banner.test.ts` | A stub binary `claude` with no authentication file | The banner shows the authentication state for `claude` |
| `.agro/scripts/__tests__/boot-banner.test.ts` | No `codex` binary | The banner shows `not installed` for `codex` |

## Design Principles
Report only what the shell can prove. Keep one detection rule.

## Out of Scope
The aliases stay. The image stays without an agent CLI.

## Open Questions
None

## Acceptance Criteria
- [ ] On a new exe.dev VM, the banner shows `not installed` for each harness without a binary.
- [ ] `pnpm test:scripts` and `pnpm typecheck` exit 0.

## Lessons

Filled by the advisor before undraft.
