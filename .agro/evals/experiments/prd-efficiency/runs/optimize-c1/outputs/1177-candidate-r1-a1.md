# PRD: Slack manifest as YAML

Status: DRAFT

## User Stories

### US-001: Replace the Slack manifest JSON with YAML

**Description:** As a Pi bridge operator, I want a YAML Slack app manifest so that I can paste it into Slack. The permissions and commands stay the same.

**Acceptance Criteria:**

- [ ] The new file `.pi/install/slack-manifest.yaml` exists and git tracks it.
- [ ] No file exists at `.pi/install/slack-manifest.json` in the working tree or in the index.
- [ ] A YAML parser loads `.pi/install/slack-manifest.yaml` without an error.
- [ ] The parsed YAML object deep-equals the JSON object from `git show <base-commit>:.pi/install/slack-manifest.json`. The implementer records the comparison command and its exit status in `progress.txt`.
- [ ] The YAML keeps each of the 7 slash commands (`/help`, `/trusted`, `/revoke`, `/channels`, `/enable`, `/disable`, `/toggletools`), each of the 13 bot scopes, and each of the 4 bot events.
- [ ] The YAML writes `background_color` as a quoted string, so that YAML does not read `#1a1a2e` as a comment.
- [ ] The YAML writes each `usage_hint` value as a quoted string, so that `<chatId> <all|mentions|trusted-only>` keeps its exact characters.

### US-002: Point the eval probe at the YAML manifest

**Description:** As a harness maintainer, I want the Slack admin command probe to check the YAML manifest so that the probe guards the pasted file.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/slack-admin-command-surface.sh` sets `MANIFEST` to the path of `.pi/install/slack-manifest.yaml`.
- [ ] The probe checks the DM event subscription and each of the 7 admin commands with literals in the YAML form of the manifest.
- [ ] The probe returns REGRESSION when `.pi/install/slack-manifest.json` exists.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0 on the changed tree.
- [ ] In a disposable copy, the implementer deletes the `/toggletools` entry from the YAML. The probe then exits 1 and names `/toggletools`. The implementer records this fault-injection result in `progress.txt`.

### US-003: Point the active documentation at the YAML manifest

**Description:** As a Pi bridge operator, I want each active document to name the YAML manifest so that I open a file that exists.

**Acceptance Criteria:**

- [ ] `README.md`, `docs/connecting.md`, `docs/harnesses/pi.md`, `docs/integrations/slack.md`, and `.pi/install/README.md` name `.pi/install/slack-manifest.yaml` or `slack-manifest.yaml` in place of the JSON name.
- [ ] `git grep -n 'slack-manifest.json' -- ':!CHANGELOG.md' ':!.agro/tasks'` prints no line.
- [ ] `CHANGELOG.md` keeps its historical `slack-manifest.json` line (line 600 at the base commit) unchanged.
- [ ] `CHANGELOG.md` has a new `### Changed` entry under `## [Unreleased]` that names `.pi/install/slack-manifest.yaml` and the issue link for #1177.

## Summary

Verified current state:

- git tracks `.pi/install/slack-manifest.json`. The file holds `display_information`, `features` (`app_home`, `bot_user`, 7 `slash_commands`), `oauth_config.scopes.bot` (13 scopes), and `settings` (4 `bot_events`, interactivity, org deploy, Socket Mode, token rotation).
- `git grep -n slack-manifest` finds these active references: `.agro/evals/probes/slack-admin-command-surface.sh:12`, `.pi/install/README.md:8`, `README.md:230`, `docs/connecting.md:299`, `docs/harnesses/pi.md:149`, and `docs/integrations/slack.md` lines 42, 66, 109, 301, and 354.
- `CHANGELOG.md:600` holds a historical reference. This plan keeps that line.
- The probe matches JSON literals such as `"message.im"` and `"command": "/help"`. These literals do not occur in YAML block style.
- The CI job `eval-probes` in `.github/workflows/ci-harness.yml` runs `bash .agro/skills/eval/run.sh`. The job runs the changed probe.
- The Pi runtime JSON files `.pi/settings.json` and `.pi/msg-bridge.json` are not Slack manifests. This plan does not change them.

Selected approach: convert the manifest to YAML block style with the same keys, values, and key order. Delete the JSON file in the same commit. Update the probe literals to the YAML form. Update each active document reference.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| new file `.pi/install/slack-manifest.yaml` | Slack app manifest | Replaces the JSON manifest. |
| `.pi/install/slack-manifest.json` | Slack app manifest | Deleted by US-001. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST`, `need_literal` calls for `message.im` and each admin command | Guards the manifest content. |
| `.pi/install/README.md` | asset table row | Names the manifest file. |
| `README.md` | Pi Slack setup link, line 230 | Links the manifest. |
| `docs/connecting.md` | line 299 | Names the manifest path. |
| `docs/harnesses/pi.md` | line 149 | Names the manifest path. |
| `docs/integrations/slack.md` | lines 42, 66, 109, 301, 354 | Names the manifest path in setup and troubleshooting. |
| `CHANGELOG.md` | `## [Unreleased]` | Records the change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slack app manifest file | Format change | The operator pastes YAML in place of JSON. Slack's "From an app manifest" screen accepts both formats. |
| Documentation links | Path change | Each active link and path names the YAML file. |
| Public documentation in `mifunedev/agro-web` | Possible path change | The Slack integration page can name the JSON path. See Open Questions. |

## Storage

N/A. The change replaces one tracked static file. No runtime state changes.

## Architectural Decisions

- The YAML file is the single source of truth for the Slack manifest. No JSON copy remains.
- The implementer deletes the JSON file. No compatibility symlink or generated mirror remains.
- The probe checks literals with `grep`, as the current probe does. The probe adds no parser dependency, because the `eval-probes` CI job does not install a YAML parser.
- Pi runtime JSON configuration stays JSON.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Red first: point `MANIFEST` at the YAML path and change the literals before the YAML file exists; the probe exits 1 with "missing Slack manifest". Green: add the YAML file; the probe exits 0. | US-001, US-002 |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Fault injection: remove `/toggletools` from a disposable copy; the probe exits 1. Restore a JSON file in a disposable copy; the probe exits 1. | US-002 |
| One-time comparison, recorded in `progress.txt` | Parse the YAML and the base-commit JSON; compare the two objects for deep equality. | US-001 |
| `bash .agro/skills/eval/run.sh` | The full probe suite reports no new REGRESSION. | Repository checks |
| `pnpm test` | The vitest suite passes. | Repository checks |

## Design Principles

- Code is the source of truth. The probe asserts the manifest content. Prose does not.
- Keep one source of truth for each artifact. Delete the obsolete JSON path.
- Apply the smallest change. Do not change Slack scopes, commands, events, or settings.
- Pin short literals in the probe, as `.agro/evals/AGENTS.md` requires.

## Out of Scope

- Changes to Slack permissions, scopes, events, or slash commands.
- Changes to `.pi/settings.json`, `.pi/msg-bridge.json`, or other Pi runtime JSON.
- Rewrites of historical `CHANGELOG.md` entries or archived task files.
- A new YAML parser dependency in `package.json`.

## Open Questions

1. Which YAML parser does the implementer use for the one-time equality check? The sandbox has no `yq` and no Python `yaml` module. `pnpm-lock.yaml` lists `yaml@2.9.0` only as a transitive package. Default: run the check with a temporary parser outside the repository, and record the command in `progress.txt`.
2. Does the public site `mifunedev/agro-web` name `.pi/install/slack-manifest.json`? If yes, the operator opens a matching change in that repository. This plan does not include that change.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no new REGRESSION against the base commit.
- [ ] `pnpm test` exits 0.
- [ ] `git grep -n 'slack-manifest.json' -- ':!CHANGELOG.md' ':!.agro/tasks'` prints no line.

## Lessons

Filled by the advisor before undraft.
