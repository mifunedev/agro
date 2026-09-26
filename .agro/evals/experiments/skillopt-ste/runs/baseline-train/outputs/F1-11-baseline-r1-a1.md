# Repair a sandbox boot blocked by a security advisory

This runbook recovers an **existing** workspace volume. The boot of that volume
aborts because a package manifest runs a security audit as an install lifecycle
hook. This runbook does not delete the volume. This runbook does not recreate
the volume. The edit in this runbook changes exactly one file: the workspace
`package.json`. After the edit, the operator restarts the sandbox, and
`agro-bootstrap.service` completes.

This runbook applies to each workspace volume whose `package.json` still holds
`"pnpm:devPreinstall": "pnpm run security:audit"`. Each volume seeded from
`ghcr.io/mifunedev/agro:0.9.0` or `ghcr.io/mifunedev/agro:<second-affected-tag>`
holds this hook.

On 2026-09-08, `ghcr.io/mifunedev/agro:latest` resolved to the same image id as
`0.9.0`. That image id is `bbfdaf6bb8ca`, with the digest tag `sha-823aabbd…`.
Each volume seeded from `latest` on or before 2026-09-08 also holds the hook.
`latest` is a moving tag. A later release points `latest` at a different image.
This paragraph records one dated observation, not a permanent property.

## What you see

`agro shell <name>` opens a container with no setup. Inside the container,
`systemctl status` shows this output:

```
systemctl status agro-bootstrap.service
× agro-bootstrap.service - AGRO sandbox bootstrap
     Active: failed (Result: exit-code)
    Process: 53 ExecStart=/usr/local/bin/entrypoint.sh (code=exited, status=1/FAILURE)
```

The last line of the boot log is this exact line:

```
[entrypoint] pnpm install failed — see /tmp/pnpm-install.log; aborting sandbox boot
```

`agro-cron.service` reports `Dependency failed`. Near the end of
`/tmp/pnpm-install.log`, a `pnpm:devPreinstall` audit table names an advisory.
The last line of `/tmp/pnpm-install.log` is this line:

```
 ELIFECYCLE  Command failed with exit code 1.
```

## Why the boot fails

The manifest connects the audit to a pnpm install lifecycle hook. pnpm runs
that hook on each `pnpm install`. The sandbox entrypoint runs
`pnpm install --prefer-offline` in two cases:

- `node_modules` is absent.
- The manifest fingerprint changed.

`pnpm audit` queries the live advisory database. If a new advisory covers a
pinned version, this sequence occurs:

1. The audit exits with code 1.
2. The hook fails.
3. The install fails.
4. The entrypoint aborts the boot.

`GHSA-82fw-gwwq-j7x9` covers vitest `>=2.1.0 <4.1.11`. The `0.9.0` manifest
pins vitest `^3.2.6`. Thus each boot from that manifest fails. Each boot
continues to fail while the advisory stays published.

## Your data is safe and reachable

systemd is PID 1 in the sandbox. `agro-bootstrap.service` is `Type=oneshot`.
A failed oneshot unit does not stop PID 1. Thus the container stays `running`.
`docker exec` still opens a shell as the `sandbox` user.

**Warning:** Each of the actions below loses state. The recovery needs none of
these actions.

- Do not delete the volume.
- Do not run `agro destroy`.
- Do not recreate the sandbox.

## Recovery needs operator action

The recovery is **not** automatic. A newer image does not repair an existing
volume. An upgrade boot never rewrites the workspace `package.json`. Thus the
hook stays in place after the upgrade. The new image then fails the same way
on that volume. The operator runs the procedure below one time for each
affected volume.

## Procedure

Run each command on the host. Replace `<name>` with the container name.

**1. Confirm the symptom.**

```bash
docker inspect --format '{{.State.Status}}' <name>            # expect: running
docker exec <name> systemctl is-failed agro-bootstrap.service   # expect: failed
docker exec <name> tail -3 /tmp/pnpm-install.log
```

The last command shows the `ELIFECYCLE` line from "What you see".

**2. Delete the one hook that blocks the install.**

Run the block below exactly as written. If the manifest does not have the shape that
this procedure repairs, the block stops and does not guess.

```bash
docker exec -i -u sandbox <name> bash -s <<'RECOVER'
set -eu
cd "$HOME/harness"
expected='pnpm run security:audit'
[ -f package.json ] && [ ! -L package.json ] || {
  echo "refusing: $PWD/package.json is not a regular file — resolve that before retrying" >&2; exit 2; }
found=$(jq -r '.scripts["pnpm:devPreinstall"] // ""' package.json)
[ -n "$found" ] || {
  echo "refusing: package.json declares no pnpm:devPreinstall hook — this procedure does not apply" >&2; exit 2; }
[ "$found" = "$expected" ] || {
  echo "refusing: pnpm:devPreinstall is '$found', not '$expected' — it carries logic of your own; remove or relocate that yourself" >&2; exit 2; }
tmp=$(mktemp -p .)
jq --indent 2 'del(.scripts["pnpm:devPreinstall"])' package.json > "$tmp"
[ -s "$tmp" ]
cat "$tmp" > package.json
rm -f "$tmp"
RECOVER
```

**The block stops and changes nothing in these cases:**

- `package.json` is a symlink or is not a regular file. The block does not
  follow the link. The block does not write through the link.
- `pnpm:devPreinstall` is absent. In this case, the failure has a different
  cause.
- `pnpm:devPreinstall` holds a value other than `pnpm run security:audit`. An
  example is `pnpm run security:audit && ./my-checks.sh`. A deletion of the key
  destroys your command. The block does not parse a combined hook. The block
  does not split a combined hook. The block does not partially rewrite a
  combined hook. Edit the hook yourself. Then run the block again.

In each of these cases, the block exits with code `2`. `package.json` stays
byte-for-byte identical.

**3. Restart the sandbox.**

```bash
docker restart <name>
```

**4. Verify the boot.**

```bash
docker exec <name> systemctl is-active agro-bootstrap.service   # expect: active
docker exec <name> systemctl is-active agro-cron.service        # expect: active
```

`agro shell <name>` now opens a container with the full setup.

## What the procedure preserves

An observation on a volume seeded from the real published image compared the
state before the failed boot with the state after the recovered boot. The table
shows the results.

| State | Result |
|-------|--------|
| Uncommitted change in the harness checkout | Preserved; content hash unchanged and `git status` still reports it modified |
| Task folders under the control-plane `tasks/` directory | Preserved; content hash unchanged |
| `~/.config/gh` credentials | Preserved; the host entry, user, and OAuth token stay the same, and the file keeps mode `0600` |
| `.env` | Preserved; content hash unchanged and the file keeps mode `0600` |
| Your own keys and scripts inside `package.json` | Preserved; a custom `scripts` entry and a custom top-level key both survive intact, and the file keeps mode `0644`, its owner, and its inode |

On first use during the boot, the `gh` CLI normalizes `hosts.yml`. The `gh`
CLI adds a `users:` block for the account that `hosts.yml` already holds. The
credential values stay the same. The file mode stays the same.

## What the edit does to `package.json`

The block in step 2 writes exactly one file: `package.json`. This section gives
the exact effect on that file.

**The file keeps its mode, owner, and inode.** The block writes the new content
into the existing file with `cat "$tmp" > package.json`. The block does not use
`mv`. A replacement with `mv` gives the file the `0600` mode and the owner of
the `mktemp` file. One recovery showed these results:

- mode `644` before and `644` after
- owner `sandbox:sandbox` before and after
- the same inode before and after

**`jq` rewrites the whole file, so `jq` sets the format.** On the published
`0.9.0` manifest, this rewrite has no cost. `jq --indent 2 '.'` gives a
byte-for-byte copy of that file. Thus the recovered file differs from the
original file by exactly the one removed line. A `diff` confirmed this result.

If you changed the format of your own `package.json`, `jq` changes the format
back. Examples are a different indent, tabs, or no trailing newline. `jq` writes
a two-space indent and a trailing newline. `jq` keeps the key order and each
value, including your own keys and scripts. After the edit, run
`git diff -- package.json` and read the changes.

Step 2 writes nothing more. Step 3 restarts the sandbox. The boot then
completes and writes state as each successful boot does:

- `node_modules` appears because the install completes.
- `gh` normalizes `hosts.yml` as described above. The host entry, user, and
  OAuth token stay the same. The file keeps mode `0600`.

## After recovery

The removal of the hook restores the boot. The removal does not remove the
vulnerable dependency. Update the checkout to a source revision that pins
vitest `>=4.1.11`. The current source has these changes:

- The source removes the hook.
- The source pins vitest `^4.1.11`.
- CI and the release process run `pnpm run security:audit` as an explicit step.

For the CI gate, read
[`.agro/evals/probes/pnpm-audit-ci-gate.sh`](../.agro/evals/probes/pnpm-audit-ci-gate.sh).

## Scope

This runbook repairs an existing seeded volume only. This runbook does not
repair a published image. The `0.9.0` build has image id `bbfdaf6bb8ca` and
also has the tag `sha-823aabbd…`. That build holds the hook in
`/opt/agro-seed/package.json`. Nobody can edit that build. A cold boot seeds a
fresh volume from that build and fails on the first boot. That volume needs
this procedure or an image from a later release.

`latest` is a moving tag. On 2026-09-08, `latest` resolved to the same build.
Before you decide whether this runbook applies, check the image that `latest`
resolves to. Run these commands on the host:

```bash
docker pull ghcr.io/mifunedev/agro:latest
docker run --rm --entrypoint bash ghcr.io/mifunedev/agro:latest \
  -c 'jq -r ".scripts[\"pnpm:devPreinstall\"] // \"absent\"" /opt/*-seed/package.json'
```

If the output is `absent`, that image completes a cold boot. The volume then
needs nothing from this runbook. For the requirements of a fixed release, read
[`release-requirements-1019-boot-fix.md`](release-requirements-1019-boot-fix.md).

The probe
[`.agro/evals/probes/sandbox-boot-advisory-recovery.sh`](../.agro/evals/probes/sandbox-boot-advisory-recovery.sh)
guards the recovery path.
