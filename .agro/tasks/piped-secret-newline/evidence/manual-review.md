# Manual review evidence — piped secret without a trailing newline

Observed run on 2026-10-11, base commit `4eac1b8d`, Node v22.23.3. Every
output below is copied from that run. The transcript holds no secret value.
The only value piped to the CLI is the dummy string `dummy-not-a-secret`, and
no command prints it.

**A. `agro secret set --sandbox <name>` with a piped value**

Prerequisites: build the CLI from source.

```bash
pnpm install --frozen-lockfile --ignore-scripts
npm --prefix .agro/cli ci --ignore-scripts
npm --prefix .agro/cli run build
```

Runs in the sandbox, local. Each scenario uses a fresh temporary `AGRO_HOME`
with one registry entry:

```bash
export AGRO_HOME=/tmp/agro-1409-review-a
mkdir -p /tmp/agro-1409-review-a/sandboxes/review-box
printf '%s\n' '{"version":1,"name":"review-box"}' > /tmp/agro-1409-review-a/sandboxes/review-box/agro.json
```

Each CLI run also printed
`agro: warning: /etc/agro/sandbox is missing; detected the sandbox from /.dockerenv and SANDBOX_NAME. Upgrade the sandbox image.`
That warning comes from the review sandbox image and is not part of this
change. The outputs below omit it.

1. Pipe the dummy value with no trailing newline:

   ```bash
   printf '%s' dummy-not-a-secret | node .agro/cli/dist/agro.js secret set GH_TOKEN --sandbox review-box
   ```

   Output:

   ```text
     Value for GH_TOKEN (input hidden): .env: set GH_TOKEN
   ```

   Expected exit status: 0.

2. Confirm the registry entry holds the key. The command prints key names
   only, never values:

   ```bash
   node .agro/cli/dist/agro.js secret list --sandbox review-box
   ```

   Output:

   ```text
   GH_TOKEN  set
   ```

   Expected exit status: 0.

3. Failure path. Against a fresh registry entry (`AGRO_HOME=/tmp/agro-1409-review-b`,
   created the same way), pipe an empty value:

   ```bash
   printf '' | node .agro/cli/dist/agro.js secret set GH_TOKEN --sandbox review-box
   ```

   Output:

   ```text
     Value for GH_TOKEN (input hidden): agro secret set: no value entered — GH_TOKEN unchanged
   ```

   Expected exit status: 1. A following
   `node .agro/cli/dist/agro.js secret list --sandbox review-box` printed
   `no secrets set — write one with `agro secret set <KEY>`` and exited 0, so
   the command wrote nothing.

**B. Cleanup**

1. Delete each temporary `AGRO_HOME`:

   ```bash
   rm -rf /tmp/agro-1409-review-a
   test -e /tmp/agro-1409-review-a && echo still-there || echo removed
   rm -rf /tmp/agro-1409-review-b
   test -e /tmp/agro-1409-review-b && echo still-there || echo removed
   ```

   Expected output: `removed` for each directory. The observed run deleted
   `/tmp/agro-1409-review-a` and `/tmp/agro-1409-review-b` and printed
   `removed` for each. The run created no other temporary directory.
