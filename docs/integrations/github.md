---
title: "GitHub"
---

# GitHub

Open Harness uses the GitHub CLI (`gh`) for authentication inside the sandbox. This page
is the command-level reference: protocol choice, SSH-key upload, verification, recovery,
and pull-request commands. The onboarding order itself — the five checks and the two
optional agent prompts — lives in
[Quickstart → Authenticate GitHub before any repository work](../quickstart.md#authenticate-github-before-any-repository-work).

Local sandbox use needs no GitHub account. Pushing, creating a repository, and opening a
pull request do. Provider authentication (Claude, Codex, Pi, and the rest) authenticates
the model, not GitHub, and grants no repository access.

## One-time onboarding

Inside the sandbox, in a Herdr pane, run these in order and read the third one's output:

```bash
gh auth login       # authenticate the intended GitHub account
gh auth setup-git   # register gh as Git's credential helper
gh auth status      # confirm the account and its access
```

`gh auth login` opens a browser-based or device OAuth flow and saves the token to
`~/.config/gh/`. `gh auth setup-git` registers the GitHub CLI as a Git credential helper,
so all subsequent `git` commands use the stored token without prompting. `gh auth status`
prints the host, the account, the protocol, and the token scopes: confirm the account is
the one you intended before you hand the workspace to an agent.

Never delegate this initial login to an agent. An agent cannot complete an interactive
OAuth flow for you, and a prompt that assumes an account it cannot verify is how the wrong
identity ends up on a commit.

After this, standard Git commands work without additional configuration:

```bash
git clone https://github.com/your-org/your-repo.git
git push origin main
```

## SSH authentication

SSH remote URLs (`git@github.com:...`) push with a key generated inside the sandbox, which
survives container restarts in the `/home/sandbox` mount. Two ways to get an SSH key that
GitHub trusts:

**A. Interactive — pick SSH during `gh auth login`** (the validated path):

```bash
gh auth login
# ? What account do you want to log into?   GitHub.com
# ? What is your preferred protocol for Git operations?   SSH
# ? Generate a new SSH key to add to your GitHub account?   Yes
#   (accept the path, empty passphrase, give it a title)
# ? How would you like to authenticate?   Paste an authentication token
```

Pasting a token (a classic PAT with `repo`, `read:org`, `admin:public_key`, and — if you
will run `gh repo create` — `workflow`) lets `gh` upload the freshly generated public key
for you. After this, `git@github.com:...` remotes push without prompting.

**B. Automatic — via `GH_TOKEN` at container start.** If `GH_TOKEN` was provided when the
sandbox booted, the entrypoint mirrors the interactive SSH path: it generates an ed25519
keypair at `~/.ssh/id_ed25519` and uploads the public key to GitHub as
`openharness-<sandbox-name>` (`.devcontainer/entrypoint.sh:275-309`). This upload requires
the token to carry the **`admin:public_key`** scope; without it the key is still generated
but not uploaded, and HTTPS + the credential helper continue to work. The step is
idempotent — an already-registered key is detected and skipped.

Verify the key is in place:

```bash
gh ssh-key list
ssh -T git@github.com    # "Hi <user>! You've successfully authenticated…"
```

## Recovery and repair

| Symptom | Command | Notes |
|---|---|---|
| Unsure which account is authenticated | `gh auth status` | Run it before any push, and after any token change. |
| Wrong account authenticated | `gh auth logout --hostname github.com`, then `gh auth login` | Log out first; a second login does not replace the first silently. |
| `git push` prompts for a password | `gh auth setup-git` | The credential helper was never registered, or `~/.gitconfig` was reset. |
| `Permission denied (publickey)` | `gh ssh-key list`, then `ssh -T git@github.com` | The key is missing from the account, or the remote is SSH while only HTTPS is set up. |
| `gh repo create` refuses | `gh auth refresh -s repo,workflow` | The token lacks a scope. `admin:public_key` is what the SSH-key upload needs. |
| Everything gone after a teardown | `gh auth login` again | `agro destroy` and `docker compose down -v` delete the home volume with the token and keys in it. Use `agro stop` to keep them. |

`agro config repo` (and `oh config repo`) creates a repository and re-points `origin` for
the retired clone-and-own recipe. It stays supported through the
[AGRO compatibility](../agro-compatibility.md) window, asks before it runs, defaults to no,
and skips itself entirely in a non-interactive shell. It is not the canonical onboarding
path. If `gh` is missing or unauthenticated it prints the equivalent commands instead of
running them:

```bash
gh repo create <your-user>/<repo> --private
git remote set-url origin git@github.com:<your-user>/<repo>.git
git remote add upstream git@github.com:mifunedev/agro.git
git push -u origin HEAD
```

## Creating and managing pull requests

With the CLI authenticated, use `gh` to create PRs, open issues, and check CI status from inside the sandbox:

```bash
# Create a pull request
gh pr create --base development --title "FROM feat/my-feature TO development"

# Check CI pipeline status
gh run list --branch feat/my-feature

# View an issue
gh issue view 42
```

## Persisting credentials across restarts

The `gh` token is stored inside the container at `~/.config/gh/`, which persists in the single `/home/sandbox` mount. The token survives `agro stop` and `agro sandbox install docker` cycles. `agro destroy` (and `docker compose down -v`) deletes the volume — re-run `gh auth login` after one, or set `storage.homePath` in `agro.json` to keep the sandbox home on a host path that `down -v` cannot touch.
