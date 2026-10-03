---
title: Slack
---

# Slack

The npm package
[pi-messenger-bridge](https://github.com/tintinweb/pi-messenger-bridge) connects
a Pi agent in the sandbox to Slack. The bridge opens a Socket Mode connection,
sends each Slack message to the Pi agent, and posts the reply back to Slack. In a
channel, the bot replies in a thread. In a DM, the bot replies flat.

The `agro gateway` command owns the bridge. `agro gateway pi` installs the bridge into the
gitignored `.pi/bridge/` directory and starts the `client-slack-pi` tmux session.
Only that session loads the bridge, so no other Pi session competes for the
Slack connection. You never run `pi install` for the bridge.

## 1. Prerequisites

- The sandbox runs (`agro ps <name>`).
- Inside the sandbox, `pi --version` works.
- You can create apps in a Slack workspace. If your company workspace blocks app
  creation, create a free workspace at
  [slack.com/get-started](https://slack.com/get-started).

## 2. Create the Slack app

The canonical manifest is
[`.pi/install/slack-manifest.yaml`](../../.pi/install/slack-manifest.yaml). The
manifest turns on Socket Mode, requests the bot scopes, and declares seven admin
slash commands.

1. Open [api.slack.com/apps](https://api.slack.com/apps).
2. Click **Create New App**, then **From an app manifest**.
3. Select your workspace.
4. Paste the contents of `.pi/install/slack-manifest.yaml`.
5. Click **Install to Workspace** and approve the OAuth scopes.

Create one Slack app for each host. Each host needs its own tokens.

When the manifest changes, update the app from the new manifest. Reinstall the
app when the manifest adds a scope.

## 3. Get the tokens

Copy two tokens from the Slack app settings. The two tokens are not
interchangeable.

| Token | Prefix | Location in the Slack app settings |
|-------|--------|------------------------------------|
| App-Level Token | `xapp-` | **Basic Information** → **App-Level Tokens**. Generate one with the `connections:write` scope. |
| Bot User OAuth Token | `xoxb-` | **OAuth & Permissions** → **Bot User OAuth Token** |

## 4. Store the tokens

Inside the sandbox, run `agro secret set` for each token. Each command prompts
for the value and hides the input:

```bash
agro secret set PI_SLACK_APP_TOKEN    # the xapp- token
agro secret set PI_SLACK_BOT_TOKEN    # the xoxb- token
```

`agro gateway pi` reads both tokens from the file that `agro secret set` writes.
At boot, the entrypoint starts `client-slack-pi` when that file holds both
tokens.

## 5. Start the gateway

Run `agro gateway` inside the sandbox. The command needs `pi` on `PATH`, and
refuses to run on the host.

```bash
agro gateway pi              # start client-slack-pi (idempotent)
agro gateway pi --restart    # restart to read token or config changes
agro gateway pi --stop       # stop the session
agro gateway pi --attach     # start if needed, then attach (read-write)
agro gateway status          # health of client-slack-pi and client-slack-hermes
```

`agro gateway pi` does these steps:

1. Installs or updates the pinned bridge in `.pi/bridge/`.
2. Merges `.pi/msg-bridge.json` into `~/.pi/msg-bridge.json`, and keeps every
   trust grant that already exists.
3. Removes a stale `~/.pi/msg-bridge.lock`.
4. Starts `client-slack-pi` under `.devcontainer/client-slack-supervise.sh`. The
   supervisor restarts Pi when the bridge stops responding or Pi crashes.

`agro gateway status` prints one state for each session:

| State | Meaning |
|-------|---------|
| `healthy` | The heartbeat is fresh. |
| `recovering` | The supervisor is in a restart or a backoff. |
| `running · disconnected (no PI_SLACK token)` | The bridge loaded without tokens. |
| `stopped` | No session runs. |

To watch the session without risk, attach read-only. Detach with `Ctrl-b d`.
Never press `Ctrl-C` or type `exit` in the session, because both stop Pi.

```bash
tmux attach -r -t client-slack-pi
tail -f /tmp/client-slack-pi.log
```

The Hermes gateway uses the same command: `agro gateway hermes`, session
`client-slack-hermes`. See [Hermes](../harnesses/hermes.md#run-and-verify-read-only).

## 6. Configure the bridge

### Pi command: `/msg-bridge`

The bridge registers one Pi command, `/msg-bridge`. Run the command inside
`client-slack-pi`. To open the session, use `agro gateway pi --attach`.
`agro gateway msg-bridge` sends `/msg-bridge` to the session for you.

- `/msg-bridge`: status and the configuration menu.
- `/msg-bridge status`: connection state, trusted-user count, and channel count.
- `/msg-bridge connect` and `/msg-bridge disconnect`: open and close Socket Mode.
- `/msg-bridge help`: the Pi command reference.

`/trusted`, `/channels`, `/enable`, `/disable`, and `/help` are Slack admin
commands (section 8). They are not Pi commands.

### Headless pre-seed: `.pi/msg-bridge.json`

The bridge keeps runtime state in `~/.pi/msg-bridge.json`. The tracked
`.pi/msg-bridge.json` is an optional seed for a sandbox that nobody watches:

```json
{
  "autoConnect": true,
  "auth": {
    "trustedUsers": ["slack:U01ABCD2345"],
    "channels": {
      "C01EFGH6789": { "enabled": true, "mode": "mentions" }
    }
  }
}
```

- `autoConnect`: `true` opens Socket Mode when the session starts.
- `auth.trustedUsers`: Slack user IDs in the form `slack:U…`. A listed user
  skips the challenge (section 7).
- `auth.channels`: per-channel settings, keyed by channel ID (`C…`).

After you edit the seed, run `agro gateway pi --restart`.

## 7. Access control

The bridge denies every unknown user. A user earns trust through a one-time
challenge:

1. An unknown user sends a message to the bot.
2. The bridge prints a 6-digit code in the Pi session. Read the code with
   `tmux attach -r -t client-slack-pi`.
3. The user sends the code to the bot in Slack.
4. The bridge adds the user to `auth.trustedUsers` in `~/.pi/msg-bridge.json`.
   Trust survives a restart.

To skip the challenge on a headless sandbox, add your `slack:U…` ID to the seed
(section 6). Then restart the gateway.

## 8. Slack admin commands

A trusted user runs these commands in a DM with the bot. The manifest declares
each command, so Slack shows the commands in autocomplete.

| Command | Effect |
|---------|--------|
| `/trusted` | List trusted users. |
| `/revoke <userId>` | Revoke trust for a user (`slack:U…` or `U…`). |
| `/channels` | List known chats and their mode. |
| `/enable <chatId> <all\|mentions\|trusted-only>` | Turn on the bot in a chat with the given mode. |
| `/disable <chatId>` | Turn off the bot in a chat. |
| `/toggletools` | Show or hide tool calls in Slack replies. |
| `/help` | Show the admin help. |

The same text works as a plain DM message from a trusted user.

## 9. Smoke test

Run these checks in the sandbox, in order.

1. Confirm that the gateway is healthy:

   ```bash
   agro gateway status
   ```

2. Confirm the Socket Mode connection. The `[Slack] Bot user ID:` line
   appears after the bridge opens Socket Mode:

   ```bash
   tmux capture-pane -t client-slack-pi -p | grep -F '[Slack] Bot user ID:'
   ```

   `curl https://slack.com/api/auth.test` checks only the `xoxb-` token. An
   invalid `xapp-` token passes `auth.test` and still fails Socket Mode. Use the
   log line as the connection test.

3. Send `hello` to the bot in a DM. Complete the challenge if the bridge asks.
   Then run `/trusted` in the DM. The agent reply appears in Slack.

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Bot stays silent; you never completed the challenge | The bridge denies unknown users | Read the code with `tmux attach -r -t client-slack-pi` and send the code in Slack, or pre-seed your user ID (section 6) |
| `/help` or `/trusted` is missing from Slack autocomplete | The app predates the current manifest | Update the app from `.pi/install/slack-manifest.yaml`, then run `agro gateway pi --restart` |
| `invalid_auth` or `not_authed` in the log | Each token sits in the other variable | Run `agro secret set` for each token again (section 4), then run `agro gateway pi --restart` |
| `agro gateway status` shows `disconnected (no PI_SLACK token)` | The tokens are not set | Run `agro secret set` for both tokens (section 4), then run `agro gateway pi --restart` |
| Bridge connects but never replies | `autoConnect` is not `true` | Set `"autoConnect": true` in `.pi/msg-bridge.json`, then run `agro gateway pi --restart` |
| Trusted user, channel messages ignored | The bot is not in the channel | In the channel, run `/invite @agro` |

To read the current trust and channel state, run
`jq '.auth' ~/.pi/msg-bridge.json`.

AGRO pins the bridge in `.agro/scripts/gateway.sh`. Upstream lineage and the pin
policy are in [`.pi/UPSTREAM.md`](../../.pi/UPSTREAM.md). For remote access to
the sandbox, see [Connecting to the Sandbox](../connecting.md).
