# PRD: Ship the Pi Slack app manifest as YAML

Status: DRAFT

## User Stories

### US-001: Replace the JSON manifest with a YAML manifest and guard it in the probe

**Description:** As a Pi bridge operator, I want a YAML Slack app manifest so that my app keeps the same permissions and commands.

**Acceptance Criteria:**

- [ ] The file `.pi/install/slack-manifest.yaml` exists, and the file `.pi/install/slack-manifest.json` does not exist.
- [ ] The YAML manifest parses and equals the JSON manifest at commit `3230337`. This command exits 0: `uvx --with pyyaml python -c 'import json,subprocess,yaml; old=json.loads(subprocess.check_output(["git","show","3230337:.pi/install/slack-manifest.json"])); new=yaml.safe_load(open(".pi/install/slack-manifest.yaml")); assert old==new'`.
- [ ] The YAML manifest uses block style. Each slash command entry holds the line `command: /<name>` with no quotes, and the `bot_events` list holds the line `- message.im`.
- [ ] `.agro/evals/probes/slack-admin-command-surface.sh` sets `MANIFEST` to `$ROOT/.pi/install/slack-manifest.yaml`.
- [ ] The probe matches the YAML literals `- message.im` and `command: /<name>` for each of the 7 admin commands: `/help`, `/trusted`, `/revoke`, `/channels`, `/enable`, `/disable`, `/toggletools`.
- [ ] The probe reports REGRESSION if `.pi/install/slack-manifest.json` exists.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0 on the updated tree.
- [ ] Fault injection in a disposable copy: the probe exits 1 and names the condition for each of these inputs: the YAML manifest without the `/toggletools` entry, the YAML manifest without `- message.im`, and a restored `slack-manifest.json`.

### US-002: Point active documentation at the YAML manifest

**Description:** As a Pi bridge operator, I want each setup document to name the YAML manifest so that I paste the file that exists.

**Acceptance Criteria:**

- [ ] `README.md`, `docs/connecting.md`, `docs/harnesses/pi.md`, `docs/integrations/slack.md`, and `.pi/install/README.md` name `.pi/install/slack-manifest.yaml` (or `slack-manifest.yaml` in the `.pi/install/README.md` table) at each place that named the JSON file.
- [ ] `docs/integrations/slack.md` step 2.3 tells the operator to paste the YAML contents and to select the YAML format in the Slack manifest editor.
- [ ] `git grep -n 'slack-manifest\.json' -- ':!CHANGELOG.md' ':!.agro/tasks/' ':!.agro/evals/probes/slack-admin-command-surface.sh'` prints no line. The probe keeps the JSON path only for the absence check.
- [ ] `CHANGELOG.md` holds one `### Changed` entry under `## [Unreleased]` that names `.pi/install/slack-manifest.yaml` and links issue #1177.
- [ ] The released entry for #354 in `CHANGELOG.md` stays unchanged.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` reports no new finding on each changed documentation line.

## Summary

Verified current state at commit `3230337`:

- `.pi/install/slack-manifest.json` is the only Slack app manifest. The manifest declares Socket Mode, 13 bot scopes, 4 bot events, and 7 DM admin slash commands.
- `.agro/evals/probes/slack-admin-command-surface.sh` reads the JSON file. The probe matches the JSON literals `"message.im"` and `"command": "/<name>"`.
- Five active documents name the JSON path: `README.md:230`, `docs/connecting.md:299`, `docs/harnesses/pi.md:149`, `docs/integrations/slack.md` (lines 42, 66, 109, 301, 354), and `.pi/install/README.md:8`.
- `CHANGELOG.md:600` names the JSON path in the released `0.x` history for #354.
- No code, test, or script reads the manifest. Slack reads the manifest only when the operator pastes the file into the Slack app editor.
- No YAML parser ships with the repository. `yq` and PyYAML are absent. `node_modules` holds no `yaml` or `js-yaml` package. The CI `eval-probes` job provisions only Node 22.

Selected approach:

1. Convert the JSON manifest to a block-style YAML file with the same keys, values, and key order. Delete the JSON file with `git mv` plus the content rewrite, so history follows the file.
2. Keep literal matching in the probe. Change each manifest literal to the YAML form. Add an absence check for the JSON file.
3. Prove parse equality once, at acceptance, with a transient PyYAML run through `uvx`. Do not add a YAML parser dependency to the repository or to CI.
4. Update each active document.
5. Add one `Unreleased` changelog entry.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/slack-manifest.json` | whole file | Source to convert, then delete |
| `.pi/install/slack-manifest.yaml` | whole file | New canonical Slack app manifest |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST`, `need_literal` calls for the manifest | Regression guard for manifest events and admin commands |
| `.pi/install/README.md` | asset table | Index of Pi installation assets |
| `docs/integrations/slack.md` | sections 2, 4, 6, and the troubleshooting table | Full Slack setup walkthrough |
| `docs/connecting.md` | Pi Slack paragraph | Connection overview |
| `docs/harnesses/pi.md` | Slack paragraph | Pi harness reference |
| `README.md` | `#### Pi` setup section | Quick-start link to the manifest |
| `CHANGELOG.md` | `## [Unreleased]` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `.pi/install/slack-manifest.yaml` | New | Operator pastes this file into Slack **From an app manifest** with the YAML format selected |
| `.pi/install/slack-manifest.json` | Remove | The JSON manifest leaves the repository |
| Setup documentation | Modify | Each manifest reference names the YAML path |

## Storage

N/A. The manifest is a static tracked file. No runtime process reads or writes the file.

## Architectural Decisions

- **Source of truth:** `.pi/install/slack-manifest.yaml` is the only Slack app manifest. The repository keeps no JSON copy and no generated mirror.
- **State management:** None. Pi runtime JSON configuration stays JSON: `.pi/settings.json`, `.pi/msg-bridge.json`, and `~/.pi/msg-bridge.json` do not change.
- **Auth / scoping:** The YAML manifest keeps each OAuth scope, each bot event, and each slash command from the JSON manifest. The parse-equality criterion in US-001 proves the match.
- **Probe parser:** The probe matches literals and does not parse YAML. The CI `eval-probes` job has no YAML parser, and the evals contract forbids a PASS that the probe cannot verify. A literal match on each command and event runs in every environment.
- **YAML quoting:** Quote each string that YAML would otherwise read as a comment, a flow indicator, or a non-string: `background_color: "#1a1a2e"` and each `usage_hint` value. Leave slash command names unquoted, so the probe literal `command: /<name>` stays exact.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Change `MANIFEST` and the literals first. Run the probe before the YAML file exists, and confirm exit 1 with `missing Slack manifest`. | Red: the probe requires the YAML manifest |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Add the YAML file and delete the JSON file. Run the probe, and confirm exit 0. | Green: the manifest exposes each event and admin command |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Fault injection in a disposable copy: remove `/toggletools`, remove `- message.im`, and restore `slack-manifest.json`. Confirm exit 1 for each input. | The REGRESSION branch names each condition |
| Transient `uvx --with pyyaml` command in US-001 | Compare the parsed YAML with the JSON at `3230337` | Field and value equality |
| `bash .agro/skills/eval/run.sh` | Full probe suite | No other probe regresses |

## Design Principles

- Keep one source of truth for each policy. The YAML manifest replaces the JSON manifest. The repository keeps no parallel copy.
- Make the smallest change. Convert one file, retarget one probe, and edit the references.
- Add no dependency. A transient `uvx` run proves parse equality once.
- Add no comment to the YAML manifest. Code is the source of truth.
- Keep the Pi runtime JSON configuration out of this change.

## Out of Scope

- Pi runtime JSON configuration: `.pi/settings.json`, `.pi/msg-bridge.json`, and `~/.pi/msg-bridge.json`.
- Changes to scopes, events, slash commands, or any other manifest value.
- A permanent YAML parser in the probe, in CI, or in `package.json`.
- Edits to released `CHANGELOG.md` entries and to archived task files.
- Automation that pushes the manifest to Slack.

## Open Questions

1. Does `mifunedev/agro-web` hold its own copy of the Slack setup pages that names `.pi/install/slack-manifest.json`? The `docs/connecting.md` link `/docs/integrations/slack` points at a site route. If agro-web copies the page, the operator opens a matching agro-web change. This task does not block on the answer.

## Acceptance Criteria

- [ ] Each US-001 and US-002 acceptance criterion passes.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `pnpm run build:harness` exits 0.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `git diff --stat 3230337 -- .pi/settings.json .pi/msg-bridge.json` prints no line.
- [ ] The change adds no dependency to `package.json`, `pnpm-lock.yaml`, or `.agro/cli/package.json`.
- [ ] A draft PR is open: `FROM feat/1177-slack-manifest-yaml TO development`.

## Lessons

Filled by the advisor before undraft.
