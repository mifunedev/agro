# PRD: Slack manifest YAML

Status: DRAFT

## User Stories

### US-001: Replace the JSON manifest with YAML and guard the YAML in the probe

**Description:** As a Pi bridge operator, I want a YAML Slack app manifest so that I can paste the YAML into Slack unchanged.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` exists, and `.pi/install/slack-manifest.json` does not exist.
- [ ] `perl -MCPAN::Meta::YAML -MJSON::PP -e 'print JSON::PP->new->canonical->encode(CPAN::Meta::YAML->read(shift)->[0])' .pi/install/slack-manifest.yaml` exits 0 and prints one JSON object.
- [ ] The parity check exits 0. The check compares the YAML output above with `git show <base-commit>:.pi/install/slack-manifest.json`. The check converts JSON booleans to strings on both sides with `jq -S 'walk(if type=="boolean" then tostring else . end)'`.
- [ ] In the YAML file, each boolean value is an unquoted `true` or `false`, and the `background_color` value `#1a1a2e` is in quotes.
- [ ] `.agro/evals/probes/slack-admin-command-surface.sh` sets `MANIFEST` to `.pi/install/slack-manifest.yaml`.
- [ ] The probe parses the manifest as YAML. The probe asserts `message.im` in `settings.event_subscriptions.bot_events`. The probe asserts each of the seven admin commands in `features.slash_commands[].command`.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] Fault injection: in a disposable copy, the probe exits 1 when one admin command is removed from the YAML. The probe also exits 1 when the YAML does not parse.

### US-002: Point active documentation to the YAML manifest

**Description:** As a Pi bridge operator, I want each setup document to name the YAML manifest so that I copy the file that exists.

**Acceptance Criteria:**

- [ ] `README.md`, `.pi/install/README.md`, `docs/connecting.md`, `docs/integrations/slack.md`, and `docs/harnesses/pi.md` name `.pi/install/slack-manifest.yaml` at each current manifest reference.
- [ ] `docs/integrations/slack.md` step 2.3 tells the operator to paste the YAML contents. The step names the YAML tab of the Slack manifest editor as `<Slack editor format label>` until the operator confirms the label.
- [ ] `git grep -n 'slack-manifest.json' -- . ':!CHANGELOG.md' ':!.agro/tasks/archive' ':!.agro/tasks/slack-manifest-yaml' ':!work'` prints no line and exits 1.
- [ ] `CHANGELOG.md` has one entry under `## [Unreleased]` that names the YAML manifest and issue #1177.

## Summary

Verified current state:

- `.pi/install/slack-manifest.json` is the only Slack app manifest. The file declares Socket Mode, 13 bot scopes, 4 bot events, and 7 admin slash commands: `/help`, `/trusted`, `/revoke`, `/channels`, `/enable`, `/disable`, `/toggletools`.
- Six tracked files outside history name the JSON path: `.agro/evals/probes/slack-admin-command-surface.sh`, `.pi/install/README.md`, `README.md`, `docs/connecting.md`, `docs/integrations/slack.md` (five lines), and `docs/harnesses/pi.md`.
- `CHANGELOG.md` line 600 and `.agro/tasks/archive/2026-09-21/retire-open-harness-name/` name the JSON path as history. This task keeps those lines.
- The probe checks the manifest with `grep -F` against JSON literals such as `"command": "/help"`. These literals do not match YAML.
- The repository and the sandbox have no `yq`, no PyYAML, and no Node YAML package. Perl core ships `CPAN::Meta::YAML` and `JSON::PP`. Both modules load in the sandbox.

Selected approach:

1. Write `.pi/install/slack-manifest.yaml` with the same keys, values, and key order as the JSON file. Delete the JSON file with `git rm`.
2. Change the probe to convert the YAML to JSON with Perl core modules. The probe then asserts structure with `jq`.
3. Update each active document reference.

The Pi runtime JSON files `.pi/settings.json` and `.pi/msg-bridge.json` stay unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/slack-manifest.json` | whole file | Current manifest. The task deletes the file. |
| `.pi/install/slack-manifest.yaml` | whole file | New manifest. The task creates the file. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST`, manifest `need_literal` block | Guards the manifest events and admin commands. |
| `.pi/install/README.md` | asset table | Lists the manifest file. |
| `README.md` | `#### Pi` section | Links the manifest for Slack app creation. |
| `docs/integrations/slack.md` | sections 2, 4, 6, troubleshooting table | Setup and recovery steps that name the manifest. |
| `docs/connecting.md` | Slack Pi paragraph | Names the manifest. |
| `docs/harnesses/pi.md` | Slack paragraph | Names the manifest. |
| `CHANGELOG.md` | `## [Unreleased]` | Records the rename. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `.pi/install/slack-manifest.yaml` | Added | The operator pastes this file into the Slack "From an app manifest" flow. |
| `.pi/install/slack-manifest.json` | Removed | The path stops resolving. Existing Slack apps keep their current configuration. |
| Slack app permissions and commands | Unchanged | Scopes, events, commands, and settings keep the same values. |
| Public docs in `mifunedev/agro-web` | Changed | The public Slack page names the YAML path. See Open Questions. |

## Storage

N/A. The task changes a tracked static file and adds no persistent state.

## Architectural Decisions

- The YAML file is the single source of truth for the Slack app manifest. The task keeps no JSON copy.
- The probe parses the YAML with Perl core modules. The probe adds no package dependency to the repository or the sandbox image.
- `CPAN::Meta::YAML` reads `true` and `false` as strings. The probe compares string values, and the parity check converts JSON booleans to strings before the comparison.
- The YAML file quotes `#1a1a2e` because an unquoted `#` starts a YAML comment.
- The implementer writes the YAML by hand or reviews generated YAML. The `CPAN::Meta::YAML` writer quotes `'false'`, and Slack then reads a string, not a boolean.
- The YAML file uses block mappings and block sequences only. `CPAN::Meta::YAML` does not read flow style or anchors.
- Surfaces: host and sandbox — applied: the implementer edits files in the sandbox. Lifecycle door — not applicable: no `agro` verb reads the manifest. Canonical and provider surfaces — not applicable: `.pi/install/` is not a provider mirror. Root and scaffold — applied: initialized projects copy `.pi/install/` with the repository. Interactive and headless processes — not applicable: the `client-slack-pi` session does not read the manifest. Local and remote operation — not applicable. Parallel operation — not applicable: one worker owns each story, and the file sets do not overlap. Public documentation — applied. Verification — applied.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Change the probe first. The probe must exit 1 while only the JSON file exists. The probe must exit 0 after the YAML file lands. | The probe reads the YAML manifest. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Remove `/toggletools` from a disposable copy. The probe exits 1 and names `/toggletools`. | The probe detects a missing admin command. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Write invalid YAML to a disposable copy. The probe exits 1 and names the parse failure. | The probe does not pass on an unreadable manifest. |
| Parity command in US-001 | Compare the YAML output with `git show <base-commit>:.pi/install/slack-manifest.json`. | The YAML keeps each field and each value. |
| `bash .agro/skills/eval/run.sh` | Full probe suite. | No other probe regresses. |
| `pnpm run typecheck`, `pnpm test:scripts` | CI harness checks. | Repository checks pass. |

## Design Principles

- Keep one source of truth for each behavior. The YAML manifest replaces the JSON manifest and leaves no dormant copy.
- Add no dependency. Perl core modules parse the YAML.
- Assert structure, not formatting. The probe checks parsed values, not literal text.
- Do not add explanatory comments to tracked code or to the manifest.

## Out of Scope

- A change to any scope, event, command, or setting in the manifest.
- A change to `.pi/settings.json`, `.pi/msg-bridge.json`, or other Pi runtime JSON.
- A rewrite of historical lines in `CHANGELOG.md` or in `.agro/tasks/archive/`.
- An update to Slack apps that operators already created.

## Open Questions

1. Does the operator want the `mifunedev/agro-web` Slack page updated in this task or in a follow-up issue?
2. What label does the Slack manifest editor show for the YAML format? The plan uses `<Slack editor format label>` until the operator confirms the label.

## Acceptance Criteria

- [ ] `.pi/install/slack-manifest.yaml` parses, and the parity check against the base JSON manifest exits 0.
- [ ] `.pi/install/slack-manifest.json` does not exist.
- [ ] The `git grep` command in US-002 prints no active reference to `slack-manifest.json`.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `pnpm run typecheck` exits 0, and `pnpm test:scripts` exits 0.
- [ ] `.pi/settings.json` and `.pi/msg-bridge.json` show no diff against the base commit.

## Lessons

Filled by the advisor before undraft.
