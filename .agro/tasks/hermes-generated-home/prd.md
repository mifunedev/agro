# PRD: Generate the Hermes home at install and stop tracking `.hermes/`

Status: DRAFT

## User Stories

### US-001: Seed the Hermes configuration defaults at install

**Description:** As an operator, I want `agro harness install hermes` to write the AGRO Hermes defaults into `<target-root>/.hermes/config.yaml` so that a fresh checkout needs no tracked Hermes file.

**Acceptance Criteria:**

- [ ] When `<hermes_home>/config.yaml` does not exist before the call, `hermes_workspace_configure()` in `.agro/scripts/hermes-workspace.sh` writes the AGRO defaults to that path as one YAML seed. Then the function sets `terminal.cwd` through `hermes config set`.
- [ ] The seed holds these keys and values: `model.default: gpt-6.1-sol-900k`, `model.provider: openai-codex`, `model.base_url: https://chatgpt.com/backend-api/codex`, `compression.codex_gpt55_autoraise: false`, `compression.auto_compact_percent: 85`, and `onboarding.seen.profile_build_offered: true`.
- [ ] The seed writes `auto_compact_percent` as a YAML integer and writes `codex_gpt55_autoraise` and `profile_build_offered` as YAML booleans.
- [ ] The seed holds no `_config_version` key and no `terminal.cwd` key.
- [ ] `.agro/scripts/hermes-workspace.sh` holds the seed in one list. No other tracked file holds a second copy of the values.
- [ ] When `<hermes_home>/config.yaml` exists before the call, the function sets only `terminal.cwd`. The function writes no seed.
- [ ] A new case in `.agro/cli/src/__tests__/hermes-integration.test.ts` runs the configure step against an empty home with a stub `hermes` binary. The case parses `config.yaml` with the `yaml` package and asserts each seed key, the number type of `auto_compact_percent`, the boolean type of both boolean keys, and the absence of `_config_version`.
- [ ] The same case asserts that the stub `hermes` binary receives `config set terminal.cwd <target-root>` after the seed write.
- [ ] A second new case writes a `config.yaml` with operator values before the configure step. The case asserts that the file bytes are unchanged after the step and that the stub `hermes` binary receives only `config set terminal.cwd <target-root>`.
- [ ] Both new cases fail before the change and pass after the change.
- [ ] When the seed write fails, the function returns a non-zero exit status, leaves no partial `config.yaml`, and prints a message that names `<hermes_home>/config.yaml`. The function does not run `hermes config set` after a failed seed write.

### US-002: Remove `.hermes/` from git and ignore the whole directory

**Description:** As a maintainer, I want git to track no file under `.hermes/` so that runtime state and generated configuration stay out of the repository.

**Acceptance Criteria:**

- [ ] `git rm --cached` removes `.hermes/README.md` and `.hermes/config.yaml` from the index. `git ls-files .hermes` prints nothing.
- [ ] `.gitignore` replaces the `/.hermes/*` block and its four `!` exemptions with the one line `/.hermes/`.
- [ ] `git check-ignore -q .hermes/config.yaml .hermes/README.md .hermes/skills/agro` exits 0.
- [ ] A new test in `.agro/scripts/__tests__/hermes-links.test.ts` runs `git ls-files .hermes` at the repository root and asserts empty output.
- [ ] The `.hermes/README.md` content has a home in `docs/harnesses/hermes.md`. The page states that `HERMES_HOME` is `<target-root>/.hermes`, that the directory holds gitignored runtime state, and that the program lives at `~/.local/lib/hermes-agent`.
- [ ] `docs/harnesses/hermes.md` states that `agro harness install hermes` generates `config.yaml` with the AGRO defaults on first install.
- [ ] `docs/harnesses/hermes.md` tells an operator with local edits in `.hermes/config.yaml` to copy the file to a backup path before the operator pulls this change.
- [ ] `CHANGELOG.md` holds one `### Removed` entry under `## [Unreleased]` for the removal of the tracked `.hermes/` files.

### US-003: Record manual review evidence

**Description:** As the advisor, I want a command transcript of a real Hermes install so that the PR `## Manual review` section proves the generated home.

**Acceptance Criteria:**

- [ ] `.agro/tasks/hermes-generated-home/evidence/manual-review.md` holds a transcript of `agro harness install hermes` in a sandbox with no `.hermes/config.yaml`.
- [ ] The transcript shows `cat .hermes/config.yaml` with each seed key, `terminal.cwd`, and the `_config_version` value that Hermes writes.
- [ ] The transcript shows a second `agro harness install hermes` after a manual `hermes config set model.default <other-model>`. The second run keeps `<other-model>`.
- [ ] The transcript shows `git status --short .hermes` with empty output after both runs.
- [ ] The transcript shows `ls -la .hermes/skills` with the link `agro -> ../../.agro/skills`.
- [ ] The story uses a sandbox only with operator approval and deletes each resource that the story creates.

## Summary

Verified current state:

- Git tracks two files under `.hermes/`: `README.md` (413 bytes) and `config.yaml` (294 bytes). `git ls-files .hermes` lists only these two files.
- `.hermes/skills/` is not tracked and is not a mirror. `.gitignore` line 65 (`/.hermes/*`) ignores the directory. `init_hermes_link()` in `.agro/scripts/link-providers.sh` creates the mirror link `.hermes/skills/agro -> ../../.agro/skills` inside the directory. In the main checkout, `.hermes/skills/` is an empty directory.
- `.gitignore` lines 65-69 ignore `/.hermes/*` and exempt `README.md`, `hooks/`, `config.yaml`, and `config.yml`. No file under `.hermes/hooks/` exists in git.
- The tracked `config.yaml` holds `model.*`, `compression.*`, `onboarding.seen.profile_build_offered`, `_config_version: 33`, and `terminal.cwd: "/home/sandbox/harness"`. The `hermes-workspace-binding` plan forbids a committed absolute path in this file. The tracked file breaks that rule.
- The request names `agro tool install hermes`. The verified command is `agro harness install hermes`. `.agro/cli/src/commands/tool.ts` holds no Hermes entry. This plan uses `agro harness install hermes`.
- Both install paths already call `configureHermes()` in `.agro/cli/src/commands/harness.ts`. The sandbox path is `installInSandbox` at lines 830-894. The host path is `installOnHost()` at lines 482-663. `configureHermes()` runs `hermes-workspace.sh configure`, which sets `terminal.cwd`.
- `.devcontainer/entrypoint.sh` line 348 runs `mkdir -p "$HERMES_RUNTIME"`. Boot creates the directory without a tracked file.

Selected approach: extend the existing `configure` step to seed the AGRO defaults on first install, then stop tracking `.hermes/`. The install does not generate a README. `docs/harnesses/hermes.md` keeps the README content.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/hermes-workspace.sh` | `hermes_workspace_configure()` | Owns the seed list. Writes the seed on first install. Sets `terminal.cwd`. |
| `.agro/cli/src/commands/harness.ts` | `configureHermes()`, `installOnHost()`, sandbox install path | Call the configure step. No change expected. |
| `.agro/scripts/link-providers.sh` | `hermes_paths_safe()`, `init_hermes_link()`, `HERMES_LINK` | Create `.hermes/skills/agro`. No change expected. |
| `.devcontainer/entrypoint.sh` | Hermes block at lines 344-370 | Creates `$HARNESS/.hermes` at boot. No change expected. |
| `.devcontainer/Dockerfile` | `ENV HERMES_HOME` | Selects the home. No change expected. |
| `.gitignore` | lines 65-69 | Replace with `/.hermes/`. |
| `.hermes/README.md`, `.hermes/config.yaml` | tracked files | Remove from the index. |
| `docs/harnesses/hermes.md` | install and storage sections | Absorb the README content and the generation behavior. |
| `docs/agro-directory-layout.md` | line 38 | Keep the `.hermes/skills/agro` row. No change expected. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install hermes` | Behavior change | The first install writes the AGRO defaults into `config.yaml`. A later install keeps the operator values. |
| `git pull` on an existing checkout | Migration | Git deletes an unmodified tracked `.hermes/config.yaml`. Git refuses the pull when the file has local edits. |
| `docs/harnesses/hermes.md` | Documentation | States the generation behavior and the backup step. |
| `CHANGELOG.md` | Documentation | One `### Removed` entry. |

## Storage

`<target-root>/.hermes/config.yaml` stays the Hermes configuration file. Hermes owns the file format and migrates `_config_version`. AGRO writes the file one time, as the YAML seed, only when the file is absent. After the seed, AGRO writes values only through `hermes config set`, per the `hermes-workspace-binding` plan. The directory becomes fully gitignored. Auth, memory, sessions, and the skill link keep their current locations.

## Architectural Decisions

- `hermes-workspace.sh` is the one source of truth for the AGRO Hermes defaults.
- The defaults seed only a home with no `config.yaml`. An existing file belongs to the operator.
- AGRO does not write `_config_version`. Hermes adds and migrates that key.
- The seed sets `onboarding.seen.profile_build_offered: true`. AGRO runs Hermes unattended, and the current tracked config sets the key. A seed without the key is a regression.
- The seed is YAML text, not a series of `hermes config set` calls. The YAML text fixes the integer and boolean types by construction.
- The install does not generate a README. A generated README duplicates `docs/harnesses/hermes.md`.
- The `!/.hermes/hooks/` exemption goes away. Git tracks no hook file, and YAGNI applies. A later task that adds a tracked hook adds its own exemption.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | Configure against an empty home writes the seed with integer and boolean types, no `_config_version`, then sets `terminal.cwd` | US-001 seeding |
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | Configure against a home with `config.yaml` leaves the file bytes unchanged and sets only `terminal.cwd` | US-001 operator values kept |
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | A failed seed write returns non-zero, leaves no partial file, names the path, and skips `hermes config set` | US-001 failure path |
| `.agro/scripts/__tests__/hermes-links.test.ts` | `git ls-files .hermes` is empty | US-002 removal |
| `.agro/scripts/__tests__/gateway.test.ts` | Existing cases | Regression for gateway home selection |
| `.agro/skills/remote-sandbox/checks/agro-rows.sh` | Row `R15-hermes-host-install` | Regression for the host install link output |

Run the suites from the repository root with `pnpm test`. The root `package.json` maps `test` to `vitest run`.

## Design Principles

- Code is the source of truth. Do not add explanatory comments to tracked code.
- Prefer the smallest truthful change. Extend the existing configure step. Do not add a new verb or template file.
- Hermes owns its configuration format. AGRO writes one seed into an absent file and uses `hermes config set` for every later change.
- Keep runtime state out of git.

## Out of Scope

- A new `agro tool install hermes` verb.
- Changes to `HERMES_HOME` selection, gateway startup, or the dashboard.
- Changes to `.hermes/skills/agro` link behavior.
- Migration code that restores a config deleted by `git pull`. The next install seeds the defaults again.

## Open Questions

None

## Acceptance Criteria

- [ ] `git ls-files .hermes` prints nothing on the task branch.
- [ ] A first `agro harness install hermes` produces a `config.yaml` with each AGRO default and `terminal.cwd`.
- [ ] A second `agro harness install hermes` keeps an operator value for `model.default`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0 after the install.
- [ ] Each test in the Test Plan passes in CI.

## Lessons

1. Claim: the plan placed the seed only in the configure step, which runs after the Hermes installer. Evidence: the upstream `install.sh` `stage_config()` copies `cli-config.yaml.example` to `config.yaml` when the file is absent, and `--skip-setup` does not skip the copy. Outcome: fixed in this PR. `seedHermes()` in `harness.ts` runs the `seed` subcommand before the installer on the host path and the sandbox path. Remote row H06 shows the AGRO seed after a first install.
2. Claim: the US-002 command `git check-ignore -q <three paths>` exits 128, because git accepts `-q` with one path only. Evidence: the worker ran the command on git 2.47.3. Outcome: dropped. The advisor ran the check per path, and each path exits 0.
3. Claim: the US-001 criterion "Both new cases fail before the change" cannot hold for the existing-config case. The old code also left the file unchanged. Evidence: the worker red run shows 2 of 3 new cases red. Outcome: dropped. The case guards a regression and passes.
4. Claim: the remote-sandbox driver counts every VM with the `agro-matrix` tag on the account, so a clean run reports a non-zero `remaining` count while another session runs. Evidence: run `exedev-hermes-home-20261011-112806.log` reports `remaining agro-matrix resources on exedev: 1`; the one VM is `agro-mx-1011-112912` of a concurrent `docker-egress` run. Outcome: issue proposed (a per-run tag or a per-name check in `scripts/run.sh`); not created before operator approval.
