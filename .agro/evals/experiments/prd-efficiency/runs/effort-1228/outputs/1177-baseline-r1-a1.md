# PRD: Slack manifest YAML

Status: DRAFT

## User Stories

### US-001: Replace the Slack manifest JSON with YAML

**Description:** As a Pi bridge operator, I want a YAML Slack manifest so that I can paste the manifest into Slack unchanged.

**Acceptance Criteria:**

- [ ] `.pi/install/slack-manifest.yaml` exists, and `.pi/install/slack-manifest.json` does not exist.
- [ ] `<yaml-parser> .pi/install/slack-manifest.yaml` converted to JSON equals `git show <base>:.pi/install/slack-manifest.json` under `jq -S .` comparison, and the `diff` exits 0.
- [ ] In the YAML file, `background_color` is the string `"#1a1a2e"`, and each boolean value is a YAML boolean, not a string.
- [ ] Red test: before the manifest change, the updated probe `.agro/evals/probes/slack-admin-command-surface.sh` exits 1 and prints `REGRESSION: missing Slack manifest`.
- [ ] Green test: after the manifest change, `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] The probe checks `message.im` and each admin command `/help`, `/trusted`, `/revoke`, `/channels`, `/enable`, `/disable`, and `/toggletools` against YAML literals in the YAML file.
- [ ] The probe exits 1 when `.pi/install/slack-manifest.json` exists.
- [ ] `git grep -n 'slack-manifest.json' -- ':!CHANGELOG.md' ':!.agro/tasks/archive'` prints only the probe line that rejects the old file.
- [ ] `git grep -n 'slack-manifest.yaml'` lists `README.md`, `.pi/install/README.md`, `docs/connecting.md`, `docs/harnesses/pi.md`, `docs/integrations/slack.md`, and the probe.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` for the manifest format change, with a link to issue <issue-number>.

## Summary

The issue is `work/issue-1177.md`. The issue asks for a YAML Slack manifest in place of the tracked JSON manifest.

Verified current state:

- `.pi/install/slack-manifest.json` holds the Slack app manifest for the Pi messenger bridge. The manifest declares Socket Mode, 13 bot scopes, 4 bot events, and 7 admin slash commands.
- The probe `.agro/evals/probes/slack-admin-command-surface.sh` sets `MANIFEST` to the JSON path at line 12. The probe greps JSON literals, for example `"command": "/help"` and `"message.im"`.
- Five active documents cite the JSON path: `README.md:230`, `.pi/install/README.md:8`, `docs/connecting.md:299`, `docs/harnesses/pi.md:149`, and `docs/integrations/slack.md` at lines 42, 66, 109, 301, and 354.
- `CHANGELOG.md:600` and two archived task files under `.agro/tasks/archive/2026-09-21/` cite the JSON path as history.
- No tracked script or runtime code reads the manifest. The file is operator input for the Slack web console.

Selected approach: the implementation owner writes `.pi/install/slack-manifest.yaml` in block style with 2-space indentation. The YAML file keeps the key order of the JSON file. The owner quotes each string that YAML reads as a comment or as another type, for example `"#1a1a2e"` and `"<userId>"`. The owner deletes the JSON file with `git rm`. The owner updates the probe and the five active documents to the YAML path. Pi runtime JSON files, for example `.pi/settings.json` and `.pi/msg-bridge.json`, stay unchanged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/slack-manifest.json` | whole file | Source of the fields and values. The owner deletes this file. |
| `.pi/install/slack-manifest.yaml` | whole file | New Slack app manifest. |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST`, `need_literal`, admin command loop | Probe that guards the manifest and the Slack docs. |
| `.pi/install/README.md` | asset table row | Index of Pi install assets. |
| `README.md` | line 230, Pi Slack setup link | Root setup link to the manifest. |
| `docs/connecting.md` | line 299 | Slack setup summary. |
| `docs/harnesses/pi.md` | line 149 | Pi harness Slack summary. |
| `docs/integrations/slack.md` | lines 42, 66, 109, 301, 354 | Full Slack setup guide and troubleshooting table. |
| `CHANGELOG.md` | `## [Unreleased]` | Release note for the format change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slack app manifest file | Format and path change | The operator pastes YAML from `.pi/install/slack-manifest.yaml` into **Create New App** → **From an app manifest**. |
| Eval probe `slack-admin-command-surface` | Assertion change | The probe reads the YAML path and YAML literals. The probe rejects the old JSON path. |

## Storage

N/A. The manifest is a tracked static file. No runtime state changes.

## Architectural Decisions

- `.pi/install/slack-manifest.yaml` is the single source of truth for the Slack app manifest. The repository keeps no JSON copy.
- The format change keeps each key, each value, and each value type of the JSON manifest.
- Historical records in `CHANGELOG.md` and `.agro/tasks/archive/` keep the old path. These records describe past state.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | YAML file exists; old JSON file is absent; `- message.im` present; `- command: <name>` present for each of the 7 admin commands | The manifest path, the format, and the admin command surface. |
| One-time check in the implementation evidence | `<yaml-parser>` output against `git show <base>:.pi/install/slack-manifest.json`, both through `jq -S .`, then `diff` | Field and value equality with the JSON manifest. |
| `bash .agro/skills/eval/run.sh` | Full probe suite | No other probe regresses. |
| `pnpm test:scripts`, `pnpm run typecheck`, `bash .agro/scripts/link-providers.sh --init` | CI harness steps from `.github/workflows/ci-harness.yml` | Repository checks pass. |

## Design Principles

- Code is the source of truth. Add no explanatory comments to the YAML file or to the probe.
- Keep one source of truth. Delete the JSON file. Do not keep the JSON file as an alternative.
- Make the smallest change that meets the issue. Do not change scopes, events, commands, or settings.
- Keep the probe deterministic. The probe uses `grep` literals and needs no YAML parser at run time.

## Out of Scope

- Changes to Pi runtime JSON configuration, for example `.pi/settings.json` and `.pi/msg-bridge.json`.
- Changes to Slack scopes, bot events, slash commands, or app settings.
- Edits to `CHANGELOG.md` history and to archived task files.
- Changes to the public site in `mifunedev/agro-web`. Open Question 2 tracks this surface.

## Open Questions

1. Which YAML parser proves the equality check? `package.json` and `pnpm-lock.yaml` declare no YAML library. Candidates are `python3` with PyYAML, `ruby -ryaml -rjson`, and `yq`. The owner records the chosen `<yaml-parser>` command in the story notes.
2. Does `mifunedev/agro-web` hold a copy of the Slack guide that cites `.pi/install/slack-manifest.json`? If yes, the operator opens a matching change in `mifunedev/agro-web`.
3. What is the GitHub issue number for the `CHANGELOG.md` link? The input file `work/issue-1177.md` implies issue 1177. The operator confirms `<issue-number>`.

## Acceptance Criteria

- [ ] `.pi/install/slack-manifest.yaml` parses, and the parsed value equals the parsed JSON manifest at `<base>`.
- [ ] `.pi/install/slack-manifest.json` does not exist.
- [ ] No active document cites `.pi/install/slack-manifest.json`.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] `pnpm test:scripts` and `pnpm run typecheck` exit 0.

## Lessons

Filled by the advisor before undraft.
