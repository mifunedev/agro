# PRD: Slack manifest as YAML

Status: DRAFT

## User Stories

### US-001: Replace the JSON Slack manifest with YAML

**Description:** As a Pi bridge operator, I want a YAML Slack app manifest. I can then paste the manifest into Slack with no change to permissions or commands.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` exists, and `.pi/install/slack-manifest.json` does not exist.
- [ ] A YAML parser loads `.pi/install/slack-manifest.yaml` into a value that deep-equals the parsed content of `git show HEAD:.pi/install/slack-manifest.json`.
- [ ] The YAML file declares the 7 slash commands `/help`, `/trusted`, `/revoke`, `/channels`, `/enable`, `/disable`, and `/toggletools`, with the same `description`, `usage_hint`, and `should_escape` values.
- [ ] The YAML file declares the same 13 bot scopes and the same 4 bot events, including `message.im`.
- [ ] The YAML file quotes each value that YAML would otherwise read as a different type, such as `"#1a1a2e"` and each `/command` or `<...>` string.

### US-002: Point the docs and the probe at the YAML manifest

**Description:** As a Pi bridge operator, I want each active doc and the Slack probe to name the YAML manifest. No instruction then points at a removed file.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/slack-admin-command-surface.sh` sets `MANIFEST` to `$ROOT/.pi/install/slack-manifest.yaml`.
- [ ] The probe matches the YAML forms `message.im` and `command: /<name>` for each of the 7 commands.
- [ ] Before the probe change lands, a disposable copy of the YAML manifest without `/toggletools` makes the probe exit 1 with a message that names `/toggletools`.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] `README.md`, `docs/connecting.md`, `docs/harnesses/pi.md`, `docs/integrations/slack.md`, and `.pi/install/README.md` name `slack-manifest.yaml`.
- [ ] `git grep -n 'slack-manifest.json' -- ':!CHANGELOG.md' ':!.agro/tasks/archive'` prints no line.

## Summary

The tracked Slack app manifest is `.pi/install/slack-manifest.json`. Slack accepts a manifest in JSON or YAML. The operator wants YAML.

The implementation owner converts the manifest to `.pi/install/slack-manifest.yaml` and deletes the JSON file. The owner keeps each key and each value. The owner then updates each active reference. The probe `slack-admin-command-surface.sh` reads the manifest with `grep -F`, so the probe literals change from the JSON form to the YAML form.

Pi runtime JSON configuration stays JSON. `.pi/settings.json` and `.pi/msg-bridge.json` do not change.

Historical records keep the old path. `CHANGELOG.md` line 600 and the archived task files under `.agro/tasks/archive/2026-09-21/retire-open-harness-name/` describe past state.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/slack-manifest.json` | whole file | Current manifest. The task deletes this file. |
| `.pi/install/slack-manifest.yaml` | whole file | New manifest. The task adds this file. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST`, `need_literal` calls for `message.im` and each command | Probe that guards the manifest admin commands. |
| `.pi/install/README.md` | line 8 table row | Index of the install directory. |
| `README.md` | line 230 | Links the manifest. |
| `docs/connecting.md` | line 299 | Names the manifest in the Slack setup. |
| `docs/harnesses/pi.md` | line 149 | Names the manifest in the Pi harness doc. |
| `docs/integrations/slack.md` | lines 42, 66, 109, 301, 354 | Slack setup and troubleshooting. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `.pi/install/slack-manifest.yaml` | Rename and format change | The operator pastes this file into the Slack "From an app manifest" flow. |
| Public docs at `mifunedev/agro-web` | Possible follow-up | The `/docs/integrations/slack` page can name the JSON file. See Open Questions. |

## Storage

N/A. The manifest is a tracked static file. The task adds no persistent state.

## Architectural Decisions

- The YAML file is the one source of truth for the Slack app manifest. No JSON copy remains.
- The task keeps the manifest content byte-for-byte equal in meaning. The task changes no scope, event, command, or setting.
- The probe keeps text-literal checks. The probe adds no YAML parser dependency, because the sandbox has no `yq` and no Python `yaml` module.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Manifest file exists; `message.im` present; each of 7 `command: /<name>` literals present | YAML manifest keeps the admin commands and the DM event. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Fault injection with a copy that lacks `/toggletools` | The probe exits 1 and names the missing command. |
| `<yaml parse-equivalence command>` | Parse the YAML file. Parse `git show HEAD:.pi/install/slack-manifest.json`. Compare the two values. | The conversion keeps each field and each value. |
| `git grep -n 'slack-manifest.json'` | Search outside `CHANGELOG.md` and `.agro/tasks/archive` | No active reference points at the removed file. |
| `pnpm test`, `pnpm typecheck`, `/eval` | Full suite | Repository checks pass. |

## Design Principles

- Change the smallest set of files. Convert the format, and change no content.
- Keep one source of truth for the manifest.
- Keep history truthful. Do not rewrite the changelog or archived tasks.
- Add no comments to tracked code.

## Out of Scope

- A change to Pi runtime JSON configuration, such as `.pi/settings.json` or `.pi/msg-bridge.json`.
- A change to Slack scopes, events, commands, or settings.
- An edit to `CHANGELOG.md` history or to archived task files.
- A new YAML parser dependency in the repository.

## Open Questions

2. Does the `mifunedev/agro-web` Slack integration page name `slack-manifest.json`? If the page names the JSON file, the operator opens a matching change in `mifunedev/agro-web`.
2. Does the `mifunedev/agro-web` Slack integration page name `slack-manifest.json`? If yes, the operator opens a matching change in that repository.
3. Does the task add a `CHANGELOG.md` entry for the rename? The default is yes, per `.agro/skills/git/SKILL.md`.

## Acceptance Criteria

- [ ] `.pi/install/slack-manifest.yaml` parses to a value equal to the removed JSON manifest.
- [ ] `git grep -n 'slack-manifest.json' -- ':!CHANGELOG.md' ':!.agro/tasks/archive'` prints no line.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `/eval` reports no REGRESSION.

## Lessons

Filled by the advisor before undraft.
