# Evidence — repo-flag-checkout-rename (#1043)

Branch `task/1043-repo-flag-checkout-rename`. PR #1045. Base `development` at
`e65e7a50`, which is the #1042 merge, so the planning base and the execution base
are the same commit and no re-grounding drift applies.

Implementation commits: `df56d824` (CLI), `4bdd930d` (docs), `22859d1c`
(knowledge), and the commit carrying this document.

## 0. Why this is better than not doing it

Before this change, `agro sandbox install` exposed two bind mounts whose names did
not separate them. `--home-mount <dir>` binds `/home/sandbox`, and `--repo <dir>`
binds `/home/sandbox/harness`. Neither name says which is which, and `--repo`
actively misleads: it names a git concept, but the directory does not have to be a
repository. What the code actually requires — proven by #1042 — is that the path
hold `.devcontainer/Dockerfile` before build mode applies. #1042 needed a
dedicated decision (D-3) partly because that flag's name had drifted from its
meaning.

After this change the operator reads `--checkout <dir>` and `--home-mount <dir>`
and can tell them apart without opening the source.

The cost, measured: **9 source files, 6 docs pages, 3 knowledge pages, +1 exported
accessor** (`configCheckout`). No behaviour changed, no operator action is
required on any existing sandbox, and no env key or compose file moved. Every
`repo` read in the CLI now routes through one accessor instead of reading the
field directly, which is a small net reduction in the number of places the
compatibility rule is expressed: previously one, now still one, but explicit and
named rather than implicit in each call site.

What this does **not** buy, stated plainly: no capability, no performance, no bug
fixed. It is a naming correction whose benefit is operator comprehension, and
comprehension is not measured here. Recorded as *claimed, unmeasured*.

## 1. What the plan asked for

Rename the operator-facing surfaces of one concept so that concept has one name,
without changing any behaviour and without touching the wire format:

- The install flag becomes `--checkout`; `--repo` keeps working.
- The config field becomes `checkout`; `repo` keeps being read.
- `checkout` outranks `repo`; passing both flags is an error.
- `AGRO_REPO_DIR`, `OH_REPO_DIR`, and both compose files keep their spelling.
- `entryRepo()` cwd-based sandbox resolution keeps working under both spellings.
- The #1042 D-3 `image.ref` pin keeps firing, reading the renamed field.

## 2. What was built

A single accessor, `configCheckout(config)` in `.agro/cli/src/lib/oh-config.ts`,
returns `config.checkout ?? config.repo` and treats an empty string as absent.
Every read of the field routes through it. `--checkout` and `--repo` both map to
one parsed field; `seedConfig` writes `checkout` and never rewrites an existing
`repo`.

All observations below were produced by the advisor against the built CLI. They
are not the workers' reports, and not the workers' unit tests.

### `--checkout` and `--repo` render byte-identical configs (FR-2, success metric)

Two installs into separate registry homes, same target directory:

```
AGRO_HOME=$TMPD/a agro sandbox install docker --yes --name s1 --checkout $TMPD/plain
AGRO_HOME=$TMPD/b agro sandbox install docker --yes --name s1 --repo     $TMPD/plain
diff $TMPD/a/sandboxes/s1/agro.json $TMPD/b/sandboxes/s1/agro.json
→ IDENTICAL
```

The written field is the new spelling:

```
  "image": { "mode": "image", "pullPolicy": "missing", "ref": "ghcr.io/mifunedev/agro:latest" },
  "runtime": "docker",
  "checkout": "/tmp/tmp.9hskfw9voc/plain"
```

### Passing both flags is refused, naming both spellings (FR-3)

```
$ agro sandbox install docker --checkout $TMPD/new --repo $TMPD/old
agro sandbox install: --checkout conflicts with --repo — pass exactly one, and prefer --checkout
```

### `checkout` outranks `repo`, and a legacy file still resolves (FR-4, FR-5)

Three registry entries — one spelling `repo`, one spelling `checkout`, one holding
both — read through `agro sandbox list --json`:

```
"name": "both",   "repo": "/tmp/.../new"     ← checkout wins over repo
"name": "legacy", "repo": "/tmp/.../old"     ← repo-only still resolves
"name": "modern", "repo": "/tmp/.../new"     ← checkout-only resolves
```

### A legacy file is not rewritten (advisor decision Q1)

`config show` on the `repo`-spelled entry reported the value under the field the
file uses, and the file on disk was byte-identical afterwards:

```
$ agro config show --sandbox legacy
  "repo": "/tmp/tmp.FcOsQXcTdO/old"
$ cat .../legacy/agro.json
{"version":1,"name":"legacy","runtime":"docker","repo":"/tmp/tmp.FcOsQXcTdO/old"}
```

### `entryRepo()` cwd resolution survives under both spellings (FR-7, US-003)

The PRD named this the thing most likely to break silently. Two entries
registered — `legacy` (`repo` → `/old`) and `modern` (`checkout` → `/new`) — then
a lifecycle verb run from five directories:

| cwd | entry spelling | observed |
|---|---|---|
| `/old` | `repo` | resolved; reached the docker API |
| `/old/sub` | `repo` | resolved; reached the docker API |
| `/new` | `checkout` | resolved; reached the docker API |
| `/new/sub` | `checkout` | resolved; reached the docker API |
| unrelated | — | `several sandboxes are registered ... name one: legacy, modern` |

Both the exact-match and the `startsWith(repo + sep)` path are covered under both
spellings, and the negative case still produces the ambiguity error.

### The #1042 D-3 pin still fires (FR-8, US-004)

Installing against a directory that holds no `.devcontainer/Dockerfile` produced
`image.mode: "image"` with `image.ref: ghcr.io/mifunedev/agro:latest`
(`DEFAULT_SANDBOX_IMAGE`) — shown in the config above — and the materialised
compose base was the build-capable one:

```
    build:
      context: ${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}
      dockerfile: .devcontainer/Dockerfile
```

That is the conflation the PRD put out of scope, observed intact: `materialize()`
still selects the base from the presence of the path rather than from the
effective `image.mode`, which is exactly why the pin is still required.

### The wire format did not move (FR-6)

`config-render.ts:41` still emits `AGRO_REPO_DIR`; only the source of its value
changed to `configCheckout(config)`. The compose files read
`${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}`, unedited.

### Actual Knowledge Impact

`knowledge-impact.sh` over the real diff: 3 NEEDS-REVIEW, 7 FRESH, 31
NOT-APPLICABLE.

| page | state | basis |
|---|---|---|
| `compose-env-boundary` | UPDATED | Claimed `AGRO_REPO_DIR` is "rendered only when `repo` is set"; now states it is rendered from `configCheckout()` and that the key keeps its spelling. `verified_at` advanced after re-reading against `config-render.ts`, `oh-config.ts`, `registry.ts` and both compose files. |
| `oh-cli-portable-lifecycle` | UPDATED | Described `--repo` as the flag and `repo` as the field throughout, including the D-3 sentence and the cwd-resolution sentence. Rewritten to the alias model; stale `sandbox.ts` line cites corrected against HEAD. `verified_at` advanced. |
| `fresh-machine-setup` | UPDATED | Mirrored the docs pages this branch changed. Brought in line with them. `verified_at` advanced. |

`.agro/knowledge/README.md` regenerated; `wiki-readme-index.sh` PASSes.

### Regression floor (US-006)

- Frozen sha256, checked against a baseline recorded **before any work** and
  re-checked after **each** commit: 7/7 OK every time. The four files the PRD
  named plus both compose files and `entrypoint.sh`.
- `git diff origin/development...HEAD -- .devcontainer/` — empty.
- `/eval`: runner exit 0, 146 probes, **zero status changes** against a baseline
  captured on `development@e65e7a50` before any work began.
  `oh-devcontainer-restructure`, `oh-home-mount`, `oh-image-only-deploy` PASS and
  are byte-identical; the frozen `registry.test.ts` passes on the alias.
- Tests: 1411 passing, typecheck clean.

## 3. Where the implementation diverged from the plan, and why

Three divergences. None is silent.

1. **US-005's docs list was extended from three pages to six.** The plan named
   `installation.md`, `quickstart.md`, `configuration.md`. The worker flagged that
   `deployment-prebuilt-image.md` carried a section headed
   `## --repo: bind a checkout into the sandbox` and is the primary operator page
   for this flag, and that `lifecycle-commands.md` holds the `sandbox install`
   synopsis while `oh-directory-layout.md` holds the `agro.json` field list. The
   advisor accepted all three into scope: leaving them would have the docs teach
   the deprecated alias as the primary spelling, which defeats the stated goal of
   one name per concept. Same mechanical rename; no behaviour change; no frozen
   file touched.

2. **`SandboxRow.repo` was deliberately NOT renamed.** It is emitted as a JSON key
   by `agro sandbox list --json`, which makes it a machine-readable consumer
   contract with no aliasing story available. The PRD lists behaviour changes as a
   non-goal, so the advisor left it. The `agro sandbox list` value column
   therefore still reads `repo` while everything around it reads `checkout`. This
   is a real residual inconsistency and is disclosed rather than fixed. It
   deserves its own issue.

3. **Both PRD open questions were decided by the advisor, both to the assumed
   default**, and both are now observable rather than assumed:
   - No normalisation of a legacy `repo` field on write. Verified above.
   - `--repo` prints no deprecation notice. No removal date exists, so a
     per-invocation warning on a supported alias would be noise. The deprecation
     signal lives in `--help` and the docs.

## 4. What remains unverified

- **Two failing tests, carried forward, not caused by this change.**
  `commands/__tests__/migrate-rehearsal.test.ts` fails 2 assertions (`agro ps` /
  `oh ps` expect exit 0). The advisor reproduced both failures identically on
  clean `development` with none of this branch's changes; the cause is the absent
  Docker daemon socket (`dial unix /var/run/docker.sock: no such file or
  directory`), which the test's own `dockerComposeAvailable()` probe cannot detect
  because `docker compose version` succeeds without a daemon. Test delta is zero.
  This suite has never been observed green in this environment.
- **Three persistent red probes, pre-existing, all `delta=unchanged`.**
  `curl-bash-safe-alternatives` (`python3: command not found`), `skills-vendored`
  (`cc-safety-net` binary absent), and `oh-config-surfaces`. The advisor compared
  `oh-config-surfaces` specifically, because it is a config-surface probe and this
  task renames a config field: its detail line is byte-identical between the base
  run and the branch run, so it did not worsen. None is gating.
- **No sandbox was actually started.** There is no Docker daemon in this
  environment, so every install observation above stops at the point the CLI hands
  off to `docker compose`. The config rendering, the field resolution, the compose
  base selection and the image pin are all observed; the container lifecycle is
  not. A reviewer with a daemon should confirm one `--checkout` install end to end.
- **The `/ste` checker reports a pre-existing backlog** on the docs pages (96
  findings across the round-1 files, 45 across round-2). The worker verified by
  before/after differential that the count is unchanged and no finding lands on a
  line authored here, but the backlog itself is untouched.
- **`oh-cli-portable-lifecycle.md` is ~2870 words against the schema's ≤900
  guidance.** Pre-existing; this change did not widen it materially (net +18/−8
  lines across all three knowledge pages). Not addressed.
- **`agro config repo`** — the unrelated GitHub-remote verb that shares the word —
  was confirmed untouched by inspection, not by a dedicated test run.
