# PRD: Langfuse Configuration Wizard

## Introduction

Configuring Langfuse tracing in AGRO is a manual, three-procedure process documented in
[`docs/integrations/langfuse.md`](../../../docs/integrations/langfuse.md). The operator
exports shell variables by hand, edits `~/.claude/settings.json`, writes
`~/.pi/agent/langfuse.json`, and repeats all of it after every `agro destroy`.

Two defects make this worse than it looks:

1. `agro secret set LANGFUSE_SECRET_KEY` already works and writes to `.env`, but the value
   **never reaches the sandbox**. `.devcontainer/docker-compose.yml:17-25` passes only
   `GH_TOKEN`. The stored secret is inert.
2. Every setting lives in the home volume, which `agro destroy` removes. Nothing restores it.

This feature adds `agro langfuse setup | apply | status | disable`: an interactive wizard that collects
the configuration once, stores it in the two existing sources of truth (`agro.json` for
non-secret fields, `.env` for keys), and renders it into the files and environment each
harness actually reads — re-applied automatically at sandbox boot.

### The transport decision

**The environment is the primary transport. Generated harness files are a secondary,
non-secret layer.**

This inverts the obvious framing, and the reason is concrete:
`~/.pi/agent/langfuse.json` accepts only `environment` and `userId`. It has **no `baseUrl`
field**. Pi therefore gets its endpoint only from the process environment. A design that
writes files and stops leaves Pi non-functional.

Credentials reach harnesses through one `0600` fragment sourced by the shell. Harness-native
files carry only non-secret segmentation fields. This keeps exactly one secret at rest, so
the "an agent must not read the keys" requirement reduces to one deny rule.

## Goals

- One command configures Langfuse for Claude Code, Pi, and Codex; no hand-edited files.
- Stored Langfuse secrets actually reach the harnesses that consume them.
- Configuration survives `agro destroy` and container recreate without operator action.
- Exactly one credential file at rest, guarded by one deny rule.
- Disabling tracing before a sensitive session is a single command with a fail-safe result.
- No secret enters git-tracked `agro.json`; no `LANGFUSE_*` key enters compose.

## Non-Goals (Out of Scope)

- Deploying, hosting, or operating Langfuse itself.
- A multi-provider abstraction (`agro tracing config <provider>`, LangWatch, etc.). The
  internal seam is provider-shaped; the command surface stays singular until a second
  provider is verified to ship harness plugins with a matching config shape.
- Reviving `LANGFUSE_PRIVACY_PRESET` or the community `pi-langfuse` fork. Both were retired
  by #1129 and stay retired.
- Native OpenTelemetry export. That is a separate, distinct feature; see FR-19.
- Project-local (repo-scoped) harness configuration. User scope only.
- Installing plugins without consent. The wizard detects missing plugins and offers to
  install them (US-013); it never installs unprompted, and `apply` never installs at all.
- Automating the Codex hook-trust approval. Codex prompts for hook trust only in interactive
  mode; the wizard writes the config and tells the operator to run `codex` once (US-012).

## User Stories

### US-001: Reinstate the `langfuse` section in `agro.json`

**Description:** As an operator, I want non-secret Langfuse settings stored in `agro.json`
so that one tracked file is the source of truth for where my traces go.

This reverses part of #1129, which removed the section because it created two sources of
truth. That objection is answered by the derived-artifact contract in US-006: `agro.json`
plus `.env` are the only sources, and every harness file is regenerated from them.

**Acceptance Criteria:**

- [ ] Remove the dangling `"langfuse": {}` stub at `agro.json:23`, then add the real section
- [ ] `LangfuseSettings` interface in `.agro/cli/src/lib/oh-config.ts` with optional
      `enabled` (boolean), `baseUrl` (string), `environment` (string), `userId` (string)
- [ ] `validateOhConfig` validates all four fields and rejects wrong types with a
      `agro.json: langfuse.<field> ...` message
- [ ] All four paths registered in `OH_CONFIG_FIELDS` so `agro config set langfuse.baseUrl`
      works and `agro config set` lists them
- [ ] `defaultOhConfig` includes `langfuse: {}`
- [ ] An existing `agro.json` with no `langfuse` section still loads and the feature stays
      inert
- [ ] `agro config set langfuse.publicKey` is refused with the existing secret-redirect
      message pointing at `agro secret set`
- [ ] Typecheck, lint, and unit tests pass

### US-002: Keep the compose and RETIRED_KEYS guards armed

**Description:** As a maintainer, I need proof that reinstating the config section did not
leak any Langfuse value into compose, so that the boundary #1129 established still holds.

`compose-env-boundary.sh` encodes the rule: a value belongs in compose `environment:` only
if a process **outside** the sandbox — or the entrypoint **before** the control plane is
readable — must act on it. Langfuse keys fail that test. `GH_TOKEN` is a named literal
exception, not a precedent.

**Acceptance Criteria:**

- [ ] `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET` remain in `RETIRED_KEYS` in
      `.agro/cli/src/lib/config-render.ts`
- [ ] `renderComposeVars` gains no `put()` call for any `LANGFUSE_*` key
- [ ] No `LANGFUSE_*` key is added to any `.devcontainer/docker-compose*.yml`
- [ ] `.agro/evals/probes/compose-env-boundary.sh` passes
- [ ] A unit test asserts `renderComposeVars` still throws for a config carrying
      `LANGFUSE_BASE_URL`

### US-003: Render the credential fragment

**Description:** As an operator, I want my Langfuse keys written to one protected file so
that every harness can read them and exactly one file needs guarding.

**Acceptance Criteria:**

- [ ] New provider module at `.agro/cli/src/lib/tracing/providers/langfuse.ts`
- [ ] Renders `~/.config/agro/langfuse.env` containing bare `KEY=value` lines (no `export`)
      for `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`, and
      `LANGFUSE_TRACING_ENVIRONMENT`
- [ ] The no-`export` form is expressed through a named test, not a code comment
      (AGENTS.md non-negotiable #5): a test named for the systemd constraint asserts the
      rendered file contains no `export` token
- [ ] `docs/integrations/langfuse.md` tells operators to use `export` in their **own** shell
      profile. That guidance stays correct for the manual path and must not be "corrected"
      to match the generated fragment
- [ ] File mode is `0600`; parent directory is `0700`
- [ ] Keys are read from `.env` via the existing `readSecret` in `lib/secrets.ts`
- [ ] Rendering is idempotent: a second run with unchanged input produces a byte-identical file
- [ ] Refuses to render and returns a clear error if either key is missing
- [ ] **No new deny rule is added.** Verified during execution: `.claude/settings.json`
      already denies `Read(file_path=**/.config/**)`, `Edit(file_path=**/.config/**)`, and
      `Bash(command=*/.config/*)`, so the fragment path is covered for read, edit, and any
      shell command naming it. A narrower duplicate glob would be noise. A test asserts the
      fragment path falls under an existing deny rule rather than adding one
- [ ] A value containing a newline or a single quote is rejected or safely quoted, with a test

### US-004: Wire the fragment into every shell

**Description:** As an operator, I want the credential fragment loaded by interactive,
login, and non-interactive shells so that cron-fired and detached sessions are traced too.

Today `.agro/install/.zshrc` (copied at `Dockerfile:97`) is the only managed shell surface,
and `.zshrc` is interactive-only. `openharness-cron.service` runs `/bin/bash -c` with only
`Environment=HOME=/home/sandbox`. The cron path currently recovers by accident — no
`default-command` is set in `.tmux.conf`, so `tmux new-session` spawns a login shell — but
`cron-runtime.ts:614` branches on `liveEntry.tmux` and the non-tmux path has no such luck.
Unattended sessions are the ones most worth tracing, and they would fail silently.

**Acceptance Criteria:**

- [ ] New tracked `.agro/install/.zshenv` sourcing `~/.config/agro/langfuse.env` when present
- [ ] The source line is guarded (`[ -r ... ] && . ...`) so a missing file is not an error
- [ ] `.devcontainer/Dockerfile` copies it to `/home/sandbox/.zshenv` beside the existing
      `.zshrc` copy, with `--chown=sandbox:sandbox`
- [ ] `zsh -c 'echo $LANGFUSE_BASE_URL'` prints the configured value — the non-interactive
      proof
- [ ] A new probe asserts the tracked `.zshenv` exists, is copied by the Dockerfile, and
      contains a guarded source of the fragment path
- [ ] `seed_home` behavior is documented: an operator's pre-existing `~/.zshenv` is never
      overwritten, and `agro langfuse status` warns when the sourcing line is absent from it
- [ ] `openharness-cron.service` gains
      `EnvironmentFile=-/home/sandbox/.config/agro/langfuse.env` so the cron runtime itself
      carries the credentials, instead of relying on tmux spawning a login shell
- [ ] The leading `-` is present so a missing fragment never fails the unit
- [ ] The fragment is written as bare `KEY=value` lines with **no `export`** — the only form
      systemd `EnvironmentFile` accepts — and `.zshenv` wraps the source in `set -a` /
      `set +a` so the shell still exports them
- [ ] A test asserts both consumers work from the one file: `systemd-analyze` (or an
      equivalent parse) accepts it, and `zsh -c 'echo $LANGFUSE_BASE_URL'` prints the value
- [ ] A cron entry with `tmux: false` (`cron-runtime.ts:614`) produces a traced session,
      proving the non-tmux path no longer depends on the incidental login-shell behavior

### US-005: Render the harness-native files

**Description:** As an operator, I want Claude Code and Pi configured from my stored
settings so that each harness segments traces correctly without hand-editing.

Codex uses the same seam and lands in US-012, separately because its hook-trust step cannot
be automated.

**Acceptance Criteria:**

- [ ] `HarnessEntry` in `.agro/cli/src/lib/harnesses/catalog.ts` gains an optional tracing
      writer; `claude-code` and `pi` provide one
- [ ] Claude Code writer **merges** an `env` block into `~/.claude/settings.json`, preserving
      all unrelated keys, and writes only `LANGFUSE_BASE_URL` and
      `LANGFUSE_TRACING_ENVIRONMENT` — **no credentials**
- [ ] Pi writer writes `~/.pi/agent/langfuse.json` with `environment` and `userId` only
- [ ] Both writers are idempotent and create parent directories as needed
- [ ] A malformed pre-existing `~/.claude/settings.json` fails with a clear error and leaves
      the file untouched
- [ ] Unit tests assert no `LANGFUSE_PUBLIC_KEY` or `LANGFUSE_SECRET_KEY` value appears in
      either generated file
- [ ] `~/.claude/settings.json` is **not** added to any deny rule — agents legitimately read it

### US-006: `agro langfuse apply`

**Description:** As an operator, I want a non-interactive apply command so that bootstrap
and scripts can restore my configuration without prompting.

**Acceptance Criteria:**

- [ ] `agro langfuse apply` renders the fragment (US-003) and both harness files (US-005)
- [ ] Exits `0` and prints a one-line "not configured" notice when `langfuse.enabled` is
      absent or `false`, writing nothing
- [ ] Never prompts; safe under cron, systemd, and a detached session
- [ ] Prints each file it wrote, and prints nothing sensitive
- [ ] Inside the sandbox it applies; on the host it refuses with
      `"~/.claude and ~/.pi exist only in the sandbox — settings saved; run `agro langfuse apply` in the sandbox or restart it"`
- [ ] Exit code is non-zero if any render fails, naming the file that failed

### US-007: Re-apply at sandbox boot

**Description:** As an operator, I want my Langfuse configuration restored automatically
after `agro destroy` and recreate, so that unattended work is never silently untraced.

**Acceptance Criteria:**

- [ ] `agro langfuse apply` runs during bootstrap, as user `sandbox`, after the home volume
      is seeded and after `.env` is readable
- [ ] Runs before `openharness-cron.service` starts, so the first cron fire is configured
- [ ] A missing or disabled configuration is a no-op that never fails the boot
- [ ] Bootstrap failure of this step is logged to the journal and does not block the sandbox
- [ ] Verified end to end: configure, `agro destroy`, recreate, then confirm both harness
      files and the fragment are present with correct modes

### US-008: `agro config langfuse` wizard

**Description:** As an operator, I want a guided five-step wizard so that I can configure
Langfuse correctly without reading the integration doc.

Reuses the existing precedent: `runWizard` at `.agro/cli/src/commands/sandbox.ts:169` and
the interactivity gate at `sandbox.ts:265`.

**The wizard is registered in the existing integration registry.** `.agro/cli/src/cli.ts:84`
declares `const INTEGRATIONS: Record<string, Integration> = {}` — a fully wired registry
with routing, per-integration `--help`, and a `(none)` placeholder, and **zero members**.
`agro config langfuse` becomes its first. The non-interactive verbs cannot live there:
`Integration` is `{ description, runner: () => Promise<number> }` and its help states the
wizard "takes no flags", so `apply`, `status`, and `disable` stay under `agro langfuse`.

**Acceptance Criteria:**

- [ ] Registered in `INTEGRATIONS` in `.agro/cli/src/cli.ts` as `langfuse`, becoming the
      registry's first member; `agro config` help lists it instead of `(none)`
- [ ] `agro config langfuse --help` renders through the existing `printIntegrationHelp`
- [ ] The `Integration` interface is **not** changed — no argv parameter, no flags
- [ ] Five steps rendered with `prompt.step(n, 5, label)` — its first caller
- [ ] Step 1 — enable: `askYesNo`, and **the question depends on current state**, because
      "no" is ambiguous otherwise. When tracing is currently disabled or unset, ask
      "Enable Langfuse tracing?" and a decline writes nothing and exits `0`. When tracing is
      currently **enabled**, ask whether to keep it enabled, and a decline runs the US-010
      disable path. Resolved during execution: US-008 and US-010 contradicted each other on
      what "no" means, and the safe-looking reading is the dangerous one — an operator
      turning tracing off before a sensitive session would answer "no", see no error, and
      still be traced
- [ ] Step 2 — base URL: a **menu**, not free text, with Langfuse Cloud /
      `http://host.docker.internal:3000` / Compose service name / custom, mirroring the table
      in `docs/integrations/langfuse.md`
- [ ] Step 3 — keys: `prompt.askSecret` twice, stored via the existing `setSecret`; already-set
      keys show a `prompt.redact` line and offer to keep the current value
- [ ] Step 4 — segmentation: `environment` defaulted to the sandbox name, optional `userId`
- [ ] Step 5 — verify then write: `curl -fsS "$BASE_URL/api/public/health"` **before**
      persisting; a failure **warns and offers to save anyway** (the URL may resolve only
      from inside the sandbox) and never hard-fails
- [ ] On confirm: writes `agro.json`, writes `.env`, then runs the US-006 apply
- [ ] `askDefaulted` and `askYesNo` are promoted from `sandbox.ts` to `lib/prompt.ts` and the
      sandbox wizard is updated to use the shared helpers — no duplicated prompt dialect
- [ ] Interactivity gate copies `sandbox.ts:265` exactly:
      `opts.yes !== true && (process.stdin.isTTY === true || io.ask !== undefined)`
- [ ] With `--yes` or no TTY, the wizard is skipped and the command behaves as `apply`
- [ ] No secret is ever echoed; terminal output uses `prompt.redact`
- [ ] Tests inject `io.ask` / `io.askSecret` following the `SecretIO` pattern; no test needs
      a real TTY

### US-009: `agro langfuse status` with drift detection

**Description:** As an operator, I want to see the resolved configuration and whether the
generated files still match it, so that a stale file or a half-finished key rotation is
visible instead of silent.

This is the check the troubleshooting table in `docs/integrations/langfuse.md` currently
asks operators to do by eye ("One harness lags after a key rotation").

**Acceptance Criteria:**

- [ ] Prints resolved `enabled`, `baseUrl`, `environment`, `userId`
- [ ] Prints whether each key is set, via `prompt.redact` — never the raw value
- [ ] For each generated file prints one of `current`, `drifted`, or `missing`
- [ ] `drifted` is determined by comparing the file against a fresh in-memory render
- [ ] Warns when `~/.zshenv` exists but does not source the fragment (the `seed_home`
      skip-if-exists case from US-004)
- [ ] Exit code `0` when everything is current or tracing is disabled; non-zero on drift, so
      the command is usable in a check
- [ ] Suggests `agro langfuse apply` whenever drift or a missing file is reported

### US-010: Disable path

**Description:** As an operator, I want one command to stop tracing before a sensitive
session, with a result I can trust.

Chosen behavior is fail-safe: **the absent secret is the off switch.** Removing the
credential fragment stops tracing even if a plugin ignores its own disable flag — which
matters, because `~/.pi/agent/langfuse.json` has no documented `enabled` field.

**Acceptance Criteria:**

- [ ] `agro langfuse disable` sets `langfuse.enabled: false` in `agro.json`. The wizard
      reaches this same path when tracing is currently enabled and the operator declines at
      step 1 — see US-008 step 1 for why the question is state-dependent
- [ ] Deletes `~/.config/agro/langfuse.env`
- [ ] Rewrites the harness files reflecting the disabled state; non-secret segmentation
      settings are **retained** in `agro.json`
- [ ] Keys are **not** removed from `.env`, so re-enabling needs no re-prompt
- [ ] `agro langfuse setup` on an already-configured, disabled setup offers to re-enable
      using stored values without re-entering keys
- [ ] Prints an explicit warning that harnesses already running keep their loaded
      credentials and must be restarted
- [ ] `agro langfuse status` reports `disabled` and confirms the fragment is absent

### US-011: Close the documentation and schema gaps

**Description:** As a maintainer, I need the documentation and schema surfaces updated in the
same change so that the parity probe passes and no stale procedure survives.

**Acceptance Criteria:**

- [ ] `.example.env:85-96` rewritten — it still describes the retired `pi-langfuse` fork
      ("pi-langfuse reads these only from the environment of the Pi process") and the deleted
      privacy presets
- [ ] `docs/configuration.md` gains rows for the four `langfuse.*` fields
- [ ] `.agro/evals/probes/config-schema-parity.sh` passes — it cross-checks `secrets.ts`,
      `.example.env`, and `docs/configuration.md` and treats asymmetry as a regression
- [ ] `docs/integrations/langfuse.md` leads with the wizard; the manual procedure is retained
      as the fallback for harnesses without a writer
- [ ] `docs/harnesses/codex.md` points at the wizard and keeps the hook-trust step, which
      stays manual
- [ ] `docs/harnesses/claude-code.md` and `docs/harnesses/pi.md` point at the wizard
- [ ] `docs/lifecycle-commands.md` documents `setup`, `apply`, `status`, `disable`
- [ ] CHANGELOG entry added, under the 250-character cap enforced by
      `changelog-entry-length.sh`
- [ ] All prose passes the `/ste` checker

### US-012: Codex writer and the hook-trust step

**Description:** As an operator, I want Codex configured by the same command so that all
three default harnesses are covered by one source of truth.

Codex is the writer that proves the seam generalizes rather than asserting it. It also
carries the one thing the wizard genuinely cannot automate: `codex` prompts for hook trust
only in interactive mode, and an untrusted hook never runs.

**Acceptance Criteria:**

- [ ] `codex` entry in `catalog.ts` provides a tracing writer through the same seam as
      `claude-code` and `pi` — no new mechanism
- [ ] Writer writes `~/.codex/langfuse.json` with `enabled`, `tags: ["codex"]`, and
      `environment`, at mode `0600`, matching the shape in `docs/integrations/langfuse.md`
- [ ] Writer sets the `codex` tag explicitly; unlike Claude Code and Pi, Codex tags nothing
      on its own
- [ ] No credential is written to the file — keys come from the fragment like every other
      harness
- [ ] Writer does **not** edit `~/.codex/config.toml`. `codex plugin add` writes the
      `[plugins]` table, and a duplicate table is invalid TOML
- [ ] `agro langfuse status` reports Codex as `untrusted` when the config is present but no
      `trusted_hash` entry for the tracing stop hook exists in `~/.codex/config.toml`
- [ ] `setup` and `status` print the manual step when trust is missing: start `codex` once
      interactively and approve the **Uploading Codex trace to Langfuse** hook
- [ ] Adding the third writer requires no change to the seam itself — if it does, the seam is
      wrong and the PR says so

### US-013: Detect missing plugins and offer to install

**Description:** As an operator, I want the wizard to tell me when a harness has no Langfuse
plugin installed, so that "no traces" has a visible cause instead of being silent.

A configured harness with no plugin and an unconfigured harness look identical: both produce
nothing. This is the single most likely first-run failure.

**Acceptance Criteria:**

- [ ] For each harness with a tracing writer, `setup` detects whether its Langfuse plugin is
      installed, using that harness's own listing command
- [ ] Detection failure (harness absent, command errors, times out) is reported as `unknown`
      and never blocks the wizard
- [ ] A harness that is not installed at all is skipped silently — it is not a missing plugin
- [ ] For each missing plugin the wizard prints the exact install command from
      `docs/integrations/langfuse.md` and offers to run it via `askYesNo`, defaulting to no
- [ ] Declining is a first-class outcome: configuration still writes, and `status` continues
      to report the plugin as missing
- [ ] `agro langfuse apply` **never** installs anything and never prompts — bootstrap and
      cron run it
- [ ] `agro langfuse status` reports per-harness plugin state: `installed`, `missing`, or
      `unknown`
- [ ] Install commands are invoked through the existing lifecycle runner, not a raw shell
      string, and are covered by tests with an injected runner
- [ ] A network or marketplace failure during install is reported and leaves the written
      configuration intact


## Functional Requirements

- **FR-1:** `agro.json` must support a `langfuse` section with `enabled`, `baseUrl`,
  `environment`, and `userId`. No credential may be stored there; `agro.json` is tracked by git.
- **FR-2:** Credentials must be read from `.env` through the existing `SECRET_KEYS` path.
- **FR-3:** No `LANGFUSE_*` variable may be added to any compose file or rendered by
  `config-render.ts`.
- **FR-4:** `LANGFUSE_BASE_URL` and `LANGFUSE_PRIVACY_PRESET` must remain in `RETIRED_KEYS`.
- **FR-5:** The system must render `~/.config/agro/langfuse.env` at mode `0600`, holding all
  four environment values, as the sole credential artifact.
- **FR-6:** A tracked `.zshenv` must source that fragment when present, covering interactive,
  login, and non-interactive shells.
- **FR-7:** The Claude Code writer must merge into `~/.claude/settings.json` without
  discarding unrelated keys, and must write no credential.
- **FR-8:** The Pi writer must write `~/.pi/agent/langfuse.json` with `environment` and
  `userId` only.
- **FR-9:** All renders must be idempotent — identical input produces a byte-identical file.
- **FR-10:** Generated files are derived artifacts. `agro.json` and `.env` are the only
  sources of truth, and `status` must detect hand-edits as drift.
- **FR-11:** `agro langfuse setup` must run five wizard steps and must verify the base URL
  before persisting, treating a failed health check as a warning.
- **FR-12:** The wizard must be skipped when stdin is not a TTY or `--yes` is passed; no
  command in this feature may block an unattended session on a prompt.
- **FR-13:** `agro langfuse apply` must run at sandbox bootstrap, as `sandbox`, before the
  cron service starts.
- **FR-14:** Disabling must delete the credential fragment and retain non-secret settings.
- **FR-15:** No command may print a credential; all display goes through `prompt.redact`.
- **FR-16:** The fragment path must be covered by `.claude/settings.json` `permissions.deny`.
  This is already true via the existing `**/.config/**` rules, so the requirement is a
  verification, not an edit. Choosing `~/.config/agro/` over another location is what
  satisfies it.
- **FR-17:** Provider logic must live under `lib/tracing/providers/`, keeping the command
  surface singular while leaving the seam provider-shaped.
- **FR-25:** The wizard must register in the existing `INTEGRATIONS` registry as
  `agro config langfuse` without altering the `Integration` interface. The non-interactive
  verbs `apply`, `status`, and `disable` live under `agro langfuse`, because that registry
  hosts flagless interactive wizards only.
- **FR-18:** Running any command on the host must persist settings and state clearly that the
  apply happens in the sandbox.
- **FR-19:** No command, flag, or document may describe this feature as OpenTelemetry. Native
  OTel is a separate path that emits runtime spans without prompts or cost
  (`docs/integrations/langfuse.md:15`, `docs/harnesses/claude-code.md:51`).
- **FR-20:** The credential fragment must be written as bare `KEY=value` lines so systemd
  `EnvironmentFile` accepts it; the tracked `.zshenv` must wrap its source in `set -a` /
  `set +a` so shells still export the values.
- **FR-21:** `openharness-cron.service` must load the fragment through
  `EnvironmentFile=-`, so an unattended session is traced without depending on tmux
  spawning a login shell.
- **FR-22:** A Codex writer must ship through the same seam as Claude Code and Pi, write the
  explicit `codex` tag, and must not edit `~/.codex/config.toml`.
- **FR-23:** `setup` must detect missing Langfuse plugins and may install one only after an
  explicit confirmation. `apply` must never install and never prompt.
- **FR-24:** `status` must report, per harness, both plugin state and generated-file state,
  so a silent no-trace condition always has a named cause.

## Technical Considerations

**Reuse, do not rebuild:**

| Need | Existing surface |
|---|---|
| Wizard loop | `runWizard`, `.agro/cli/src/commands/sandbox.ts:169` |
| Interactivity gate | `sandbox.ts:265` |
| Masked input | `prompt.askSecret`, `lib/prompt.ts:63` |
| Step headers | `prompt.step`, `lib/prompt.ts:33` — currently no callers |
| Secret redaction | `prompt.redact`, `lib/prompt.ts:47` |
| Secret read/write | `readSecret` / `setSecret`, `lib/secrets.ts` |
| Injected IO for tests | `SecretIO`, `commands/secret.ts:15` |
| Config validation | `validateOhConfig`, `OH_CONFIG_FIELDS`, `lib/oh-config.ts` |

**Constraints:**

- `compose-env-boundary.sh` is an armed probe, not a guideline. Compose is closed.
- `agro.json` is git-tracked (`commands/config.ts:70`). Secrets are refused there already.
- Agent and harness share the `sandbox` uid. A read boundary is a harness deny-rule; file
  mode cannot separate them. `0600` protects against other users, not against the agent.
- `agro destroy` removes named volumes, so every generated file is disposable by design. This
  is why bootstrap re-apply (US-007) is a requirement and not a convenience.
- `seed_home` (`.devcontainer/entrypoint.sh:91`) skips any file that already exists, so a
  tracked `.zshenv` will not overwrite an operator's own. US-009 surfaces that case.

**To verify during implementation (assumptions, not established facts):**

- Whether the Claude Code plugin's `Stop` hook child process inherits the parent env through
  its `uv` invocation. The whole Claude Code path depends on it.
- Whether Herdr sets tmux `default-command` anywhere outside `~/.tmux.conf`. If it does, panes
  may not spawn a login shell and US-004's non-interactive coverage becomes load-bearing.

## Success Metrics

- Configuring Langfuse for all three default harnesses takes one command and under two
  minutes, replacing three hand-edited files plus shell exports.
- A key rotation is a single `agro langfuse setup` re-run; `status` reports `current` for
  every file afterward.
- After `agro destroy` and recreate, traces resume with no operator action.
- A cron-fired session produces traces — verified by a trace tagged with the configured
  environment from an unattended run.
- Exactly one file on disk contains Langfuse credentials, and it is deny-listed.

## Knowledge Context

- **Base commit**: `ece037594252c3bc7e57328aadf73aaec55a581a`
- **Queries**: `compose env boundary`, `cli config render`, `evals probes`, `sandbox entrypoint`
- **Knowledge used**: `[[compose-env-boundary]]`, `[[pattern-cli-bundled-asset-relative-import]]`, `[[pattern-evals-probe-failure-path-untested]]`, `[[pattern-evals-unexercised-oracle]]`
- **Grounded against**: `.agro/cli/src/lib/config-render.ts`, `.agro/cli/src/lib/secrets.ts`, `.agro/cli/src/lib/oh-config.ts`, `.agro/cli/src/lib/harnesses/catalog.ts`, `.agro/cli/src/lib/prompt.ts`, `.agro/cli/src/commands/config.ts`, `.agro/cli/src/commands/secret.ts`, `.agro/cli/src/commands/sandbox.ts`, `.devcontainer/docker-compose.yml`, `.devcontainer/Dockerfile`, `.devcontainer/entrypoint.sh`, `.devcontainer/openharness-bootstrap.service`, `.agro/scripts/cron-runtime.ts`, `.agro/evals/probes/compose-env-boundary.sh`, `.agro/evals/probes/config-schema-parity.sh`, `docs/integrations/langfuse.md`, `agro.json`, `.example.env`
- **Conflicts discovered**: `none` — `[[compose-env-boundary]]` matched the current sources on every claim this plan leans on. Its `verified_at` predates this work; the page needs an additive update, not a correction (see Expected Knowledge Impact).

Three recalled items changed the plan rather than merely confirming it:

- `[[compose-env-boundary]]` supplied the rule that closes compose to `LANGFUSE_*` and named `GH_TOKEN` as a literal exception rather than a precedent. This is the reason the design routes credentials through a sandbox-side fragment instead of the obvious compose variable.
- `[[pattern-cli-bundled-asset-relative-import]]` warns that `.devcontainer/Dockerfile` stages `.agro/cli/` alone and builds it there, so a relative import reaching outside the package breaks that one build site. US-003's provider module must not import the tracked `.zshenv` or any `.devcontainer/` asset by relative path.
- `[[pattern-evals-probe-failure-path-untested]]` and `[[pattern-evals-unexercised-oracle]]` require every new probe in this task to have its failing branch executed once by fault injection, with the injection recorded. A probe that has only ever passed proves nothing.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `compose-env-boundary`
- **Affected source paths**: `.agro/cli/src/lib/config-render.ts`, `.agro/cli/src/lib/oh-config.ts`, `.agro/cli/src/lib/harnesses/catalog.ts`, `.devcontainer/docker-compose.yml`, `.devcontainer/Dockerfile`, `.devcontainer/entrypoint.sh`, `.agro/evals/probes/compose-env-boundary.sh`
- **Reason**: `[[compose-env-boundary]]` documents the routes configuration takes into the sandbox and lists every `environment:` literal. This task adds a third route — a sandbox-side credential fragment plus per-harness generated files — and touches seven of that page's declared `sources:`. The page stays correct about compose; it becomes incomplete about the whole boundary. The update is additive and must advance `verified_at`.

## Plan Reconciliation

- **Source plan**: `.agro/tasks/langfuse-config-wizard/prd.md` (approved in-session; scope revised by three operator decisions recorded as D6, D7, D9 in `MEMORY.md`)
- **Intent preserved**: YES
- **Material deviations**: `none`
- **Constraints discovered during grounding**: three, none contradicting the approved plan —
  (1) the credential fragment must serve two consumers with incompatible formats, resolved as D10 (bare `KEY=value` plus `set -a` in `.zshenv`) rather than by rendering two files;
  (2) `[[pattern-cli-bundled-asset-relative-import]]` constrains how the provider module may reference tracked assets;
  (3) new probes require recorded fault injection per `[[pattern-evals-probe-failure-path-untested]]`;
  (4) `.agro/cli/src/cli.ts:84` already carries an empty `INTEGRATIONS` wizard registry built
  for exactly this case. Grounding surfaced it, the operator was asked because it changes the
  mechanism the PRD named, and approved the hybrid: `agro config langfuse` for the wizard,
  `agro langfuse <verb>` for the non-interactive commands. `Integration` stays unchanged.
- **Orchestration preserved**: NOT-APPLICABLE — the approved PRD carries no `## advisor orchestration strategy`; this build uses the default advisor-first dispatch from `.agro/skills/spec/references/execute.md`.


## Open Questions

1. Should `agro langfuse status` be wired into `agro doctor` or the sandbox login banner, so
   drift surfaces without being asked? Deferred; not required for this change.
2. Should the base-URL health check run from inside the sandbox when `setup` is invoked on the
   host, given the URL may only resolve there? Current answer: warn and save, per US-008.
3. Does the Pi plugin honor any disable flag in its JSON file? Undocumented. US-010 does not
   depend on it — fragment removal is the off switch — but confirming would allow a
   defence-in-depth flag.
5. Can Codex hook trust be detected reliably from `~/.codex/config.toml` alone, or does it
   need `codex` to report it? US-012 assumes the `trusted_hash` grep from
   `docs/integrations/langfuse.md` is sufficient; verify before relying on it in `status`.
6. Does each harness expose a scriptable plugin listing with a stable exit code? US-013's
   detection depends on it and degrades to `unknown` if not.
4. When a second provider appears, does promoting to `agro tracing config <provider>` keep
   `agro langfuse` as an alias indefinitely, or through a deprecation window?
