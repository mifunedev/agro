# US-008 · Supported migration path check (`agro migrate --check`)

- **Issue:** [#944](https://github.com/mifunedev/agro/issues/944), user story US-008
- **Date:** 2026-09-08 (UTC)
- **Verdict:** the supported path **applies to both repositories**. `status: ready`,
  exit code `0`, no conflicts, in both cases.

This contradicts the PRD's working hypothesis. PRD finding F4 says: "Neither is a
fully equipped control plane — no `cli`, `scripts`, `hooks`, or config — so
`agro migrate --check` decides whether the supported path applies." The check was
run, and the answer is that `agro migrate` **has no equipped-control-plane
requirement**. It is a name migration, not a control-plane migration.

## Which repositories carry `.oh/` — re-verified

Re-derived from the US-001 scan rather than taken from the PRD. Two independent
methods agree.

Content scan, from `consumer-inventory.md`:

```bash
git -C <clone> ls-files | grep -E '(^|/)\.oh/'
```

Root-marker scan through the API, over all 32 repositories:

```bash
for n in $(jq -r '.[].name' repos.json); do
  gh api "repos/mifunedev/$n/contents/" \
    --jq '[.[].name] | map(select(. == ".oh" or . == ".agro" or . == "oh.json" or . == "agro.json")) | join(",")'
done
```

| Repository | Scanned SHA | `.oh/` tracked files | Contents |
|---|---|---|---|
| `mifunedev/agro` | `823aabbd7324e08e3b685af6b0a5ef5c3467a15f` | 539 | full control plane, plus root `oh.json` |
| `mifunedev/openharness-cloud` | `0aa8f999c3ef79ff8c116517b192206e5d69ba45` | 131 | `.oh/tasks` (129), `.oh/skills` (2) |
| `mifunedev/agro-web` | `409ef104a3bf5a0b49f4cb68a1437e75938e8de0` | 6 | `.oh/tasks` only, one folder |

All other 29 repositories carry no `.oh/`, `.agro/`, `oh.json`, or `agro.json` at
the root and no tracked file under any `.oh/` path.

**Correction:** the PRD says only two repositories carry a `.oh/` directory. There
are three. `mifunedev/agro` carries its own — but that is **default-branch
release lag**, not a compatibility surface awaiting Phase 5 retirement: the
Phase 2 `.oh/` → `.agro/` cutover is already merged to `development` @
`b10ecac3` and simply unreleased, while `main` @ `823aabb` is the v0.9.0 release
point and predates it. It is out of scope for US-008 for that reason, not
because anything there is pending migration. The literal count in F4 is
nonetheless wrong. `agro-web` and `openharness-cloud` are the two in scope, as
the PRD intends.

## What `agro migrate` actually requires

Read from `.agro/cli/src/commands/migrate.ts` and `.agro/cli/src/lib/migrate.ts`
in the harness checkout, and from `docs/lifecycle-commands.md:135-171`.

- The **only** precondition is a root marker.
  `migrate.ts:88` — `export const ROOT_MARKERS = [".oh", ".agro", "oh.json", "agro.json"];`
  `findProjectRoot()` walks up from the current directory to the nearest ancestor
  holding one. There is no check for `cli/`, `scripts/`, `hooks/`, a manifest, or
  a config file.
- The migration is a **wholesale rename**: `.oh/` → `.agro/` and `oh.json` →
  `agro.json`, plus re-pointing five provider symlinks (`.claude/skills`,
  `.claude/hooks`, `.codex/skills`, `.agents/skills`, `.pi/skills`) from
  `../.oh/…` to `../.agro/…`.
- It **refuses** rather than merges: a byte-identical legacy copy is retired to
  `<name>.migrated`; divergent legacy and AGRO copies are a conflict, exit `2`,
  and nothing is moved. There is no force option.
- It **never touches** `~/.openharness`, `.env`, or `.git`.
- Exit codes: `0` applied or nothing to do, `2` refused (conflict or lock held on
  `.agro-migrate.lock`), `1` failure.

## How the command was invoked

`agro` is **not** on `PATH` in this sandbox. The installed executable is
`/usr/local/bin/oh` → `/opt/oh/dist/oh.js`, version **0.7.0**, and it does not
carry the verb:

```
$ oh --version
0.7.0
$ oh migrate --help
oh: unknown command "migrate"
```

`docs/lifecycle-commands.md:142` says "`oh migrate` dispatches to the same
command", which is true of a current build but not of the 0.7.0 binary baked into
this image. So the CLI was built from source the way the repository builds it —
`.agro/cli/package.json` `scripts.build` is `node build.mjs`:

```bash
cp -a /home/sandbox/harness/.agro/cli <scratch>/cli
ln -s /opt/oh/node_modules <scratch>/cli/node_modules      # esbuild, from the image
cd <scratch>/cli && OH_ASSET_ROOT=/home/sandbox/harness node build.mjs
# -> dist/agro.js  203.8kb   (and a byte-identical dist/oh.js)

$ node <scratch>/cli/dist/agro.js --version
0.9.0
```

`OH_ASSET_ROOT` is `build.mjs`'s documented asset-root override
(`build.mjs:10`), pointed at the harness checkout so the bundled assets resolve.
Nothing was written inside `/home/sandbox/harness/.agro/cli`.

Each repository was scanned into a **disposable scratchpad copy**. The real
operator clone at `/home/sandbox/harness/projects/mifunedev/openharness-cloud`
was never a target; it was read once with `git rev-parse origin/development` and
otherwise untouched. `--check` was passed on every invocation. `--home` was never
passed, so the sandbox registry was never a target either.

---

## `mifunedev/agro-web` @ `409ef104a3bf5a0b49f4cb68a1437e75938e8de0`

### Preconditions observed

```
root markers:  .oh   (present)
               .agro, oh.json, agro.json  -> absent
provider link dirs: .claude, .codex, .agents, .pi  -> all absent
.oh/ contents: .oh/tasks/sandbox-registry-one-door/{evidence.md,plan.md,prd.json,prd.md,progress.txt,simplify-rounds.json}
```

### Command

```bash
cd <scratch>/migrate-check/agro-web
node <scratch>/cli/dist/agro.js migrate --check
```

### Full output

```
agro migrate: plan for <scratch>/migrate-check/agro-web
  rename  <scratch>/migrate-check/agro-web/.oh -> <scratch>/migrate-check/agro-web/.agro
  noop    <scratch>/migrate-check/agro-web/agro.json (absent in both generations)
  noop    <scratch>/migrate-check/agro-web/.claude/skills (link absent)
  noop    <scratch>/migrate-check/agro-web/.claude/hooks (link absent)
  noop    <scratch>/migrate-check/agro-web/.codex/skills (link absent)
  noop    <scratch>/migrate-check/agro-web/.agents/skills (link absent)
  noop    <scratch>/migrate-check/agro-web/.pi/skills (link absent)
status: ready
```

### Exit code

`0`

### Machine-readable plan (`--check --json`)

```json
{
  "version": 1,
  "root": "<scratch>/migrate-check/agro-web",
  "status": "ready",
  "steps": [
    {
      "kind": "rename",
      "from": "<scratch>/migrate-check/agro-web/.oh",
      "to": "<scratch>/migrate-check/agro-web/.agro",
      "snapshot": { "type": "directory", "mode": 493, "ino": 1230964, "mtimeMs": 1788929121704.1448, "size": 4096 },
      "createsParent": false
    },
    { "kind": "noop", "path": "<scratch>/migrate-check/agro-web/agro.json", "reason": "absent in both generations" },
    { "kind": "noop", "path": "<scratch>/migrate-check/agro-web/.claude/skills", "reason": "link absent" },
    { "kind": "noop", "path": "<scratch>/migrate-check/agro-web/.claude/hooks", "reason": "link absent" },
    { "kind": "noop", "path": "<scratch>/migrate-check/agro-web/.codex/skills", "reason": "link absent" },
    { "kind": "noop", "path": "<scratch>/migrate-check/agro-web/.agents/skills", "reason": "link absent" },
    { "kind": "noop", "path": "<scratch>/migrate-check/agro-web/.pi/skills", "reason": "link absent" }
  ],
  "conflicts": []
}
```

### Verdict

**The supported path applies.** One `rename` step, no `rewrite` step, no
conflict, exit `0`. `agro migrate` is the correct mechanism; an ad hoc directory
rename is neither needed nor permitted.

Historical content is preserved: the plan contains **no `rewrite` step**, so no
file is opened or edited. The single operation is a directory `renameSync`, which
moves the inode and leaves every byte, permission bit, and symlink target intact.

No follow-up edit is required. `.oh/tasks/sandbox-registry-one-door/` has no live
reference anywhere outside `.oh/`:

```bash
git grep -nIE 'sandbox-registry-one-door' -- . ':!.oh/'   # empty
```

The other `.oh/` strings in `agro-web` (`scripts/build-oh-cli.mjs:24`
`CLI_DIRS = [".agro/cli", ".oh/cli"]`, `scripts/sync-external-scripts.mjs:32`
`PRE_RENAME_SCRIPTS_DIR = ".oh/"`, and the `docs/`/`blog/` prose) all describe the
**runtime repository's** control plane, not `agro-web`'s own directory. They are
deliberate compatibility fallbacks and must not be touched by this migration.

---

## `mifunedev/openharness-cloud` @ `0aa8f999c3ef79ff8c116517b192206e5d69ba45`

### Preconditions observed

```
root markers:  .oh   (present)
               .agro, oh.json, agro.json  -> absent
provider link dirs: .claude, .codex, .agents, .pi  -> all absent
.oh/ contents: .oh/tasks (129 tracked files), .oh/skills (2 tracked files:
               .oh/skills/dev-tmux/SKILL.md, .oh/skills/dev-tmux/scripts/dev-tmux.sh)
tracked symlinks in the repository: none
```

### Command

```bash
cd <scratch>/migrate-check/openharness-cloud
node <scratch>/cli/dist/agro.js migrate --check
```

### Full output

```
agro migrate: plan for <scratch>/migrate-check/openharness-cloud
  rename  <scratch>/migrate-check/openharness-cloud/.oh -> <scratch>/migrate-check/openharness-cloud/.agro
  noop    <scratch>/migrate-check/openharness-cloud/agro.json (absent in both generations)
  noop    <scratch>/migrate-check/openharness-cloud/.claude/skills (link absent)
  noop    <scratch>/migrate-check/openharness-cloud/.claude/hooks (link absent)
  noop    <scratch>/migrate-check/openharness-cloud/.codex/skills (link absent)
  noop    <scratch>/migrate-check/openharness-cloud/.agents/skills (link absent)
  noop    <scratch>/migrate-check/openharness-cloud/.pi/skills (link absent)
status: ready
```

### Exit code

`0`

### Machine-readable plan (`--check --json`)

```json
{
  "version": 1,
  "root": "<scratch>/migrate-check/openharness-cloud",
  "status": "ready",
  "steps": [
    {
      "kind": "rename",
      "from": "<scratch>/migrate-check/openharness-cloud/.oh",
      "to": "<scratch>/migrate-check/openharness-cloud/.agro",
      "snapshot": { "type": "directory", "mode": 493, "ino": 1231221, "mtimeMs": 1788929255891.1987, "size": 4096 },
      "createsParent": false
    },
    { "kind": "noop", "path": "<scratch>/migrate-check/openharness-cloud/agro.json", "reason": "absent in both generations" },
    { "kind": "noop", "path": "<scratch>/migrate-check/openharness-cloud/.claude/skills", "reason": "link absent" },
    { "kind": "noop", "path": "<scratch>/migrate-check/openharness-cloud/.claude/hooks", "reason": "link absent" },
    { "kind": "noop", "path": "<scratch>/migrate-check/openharness-cloud/.codex/skills", "reason": "link absent" },
    { "kind": "noop", "path": "<scratch>/migrate-check/openharness-cloud/.agents/skills", "reason": "link absent" },
    { "kind": "noop", "path": "<scratch>/migrate-check/openharness-cloud/.pi/skills", "reason": "link absent" }
  ],
  "conflicts": []
}
```

### Verdict

**The supported path applies.** Identical shape to `agro-web`: one `rename`, no
`rewrite`, no conflict, exit `0`. Historical `.oh/tasks` content is preserved
unmodified for the same reason — the plan opens no file.

**One follow-up edit is required in the same change.** `agro migrate` renames the
directory; it does not rewrite prose. Cloud has **live operator references** to
paths inside its own `.oh/`, which the rename would break:

```
docs/browser-gateway-runbook.md:200   bash .oh/skills/dev-tmux/scripts/dev-tmux.sh start \
docs/browser-gateway-runbook.md:216   bash .oh/skills/dev-tmux/scripts/dev-tmux.sh verify \
docs/browser-gateway-runbook.md:234   bash .oh/skills/dev-tmux/scripts/dev-tmux.sh status
docs/browser-gateway-runbook.md:235   bash .oh/skills/dev-tmux/scripts/dev-tmux.sh attach
docs/browser-gateway-runbook.md:236   bash .oh/skills/dev-tmux/scripts/dev-tmux.sh repair
docs/browser-gateway-runbook.md:237   bash .oh/skills/dev-tmux/scripts/dev-tmux.sh repair --dry-run
docs/browser-gateway-runbook.md:238   bash .oh/skills/dev-tmux/scripts/dev-tmux.sh stop
docs/browser-gateway-runbook.md:276   `bash .oh/skills/dev-tmux/scripts/dev-tmux.sh restart-web`
```

These eight lines are the only breaking references. Every other `.oh/` mention in
Cloud outside `.oh/` itself is a **citation of a historical task record** in a
comment or a doc, which stays accurate either way but reads better if updated:

```
README.md:874                                  .oh/tasks/ovh-docker-replatform/prd.md
apps/provisioner/src/billing.ts:63             .oh/tasks/billing-meter-name-mismatch/prd.md
apps/web/lib/email/boundary.test.ts:25         .oh/tasks/transactional-email-boundary/prd.md
apps/web/lib/email/resend-transport.ts:36      .oh/tasks/transactional-email-boundary/prd.md
apps/web/lib/simplify-user-org-invariants.test.ts:258,281
apps/web/lib/user-roles.test.ts:39             .oh/tasks/org-invite-email/
apps/web/lib/users-client.test.ts:44
docs/design/console-mvp.md:22,414              .oh/tasks/neon-inspired-console/…
docs/email-runbook.md:34,523                   .oh/tasks/transactional-email-boundary/prd.md
```

---

## Summary

| Repository | `agro migrate --check` status | Exit | Supported path applies? | Disposition |
|---|---|---|---|---|
| `mifunedev/agro-web` | `ready` | `0` | **yes** | Run `agro migrate` (no flags). No follow-up edit needed. |
| `mifunedev/openharness-cloud` | `ready` | `0` | **yes** | Run `agro migrate` (no flags), and in the same commit repoint the 8 live `docs/browser-gateway-runbook.md` command paths from `.oh/skills/dev-tmux/…` to `.agro/skills/dev-tmux/…`. |
| `mifunedev/agro` | not run — out of US-008 scope | — | n/a | Its `.oh/` is **not** a compatibility surface awaiting retirement. The Phase 2 `.oh/` → `.agro/` cutover is already merged to `development` @ `b10ecac3` and simply unreleased, so `main` @ `823aabb` shows default-branch release lag. Nothing to migrate here, by this or any later phase. |

No ad hoc directory rename is proposed or performed anywhere. Historical
`.oh/tasks` content is preserved unmodified in both repositories, because the
supported path performs a directory rename and rewrites no file.

## Limitations

1. **`--check` only. Nothing was applied.** `agro migrate` without `--check` was
   never run, in the scratchpad or anywhere else. The "content is preserved"
   claim is read from the plan (`rename` only, zero `rewrite` steps) and from
   `applyMigration`'s use of `renameSync`, not observed after an apply.
2. **The check ran on a scratchpad copy, not on a worktree of the target
   repository.** The copy is byte-identical to the shallow clone at the recorded
   SHA, and the scratchpad has no ancestor root marker, so `findProjectRoot()`
   resolved to the copy root in both cases — visible in the `plan for …` line. A
   real worktree nested under another marked checkout could resolve to a different
   root; the implementer must confirm the `plan for` line names the repository
   root before applying.
3. **`agro` is not installed in this sandbox.** The verdict was produced by a CLI
   built from `/home/sandbox/harness/.agro/cli` at version `0.9.0`. The image's
   `oh` is `0.7.0` and has no `migrate` verb, so an operator on this image cannot
   reproduce this check without upgrading the CLI first. That is a real
   reproducibility constraint, not a scan artifact.
4. **Git rename detection was not exercised.** `agro migrate` is a filesystem
   rename and is not git-aware. History across the rename depends on git's own
   rename detection at commit time, which was not verified here.
5. **The eight `browser-gateway-runbook.md` command paths were found by static
   grep**, not by running the runbook. Whether any other operator procedure
   outside the repository depends on the literal path `.oh/skills/dev-tmux/` is
   unknown and cannot be determined from the repository alone.
