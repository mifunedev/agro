# Manual review evidence — secret delivery hardening

Observed run on 2026-10-11, base commit `63f7d357`, Node v22.23.3. Every
output below is copied from that run. The transcript holds no secret value.
The only value piped to the CLI is the dummy string `dummy-not-a-secret`, and
no command prints it.

**A. The secret-exposure hook**

Prerequisites: a checkout of the AGRO harness, `jq`, and `bash`. Runs in the
sandbox, local. Run `export LC_ALL=C` first to silence the perl locale warning
in a sandbox without generated locales.

1. Pipe a PreToolUse input for `agro secret get GH_TOKEN` through the hook:

   ```bash
   printf '%s' '{"tool_input":{"command":"agro secret get GH_TOKEN"}}' | bash .agro/hooks/deny-env-dump.sh
   ```

   Output, trimmed:

   ```json
   {
     "hookSpecificOutput": {
       "hookEventName": "PreToolUse",
       "permissionDecision": "deny",
       "permissionDecisionReason": "Secret-exposure guard (deny): command matches a high-risk pattern — ... or a token-printing CLI (gh auth token, agro secret get, gcloud auth print-*-token, ...). ..."
     }
   }
   ```

   Expected: `"permissionDecision": "deny"`. Expected exit status: 0. The
   hook signals the denial through its JSON, not through its exit status.

2. Allowed path. Pipe a PreToolUse input for `agro secret list`:

   ```bash
   printf '%s' '{"tool_input":{"command":"agro secret list"}}' | bash .agro/hooks/deny-env-dump.sh
   ```

   Expected output: none. An empty output allows the command. Expected exit
   status: 0.

**B. `agro secret set --sandbox <name>`**

Prerequisites: build the CLI from source.

```bash
npm --prefix .agro/cli ci --ignore-scripts
npm --prefix .agro/cli run build
```

Runs in the sandbox, local. Each step uses a temporary `AGRO_HOME` with one
registry entry, created the same way as the `--sandbox <name>` tests in
`.agro/cli/src/__tests__/config-secret.test.ts`:

```bash
export AGRO_HOME=/tmp/agro-us004-home
mkdir -p /tmp/agro-us004-home/sandboxes/review-box
printf '%s\n' '{"version":1,"name":"review-box"}' > /tmp/agro-us004-home/sandboxes/review-box/agro.json
```

Each CLI run also printed
`agro: warning: /etc/agro/sandbox is missing; detected the sandbox from /.dockerenv and SANDBOX_NAME. Upgrade the sandbox image.`
That warning comes from the review sandbox image and is not part of this
change. The outputs below omit it.

1. Failure path. Set a key that Compose does not pass to the container:

   ```bash
   printf '%s\n' dummy-not-a-secret | node .agro/cli/dist/agro.js secret set PI_SLACK_BOT_TOKEN --sandbox review-box
   ```

   Output:

   ```text
   agro secret set: PI_SLACK_BOT_TOKEN does not reach the container from --sandbox review-box — Compose passes only GH_TOKEN, SANDBOX_PASSWORD, TYPESAFE_API_KEY.
   Run `agro secret set PI_SLACK_BOT_TOKEN` in the project checkout instead.
   ```

   Expected exit status: 1. The command does not read the value and writes
   no file.

2. Set a key that Compose passes, with the dummy value on stdin:

   ```bash
   printf '%s\n' dummy-not-a-secret | node .agro/cli/dist/agro.js secret set GH_TOKEN --sandbox review-box
   ```

   Output:

   ```text
     Value for GH_TOKEN (input hidden): .env: set GH_TOKEN
   ```

   Expected exit status: 0.

3. Confirm the registry entry holds the key. The command prints key names
   only, never values:

   ```bash
   node .agro/cli/dist/agro.js secret list --sandbox review-box
   ```

   Output:

   ```text
   GH_TOKEN  set
   ```

   Expected exit status: 0.

Observed side note, outside this change: when the piped value has no
trailing newline (`printf '%s' dummy-not-a-secret | ...`), `agro secret set
GH_TOKEN --sandbox review-box` printed only the prompt, wrote nothing, and
exited 0. The next `agro secret list --sandbox review-box` printed
`no secrets set — write one with `agro secret set <KEY>``. Pipe the value
with a trailing newline.

**C. Cleanup**

1. Delete the temporary `AGRO_HOME`:

   ```bash
   rm -rf /tmp/agro-us004-home
   test -e /tmp/agro-us004-home && echo still-there || echo removed
   ```

   Expected output: `removed`. The observed run deleted
   `/tmp/agro-us004-home` after each sequence. The run created no other
   temporary directory.
