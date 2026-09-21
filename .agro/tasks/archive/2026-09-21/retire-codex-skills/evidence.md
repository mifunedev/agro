# Codex skill retirement evidence

## Why this is better than not doing it
The supported skill surfaces no longer include the redundant `.codex/skills` link. Codex uses `.agents/skills`; `.agro/skills` remains canonical. The production change reuses two existing retirement tables and adds no migration algorithm. Skill-discovery behavior is verified through filesystem tests, not a live Codex inference session.

## What the plan asked for
Retire `.codex/skills`, preserve discovery and user content, update tests and current documentation, and open a PR without merging.

## What was built
- Removed the tracked `.codex/skills` link. Other Codex files remain unchanged.
- Provider initialization repairs `.agents/skills` before retiring a known Codex link to `.codex/skills.migrated`.
- `agro migrate` uses the existing Pi retirement rules. Unsafe replacement discovery keeps the old path; legacy pack links are re-pointed during namespace migration. Custom paths remain unchanged. Retirement-marker collisions are not overwritten.
- Updated current docs, CLI help, changelog, and the lifecycle knowledge index. Historical snapshots remain unchanged.

### Verification at content commit `026dd1f357924e7aecca29e6721968b2392e6d18`
| Check | Observed result |
|---|---|
| Three migration/provider Vitest suites | 115 passed; 3 files passed |
| `pnpm run typecheck` | Exit 0 |
| `pnpm run build:harness` | Exit 0; built `dist/agro.js` |
| `pnpm test:scripts` | 1369 passed; 2 failed; 77 files passed and 1 failed |
| Unchanged-base Docker rehearsal suite | The same two `agro ps` / `oh ps` assertions failed at line 197; 4 passed |
| Full eval against same-environment base scoreboard | Exit 0; 146 probes; no new regressions |
| Neutral clean-clone `skills-vendored.sh` | PASS, including fresh clone and Hermes presence checks |
| Reintroduce `.codex/skills` in a disposable clone | Exit 1: `.codex/skills is a retired provider surface` |
| `wiki-readme-index.sh` | PASS after index regeneration |
| `git diff --check` | Exit 0 |
| Independent review | No blocking findings at the content commit |

The neutral clone run unsets `CC_SAFETY_NET_STRICT` and `HERMES_HOME` only for the probe process. The probe intentionally supplies a bare PATH and temporary clone. Inherited sandbox overrides cause the same failures on the unchanged base. No guard configuration or shared environment was changed.

### Knowledge impact
| Page | State |
|---|---|
| `oh-cli-portable-lifecycle` | UPDATED: retirement contract and index match the implementation |
| `compose-env-boundary` | NOT-AFFECTED: its linker dependency documents Hermes runtime-home behavior, which is unchanged |
| `fresh-machine-setup` | NOT-AFFECTED: its linker dependency documents Hermes onboarding and home reconciliation, which are unchanged |

## Where the implementation diverged
None. Existing CLI and Bash migration behavior intentionally differs: CLI migration preserves custom paths; provider initialization refuses conflicts.

## What remains unverified
- Local full-suite green is blocked by two Docker rehearsal failures reproduced on the unchanged base.
- Three inherited-environment probe failures reproduce on the base: `curl-bash-safe-alternatives` (missing `python3`), `oh-config-surfaces`, and `skills-vendored`. The latter passes with neutral clone settings.
- CI is tracked on PR #1035; this artifact does not claim CI passed before it finishes.
- No live Codex inference session, Docker image rebuild, or separate `mifunedev/agro-web` deployment was performed.
- The reviewer suggested consolidating overlapping Pi test coverage as a nonblocking follow-up. The runtime implementation is already minimal.
