# Evidence — sandbox-install-mount-semantics (#1042, PR #1044)

Branch `bug/1042-sandbox-install-mount-semantics`. Base `development` at `f94c1ad5`.

## 0. Why this is better than not doing it

Before this branch, an operator who wanted a sandbox to persist at a host path
had one plausible-looking flag and it was the wrong one. `--repo <empty dir>`
was accepted, ran the whole wizard, wrote a registry entry, and then failed
minutes later inside `docker buildx`:

```
resolve : lstat /home/ryaneggz/sandboxes/agro-sbx-1/.devcontainer: no such file or directory
```

The error came from Docker, named neither the flag nor the broken assumption,
and left a registry entry behind. The mount the operator actually wanted,
`/home/sandbox` (`storage.homePath`), had no install flag at all. It was
reachable only through `agro config set storage.homePath`, which is the one door
where the setting silently destroys state: the next start swaps the mount source
and every file in the named volume becomes orphaned and invisible.

After this branch, measured against the built CLI:

| Command | Before | After |
|---|---|---|
| `--repo <non-checkout>` | fails in buildx after the wizard | `image.mode: image`, binds the directory, runs the published image |
| `--repo <checkout>` | builds | builds, unchanged |
| persist at a host path | no flag exists | `--home-mount <dir>`, plus a wizard prompt |
| `config set storage.homePath` on a live sandbox | silent orphaning | refused, names the volume, `--force` overrides |
| failed preflight | registry entry left behind | no registry entry, no created directory |

Cost: 12 files, +1265/-32 lines, of which the task folder and tests are the
majority. Production code changed in three files: `sandbox.ts`, `cli.ts`,
`config.ts`. No compose file, no entrypoint, no env-key rename.

## 1. What the plan asked for

Separate the two bind mounts that `agro sandbox install` conflated. Stop
inferring build mode from the presence of `--repo`. Fail before the wizard when
a build is impossible, in `agro`'s voice rather than Docker's. Leave no registry
entry on a preflight failure. Give `storage.homePath` a create-time door. Guard
the late `config set` that orphans state. Keep the compose files, the entrypoint,
`AGRO_REPO_DIR`, and `AGRO_HOME_MOUNT` untouched, and keep the four
compose-string probes green and unedited.

## 2. What was built

All eight stories are `passes: true` in `prd.json`. Each was validated by the
advisor against the built CLI, not from a worker's report.

**Four install paths, each read back from the written `agro.json` and the
materialized compose base:**

```
--repo <checkout>        -> image.mode build, no image.ref, build-capable base
--repo <non-checkout>    -> image.mode image, image.ref ghcr.io/mifunedev/agro:latest,
                            repo still written
no --repo                -> image.mode image, no ref, image-only base (unchanged)
--home-mount <dir> alone -> image-only base, storage.homePath written, directory created
```

**`entryRepo()` cwd resolution preserved**, including on the new image-mode
checkout path. With two entries registered, from an unrelated cwd:

```
agro: several sandboxes are registered in ... — name one: entry-build, entry-image
```

and from inside either bound directory the CLI resolves the entry and reaches
Docker, which is as far as this host can go:

```
failed to connect to the docker API at unix:///var/run/docker.sock ...
```

**The `config set storage.homePath` guard**, end to end on a host with no Docker
daemon:

```
$ agro config set storage.homePath /srv/demo-home --sandbox g1
oh.json: set storage.homePath=/srv/demo-home (added)          # fails OPEN, as designed
$ agro config set storage.homePath /srv/demo-home --sandbox g1
oh.json: storage.homePath already /srv/demo-home              # no-op, guard skipped
$ agro config set storage.homePath /srv/other --sandbox g1 --force
oh.json: set storage.homePath=/srv/other (updated)            # --force overrides
```

**`/eval` — the regression floor.** Runner exit `0`, 146 probes, no green→red
delta. The three compose-string probes pass and are byte-identical:

```
oh-devcontainer-restructure      PASS        unchanged
oh-home-mount                    PASS        unchanged
oh-image-only-deploy             PASS        unchanged
```

Three persistent reds carried forward, all `delta=unchanged` and none caused by
this branch: `curl-bash-safe-alternatives` (the probe shells out to `python3`,
which this container does not have), `oh-config-surfaces` (PR #887), and
`skills-vendored`.

**Protected paths.** All four byte-identical to the pre-work baseline, asserted
by sha256 after every worker commit and once more at the end:

```
0bc2686007e1...  .agro/evals/probes/oh-devcontainer-restructure.sh
664447701d78...  .agro/evals/probes/oh-home-mount.sh
826fef45e2e6...  .agro/evals/probes/oh-image-only-deploy.sh
ac25e4b410d1...  .agro/cli/src/lib/__tests__/registry.test.ts
```

`git diff origin/development...HEAD -- .devcontainer/` is empty.

**Test suite.** 1393 passing, up from 1380 on the base (13 new tests). Typecheck
clean. Two failures in `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts`
are pre-existing: the advisor reproduced them independently on the clean
`development` checkout before accepting any worker claim. They assert `ps.status`
when `dockerComposeAvailable()` reports true, and this environment has no
reachable Docker daemon.

### Actual Knowledge Impact

| Page | State | Basis |
|---|---|---|
| `oh-cli-portable-lifecycle` | UPDATED | Declared sources `cli.ts` and `sandbox.ts` changed. Its wizard-question list, its `--repo` build-mode claim, and its `image.ref` persistence claim were all falsified. |
| `fresh-machine-setup` | UPDATED | Declared sources `docs/quickstart.md` and `docs/installation.md` changed. Its wizard-question enumeration at lines 82-83 was falsified. |
| `compose-env-boundary` | NOT-AFFECTED (its declared sources `config-render.ts` and `registry.ts` are unchanged, and the branch preserves every env-key spelling it documents) | `knowledge-impact.sh` reports FRESH; the planner had predicted REVERIFIED. |

## 3. Where it diverged from the plan, and why

Three decisions were made after the operator approved the PRD. All three are
recorded in `prd.md` under `## Decisions`.

- **D-1 — the FR-9 override flag is `--force`.** The PRD left the name open.
  `agro update --force` already means "override a safety gate", so a second word
  for one concept was rejected.
- **D-2 — `--home-mount` accepts a non-empty directory.** The PRD left this open.
  Re-installing against an already-seeded home path is the recovery case the flag
  exists to serve, and emptiness is not the real hazard; ownership is, and the
  docs state it.
- **D-3 — the install pins `image.ref` when `repo` is set and the mode is
  `image`.** This one goes beyond what the PRD spelled out and is the divergence
  a reviewer should look at hardest. US-001 creates a combination that did not
  previously exist: `repo` set with `image.mode: image`. `materialize()` picks
  the compose base from `repo` alone, so that path gets the build-capable base,
  whose image default is the local build-target name `sandbox-${SANDBOX_NAME}`
  with `pull_policy: missing`. Nothing pinned `AGRO_SANDBOX_IMAGE` there:
  `config-render.ts:50` renders it only from `image.ref`, which `defaultOhConfig`
  leaves unset, and `lifecycle.ts:163-169` resolves `DEFAULT_SANDBOX_IMAGE` only
  under `--image`. Without the pin, `--repo <empty dir>` would have failed on a
  missing image — trading a buildx error for a pull error and still failing the
  PRD's own success metric that the command "succeeds using the published
  image". The PRD states that outcome and not the mechanism; the advisor chose
  the mechanism and kept it narrow (only when `repo` is set; a configured
  `image.ref` still wins; the image-only path untouched).

Two further advisor calls, smaller:

- The build preflight **skips** under `--no-build`, `--image`, and
  `--image=<ref>`, because no build runs on those paths so a Dockerfile is not
  required. The PRD does not name this case.
- The `config set` guard **skips a no-op set**. As first written it refused when
  the new value equalled the current one, with a message asserting that state
  "would be orphaned" — a hazard that does not exist when nothing changes. A
  message whose whole purpose is to tell the truth about data loss must not
  assert a false hazard, so the guard now compares the current value first.

The advisor also added `## Knowledge Context`, `## Expected Knowledge Impact`,
and `## Plan Reconciliation` to `prd.md`, which the approved plan lacked, to
complete the three-file contract. No goal, functional requirement, non-goal, or
acceptance criterion was changed.

## 4. What remains unverified

- **The guard's true-positive path is proven only against a stubbed runner.**
  This host has no Docker daemon, so "the named volume exists, therefore refuse"
  was never exercised end to end against a real volume. The fail-open, no-op, and
  `--force` paths WERE verified end to end. A reviewer with Docker should run
  `agro config set storage.homePath <dir>` against a sandbox that has been
  started once, and confirm the refusal names `<name>_workspace`.
- **No install was carried through to a running container.** Every install
  verification stopped at the written `agro.json` and the materialized compose
  base, because `agro sandbox install` refuses to run inside a sandbox and no
  daemon is reachable. The PRD's success metric "succeeds on a cold host and
  persists `/home/sandbox` at that path" is therefore argued from the rendered
  configuration, not observed. This is the single largest gap in this document.
- **STE on the docs is zero-delta, not zero.** The four documentation files carry
  96 pre-existing findings in prose these stories do not own. The standard
  applied was "add no new findings", measured per-finding against the pre-work
  baseline. Whole-file `exit 0` was not reachable without rewriting documents
  outside this task's scope.
- **Two pre-existing red tests and three persistent red probes are carried
  forward**, listed above with their causes. None is a green→red transition.
- **`verified_at` on both knowledge pages is broader than what was re-read.**
  The field is page-level, but the worker re-read only the code behind the
  claims it changed. Advancing both pages to `270b2dbd` therefore blesses
  sections not re-verified at this pin: on `oh-cli-portable-lifecycle` the
  bundled-assets / `build.mjs` paragraph, `resolveProduct`, the `oh update` /
  `agro update` / `agro migrate` paragraphs, remote-fetch, troubleshooting, and
  the verb-routing table; on `fresh-machine-setup` everything outside lines
  82-95. None of that material appears in this diff, so nothing suggests it went
  stale, but it carries its previous evidence rather than fresh evidence. A true
  page-level re-verification is a separate pass.
- **Spec-tail gates not run:** `/audit implementation` with its gate-5 simplicity
  review, `/spec retro`, `/wiki compile`, and `/benchmark`. The advisor ran
  `/eval`, the knowledge-impact gate, and the PR promotable classification
  directly. A reviewer wanting a simplicity verdict on the diff does not have one
  here.
