---
title: "MicroSandbox"
---

# MicroSandbox

[MicroSandbox](https://github.com/microsandbox/microsandbox) runs microVMs. Each
microVM has its own kernel and uses KVM. AGRO cannot provision a sandbox on
MicroSandbox. `agro sandbox install microsandbox` exits with an error. AGRO ships
the `msb` command-line binary as an installable tool.

## Install `msb`

Run these commands inside a sandbox:

```bash
agro tool install microsandbox   # install msb as the sandbox user
agro tool status microsandbox    # show the installed state and version
```

`agro tool install microsandbox` downloads the upstream installer script,
verifies the script against a pinned `sha256`, and runs the script with
`MSB_HOME="${NPM_USER_PREFIX:-$HOME/.local}/microsandbox"`. The binary lands in
`~/.local/microsandbox/bin/msb`. A symlink at `~/.local/bin/msb` puts `msb` on
`PATH`.

AGRO pins the installer script, not the `msb` version. The script installs the
latest upstream release. The install needs network access. The install writes
no `agro.json` field and restarts nothing. The binary lives in the home mount,
so the binary survives a container recreate. `agro destroy <name>` removes the
binary.

## KVM requirement

A microVM needs `/dev/kvm`. The sandbox compose file passes no devices, so the
sandbox has no `/dev/kvm`. `msb` installs in the sandbox, but a microVM fails to
start in the sandbox.

`agro tool install microsandbox` verifies only that `PATH` holds `msb`. To test a
KVM host, run these commands on the KVM host:

```bash
msb self doctor                  # exits 0 when the machine can run microVMs
msb run alpine --exec 'echo ok'  # prints "ok"
```

See [Runtimes Overview](overview.md).
