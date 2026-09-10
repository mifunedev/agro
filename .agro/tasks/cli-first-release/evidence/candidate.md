# Candidate evidence — US-010 / US-011 / US-012

Exact head: `c078c91e80647bc0c60cebb7ad1f11d929159d33`
Core PR: https://github.com/mifunedev/agro/pull/1031
CI: Sandbox Boot Guard run 34418907048 SUCCESS (job 102689819356)
Artifact: `cli-first-install-smoke-log-34418907048/cli-first-install-smoke.log`
Image: `openharness-sandbox-boot-guard:a7560348b8d1f4065118aea323df2f11725eb6fe` (locally built candidate, not released latest)

## Node-missing bootstrap (debian:bookworm-slim)

Observed in job log:

```
node_before=ABSENT
bootstrap_version=0.9.0
node_after=/tmp/cli-first-fa8uNz/bootstrap-home/.nvm/versions/node/v22.23.2/bin/node version=v22.23.2
cli-first-install-smoke: phase bootstrap complete
```

Real `get-agro.sh` against built `agro.js`. nvm provisioned Node 22.23.2. New-shell agro 0.9.0.

## Pack + seed + recreation (`--phase all`, pipefail)

```
tarball=/tmp/cli-first-zIGAIz/mifune-agro-0.9.0.tgz
packed_agro=/tmp/cli-first-zIGAIz/prefix/bin/agro
packed_version=0.9.0
packed_identity=agro — AGRO CLI (v0.9.0)
bootstrap_agro=/tmp/cli-first-zIGAIz/bootstrap-home/.local/bin/agro
bootstrap_version=0.9.0
seed_sandbox=agro-cli-first-seed-16141
seed_container=2eac65f1fabb
seed_image=openharness-sandbox-boot-guard:a7560348b8d1f4065118aea323df2f11725eb6fe
seed_storage=agro-cli-first-seed-16141_workspace
```

Recreate `access.dockerSocket=false`:

```
before_container=a229912b90fa
before_storage=agro-cli-first-sock-false-16141_workspace
before_dockerSocket=false
before_cred=f5f8eeae987b3e68b4592b2c02ba1dd277eba1fbfa716c3c829c7dbb513a2773 600 1000 1000
before_canary=2fbe9d670673ff50f35f36f9352b881781521f0c10c148457bf7e62071470f72 755 1000 1000
before_edit=4a5ff66de11469e43ab47873977a54c04f821be8edd8a52b586ce340c0e93415
before_marker=7fe84431b2b041fb42d4907538d3e3c5cb585f861e89f13a4aa1e26cd618f731
after_container=632cbe559293
after_storage=agro-cli-first-sock-false-16141_workspace
after_dockerSocket=false
```

Recreate `access.dockerSocket=true`:

```
before_container=8989eb84e410
before_storage=agro-cli-first-sock-true-16141_workspace
before_dockerSocket=true
before_cred=f5f8eeae987b3e68b4592b2c02ba1dd277eba1fbfa716c3c829c7dbb513a2773 600 1000 1000
before_canary=2fbe9d670673ff50f35f36f9352b881781521f0c10c148457bf7e62071470f72 755 1000 1000
after_container=b533b3cd63c7
after_storage=agro-cli-first-sock-true-16141_workspace
after_dockerSocket=true
cli-first-install-smoke: phase all complete
```

Container IDs changed. Storage names unchanged. Credential mode 600 uid/gid 1000. Canary mode 755 uid/gid 1000. Seed edit and marker hashes recorded before recreation; the job exited 0 so those assertions passed.

False pass on 5e1096f2 is not evidence. Pipefail on this head failed closed when pack/recreate were broken, then passed when they were not.
