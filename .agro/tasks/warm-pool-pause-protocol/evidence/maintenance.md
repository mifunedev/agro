# E4 maintenance count

Source: agro-console branch `development` at commit `d4ae1b17`.
All `file:line` references point to that commit.
This file counts maintenance cost only. E1 and E2 measure claim time.

## Designs

- **N′ (two pools).** N′ runs the current code with `sandbox` pool `max` above 0. Each profile and spec pair is one pool cell.
- **H (one pool).** H keeps one neutral `sandbox` pool for each spec. An agro claim takes a `sandbox` pool node. The claim restore path then extracts a prebuilt agro layer archive. An agro release publishes a new archive. The release drains no pool.

H keeps the root-side agro files in the `sandbox` pool build as inert units. These files hold no agro version. The archive holds only home content: the agro CLI, Node, nvm, code-server, and T3. The restore script accepts only members under `./` and extracts them into `/home/sandbox` (`packages/shared/src/cloud-init-base.ts:246`, `:272` to `:274`).

## Pool builds, cells, and drains

| Count | N′ | H | Source |
|---|---|---|---|
| Specs | 5 | 5 | `packages/shared/src/models/node.ts:5` |
| Profiles in the pool | 2 | 1 | `packages/shared/src/models/node.ts:28`, `apps/provisioner/src/services/node-pool.service.ts:261` |
| Pool builds for each spec | 2 | 1 | `apps/provisioner/src/services/node-pool.service.ts:261` to `:262`, `:342` |
| Pool cells | 10 | 5 | `packages/shared/src/console-config.json:60` to `:107` |
| Canonical pool fingerprints | 3 | 1 | `apps/provisioner/src/services/node-pool.service.ts:92` to `:93`, `:120` to `:121` |
| Drain rules in `staleReason` | 8 | 3 | `apps/provisioner/src/services/node-pool.service.ts:139` to `:146` |
| Cells that one agro release drains | 10 | 0 | `apps/provisioner/src/services/node-pool.service.ts:140`, `:340` |
| Pool or archive builds that one agro release forces | 10 | 1 | `apps/provisioner/src/services/node-pool.service.ts:261` to `:273` |

N′ drains the `sandbox` pool on each agro release. The check at `node-pool.service.ts:140` compares `agroVersion` for every profile. `addPoolNode` writes `agroVersion` for every profile at `:340`. The `sandbox` cloud-init holds no agro version. The 0.28.0 bump left the `sandbox.pool` fingerprint the same (commit `8d4f81fd`). The same rule applies to `codeServerVersion` at `:141` and `:341`.

H keeps the drain rules at `:139`, `:142`, and `:143`, and the age rule at `:150`. The table counts the age rule in neither column.

## Profile-branch sites

A profile-branch site is a line that branches on `agro` or `sandbox` in the pool, claim, or cloud-init path.

| # | Site | N′ | H |
|---|---|---|---|
| 1 | `apps/provisioner/src/services/node-pool.service.ts:93` | kept | removed |
| 2 | `apps/provisioner/src/services/node-pool.service.ts:121` | kept | removed |
| 3 | `apps/provisioner/src/services/node-pool.service.ts:137` | kept | removed |
| 4 | `apps/provisioner/src/services/node-pool.service.ts:144` | kept | removed |
| 5 | `apps/provisioner/src/services/node-pool.service.ts:261` | kept | removed |
| 6 | `apps/provisioner/src/services/node-pool.service.ts:282` | kept | removed |
| 7 | `apps/provisioner/src/services/node-pool.service.ts:297` | kept | removed |
| 8 | `apps/provisioner/src/services/node-pool.service.ts:345` | kept | removed |
| 9 | `packages/db/src/repositories/nodes.repository.ts:137` | kept | removed |
| 10 | `packages/shared/src/index.ts:1157` | kept | kept |
| 11 | `apps/provisioner/src/services/provision.service.ts:388` | kept | removed |
| 12 | `apps/provisioner/src/services/provision.service.ts:515` | kept | removed |
| 13 | `apps/provisioner/src/services/provision.service.ts:518` | kept | kept |
| 14 | `apps/provisioner/src/services/provision.service.ts:824` | kept | removed |
| 15 | `apps/provisioner/src/services/provision.service.ts:873` | kept | kept |
| 16 | `apps/provisioner/src/services/provision.service.ts:1090` | kept | kept |
| 17 | `apps/web/server/services/node-claim.service.ts:84` | kept | kept |
| 18 | `apps/web/server/services/node-claim.service.ts:88` | kept | kept |
| 19 | `packages/shared/src/cloud-init-base.ts:194` | kept | removed |
| 20 | `packages/shared/src/cloud-init-base.ts:212` | kept | removed |
| 21 | `packages/shared/src/cloud-init-base.ts:222` | kept | removed |
| 22 | `packages/shared/src/cloud-init-base.ts:232` | kept | removed |
| 23 | new agro layer branch in `apps/web/server/services/node-claim.service.ts` | absent | added |
| 24 | new agro payload branch in the claim script, `packages/shared/src/cloud-init-base.ts:222` | absent | added |

Sites 19 to 22 read the four layer hooks at `packages/shared/src/cloud-init-base.ts:29` to `:32`.

- N′ total: 22 sites.
- H total: 8 sites. H removes 16 sites and adds 2.

H moves the profile choice from pool build time to claim time. H does not remove the choice.

## Cloud-init fixtures

| Count | N′ | H | Source |
|---|---|---|---|
| Pool-build fixture cases | 3 | 1 | `packages/shared/src/__tests__/fixtures/pool-cloud-init-cases.ts:39`, `:40`, `:48` |
| Pool-build fixture entries that one agro release changes | 2 | 0 | `packages/shared/src/__tests__/fixtures/pool-cloud-init-sha256.json:2` to `:3` |
| Golden fixture files on the pool path | 1 | 1 | `packages/shared/src/__tests__/fixtures/pool-cloud-init-sha256.json` |

H keeps `sandbox.pool` at `pool-cloud-init-cases.ts:48` and changes its digest once. The inert agro units enter that build. The cold entries `agro.hostname` and `agro.fromRecoveryPoint` change on each release in both designs.

## External installer paths in pool builds

| # | Installer | Pin | Source | N′ | H |
|---|---|---|---|---|---|
| 1 | age tarball | sha256 | `packages/shared/src/host-management-assets.ts:441` to `:442` | 2 pool builds | 1 pool build |
| 2 | zmx tarball | sha256 | `packages/shared/src/host-management-assets.ts:468` to `:469` | 2 pool builds | 1 pool build |
| 3 | Docker apt repository | key fingerprint, packages unpinned | `packages/shared/src/index.ts:582`, `:591` | `sandbox` pool build | pool build |
| 4 | agro `install.sh` and `agro.js` | sha256 | `packages/shared/src/workspace-bootstrap-assets.ts:205` to `:209` | `agro` pool build | archive build |
| 5 | Node tarball | sha256 | `packages/shared/src/workspace-bootstrap-assets.ts:231` to `:234` | `agro` pool build | archive build |
| 6 | `nvm.sh` | sha256 | `packages/shared/src/workspace-bootstrap-assets.ts:235` to `:236` | `agro` pool build | archive build |
| 7 | code-server tarball | sha256 | `packages/shared/src/workspace-bootstrap-assets.ts:280` to `:283` | `agro` pool build | archive build |
| 8 | T3 `curl \| sh` | version only, script unpinned | `packages/shared/src/workspace-bootstrap-assets.ts:91` to `:95` | `agro` pool build | archive build |
| 9 | `agro tool install docker-engine` | unpinned apt packages | `packages/shared/src/workspace-bootstrap-assets.ts:133`, `:341` | `agro` pool build | removed, row 3 covers Docker |

- N′: 11 installer paths in pool builds. The `agro` build has 8. The `sandbox` build has 3.
- H: 3 installer paths in pool builds and 5 in the archive build. The total is 8.
- N′ runs installers 4 to 8 on each `agro` pool node. H runs installers 4 to 8 once for each release.
- Installer 8 stays unpinned in both designs.

## Files that one agro release bump touches

The count uses the files that both recent bumps touched: `8d4f81fd` (0.28.0) and `045eec3e` (0.27.0).

1. `CHANGELOG.md`
2. `apps/provisioner/src/__tests__/provision.test.ts`
3. `config.yaml`
4. `deploy/config.yaml`
5. `infra/cloud-init/cloud-config.yaml`
6. `packages/shared/src/__tests__/cloud-init.test.ts`
7. `packages/shared/src/__tests__/fixtures/agro-cloud-init-sha256.json`
8. `packages/shared/src/__tests__/fixtures/cold-cloud-init-sha256.json`
9. `packages/shared/src/__tests__/fixtures/pool-cloud-init-sha256.json`
10. `packages/shared/src/console-config.json:17` to `:21`
11. `packages/shared/src/index.ts:77`

- N′: 11 files.
- H: 11 files. Cold agro builds keep files 5 to 8 and file 11. File 9 keeps the cold entries. The archive pin goes into files 3, 4, and 10. H adds no file to the set.

## Code sites that H changes

The marks are `A` for add and `R` for remove.

### `apps/provisioner/src/services/node-pool.service.ts`

| Mark | Line | Change |
|---|---|---|
| R | `:42` to `:43`, `:71` | Remove the `t3Release` dependency. T3 ships in the archive. |
| R | `:82` to `:84` | Remove the profile from `poolLabel`. |
| R | `:92` to `:93`, `:111`, `:113` | Remove the profile and T3 inputs from `canonicalPoolCloudInit`. |
| R | `:120` to `:121` | Remove the `profile:t3` fingerprint key. |
| R | `:137` | Remove `installsT3`. |
| R | `:140` | Remove the `agroVersion` drain. |
| R | `:141` | Remove the `codeServerVersion` drain. |
| R | `:144` | Remove the `agro` push drain. |
| R | `:145` to `:146` | Remove the T3 drains. |
| R | `:217`, `:249` to `:254` | Remove the T3 version lookup. |
| R | `:261` | Remove the profile loop in `fill`. |
| R | `:282` | Remove the profile parameter of `addSwapPoolNode`. |
| R | `:297`, `:300` | Remove the profile key from the target lookup. |
| R | `:340` to `:341` | Remove the version fields from the pool node row. |
| R | `:342` to `:343` | Remove the profile and T3 build from the pool node row. |
| R | `:345` | Remove the `bindChannel` profile branch. |

Total: 16 R, 0 A.

### `packages/shared/src/cloud-init-base.ts`

| Mark | Line | Change |
|---|---|---|
| R | `:29` to `:32` | Remove the four per-layer claim hooks. |
| A | `:159` | Parse an optional agro layer block in the claim body. |
| A | `:164` to `:172` | Check the layer URL, sha256, and size. Write the layer input file. |
| A | `:201` | Clear the layer input file on each claim loop. |
| A | `:203` to `:204` | Restore the layer archive before the workspace archive. |
| A | `:194` | For an agro claim, send the agro ack body. |
| A | `:212` | Set the gone codes to `401\|404` for every claim. |
| A | `:222` | For an agro claim, enable the inert agro units. Register runtime settings. Start the agro apps. |
| A | `:232` | Restart the pull unit after an agro ack. |

Total: 1 R, 8 A. The restore script at `:238` to `:275` stays the same.

### `packages/shared/src/index.ts`

| Mark | Line | Change |
|---|---|---|
| R | `:496` | Remove `t3` from `poolBuild`. |
| R | `:1190` | Remove `pool` from `agroLayer`. |
| R | `:1192` | Remove the pool T3 install. |
| R | `:1193` | Remove the pool Docker guard. |
| R | `:1204` | Remove the pool Docker install. |
| R | `:1205` | Remove `appsStopped`. |
| R | `:1220` | Remove the pool `startApps`. |
| R | `:1223` | Remove the claim guard on the management channel. |
| R | `:1475` | Remove the pool T3 enable guard. |
| R | `:1491` | Remove the pool arguments of `pullWriteFiles`. |
| R | `:1495` | Remove `CLAIM_ENABLE` from `agroLayer`. |
| R | `:1483` to `:1486` | Remove the agro claim hook values. |
| R | `:1030` to `:1033` | Remove the `sandbox` claim hook values. |
| A | `:1160` to `:1182` | Export `AGRO_CLAIM_APPS` for the claim script. |
| A | `:1258` to `:1395`, `:1442` to `:1471` | Move the agro system files into one shared function. |
| A | `:1041` | Add the inert agro system files to the `sandbox` pool build. |
| A | `:1042` | Add the pull directive handlers for agro claims. |
| A | `:1048` | Add the agro state directories and lock file from `:1399` to `:1401`. |

Total: 13 R, 5 A.

### H sites outside the three files

- A: `apps/web/server/services/node-claim.service.ts:160`, `:167`, `:169`. Add the layer archive to the agro claim body.
- A: `apps/web/server/services/node-claim.service.ts:187`. Accept runtime settings that the claim registers.
- A: `packages/shared/src/models/node-claim.ts`. Add the layer block to the claim schema.
- A: one archive build and publish job, and one archive pin in the config files.
- R: `packages/shared/src/models/console-config.ts:85` to `:91`, `:96` to `:105`, `:130` to `:138`, `:147`. Remove the profile dimension of the pool config.
- R: `packages/shared/src/console-config.json:60` to `:83`, `config.yaml:50` to `:66`, `deploy/config.yaml:50` to `:66`. Remove the `agro` pool block.

H is a one-time change of 30 R and 13 A in the three files. The ongoing total below excludes this one-time cost.

## Ongoing total

Formula:

- `R = F + P + D + B` for each agro release.
- `F` is the count of files that the release bump touches.
- `P` is the count of pool-build fixture entries that the release changes.
- `D` is the count of pool cells that the release drains.
- `B` is the count of pool cell rebuilds or archive builds that the release forces.
- `S = C + K + Q` for each added spec.
- `C` is the count of pool cells that the spec adds.
- `K` is the count of pool config blocks that the spec adds. Three config files hold the pool config: `config.yaml`, `deploy/config.yaml`, and `packages/shared/src/console-config.json`.
- `Q` is the count of shared spec sites: `NODE_SPECS` at `packages/shared/src/models/node.ts:5` and the offering in `packages/shared/src/provider-catalog.yaml:17` to `:52`.
- `ongoing total = R + S`.

| Term | N′ | H |
|---|---|---|
| F | 11 | 11 |
| P | 2 | 0 |
| D | 10 | 0 |
| B | 10 | 1 |
| R | 33 | 12 |
| C | 2 | 1 |
| K | 9 | 6 |
| Q | 2 | 2 |
| S | 13 | 9 |
| Ongoing total | 46 | 21 |

N′ adds 3 config blocks in each file: `maxPerSpec`, `profiles.agro.specs`, and `profiles.sandbox.specs`. H adds 2 blocks in each file: `maxPerSpec` and the pool specs.

## Result

E4 favors H. The H ongoing total is 21. The N′ ongoing total is 46. 21 is lower than 46.

Facts that favor N′:

- A one-line profile guard at `node-pool.service.ts:140` stops the `sandbox` drain in N′. With the guard, N′ has `D = 5` and `B = 5`. The N′ total is then 36. 36 is still higher than 21.
- H adds an archive build, an archive upload, and an archive pin. N′ has no such pipeline.
- H keeps 8 profile-branch sites. H moves the profile choice to claim time.
- H costs 43 one-time changes in the three files. N′ costs 0.
- Each H agro claim extracts the layer archive. E1 and E2 measure that time. E4 does not.
