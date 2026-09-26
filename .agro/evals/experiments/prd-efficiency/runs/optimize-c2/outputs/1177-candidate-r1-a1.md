# PRD: Slack app manifest in YAML

Status: DRAFT

## User Stories

### US-001: Convert the Slack manifest to YAML

**Description:** As a Pi bridge operator, I want a YAML Slack manifest so that I can paste it into Slack.

**Acceptance Criteria:**

- [ ] The new file `.pi/install/slack-manifest.yaml` exists and uses YAML block style.
- [ ] The file `.pi/install/slack-manifest.json` is absent from the working tree and from `git ls-files`.
- [ ] A YAML parser loads the new file `.pi/install/slack-manifest.yaml` without error.
- [ ] The parsed YAML value deep-equals the JSON value from `git show HEAD:.pi/install/slack-manifest.json`.
- [ ] The parity command and its exit status appear in `progress.txt` and in the PR body.
- [ ] The YAML keeps the 7 slash commands, the 13 bot scopes, the 4 bot events, and `socket_mode_enabled: true`.

### US-002: Point the probe and the docs at the YAML manifest

**Description:** As a Pi bridge operator, I want every active reference to name the YAML manifest so that no link breaks.

**Acceptance Criteria:**

- [ ] `MANIFEST` in `.agro/evals/probes/slack-admin-command-surface.sh` names the new file `.pi/install/slack-manifest.yaml`.
- [ ] The probe matches the YAML literal `- message.im` for the DM event subscription.
- [ ] The probe matches the YAML literal `command: /<name>` for each of the 7 admin commands.
- [ ] The probe exits 1 with a `REGRESSION:` line when the old JSON manifest exists.
- [ ] A fault-injection run on a disposable copy that removes `command: /toggletools` exits 1 and names the toggletools command.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0 and prints `PASS:`.
- [ ] `.pi/install/README.md`, `README.md`, `docs/connecting.md`, `docs/harnesses/pi.md`, and `docs/integrations/slack.md` name `slack-manifest.yaml`.
- [ ] `git grep -n 'slack-manifest.json' -- ':!CHANGELOG.md' ':!.agro/tasks/archive'` prints no line.
- [ ] `CHANGELOG.md` has one `### Changed` entry under `## [Unreleased]` that names the YAML manifest.

## Summary

The Slack app manifest is JSON at `.pi/install/slack-manifest.json`. Slack accepts JSON and YAML manifests. The issue asks for YAML. The manifest holds `display_information`, `features`, `oauth_config`, and `settings`.

The probe `.agro/evals/probes/slack-admin-command-surface.sh` reads the manifest at line 12. The probe matches JSON literals such as `"message.im"` and `"command": "/help"`. These literals do not match YAML text. The implementer must change the literals to YAML form.

Active references to the JSON manifest exist at these locations:

- `.pi/install/README.md` line 8
- `README.md` line 230
- `docs/connecting.md` line 299
- `docs/harnesses/pi.md` line 149
- `docs/integrations/slack.md` lines 42, 66, 109, 301, and 354

`CHANGELOG.md` line 600 and the archived plans under `.agro/tasks/archive` record history. This task leaves those lines unchanged.

The selected approach: write the YAML by hand from the JSON, prove parity with one parser run, then delete the JSON. Pi runtime JSON files stay unchanged. These files are `.pi/settings.json` and `.pi/msg-bridge.json`.

The host has no YAML parser. `yq` is absent, `python3` has no `yaml` module, and root `package.json` declares no YAML package. See Open Questions.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/slack-manifest.json` | whole file | Source of the values. The task deletes this file. |
| new file `.pi/install/slack-manifest.yaml` | whole file | The Slack app manifest in YAML. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST`, `need_literal` calls | Guards the manifest commands and the DM event. |
| `.pi/install/README.md` | asset table row | Names the manifest asset. |
| `README.md` | line 230 link | Links to the manifest. |
| `docs/connecting.md` | line 299 | Tells the operator which manifest to use. |
| `docs/harnesses/pi.md` | line 149 | Tells the operator which manifest to use. |
| `docs/integrations/slack.md` | lines 42, 66, 109, 301, 354 | Slack setup steps and troubleshooting table. |
| `CHANGELOG.md` | `## [Unreleased]` | Records the change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slack app manifest file | Format change | The operator pastes YAML into the Slack manifest editor. Scopes, events, and commands stay the same. |
| Operator documentation | Path change | Each active doc names `slack-manifest.yaml`. |
| Eval probe | Assertion change | The probe matches YAML literals and rejects the old JSON file. |

## Storage

N/A. The manifest is a static tracked file. The task adds no persistent state.

## Architectural Decisions

- The YAML file is the one source of truth for the Slack app manifest. The task keeps no JSON copy.
- The YAML keeps the key order and the value order of the JSON file. A reviewer can then compare the two files line by line.
- The probe keeps literal `grep` checks. The probe adds no YAML parser dependency.
- The parity proof is a one-time check at implementation time. The repository adds no YAML dependency for it.
- Host and sandbox: the implementer edits and tests inside the sandbox.
- Lifecycle door: not applicable. No `agro` verb reads the manifest.
- Canonical and provider surfaces: not applicable. The `.pi/install` directory holds no generated mirror.
- Public documentation: applied. The mifunedev/agro-web Slack page can name the JSON path. See Open Questions.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Red: point `MANIFEST` at the YAML path before the YAML file exists. The probe exits 1. | The probe detects a missing manifest. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Green: run the probe after the YAML file and the doc edits land. The probe exits 0. | YAML commands, DM event, and docs agree. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Fault: on a disposable copy, delete `command: /toggletools`. The probe exits 1. | The command check names the missing command. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Fault: on a disposable copy, restore the JSON file. The probe exits 1. | The probe rejects the old JSON manifest. |
| `<yaml parity command>` | Load the YAML and the JSON from `HEAD`, then compare the two values. | Every field and every value survives the conversion. |
| `bash .agro/skills/eval/run.sh` | Full probe suite. | No other probe regresses. |
| `pnpm run typecheck`, `pnpm test:scripts` | Repository checks from `.github/workflows/ci-harness.yml`. | Repository checks pass. |

## Design Principles

- Keep one source of truth for each policy and behavior.
- Delete obsolete paths. Leave no dormant JSON copy.
- Add no tracked code comments.
- Pin short semantic fragments in the probe, per `.agro/evals/AGENTS.md`.
- Change only the manifest format. Change no permission, scope, event, or command.

## Out of Scope

- The Pi runtime JSON files `.pi/settings.json` and `.pi/msg-bridge.json`.
- History in `CHANGELOG.md` line 600 and in `.agro/tasks/archive`.
- The generated `.agro/evals/RESULTS.md` row. The eval runner rewrites that row.
- A new YAML dependency in `package.json`.
- Changes to Slack scopes, events, slash commands, or bridge code.

## Open Questions

1. Which parser proves YAML parity? The host has no `yq`, no Python `yaml` module, and no Node YAML package. Options: A. a disposable virtual environment with PyYAML in the sandbox; B. `npx --yes yaml` in the sandbox; C. `<other parser>`. Replace `<yaml parity command>` with the answer.
2. Does the mifunedev/agro-web Slack page name `.pi/install/slack-manifest.json`? On a match, the operator opens a matching change in that repository.

## Acceptance Criteria

- [ ] The new file `.pi/install/slack-manifest.yaml` is tracked, and `.pi/install/slack-manifest.json` is absent.
- [ ] `<yaml parity command>` exits 0 and reports equal values.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] `git grep -n 'slack-manifest.json' -- ':!CHANGELOG.md' ':!.agro/tasks/archive'` prints no line.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `git diff --stat HEAD -- .pi/settings.json .pi/msg-bridge.json` prints no line.

## Lessons

Filled by the advisor before undraft.
