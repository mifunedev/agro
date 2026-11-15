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

For a self-managed instance, replace `gitlab.com` with the instance hostname.
`glab auth login` saves the token in `~/.config/glab-cli/`. The
`--setup-git-credential-helper` flag makes `glab` the Git credential helper for
that host, so `git` uses the stored token without a prompt.

## Automatic login at container start

Set the token as a secret, and optionally set the instance host:

```bash
agro secret set GITLAB_TOKEN
agro config set git.gitlabHost gitlab.example.com
agro stop <name> && agro sandbox install docker --name <name>
```

The token needs the `api` and `write_repository` scopes. When `GITLAB_TOKEN`
is set, the entrypoint runs `glab auth login --stdin` for the host in
`git.gitlabHost`, or for `gitlab.com` when the field is unset. The entrypoint
also registers `glab` as the HTTPS credential helper for that host. The
entrypoint skips the login when `glab` already holds a login for that host.
Compose passes `git.gitlabHost` to the container as `GITLAB_HOST`, so `glab`
outside a GitLab checkout targets the same instance.

## Recovery and repair

| Symptom | Command | Notes |
|---|---|---|
| Unknown GitLab account | `glab auth status` | Run `glab auth status` before a push and after a token change. |
| Wrong GitLab account | `glab auth logout --hostname <host>`, then `glab auth login` | Log out first. |
| `git push` prompts for a password | `glab auth login --hostname <host> --setup-git-credential-helper` | `~/.gitconfig` has no `glab` credential helper for the host. |
| Login gone after `agro destroy` | `glab auth login` | `agro destroy` deletes the home volume. Use `agro stop` to keep the volume. |

## OpenShell runtime

The canonical OpenShell policy allows `git`, `glab`, and `curl` to reach
`gitlab.com`. A self-managed instance needs its own entry in the `gitlab`
network policy of `.devcontainer/openshell-policy.yaml`.
