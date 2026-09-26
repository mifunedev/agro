# git-conventions screen

Decision under the pinned rule: `freeze-d1-git`. The screen pass rate is 0.70, and the rule of issue #1190 freezes D1 when the pass rate is below 0.75.

The decision is not stable. Each of the three failures comes from the historical corpus, not from a `/git` convention that the agent ignored. Under the adjusted reading in "Verifier doubt", the pass rate is 1.00 and the decision is `no-headroom`. The ref leak in "Verifier doubt" can also raise the pass rate. The advisor must select the reading before a D1 freeze.

## Setup

- Model: `claude-opus-5-5`, effort `medium`, Claude Code 2.1.280, native `claude -p`.
- Prompt: `/git The working tree holds the complete change for issue #<N> ("<issue title>"). Create the task branch, commit the change, and write the pull request title on the first line of work/pr.md and the pull request body after it. Do not push and do not call GitHub.`
- Corpus: 10 merged pull requests into `development`. `select.sh` and `corpus/manifest.json` record the selection rule, the full candidate pool, and the `sha256` digest of each patch.
- Revision: the first parent of the merge commit.
- Patch: `git diff --binary <parent> <merge>` without `CHANGELOG.md`. The episode must write the changelog entry. The runner applies the patch as uncommitted changes.
- Overlay: each episode writes `.agro/skills/git/SKILL.md` and `.github/pull_request_template.md` from `2ab265fb` and marks both files skip-worktree. Seven of the 10 revisions have a template with no evidence sections.
- Leak guard: each episode deletes `.agro/evals/experiments/`. No revision holds that directory.
- `core.excludesFile` ignores `/work/` in the episode, so `work/pr.md` cannot enter a commit.
- Verifier: `verify-git.sh`. The `--help` text states each rule. `tests/verify-git.sh` exits 0 on 17 fixtures.

## Egress block

`no-egress.sh` wraps each `claude` process:

- `env -u` removes `GH_TOKEN`, `GITHUB_TOKEN`, `GH_ENTERPRISE_TOKEN`, the askpass helpers, `SSH_AUTH_SOCK`, and the editor git bridges.
- `GH_CONFIG_DIR` is a new empty directory, so `gh` has no login.
- `GIT_CONFIG_COUNT` sets `remote.origin.pushurl` to a path that does not exist, rewrites each push URL prefix to that path with `pushInsteadOf`, and clears each credential helper.
- `GIT_SSH_COMMAND=false` and `GIT_TERMINAL_PROMPT=0`.

`tests/no-egress.sh` runs a fake agent in the same wrapper. `git push` to `origin`, to the HTTPS URL, and to the SSH URL fail on the block path. `git credential fill`, `gh auth status`, `gh api user`, and `gh pr create` fail with no login. The test exits 0. Two fault injections make it exit 1: without the push rewrite, and without the token removal and the empty `gh` directory.

Each episode records the new refs and deletes each branch that it created with `git-maintenance.sh branch-delete`. No episode left a ref, and no episode changed an existing ref.

## Result

| PR | Issue | Revision | Area | Branch | Pass | Failed check | Cost (USD) | Turns | Elapsed (s) |
|---|---|---|---|---|---|---|---|---|---|
| #1154 | #1150 | `90707bd2` | `.agro/hooks` | `bug/1150-guard-false-allows` | yes | none | 0.44 | 10 | 47 |
| #1049 | #935 | `ed9ac894` | `.agro/scripts` | `bug/935-compose-env-path-parity` | no | `c6_scope` | 0.79 | 23 | 82 |
| #1063 | #1062 | `c49f4c89` | `.agro/skills` | `skill/1062-supervisor-description-limit` | yes | none | 0.57 | 13 | 84 |
| #1111 | #1110 | `632a77e1` | `.agro/scripts` | `bug/1110-sandbox-python-commands` | yes | none | 0.47 | 11 | 43 |
| #1083 | #1082 | `81e66e66` | `.agro/skills` | `task/1082-retire-claude-md-symlinks` | yes | none | 0.51 | 11 | 49 |
| #1051 | #1050 | `dd5ff0c0` | `.agro/cli` | `task/1050-retire-agro-cloud-command` | no | `c6_scope` | 0.62 | 15 | 63 |
| #1091 | #1090 | `ab86a8c3` | `.agro/cli` | `feat/1090-antigravity-zero-confirmation-default` | yes | none | 0.39 | 9 | 38 |
| #1180 | #1179 | `9a9ddacc` | `.pi` | `task/1179-remove-pi-recap-default` | yes | none | 0.37 | 9 | 33 |
| #1069 | #1068 | `a33545a2` | `.agro/skills` | `bug/1068-supervisor-pi-description-limit` | yes | none | 0.38 | 8 | 38 |
| #1169 | #1168 | `de2c33ca` | `.agro/cli` | `feat/1168-node-host-tools` | no | `c5_changelog` | 0.67 | 16 | 77 |

- Pass rate: 7 of 10, 0.70.
- Check rates: `c1_commit_subjects` 1.00, `c2_branch` 1.00, `c3_pr_title` 1.00, `c4_pr_body` 1.00, `c5_changelog` 0.90, `c6_scope` 0.80.
- Total cost: $5.21 for 10 attempts. The first episode cost $0.44. Mean turns: 12.5. Mean elapsed time: 55 s.
- No episode left an uncommitted change.

## Failure classes

Class 1, ignored task files (#1049, #1051). The patch adds files under `.agro/tasks/<slug>/`. The `.gitignore` of the revision ignores each of these files, and the original authors force-added them. The agent committed the other files and did not force-add ignored files. The #1049 agent ran `git check-ignore -v .agro/tasks/compose-env-path-parity/*` before the commit. `c6_scope` for #1049 lists "D .agro/tasks/compose-env-path-parity/prd.md" and four other task files.

Class 2, a release section (#1169). The patch sets the version to 0.15.0. The agent added a `## [0.15.0] - 2026-09-26` section and put five entries under it. The original pull request also added a `## [0.15.0]` section. `c5_changelog` reports "not under ## [Unreleased]" for each entry.

## Verifier doubt

- `c6_scope` compares the committed tree with the full patch. It does not remove paths that the `.gitignore` of the revision ignores. A reading that removes these paths passes #1049 and #1051.
- `c5_changelog` requires `## [Unreleased]`. The `/git` skill also lets a release publish a `## [<VERSION>]` section. A reading that accepts a versioned section when the original pull request added one passes #1169.
- When both readings apply, the pass rate is 1.00, and every check rate is 1.00. The verifier was not changed after the episodes.
- `c4_pr_body` checks that each evidence section has content. It does not check that the content is true.
- One repeat per case. The standard error of a 0.70 pass rate on 10 attempts is about 0.14.
- The patch holds the task folder of the original pull request, so the agent can read the original branch name. Five of 10 branch names equal the original name.
- Leak: the episode worktree shares the refs of the repository. Local `development` and `origin/development` hold each merged pull request. Each of the 10 episodes ran `git show`, `git log`, `git diff`, or `git checkout` against `development`. The #1169 agent read `development:CHANGELOG.md`. The #1049 agent reported: "your local `development` already has this fix. PR #1049 was merged there as `dd5ff0c0`." The leak guard does not cover refs. A leak-free screen needs an episode repository that holds only the pinned revision.

## Evidence

- `runs/screen/episodes.jsonl`: one line for each attempt.
- `runs/screen/outputs/<pr>/`: `pr.md`, `log.txt` (`git log --format='%H %s' <parent>..HEAD`), and `changelog.diff`.
- `runs/screen/summary.json`: the summary from `summarize.sh screen`.
- Traces: `${XDG_STATE_HOME:-$HOME/.local/state}/agro/git-screen/traces/`. Git does not track the traces.
