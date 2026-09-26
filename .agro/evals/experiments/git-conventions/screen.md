# git-conventions screen

Decision: `no-headroom`. Do not freeze D1 for a `/git` experiment.

The leak-free screen pass rate is 1.00. The rule of issue #1190 freezes D1 only when the pass rate is below 0.75. Each of the six checks has a rate of 1.00.

## Runs

| Run | Episode repository | Verifier | Pass rate | Cost (USD) | Role |
|---|---|---|---|---|---|
| `runs/screen/` | isolated, one commit | advisor rulings | 1.00 | 4.44 | decision run |
| `runs/screen-leaky/` | worktree of this repository | advisor rulings, rescored | 1.00 | 5.21 | comparison only |

The first run gave 0.70 with the verifier before the advisor rulings. That run is leaky: the episode worktree shared the refs of this repository, and local `development` held each merged answer. Each of the 10 leaky episodes read `development`. `summarize.sh screen-leaky --rescore` scores the stored heads and outputs with the ruled verifier. The label in `runs/screen-leaky/summary.json` marks the run as leaky.

Total cost of the screen: $9.65 for 20 attempts.

## Setup

- Model: `claude-opus-5-5`, effort `medium`, Claude Code 2.1.280, native `claude -p`. `--disallowedTools WebFetch WebSearch`.
- Prompt: `/git The working tree holds the complete change for issue #<N> ("<issue title>"). Create the task branch, commit the change, and write the pull request title on the first line of work/pr.md and the pull request body after it. Do not push and do not call GitHub.`
- Corpus: 10 merged pull requests into `development`. `select.sh` and `corpus/manifest.json` record the selection rule, the full candidate pool, and the `sha256` digest of each patch.
- Revision: the first parent of the merge commit.
- Patch: `git diff --binary <parent> <merge>` without `CHANGELOG.md`. The episode must write the changelog entry. The runner applies the patch as uncommitted changes.
- Overlay: each episode writes `.agro/skills/git/SKILL.md` and `.github/pull_request_template.md` from `2ab265fb` and marks both files skip-worktree. Seven of the 10 revisions have a template with no evidence sections.
- Leak guard: each episode deletes `.agro/evals/experiments/`. No revision holds that directory.
- `core.excludesFile` ignores `/work/` in the episode, so `work/pr.md` cannot enter a commit.

## Isolation

`make-episode-repo.sh` builds each episode repository under `${XDG_STATE_HOME:-$HOME/.local/state}/agro/git-screen/repos/`: `git init`, a depth-1 fetch of the pinned revision, and a detached checkout. The repository has no remote, no ref, no `FETCH_HEAD`, and no alternates. The runner deletes the repository after the verifier runs.

`tests/episode-repo.sh` builds the repository for each of the 10 cases. For each case, `git log --all` shows only the pinned revision, `git branch -a` shows only the detached `HEAD`, and the merge commit is not in the object store. The test exits 0. A fault injection with a depth-2 fetch and an `origin` remote makes the test exit 1.

`run-batch.sh` compares `git for-each-ref` of this repository before and after each batch. Both batches of the decision run found no change to the refs.

## Egress block

`no-egress.sh` wraps each `claude` process:

- `env -u` removes `GH_TOKEN`, `GITHUB_TOKEN`, `GH_ENTERPRISE_TOKEN`, the askpass helpers, `SSH_AUTH_SOCK`, and the editor git bridges.
- `GH_CONFIG_DIR` is a new empty directory, so `gh` has no login.
- `GIT_CONFIG_COUNT` rewrites each push URL prefix and each GitHub fetch URL prefix to a path that does not exist, and clears each credential helper.
- `GIT_SSH_COMMAND=false` and `GIT_TERMINAL_PROMPT=0`.

`tests/no-egress.sh` runs a fake agent in the same wrapper. `git push` to `origin`, to the HTTPS URL, and to the SSH URL fail on the block path. `git fetch` and `git ls-remote` from GitHub fail on the block path. `git credential fill`, `gh auth status`, `gh api user`, and `gh pr create` fail with no login. The test exits 0. Fault injections without the URL rewrites, and without the token removal and the empty `gh` directory, make the test exit 1. No episode of the decision run called `gh`, `curl`, `git fetch`, WebFetch, or WebSearch.

## Verifier

`verify-git.sh` prints one JSON object with `c1_commit_subjects`, `c2_branch`, `c3_pr_title`, `c4_pr_body`, `c5_changelog`, `c6_scope`, `pass`, and `details`. The `--help` text states each rule. `tests/verify-git.sh` exits 0 on 21 fixtures. Each fault fixture fails only its intended check.

The advisor rulings came before the decision run:

- `c6_scope`: the expected tree and the committed tree leave out each path that the patch adds and that the `.gitignore` files of the revision ignore (`git check-ignore --no-index`). The fixture from the #1049 episode passes, and the same fixture without a tracked test file fails `c6_scope`.
- `c5_changelog`: when the patch changes the `version` of `package.json`, entries can sit under the new `## [<version>]` section. The #1169 fixture with one sentence for each entry passes. The real #1169 changelog fails, because it holds three two-sentence entries.

## Result

| PR | Issue | Revision | Area | Branch | Pass | Failed check | Cost (USD) | Turns | Elapsed (s) |
|---|---|---|---|---|---|---|---|---|---|
| #1154 | #1150 | `90707bd2` | `.agro/hooks` | `bug/1150-secret-guard-false-allows` | yes | none | 0.50 | 14 | 84 |
| #1049 | #935 | `ed9ac894` | `.agro/scripts` | `bug/935-compose-parity-env-identity` | yes | none | 0.47 | 11 | 48 |
| #1063 | #1062 | `c49f4c89` | `.agro/skills` | `bug/1062-supervisor-description-limit` | yes | none | 0.46 | 9 | 43 |
| #1111 | #1110 | `632a77e1` | `.agro/scripts` | `bug/1110-resolve-sandbox-python-commands` | yes | none | 0.50 | 12 | 47 |
| #1083 | #1082 | `81e66e66` | `.agro/skills` | `task/1082-retire-claude-md-symlinks` | yes | none | 0.46 | 9 | 41 |
| #1051 | #1050 | `dd5ff0c0` | `.agro/cli` | `task/1050-retire-agro-cloud-command` | yes | none | 0.43 | 7 | 34 |
| #1091 | #1090 | `ab86a8c3` | `.agro/cli` | `feat/1090-antigravity-zero-confirmation` | yes | none | 0.32 | 6 | 26 |
| #1180 | #1179 | `9a9ddacc` | `.pi` | `task/1179-remove-pi-recap-default` | yes | none | 0.35 | 8 | 43 |
| #1069 | #1068 | `a33545a2` | `.agro/skills` | `bug/1068-supervisor-description-pi-limit` | yes | none | 0.36 | 7 | 37 |
| #1169 | #1168 | `de2c33ca` | `.agro/cli` | `feat/1168-node-host-tools` | yes | none | 0.59 | 11 | 64 |

- Pass rate: 10 of 10, 1.00.
- Check rates: each of the six checks 1.00.
- Cost: $4.44 for 10 attempts. The first episode cost $0.50. Mean turns: 9.4. Mean elapsed time: 47 s.
- No episode left an uncommitted change. The longest changelog entry has 245 characters.

## Failure classes

The decision run has no failure. The leaky run had two classes before the rulings: ignored task files (#1049, #1051) and a release section (#1169). The rulings accept both classes.

## Limits

- One repeat per case. With 10 of 10 passes, the one-sided 95% lower bound of the pass rate is about 0.74.
- `c4_pr_body` checks that each evidence section has content. It does not check that the content is true.
- The patch holds the task folder of the original pull request. An agent can read the plan and the branch name from it. Two of 10 branch names equal the original name.
- `no-egress.sh` does not stop network access from a shell tool, for example `curl` to github.com. The agent runs as the operator user and can read files outside the episode repository.

## Evidence

- `runs/screen/episodes.jsonl`: one line for each attempt of the decision run.
- `runs/screen/outputs/<pr>/`: `pr.md`, `log.txt` (`git log --format='%H %s' <parent>..HEAD`), and `changelog.diff`.
- `runs/screen/summary.json`: the summary from `summarize.sh screen`.
- `runs/screen-leaky/`: the leaky run and its rescored summary.
- Traces: `${XDG_STATE_HOME:-$HOME/.local/state}/agro/git-screen/traces/`. Git does not track the traces.
