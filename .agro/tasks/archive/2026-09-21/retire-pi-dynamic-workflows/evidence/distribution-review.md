# Distribution review (D5, part 1)

Researched by T2, an independent read-only worker. Verdict accepted by the advisor.
Every claim below is cited to current source. Nothing here is inferred from naming.

## Question

Does this repository's `.pi/settings.json` reach an initialized or updated project, so
that removing the pin changes the default package list downstream?

## Answer

**Yes, for a new sandbox workspace seeded from a rebuilt image. No, for an existing
sandbox, and there is no update verb that rewrites the file.**

## Evidence

### There is no `init` verb, and nothing templates a Pi settings file

- `.agro/cli/src/commands/` contains `config.ts`, `harness.ts`, `lifecycle.ts`,
  `migrate.ts`, `sandbox.ts`, `secret.ts`, `self-upgrade.ts`, `tool.ts`, `update.ts`.
  There is no `init.ts`. A grep for `"init"` across `.agro/cli/src` returns nothing.
- No lifecycle source generates or templates a Pi settings file. The only non-test
  `settings.json` literal across `.agro/cli`, `.agro/install`, `.agro/scripts`, and
  `.devcontainer` is `.devcontainer/entrypoint.sh:102`, and it seeds
  `.claude/settings.json`, not `.pi/settings.json`.

### Propagation happens by whole-tree image seed

- `.devcontainer/Dockerfile:111` and `.devcontainer/Dockerfile:131` —
  `COPY --chown=sandbox:sandbox . /opt/agro-seed/` copies the repository tree into the
  image seed.
- `.dockerignore:15-16` excludes `.pi/bridge/` and `.pi/npm/`. It does **not** exclude
  `.pi/settings.json`, so the file enters the seed.
- `.devcontainer/entrypoint.sh:94-125` (`seed_workspace_volume`) resolves the seed
  source through `.agro/scripts/compat.sh:146`, whose root is `/opt/agro-seed`
  (`.agro/scripts/compat.sh:11`).
- `.devcontainer/entrypoint.sh:119` — `cp -a "$src/." "$dest/"` runs **only when the
  control directory is absent**. Lines `:124-126` then write an `.image-seeded` marker,
  and lines `:113-115` short-circuit every later boot on that marker.

## Consequence for the retirement claim

Removing the pin here changes the defaults for a **new** sandbox workspace seeded from a
rebuilt image.

It changes **nothing** for an existing sandbox: that workspace's `.pi/settings.json` is
never re-seeded, and no update or upgrade verb rewrites it. An operator who wants the
retirement to take effect in an existing workspace edits that file themselves.

No downstream project receives the package list by any other path.

## Boundary preserved

This review changed no lifecycle source. The plan's affected-surfaces table marks the
lifecycle door "applied for review" and forbids adding a retirement verb or a bypass.
No such verb was added, and none is proposed.
