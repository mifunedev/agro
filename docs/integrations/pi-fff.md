---
title: Pi fff (file search)
---

# Pi fff (file search)

AGRO loads [`@ff-labs/pi-fff`](https://github.com/dmtrKovalenko/fff) as a
project-local Pi package from `.pi/settings.json`:

```json
"npm:@ff-labs/pi-fff@0.9.5"
```

After you trust the project, Pi installs missing project packages at startup.
AGRO pins the package and does not copy upstream source into `.pi/extensions/`.

[`fff`](https://github.com/dmtrKovalenko/fff) is a typo-tolerant file-search
engine for AI agents. The Pi extension uses the native `@ff-labs/fff-node`
binding. The binding ships prebuilt binaries for Linux (glibc and musl), macOS,
and Windows through `optionalDependencies`. The sandbox needs no Rust toolchain
and no separate binary install.

The top-level pin does not pin the native binding. `pi-fff` declares
`@ff-labs/fff-node: "*"`, so npm resolves the binding at install time.

## What it adds

The package registers two agent tools. The package also replaces the
`@`-mention autocomplete of Pi with a picker that ranks files by frecency.

- **`ffgrep`** searches file contents. The tool accepts `path`, `exclude`,
  `caseSensitive`, `context`, and cursor pagination. `ffgrep` detects a regex,
  falls back to fuzzy search after zero exact matches, and rejects a
  wildcard-only pattern such as `.*`.
- **`fffind`** searches the full repository-relative path, not only the file
  name. Files that you open rank higher on the next search.

A hint in [`.pi/APPEND_SYSTEM.md`](../../.pi/APPEND_SYSTEM.md) tells the agent
to prefer these tools when Pi loaded them. The native `grep` and `find` tools
stay available as the fallback.

### Modes

Switch the mode at runtime with `/fff-mode`:

| Mode | Effect |
| --- | --- |
| `tools-and-ui` (default) | Adds `ffgrep` and `fffind`. Replaces `@`-mention autocomplete with FFF. |
| `tools-only` | Adds the tools only. Keeps the native Pi autocomplete. |
| `override` | Replaces the built-in Pi `grep`, `find`, and `multi_grep` with FFF. |

AGRO keeps the default `tools-and-ui` mode and does not set
`PI_FFF_MODE=override`. Environment variables: `PI_FFF_MODE`,
`FFF_FRECENCY_DB`, `FFF_HISTORY_DB`. Flags: `--fff-mode`, `--fff-frecency-db`,
`--fff-history-db`.

### Commands

- `/fff-mode [tools-and-ui | tools-only | override]`: show or switch the mode.
- `/fff-health`: picker, frecency, and git integration status.
- `/fff-rescan`: rescan the file index.

## Disable or remove

Every Pi session loads fff after you pin the package. To remove fff:

1. Remove `"npm:@ff-labs/pi-fff@0.9.5"` from `packages[]` in `.pi/settings.json`.
2. Remove the same entry from `.pi/extensions/__tests__/settings.test.ts`. The
   `toEqual` array checks the exact list, in order.
3. Remove the `## File search` section from `.pi/APPEND_SYSTEM.md`.

To keep the package but stop autocomplete changes, run `/fff-mode tools-only`.

## Verify the install

Run these commands from the repository root:

```bash
jq '.packages[]' .pi/settings.json | grep '@ff-labs/pi-fff@0.9.5'   # the pin is present
npm view @ff-labs/pi-fff@0.9.5 'pi' 'version'                      # the package metadata resolves
pi -e npm:@ff-labs/pi-fff@0.9.5                                     # try the package without a settings change
```

In the Pi session, confirm that `ffgrep` and `fffind` appear in the Pi tool list.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ffgrep` and `fffind` missing from the Pi tool list | The native binding failed to install: no network at boot, or a glibc and musl mismatch | In a trusted session, run `pi -e npm:@ff-labs/pi-fff@0.9.5` and read the startup output. Confirm that a `@ff-labs/fff-bin-linux-*` package resolved. |
| `@`-mention autocomplete is empty at first launch | The frecency index is empty in a fresh sandbox | Run `/fff-rescan`. Run `/fff-health` to inspect the picker, frecency, and git status. |
| Package not listed | The project is not trusted, or Pi has not installed the packages | Run `pi list --approve`, or restart Pi from the trusted project root. |
| Native `grep` and `find` missing | FFF runs in `override` mode | Run `/fff-mode tools-and-ui`. |
