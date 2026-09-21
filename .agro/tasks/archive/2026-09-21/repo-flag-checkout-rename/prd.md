# PRD: Rename `--repo` to `--checkout`

Tracks GitHub issue #1043. Follows #1042, merged as `e65e7a50`.

## Introduction

`--repo` names a git concept. The flag takes a host path and binds it at
`/home/sandbox/harness`. The name implies the directory must be a repository. It
says nothing about the real requirement that #1042 made explicit: build mode
applies only when the path contains `.devcontainer/Dockerfile`.

#1042 added `--home-mount`. The install command now exposes two bind mounts, so
the names must separate them:

| Flag | Target | Meaning |
|---|---|---|
| `--home-mount <dir>` | `/home/sandbox` | Where the sandbox persists |
| `--checkout <dir>` | `/home/sandbox/harness` | Bind an existing checkout; selects build mode |

`--checkout` states what the directory is. `--workspace` was considered and
rejected. The persistence mount is the workspace, the compose default volume is
named `workspace`, and reusing the term would collide with `--home-mount`.

This is a rename of the operator-facing surfaces. It changes no behavior.

## Goals

- Rename the install flag to `--checkout`, and keep `--repo` working.
- Rename the config field to `checkout`, and keep reading `repo`.
- Freeze the env key `AGRO_REPO_DIR` and both compose files.
- Preserve `entryRepo()` cwd-based sandbox resolution under both spellings.

## User Stories

### US-001: Rename the install flag

**Description:** As an operator, I want `--checkout <dir>` to name what the
directory is, so that the flag does not imply a git requirement.

**Acceptance Criteria:**

- [ ] `--checkout <dir>` is accepted by `agro sandbox install`
      (`.agro/cli/src/cli.ts:735-745`)
- [ ] `--repo <dir>` still works and produces an identical rendered config
- [ ] Passing both flags is an error that names both spellings
- [ ] `agro sandbox install --help` documents `--checkout` and marks `--repo` as
      the deprecated alias (`.agro/cli/src/cli.ts:255-271`)
- [ ] Tests pass
- [ ] Typecheck passes

### US-002: Rename the config field

**Description:** As an operator reading `agro.json`, I want the field to match
the flag, so that one concept has one name.

**Acceptance Criteria:**

- [ ] `checkout` is a valid config field
      (`.agro/cli/src/lib/oh-config.ts:98,189,334`)
- [ ] A config file holding `repo` still resolves, and its value is used
- [ ] `checkout` outranks `repo` when a file holds both, and the precedence is
      documented
- [ ] `agro config set checkout <dir>` writes the new field
- [ ] `agro config show` reports the value under the field the file uses
- [ ] Tests pass
- [ ] Typecheck passes

### US-003: Preserve cwd-based sandbox resolution

**Description:** As an operator, I want lifecycle verbs run from inside a bound
checkout to keep resolving the right sandbox, so that the rename changes no
behavior.

**Acceptance Criteria:**

- [ ] `entryRepo()` resolves under both field spellings
      (`.agro/cli/src/lib/registry.ts:56,136-137`)
- [ ] A lifecycle verb run from inside a bound checkout resolves the correct
      sandbox for an entry written with `repo`
- [ ] The same holds for an entry written with `checkout`
- [ ] An unrelated cwd still produces the ambiguity error
- [ ] Tests pass
- [ ] Typecheck passes

### US-004: Keep the D-3 image pin correct under the new name

**Description:** As an operator, I want the published-image pin from #1042 to
keep firing, so that a non-checkout path does not regress to a missing image.

**Acceptance Criteria:**

- [ ] The `image.ref` fill at `.agro/cli/src/commands/sandbox.ts:285-291` reads
      the renamed field
- [ ] `--checkout <non-checkout dir>` resolves to `image.mode: "image"` with
      `image.ref` set to `DEFAULT_SANDBOX_IMAGE`
- [ ] `--repo <non-checkout dir>` behaves identically
- [ ] A seed or explicit `--image <ref>` still outranks the fill
- [ ] Tests pass
- [ ] Typecheck passes

### US-005: Update the documentation

**Description:** As an operator reading the docs, I want one name per concept, so
that I am not choosing between two spellings.

**Acceptance Criteria:**

- [ ] `docs/installation.md`, `docs/quickstart.md`, and `docs/configuration.md`
      use `--checkout` and the `checkout` field
- [ ] Each states that `--repo` and `repo` remain supported aliases
- [ ] `docs/configuration.md` keeps `AGRO_REPO_DIR` as the env key, unrenamed
- [ ] Prose passes the `/ste` checker
- [ ] A CHANGELOG entry exists per `.agro/skills/git/SKILL.md`
- [ ] Typecheck passes

### US-006: Confirm the regression floor

**Description:** As the advisor, I want the probe suite green and unedited, so
that the rename is provably behavior-neutral.

**Acceptance Criteria:**

- [ ] `/eval` reports no regression
- [ ] `.agro/evals/probes/oh-devcontainer-restructure.sh`,
      `.agro/evals/probes/oh-home-mount.sh`, and
      `.agro/evals/probes/oh-image-only-deploy.sh` are byte-identical and pass
- [ ] `.agro/cli/src/lib/__tests__/registry.test.ts:192` is byte-identical and
      passes
- [ ] `git diff development...HEAD -- .devcontainer/` is empty
- [ ] Tests pass
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `agro sandbox install` must accept `--checkout <dir>`.
- FR-2: `--repo <dir>` must remain a working alias and produce an identical
  rendered config.
- FR-3: Passing `--checkout` and `--repo` together must be an error.
- FR-4: `checkout` must be a valid config field, and `repo` must remain readable.
- FR-5: `checkout` must outrank `repo` when both are present.
- FR-6: `AGRO_REPO_DIR`, `OH_REPO_DIR`, and both compose files must keep their
  current spelling.
- FR-7: `entryRepo()` must resolve under both field spellings.
- FR-8: The `image.ref` fill from #1042 must read the renamed field.

## Non-Goals

- Renaming `AGRO_REPO_DIR` or `OH_REPO_DIR`.
- Editing `.devcontainer/docker-compose.yml` or
  `.devcontainer/docker-compose.image-only.yml`.
- Editing `.devcontainer/entrypoint.sh`.
- Removing the `--repo` flag or the `repo` field. Deprecation timing is a
  separate decision.
- Changing any install behavior. This is a rename.
- Reworking how `materialize()` selects the compose base. See Technical
  Considerations.

## Technical Considerations

- **Do not rename the env key.** `.devcontainer/docker-compose.yml:9,13` reads
  `${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}`. That chain is already a two-generation
  compatibility contract. A third spelling would make every reference
  `${AGRO_CHECKOUT_DIR:-${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}}` and force edits to
  four protected files and two knowledge pages. No operator types the env
  variable. The flag and the config file caused the confusion in #1042. The wire
  format did not.
- **`repo` carries a third meaning.** `entryRepo()` resolves which sandbox a
  lifecycle verb addresses when the operator runs it from inside that directory
  (`.agro/cli/src/lib/registry.ts:56,136-137`). The field is the sandbox's
  host-side identity anchor, not only a mount argument.
- **A known conflation, deliberately left alone.** `materialize()` selects the
  compose base from the presence of `repo` alone
  (`.agro/cli/src/lib/registry.ts:93-99`), not from the effective `image.mode`.
  That is why #1042 needed decision D-3: a non-checkout path gets the
  build-capable base, whose image default is the local build-target name, so the
  install pins `DEFAULT_SANDBOX_IMAGE` to compensate
  (`.agro/cli/src/commands/sandbox.ts:285-291`). Selecting the base from the
  effective mode would remove the need for that pin. **Do not attempt it in this
  task.** It is a behavior change, and this task is a rename. Raise it as a
  separate issue if the rename makes the coupling harder to carry.

## Success Metrics

- `agro sandbox install docker --checkout <harness checkout>` and the same
  command with `--repo` produce byte-identical rendered configs.
- An entry created before this change keeps working with no operator action.
- `/eval` reports no regression, with the four protected files unedited.

## Open Questions

- Should `agro config show` normalize a legacy `repo` field to `checkout` on the
  next write, or leave the file as the operator wrote it? Leaving it is the
  smaller change and is the assumed default.
- Should `--repo` print a deprecation notice on use, or stay silent until a
  removal is scheduled? Silent is the assumed default, because no removal date
  exists.
