# Sandbox Python

`.agro/scripts/provision-python.sh` runs during image creation and sandbox boot.
It installs Python 3.13 with `uv python install --default`.
The default `UV_PYTHON_BIN_DIR` is `$HOME/.local/bin`, which the image includes in PATH.
The `python` and `python3` commands need no shell activation.
Project virtual environments retain their own interpreters and packages.

## Kernel provisioning

The kernel environment lives at `$HOME/.local/share/agro/kernel`.
The provisioner compares its base interpreter with the requested uv-managed interpreter.
It reuses a matching environment and recreates a stale environment at the same path.
If creation or package installation fails during migration, it restores the old kernel.
The provisioner retains older managed Python installations.
A file lock serializes provisioning within one HOME.
Boot reports provisioning failures as warnings and continues.

Use `AGRO_PYTHON_VERSION`, `AGRO_PYTHON_KERNEL_HOME`, and `AGRO_PYTHON_KERNEL_PACKAGES` to override defaults.
The provisioner refuses kernel replacement at `/`, HOME, an ancestor of HOME, a symlink path, or a non-managed environment.
It accepts legacy uv environments at the default or explicitly configured kernel path.
Set `AGRO_PYTHON_KERNEL_HOME` only to the environment that the provisioner must manage.

## Verification

Inside the sandbox, check the installation without repair:

```bash
bash .agro/scripts/provision-python.sh --verify
```

Verification checks both default commands, the kernel base interpreter, and the `ipykernel` import.
Base-command checks use an explicit PATH independent of the caller's active project environment.
`verify-sandbox-image.sh` restores `/opt/home-seed` in an ephemeral container with networking disabled.
It checks Python 3.13 defaults and the kernel as `sandbox`, without a login shell.

Run the real-uv regression matrix as a non-root sandbox user:

```bash
bash .agro/scripts/__tests__/provision-python.integration.sh
```

The matrix downloads interpreters and packages into a disposable HOME.
It checks fresh provisioning, migration, rollback, command resolution, verification failures, and project isolation.
It deletes the test HOME on exit.
