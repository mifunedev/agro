# PRD: Slack manifest YAML

Status: DRAFT

## User Stories

### US-001: Replace the JSON manifest with YAML

**Description:** As a Pi bridge operator, I want a YAML Slack manifest so that I paste the file into Slack unchanged.

**Acceptance Criteria:**

- [ ] The new file `.pi/install/slack-manifest.yaml` exists and parses as YAML.
- [ ] The parsed YAML equals the parsed JSON from `git show HEAD:.pi/install/slack-manifest.json`, with the same keys, values, and list order.
- [ ] After the change, `git ls-files .pi/install/slack-manifest.json` prints nothing.
- [ ] Each string that contains `: `, `#`, `<`, or `|` is quoted in the YAML file.
- [ ] `.agro/evals/probes/slack-admin-command-surface.sh` sets `MANIFEST` to the YAML path and checks `message.im` plus the seven admin commands in YAML syntax.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] If the implementer deletes the /trusted entry from a disposable copy of the YAML file, the probe exits 1 and names /trusted.

### US-002: Point active docs at the YAML manifest

**Description:** As a Pi bridge operator, I want the docs to name the YAML manifest so that setup links resolve.

**Acceptance Criteria:**

- [ ] `README.md`, `docs/connecting.md`, `docs/harnesses/pi.md`, `docs/integrations/slack.md`, and `.pi/install/README.md` name the new file `.pi/install/slack-manifest.yaml`.
- [ ] `git grep -n 'slack-manifest.json' -- . ':!CHANGELOG.md' ':!.agro/tasks'` prints nothing.
- [ ] `CHANGELOG.md` keeps the historical line 600 unchanged and gains one new entry for the YAML switch.

## Summary

The Slack app manifest lives at `.pi/install/slack-manifest.json` (93 lines). The file declares display information, the bot user, seven DM admin slash commands, bot scopes, bot events, and Socket Mode settings. Five docs files cite the JSON path. The probe `.agro/evals/probes/slack-admin-command-surface.sh` greps JSON literals such as `"command": "/help"` and `"message.im"`.

The selected approach converts the manifest to YAML with identical content, deletes the JSON file, retargets the probe, and updates the active docs. Pi runtime JSON configuration, such as `.pi/msg-bridge.json`, stays JSON. No tracked YAML parser exists: PyYAML and `yq` are absent from the sandbox, and no tracked `package.json` declares `yaml` or `js-yaml`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/install/slack-manifest.json` | whole file | Source content; deleted after conversion |
| `.pi/install/slack-manifest.yaml` (new file) | whole file | New Slack app manifest |
| `.agro/evals/probes/slack-admin-command-surface.sh` | `MANIFEST`, `need_literal` checks at lines 12 and 52-55 | Regression guard for manifest content |
| `.pi/install/README.md` | line 8 table row | Directory index entry |
| `README.md` | line 230 | Slack setup link |
| `docs/connecting.md` | line 299 | Slack setup pointer |
| `docs/harnesses/pi.md` | line 149 | Pi harness Slack pointer |
| `docs/integrations/slack.md` | lines 42, 66, 109, 301, 354 | Slack integration guide |
| `CHANGELOG.md` | unreleased section | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Slack app manifest file | Format change | Operators paste YAML into the Slack manifest editor. Permissions and commands stay identical. |
| Public docs in mifunedev/agro-web | Path change | Docs that cite the JSON manifest path need the YAML path. See Open Questions. |

## Storage

N/A. The change edits one tracked configuration file and holds no runtime state.

## Architectural Decisions

- The YAML file is the single source of truth for the Slack app manifest. No JSON copy stays in the repository.
- The conversion changes format only. The field set, values, and list order stay identical.
- The probe keeps literal `grep` checks against the YAML text, so the probe needs no YAML parser.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/slack-admin-command-surface.sh` | Red: retarget `MANIFEST` to the YAML path before the YAML file exists; the probe exits 1 | The probe detects a missing manifest |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Green: after the YAML file exists, the probe exits 0 | YAML manifest declares `message.im` and all admin commands |
| `.agro/evals/probes/slack-admin-command-surface.sh` | Fault injection: remove the /trusted entry from a disposable copy; the probe exits 1 | The REGRESSION branch names the missing command |
| `<yaml-json equivalence command>` | Parse both files and compare the objects | The YAML preserves every field and value |

## Design Principles

- Follow the eval contract in `.agro/evals/AGENTS.md`: pin short literal fragments and drive the REGRESSION branch before landing.
- Do not add comments to the YAML file or the probe.
- Delete the JSON file instead of keeping a dormant duplicate.

## Out of Scope

- Pi runtime JSON configuration, such as `.pi/msg-bridge.json` and `.pi/settings.json`.
- Changes to Slack scopes, events, or slash commands.
- Edits to historical `CHANGELOG.md` entries.

## Open Questions

1. Which command proves YAML-to-JSON equivalence? The sandbox has no PyYAML and no `yq`, and no tracked package declares a YAML parser. Options: A. a one-off `npx --yes js-yaml` run recorded in the PR body; B. install PyYAML for the check only; C. `<other parser>`.
2. Does mifunedev/agro-web cite the JSON manifest path? If yes, the operator opens a matching docs change there.

## Acceptance Criteria

- [ ] The new file `.pi/install/slack-manifest.yaml` exists, and `.pi/install/slack-manifest.json` is absent from the working tree.
- [ ] The equivalence check from Open Question 1 exits 0.
- [ ] `bash .agro/evals/probes/slack-admin-command-surface.sh` exits 0.
- [ ] `git grep -n 'slack-manifest.json' -- . ':!CHANGELOG.md' ':!.agro/tasks'` prints nothing.
- [ ] The repository CI checks pass on the task branch.

## Lessons

Filled by the advisor before undraft.
