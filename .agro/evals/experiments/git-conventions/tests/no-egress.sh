#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR
readonly EXP_DIR="${TEST_DIR%/tests}"
readonly WRAPPER="$EXP_DIR/no-egress.sh"
readonly BLOCK_URL=/nonexistent/agro-git-screen-no-push
readonly REMOTE=https://github.com/mifunedev/agro.git

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat >"$tmp/fake-agent.sh" <<'AGENT'
#!/usr/bin/env bash
set -u
block="$1"
remote="$2"
out="$3"
result() { printf '%s %s\n' "$1" "$2" >>"$out"; }
attempt() {
  local name="$1" must="$2"
  shift 2
  if "$@" >"$out.$name.stdout" 2>"$out.$name.stderr"; then
    result "$name" succeeded
  elif grep -qiE -- "$must" "$out.$name.stderr"; then
    result "$name" blocked
  else
    result "$name" "failed-for-another-reason: $(head -c 300 "$out.$name.stderr" | tr '\n' ' ')"
  fi
  rm -f "$out.$name.stdout"
}
cd "$(mktemp -d)"
git init -q -b task/1190-no-egress-probe .
git remote add origin "$remote"
git -c user.name=probe -c user.email=probe@example.invalid commit -q --allow-empty -m "task: no-egress probe"
attempt git-push-origin "$block" git push origin HEAD
attempt git-push-https-url "$block" git push "$remote" HEAD:refs/heads/task/1190-no-egress-probe
attempt git-push-ssh-url "$block" git push git@github.com:mifunedev/agro.git HEAD:refs/heads/task/1190-no-egress-probe
attempt git-credential-fill "terminal prompts disabled|could not read" sh -c 'printf "protocol=https\nhost=github.com\n\n" | git credential fill'
attempt gh-auth-status "not logged in|gh auth login" gh auth status
attempt gh-api-user "gh auth login|GH_TOKEN|authentication" gh api user
attempt gh-pr-create "gh auth login|GH_TOKEN|authentication" gh pr create --repo mifunedev/agro --base development --head task/1190-no-egress-probe --title "FROM task/1190-no-egress-probe TO development" --body "no-egress probe"
for name in GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN; do
  if [ -n "${!name+set}" ]; then result "env-$name" present; else result "env-$name" blocked; fi
done
AGENT

failures=0
fail() {
  printf 'FAIL %s\n' "$*"
  failures=$((failures + 1))
}

set +e
bash "$WRAPPER" -- bash "$tmp/fake-agent.sh" "$BLOCK_URL" "$REMOTE" "$tmp/results.txt"
rc=$?
set -e
[ "$rc" -eq 0 ] || fail "wrapper: the fake agent exited $rc"
[ -s "$tmp/results.txt" ] || fail "wrapper: the fake agent recorded no result"

expected=(git-push-origin git-push-https-url git-push-ssh-url git-credential-fill gh-auth-status gh-api-user gh-pr-create env-GH_TOKEN env-GITHUB_TOKEN env-GH_ENTERPRISE_TOKEN)
for name in "${expected[@]}"; do
  line="$(grep -m1 "^$name " "$tmp/results.txt" || true)"
  if [ "${line#* }" = blocked ]; then
    printf 'ok   %s blocked\n' "$name"
  else
    fail "$name: ${line#* }"
  fi
done

if gh auth status >/dev/null 2>&1; then
  printf 'control: gh is logged in outside the wrapper\n'
else
  printf 'control: gh is not logged in outside the wrapper; the gh checks prove less\n'
fi
if [ -n "$(git config --get-all credential.helper 2>/dev/null; git config --get-all credential.https://github.com.helper 2>/dev/null)" ]; then
  printf 'control: git has a credential helper outside the wrapper\n'
fi

if [ "$failures" -ne 0 ]; then
  printf '%s failure(s): an episode can push or reach the GitHub API\n' "$failures"
  exit 1
fi
printf 'no egress: git push and gh are blocked\n'
