---
title: "GitLab"
---

# GitLab

AGRO installs the GitLab CLI (`glab`) in the sandbox image beside `gh`. This
page is the command reference for GitLab authentication inside the sandbox.
GitLab support is optional. A sandbox without `GITLAB_TOKEN` and without a
`glab` login behaves the same as before.

## One-time login

Inside the sandbox, in a Herdr pane, run these commands in order:

```bash
glab auth login --hostname gitlab.com --git-protocol https --setup-git-credential-helper
glab auth status
```

`glab auth login` saves the token in `~/.config/glab-cli/`. The
`--setup-git-credential-helper` flag makes `glab` the Git credential helper for
that host, so `git` uses the stored token without a prompt.

## Automatic login at container start

Set the token as a secret, then recreate the sandbox:

```bash
agro secret set GITLAB_TOKEN
agro stop <name> && agro sandbox install docker --name <name>
```

The token needs the `api` and `write_repository` scopes. When `GITLAB_TOKEN`
is set, the entrypoint runs `glab auth login --stdin` for `gitlab.com` and
registers `glab` as the HTTPS credential helper. The entrypoint skips the login
when `glab` already holds a login for `gitlab.com`. AGRO supports `gitlab.com`
only; it does not configure self-managed GitLab instances.

## Recovery and repair

| Symptom | Command | Notes |
|---|---|---|
| Unknown GitLab account | `glab auth status` | Run `glab auth status` before a push and after a token change. |
| Wrong GitLab account | `glab auth logout --hostname gitlab.com`, then `glab auth login` | Log out first. |
| `git push` prompts for a password | `glab auth login --hostname gitlab.com --setup-git-credential-helper` | `~/.gitconfig` has no `glab` credential helper for `gitlab.com`. |
| Login gone after `agro destroy` | `glab auth login` | `agro destroy` deletes the home volume. Use `agro stop` to keep the volume. |
