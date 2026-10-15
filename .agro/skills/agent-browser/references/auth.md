# Authentication

Read this reference before you open a page that needs a sign-in. The operator
signs in one time through the dashboard. The agent saves the signed-in browser
state to a file. Later sessions load the file and need no dashboard.

## Contents

- [Rules](#rules)
- [Choose the method](#choose-the-method)
- [Set up a saved state](#set-up-a-saved-state)
- [Reuse a saved state](#reuse-a-saved-state)
- [Form sign-in with the vault](#form-sign-in-with-the-vault)
- [Expired state](#expired-state)

## Rules

- A saved state file and a vault profile are credentials. Keep them under
  `~/.agent-browser/`. The sandbox home volume keeps that directory across
  rebuilds, and git never sees it.
- Never write a state file under the repository, `.agro/tasks/`, or an evidence
  directory. Never attach one to a PR, an issue, or a message.
- Never type, echo, or log a password. The operator enters each password.
- A screenshot, a recording, a HAR file, or a console log of a signed-in page
  can show tokens or private data. Read each one before you commit it.
- Give `--state` only on the command that opens the session. A `--state` on a
  later command restarts the browser and loses `localStorage`. For the same
  reason, do not set `AGENT_BROWSER_STATE`.
- Do not use `--restore` for a shared sign-in. It writes the state back during
  the session, so parallel sessions race on one file. Each session loads the
  saved state read-only with `--state`.
- `--allowed-domains` refuses state replay. Do not combine it with `--state`.

## Choose the method

| Sign-in | Method |
|---|---|
| SSO, OAuth, MFA, passkey, CAPTCHA, or an email link | Saved state. The operator signs in through the dashboard. |
| A plain username and password form | The vault, then a saved state. |
| An API token in a header | `--headers '{"Authorization":"Bearer …"}'` from an environment variable. No browser sign-in. |

## Set up a saved state

Do this one time for each app and account. The operator must be available.

1. Name the app and the state file:

   ```bash
   APP=<app-slug>
   STATE="$HOME/.agent-browser/state/$APP.json"
   AUTH_SESSION="auth-$APP"
   mkdir -p "$(dirname "$STATE")" && chmod 700 "$(dirname "$STATE")"
   ```

2. Open the sign-in page in its own session:

   ```bash
   agent-browser --session "$AUTH_SESSION" open "$LOGIN_URL"
   ```

3. Start the dashboard and give the operator the access route. Follow
   `references/dashboard.md`. Ask the operator to select the `$AUTH_SESSION`
   tab, sign in, and reply when the app shows the signed-in page.
4. Check a signed-in signal, for example the account name or a URL that only a
   signed-in user reaches:

   ```bash
   agent-browser --session "$AUTH_SESSION" get url
   agent-browser --session "$AUTH_SESSION" get text '<signed-in selector>'
   ```

   If the signal is missing, ask the operator again. Do not save a signed-out
   state.

5. Save the state, restrict the file, and close the session:

   ```bash
   agent-browser --session "$AUTH_SESSION" state save "$STATE"
   chmod 600 "$STATE"
   agent-browser --session "$AUTH_SESSION" close
   ```

6. Stop the dashboard and any tunnel that you started for the sign-in.

The file holds the cookies, `localStorage`, and `sessionStorage` of each
origin. When `AGENT_BROWSER_ENCRYPTION_KEY` is set, `state save` encrypts the
file and appends `.enc` to the path. Each session that loads it then needs the
same key. Without a key manager, keep the file unencrypted with mode 600.

## Reuse a saved state

Give `--state` on the first command of the session only:

```bash
agent-browser --session "$SESSION" --state "$STATE" open "$URL"
agent-browser --session "$SESSION" get text '<signed-in selector>'
```

Each session loads its own copy. Parallel sessions can load the same file.

To record a signed-in scenario, give the file to `record.sh start` with
`--state "$STATE"`. See `references/recording.md`.

## Form sign-in with the vault

The vault stores a username and an encrypted password under
`~/.agent-browser/auth/`. `auth login` opens the sign-in URL, fills the form,
and submits it. It cannot pass MFA, SSO, or a CAPTCHA.

1. The operator saves the profile in their own Herdr pane. The password comes
   from standard input, so it never appears in a command line or a transcript:

   ```bash
   agent-browser auth save <app-slug> --url "$LOGIN_URL" --username <user> --password-stdin
   ```

   The operator types the password, presses Enter, then presses Ctrl-D. Add
   `--username-selector`, `--password-selector`, and `--submit-selector` when
   the form has unusual fields.

2. The agent signs in a session:

   ```bash
   agent-browser --session "$SESSION" auth login <app-slug>
   ```

3. Check the signed-in signal. To skip the form in later sessions, save the
   state as in step 5 of the setup.

`auth list` and `auth show <name>` print metadata without the password.
`auth delete <name>` removes a profile.

## Expired state

A session that loads an expired state shows the signed-out page. Check the
signed-in signal after each `open` with `--state`. When the signal is missing:

- With a vault profile, run `auth login`, then save the state again.
- Without a vault profile, the operator must sign in again. In an unattended
  session, escalate with the `escalate` skill. Do not retry in a loop.
