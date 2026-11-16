# Manual review: next.sh state order with and without review

This transcript runs `bash .agro/skills/delegate/scripts/next.sh --task demo` in a new temp git repository with a stub `gh` on `PATH`. It records the state sequence for a task without `review` and for a task with `"review": true`. Each output is copied from an observed run on 2026-11-15 against `next.sh` at commit `a46b4021`.

## Prerequisites

- Location: sandbox, main checkout `/home/sandbox/harness` on `feat/1658-fold-review-into-delegate`.
- Tools: `bash`, `git`, and `jq` on `PATH`. No live PR and no GitHub sign-in.
- Save the two files below in a scratch directory `$SCRATCH` as `$SCRATCH/gh` and `$SCRATCH/drive.sh`.

## Stub `gh`

The stub answers only `gh pr view <n> --json headRefOid,isDraft,statusCheckRollup -q <query>`. It runs the `-q` query with `jq` over JSON that the environment controls:

- `GH_STUB_CHECKS`: `pass`, `pending`, or `fail` for one check run.
- `GH_STUB_DRAFT`: `true` or `false` for `isDraft`.
- `headRefOid`: `git rev-parse HEAD` of the current repository, or `GH_STUB_HEAD` when set.

```bash
#!/usr/bin/env bash
set -u
case "$1 $2" in
  "pr view")
    query="."
    while [ $# -gt 0 ]; do
      case "$1" in
        -q) query="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    jq -nc \
      --arg head "${GH_STUB_HEAD:-$(git rev-parse HEAD)}" \
      --arg draft "${GH_STUB_DRAFT:-true}" \
      --arg checks "${GH_STUB_CHECKS:-pass}" '
        {
          pass: {status: "COMPLETED", conclusion: "SUCCESS"},
          pending: {status: "IN_PROGRESS", conclusion: ""},
          fail: {status: "COMPLETED", conclusion: "FAILURE"}
        } as $results
        | {
            headRefOid: $head,
            isDraft: ($draft == "true"),
            statusCheckRollup: [{__typename: "CheckRun", workflowName: "ci", name: "check", startedAt: "2026-01-01T00:00:00Z"} + $results[$checks]]
          }' | jq -r "$query"
    ;;
  *) echo "unexpected gh call: $*" >&2; exit 2 ;;
esac
```

## Driver

`drive.sh <harness root> <stub gh> <default|review>` does these steps:

1. Creates a new temp path with `mktemp -d`, a bare remote, and a work repository on `feat/1-demo`.
2. Copies `next.sh` to `.agro/skills/delegate/scripts/next.sh` in the work repository, because `next.sh` runs from the git toplevel.
3. Writes `.agro/tasks/demo/prd.json` with one story `US-001` (`passes: false`) and `pr: 7`. In `review` mode, it also writes `"review": true`. Writes `prd.md` with an empty `## Lessons`.
4. Changes one piece of state per step and runs `next.sh` after each change.
5. Deletes the temp path and checks that the path no longer exists.

The driver writes no file in the harness checkout.

```bash
#!/usr/bin/env bash
set -euo pipefail

harness="$1"
stub="$2"
mode="$3"

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.com GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1

tmp="$(mktemp -d)"
echo "# temp path: $tmp"
mkdir "$tmp/bin" "$tmp/work"
cp "$stub" "$tmp/bin/gh"
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH"
git init -q --bare "$tmp/remote.git"
cd "$tmp/work"
git init -q -b feat/1-demo
git config commit.gpgsign false
git remote add origin "$tmp/remote.git"
mkdir -p .agro/skills/delegate/scripts .agro/tasks/demo
cp "$harness/.agro/skills/delegate/scripts/next.sh" .agro/skills/delegate/scripts/next.sh

review_field='{}'
[ "$mode" = review ] && review_field='{"review": true}'
jq -n --argjson extra "$review_field" '{schemaVersion: 1, project: "demo", branchName: "feat/1-demo", pr: 7,
  userStories: [{id: "US-001", title: "demo", priority: 1, passes: false, dependsOn: []}]} + $extra' > .agro/tasks/demo/prd.json
printf '# Demo\n\n## Stories\n\nText.\n\n## Lessons\n\n' > .agro/tasks/demo/prd.md
git add -A && git commit -q -m init

step() {
  echo
  echo "\$ $1"
  echo "\$ GH_STUB_CHECKS=${GH_STUB_CHECKS:-pass} GH_STUB_DRAFT=${GH_STUB_DRAFT:-true} bash .agro/skills/delegate/scripts/next.sh --task demo"
  bash .agro/skills/delegate/scripts/next.sh --task demo
}
set_prd() {
  jq "$1" .agro/tasks/demo/prd.json > prd.tmp && mv prd.tmp .agro/tasks/demo/prd.json
  git add -A && git commit -q -m "$2"
}
lessons() {
  printf '# Demo\n\n## Stories\n\nText.\n\n## Lessons\n\nNone.\n' > .agro/tasks/demo/prd.md
  git add -A && git commit -q -m lessons
}

export GH_STUB_CHECKS=pending GH_STUB_DRAFT=true
step "# US-001 passes=false"
set_prd '.userStories[0].passes = true' accept
if [ "$mode" = review ]; then
  step "# US-001 passes=true, commit not pushed"
  git push -q -u origin feat/1-demo
  step "# git push; checks pending"
  export GH_STUB_CHECKS=pass
  step "# checks pass"
  set_prd '.reviewed = "2026-11-15 code review: no findings"' reviewed
  step "# reviewed written and committed; ## Lessons empty"
else
  step "# US-001 passes=true; ## Lessons empty"
fi
lessons
step "# ## Lessons written and committed, not pushed"
git push -q -u origin feat/1-demo
export GH_STUB_CHECKS=pending
step "# git push; checks pending"
export GH_STUB_CHECKS=pass
step "# checks pass; draft"
export GH_STUB_DRAFT=false
step "# gh pr ready (draft=false)"

echo
echo "\$ rm -rf $tmp && test ! -e $tmp && echo removed"
cd /
rm -rf "$tmp"
test ! -e "$tmp" && echo removed
```

## A. Review absent: `story`, `close`, `push`, `ci`, `ready`, `done`

Command (sandbox, from any directory):

```bash
TMPDIR=$SCRATCH bash $SCRATCH/drive.sh /home/sandbox/harness $SCRATCH/gh default; echo "exit=$?"
```

Observed output (`$SCRATCH` was `/tmp/claude-1000/-home-sandbox-harness/9c211caa-ee44-4543-8afc-6953e94c1d33/scratchpad`):

```text
# temp path: /tmp/claude-1000/-home-sandbox-harness/9c211caa-ee44-4543-8afc-6953e94c1d33/scratchpad/tmp.OGRb1rfBGg

$ # US-001 passes=false
$ GH_STUB_CHECKS=pending GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
story US-001
Dispatch, verify, and accept US-001 per /delegate.

$ # US-001 passes=true; ## Lessons empty
$ GH_STUB_CHECKS=pending GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
close
Write a non-empty ## Lessons section in prd.md per /git § Ready for review.

$ # ## Lessons written and committed, not pushed
$ GH_STUB_CHECKS=pending GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
push
Run git push.

$ # git push; checks pending
$ GH_STUB_CHECKS=pending GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
ci
Run /ci-status and wait for the result.

$ # checks pass; draft
$ GH_STUB_CHECKS=pass GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
ready
Run gh pr ready 7.

$ # gh pr ready (draft=false)
$ GH_STUB_CHECKS=pass GH_STUB_DRAFT=false bash .agro/skills/delegate/scripts/next.sh --task demo
done
Stop.

$ rm -rf /tmp/claude-1000/-home-sandbox-harness/9c211caa-ee44-4543-8afc-6953e94c1d33/scratchpad/tmp.OGRb1rfBGg && test ! -e /tmp/claude-1000/-home-sandbox-harness/9c211caa-ee44-4543-8afc-6953e94c1d33/scratchpad/tmp.OGRb1rfBGg && echo removed
removed
exit=0
```

## B. `"review": true`: `story`, `push`, `ci`, `review`, `close`, `push`, `ci`, `ready`, `done`

Command (sandbox, from any directory):

```bash
TMPDIR=$SCRATCH bash $SCRATCH/drive.sh /home/sandbox/harness $SCRATCH/gh review; echo "exit=$?"
```

Observed output:

```text
# temp path: /tmp/claude-1000/-home-sandbox-harness/9c211caa-ee44-4543-8afc-6953e94c1d33/scratchpad/tmp.WZZK2mieeb

$ # US-001 passes=false
$ GH_STUB_CHECKS=pending GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
story US-001
Dispatch, verify, and accept US-001 per /delegate.

$ # US-001 passes=true, commit not pushed
$ GH_STUB_CHECKS=pending GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
push
Run git push.

$ # git push; checks pending
$ GH_STUB_CHECKS=pending GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
ci
Run /ci-status and wait for the result.

$ # checks pass
$ GH_STUB_CHECKS=pass GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
review
Run the code review per /delegate § Review, then write reviewed in prd.json.

$ # reviewed written and committed; ## Lessons empty
$ GH_STUB_CHECKS=pass GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
close
Write a non-empty ## Lessons section in prd.md per /git § Ready for review.

$ # ## Lessons written and committed, not pushed
$ GH_STUB_CHECKS=pass GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
push
Run git push.

$ # git push; checks pending
$ GH_STUB_CHECKS=pending GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
ci
Run /ci-status and wait for the result.

$ # checks pass; draft
$ GH_STUB_CHECKS=pass GH_STUB_DRAFT=true bash .agro/skills/delegate/scripts/next.sh --task demo
ready
Run gh pr ready 7.

$ # gh pr ready (draft=false)
$ GH_STUB_CHECKS=pass GH_STUB_DRAFT=false bash .agro/skills/delegate/scripts/next.sh --task demo
done
Stop.

$ rm -rf /tmp/claude-1000/-home-sandbox-harness/9c211caa-ee44-4543-8afc-6953e94c1d33/scratchpad/tmp.WZZK2mieeb && test ! -e /tmp/claude-1000/-home-sandbox-harness/9c211caa-ee44-4543-8afc-6953e94c1d33/scratchpad/tmp.WZZK2mieeb && echo removed
removed
exit=0
```

## Cleanup

Each run deletes its own temp path, as the last three lines of each output show. Then delete the two scratch files:

```bash
rm -f $SCRATCH/gh $SCRATCH/drive.sh
```

Check that no existing task changed (sandbox, `/home/sandbox/harness`):

```bash
git status --short
```

Expected: no output before this evidence file is added.
