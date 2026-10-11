# Manual review evidence — xai-key-delivery

Observed run on 2026-10-11, base commit `b565edc8`, Node v22.23.3, Docker
Compose v5.5.1. Every output below is copied from that run. The transcript
holds no secret value. The only value used is the dummy string
`dummy-not-a-secret`.

**Setup**

Prerequisites: a checkout of the AGRO harness. Runs in the sandbox, local.

```bash
pnpm install --frozen-lockfile --ignore-scripts
npm --prefix .agro/cli ci --ignore-scripts
npm --prefix .agro/cli run build
```

Expected exit status of each command: 0.

**A. `agro secret set XAI_API_KEY --sandbox <name>`**

Prerequisites: the built CLI. Runs in the sandbox, local. Each step uses a
temporary `AGRO_HOME` with one registry entry:

```bash
export AGRO_HOME=/tmp/agro-xai-review-home
mkdir -p /tmp/agro-xai-review-home/sandboxes/review-box
printf '%s\n' '{"version":1,"name":"review-box"}' > /tmp/agro-xai-review-home/sandboxes/review-box/agro.json
```

Each CLI run also printed
`agro: warning: /etc/agro/sandbox is missing; detected the sandbox from /.dockerenv and SANDBOX_NAME. Upgrade the sandbox image.`
That warning comes from the review sandbox image and is not part of this
change. The outputs below omit it.

1. Set `XAI_API_KEY` with the dummy value on stdin:

   ```bash
   printf '%s\n' dummy-not-a-secret | node .agro/cli/dist/agro.js secret set XAI_API_KEY --sandbox review-box
   ```

   Output:

   ```text
     Value for XAI_API_KEY (input hidden): .env: set XAI_API_KEY
   ```

   Observed exit status: 0.

2. Confirm the registry entry holds the key. The command prints key names
   only, never values:

   ```bash
   node .agro/cli/dist/agro.js secret list --sandbox review-box
   ```

   Output:

   ```text
   XAI_API_KEY  set
   ```

   Observed exit status: 0.

3. Failure path. Set a key that Compose does not pass to the container:

   ```bash
   printf '%s\n' dummy-not-a-secret | node .agro/cli/dist/agro.js secret set PI_SLACK_BOT_TOKEN --sandbox review-box
   ```

   Output:

   ```text
   agro secret set: PI_SLACK_BOT_TOKEN does not reach the container from --sandbox review-box — Compose passes only GH_TOKEN, SANDBOX_PASSWORD, TYPESAFE_API_KEY, XAI_API_KEY.
   Run `agro secret set PI_SLACK_BOT_TOKEN` in the project checkout instead.
   ```

   Observed exit status: 1. The allowed-key list now names `XAI_API_KEY`.

**B. Compose passes `XAI_API_KEY` to the container**

Prerequisites: Docker Compose. Runs in the sandbox, local. The command
needed no other variables. The output is filtered to the `XAI_API_KEY` line
only; the full config is never printed.

1. Render the config with the dummy value:

   ```bash
   XAI_API_KEY=dummy-not-a-secret docker compose -f .devcontainer/docker-compose.yml config | grep XAI_API_KEY
   ```

   Output:

   ```text
         XAI_API_KEY: dummy-not-a-secret
   ```

   Observed exit status of `docker compose config`: 0.

2. Unset path. Render the config with `XAI_API_KEY` unset:

   ```bash
   env -u XAI_API_KEY docker compose -f .devcontainer/docker-compose.yml config | grep XAI_API_KEY
   ```

   Output:

   ```text
         XAI_API_KEY: ""
   ```

   Observed exit status of `docker compose config`: 0. The
   `${XAI_API_KEY:-}` default keeps Compose from failing when the key is
   absent.

**C. Cleanup**

1. Delete the temporary `AGRO_HOME`:

   ```bash
   rm -rf /tmp/agro-xai-review-home
   test -e /tmp/agro-xai-review-home && echo still-there || echo removed
   ```

   Output: `removed`. The observed run deleted `/tmp/agro-xai-review-home`.
   The run created no other temporary directory. Scenario B creates no
   resource.
