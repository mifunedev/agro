#!/usr/bin/env bash
set -u
E=$(cd "$(dirname "$0")/.." && pwd)
fails=0
expect() {
  local fixture=$1 pattern=$2 out
  out=$(python3 -I "$E/verdict.py" --fixture "$E/fixtures/$fixture" ${STEPS:+--steps} 2>&1)
  if grep -Eq -- "$pattern" <<<"$out"; then
    echo "ok   $fixture: /$pattern/"
  else
    echo "FAIL $fixture: /$pattern/ not found in:"; sed 's/^/     /' <<<"$out"; fails=$((fails + 1))
  fi
}
expect pass '^e1 h agro: n=10 .* PASS$'
expect pass '^e1 h sandbox: n=10 .* PASS$'
expect pass '^E1: PASS'
expect pass '^E3: PASS'
expect pass '^E2: PENDING \(missing residue/summary.json\)$'
expect pass '^E6: PENDING'
expect fail '^e1 h agro: n=10 median=21.7 p90=50.5 .* FAIL'
expect fail '^E1: FAIL'
expect invalid '^e1 h agro: n=10 .* dropped=2 .* PASS$'
expect invalid '^dropped .*e1-h-agro-20.json: pooled_at null$'
expect invalid '^dropped .*e1-h-agro-21.json: pooled_at null$'
expect invalid '^E1: PASS'
expect inputs '^e6 v 4g: n=10 .* attach_mount_median=4.5 PASS$'
expect inputs '^e6 a small: n=10 .* RECORDED$'
expect inputs '^E1: PENDING \(missing e1 h runs\)$'
expect inputs '^E2: PASS'
expect inputs '^E4: FAVORS H \(h_total=13, nprime_total=20\)$'
expect inputs '^E5: PASS V'
expect inputs '^E6: PASS V'
expect inputs '^E7: PASS'
expect hookrev '^e1 h agro: n=10 .* dropped=2 .* PASS$'
expect hookrev '^dropped e1-h-agro-old.json: hook revision$'
expect hookrev '^dropped e1-h-agro-nohook.json: hook revision$'
expect hookrev '^e1 h sandbox: n=10 .* dropped=0 .* PASS$'
expect e2allowed '^E2: PASS \(H extra entries=2 allowed=gh,libatomic1, H agro files beyond floor=0, noise floor=14\)$'
expect e2unlisted '^E2: FAIL \(H extra entries=2 allowed=gh, H agro files beyond floor=0, noise floor=14\)$'
expect e2nolist '^E2: FAIL \(H extra entries=2, H agro files beyond floor=0, noise floor=14\)$'
expect tokenscope '^e6 a small: n=10 .*failures=0 dropped=2 .* RECORDED$'
expect tokenscope '^dropped e6-a-small-new404.json: token scope$'
expect tokenscope '^dropped e6-a-small-legacy404.json: token scope$'
STEPS=1 expect steps '^levers stream:0,apt:0,archive:A0: n=3 usable_median=48.5 usable_p90=49.0$'
STEPS=1 expect steps '^levers stream:1,apt:1,archive:A0: n=3 usable_median=36.0 usable_p90=36.5$'
STEPS=1 expect steps '^dropped e1-h-agro-old.json: hook revision$'
multi=$(python3 -I "$E/verdict.py" --steps --base "$E/fixtures/multi" 2>&1)
[ "$(grep -E '^(runs-attribution |runs |dropped )' <<<"$multi" | sed 's/: n=.*//')" = "$(printf '%s\n' 'runs-attribution levers stream:0,apt:0,archive:A0' 'runs-attribution levers stream:1,apt:1,archive:A0' 'dropped runs/e1-h-agro-old.json: hook revision' 'runs levers stream:0,apt:0,archive:A0')" ] \
  && echo "ok   multi: one table per folder and lever set, in folder order, hook revision dropped per folder" || { echo "FAIL multi:"; sed 's/^/     /' <<<"$multi"; fails=$((fails + 1)); }
step_medians() {
  python3 -I "$E/verdict.py" --fixture "$E/fixtures/steps" --steps | awk -v set="levers $1:" 'index($0, set) == 1 { on = 1; next } /^levers / { on = 0 } on && $1 != "step" { printf "%s=%s/%s ", $1, $2, $3 }'
}
expect_medians() {
  local got
  got=$(step_medians "$1")
  if [ "$got" = "$2" ]; then echo "ok   steps $1 medians"; else echo "FAIL steps $1 medians: got '$got'"; fails=$((fails + 1)); fi
}
expect_medians stream:0,apt:0,archive:A0 'bind=1.4/3 ssh=4.9/3 pre_hook=0.4/3 handoff=0.5/3 fetch=12.5/3 verify=1.5/3 extract=7.7/3 install=7.2/3 docker=4.6/3 apps-started=0.2/3 apps-up=6.4/3 session=0.4/3 probe=0.8/3 '
expect_medians stream:1,apt:1,archive:A0 'bind=1.4/3 ssh=4.9/3 pre_hook=0.4/3 handoff=0.5/3 fetch=14.5/3 verify=0.0/3 extract=0.4/3 stream=14.9/3 install=1.5/3 docker=4.6/3 apps-started=0.2/3 apps-up=6.4/3 session=0.4/3 probe=0.8/3 '
[ "$(python3 -I "$E/verdict.py" --fixture "$E/fixtures/steps" --steps | grep -c '^levers ')" = 2 ] && echo "ok   steps: exactly 2 lever sets" || { echo "FAIL steps: lever set count"; fails=$((fails + 1)); }
[ "$(python3 -I "$E/verdict.py" --fixture "$E/fixtures/steps" | grep -c '^e1 h agro: n=6 .*dropped=1 ')" = 1 ] && echo "ok   steps: E1 path keeps lever-mixed runs, drops old hook" || { echo "FAIL steps: E1 series line"; fails=$((fails + 1)); }
hook_case() {
  local name=$1 want_rc=$2 pattern=$3 tmp out rc
  shift 3
  tmp=$(mktemp -d)
  mkdir -p "$tmp/arms/h"
  cp "$E/arms/h/after-claim.sh" "$tmp/arms/h/"
  cp "$E/fixtures/hook/archives.json" "$tmp/"
  printf 'https://example.invalid/x\n' >"$tmp/url"
  out=$(env -u H_STREAM -u H_PARALLEL_APT -u H_ARCHIVE "$@" PATH="$E/fixtures/hook:$PATH" FAKE_SSH_LOG="$tmp/ssh.log" L2A_URL_FILE="$tmp/url" DRIVER_DOCKER=false \
    sh "$tmp/arms/h/after-claim.sh" 192.0.2.1 "$tmp/log" 2>&1; echo "rc=$?"; cat "$tmp/log" "$tmp/ssh.log" 2>/dev/null)
  rc=$(grep -o '^rc=[0-9]*' <<<"$out" | head -n 1)
  rm -rf "$tmp"
  if [ "$rc" = "rc=$want_rc" ] && grep -Eq -- "$pattern" <<<"$out"; then
    echo "ok   hook $name: /$pattern/"
  else
    echo "FAIL hook $name: $rc /$pattern/ in:"; sed 's/^/     /' <<<"$out"; fails=$((fails + 1))
  fi
}
hook_case unset 0 'local start .*sha256=899db69f.* bytes=364036107 docker=off levers=stream:0,apt:0,archive:A0$'
hook_case unset-remote-args 0 'sudo bash -s -- 899db69f[0-9a-f]+ 364036107 off 0 0$'
hook_case unset-json 0 '^\{"archive_sha256":"899db69f[0-9a-f]+","docker":"off","archive":"A0","levers":"stream:0,apt:0,archive:A0"\}$'
hook_case all-levers 0 'local start .*sha256=a{64} bytes=200000000 docker=off levers=stream:1,apt:1,archive:A1$' H_STREAM=1 H_PARALLEL_APT=1 H_ARCHIVE=A1
hook_case all-levers-remote-args 0 'sudo bash -s -- a{64} 200000000 off 1 1$' H_STREAM=1 H_PARALLEL_APT=1 H_ARCHIVE=A1
hook_case bad-archive 64 'H_ARCHIVE must be A0 or A1' H_ARCHIVE=A2
hook_case bad-stream 64 'H_STREAM must be 0 or 1' H_STREAM=yes
for e in 1 2 3 4 5 6 7; do expect pass "^E$e: "; done
[ "$(python3 -I "$E/verdict.py" --fixture "$E/fixtures/pass" | grep -c '^E[1-7]: ')" = 7 ] && echo "ok   pass: exactly 7 E lines" || { echo "FAIL pass: E line count"; fails=$((fails + 1)); }
[ "$fails" = 0 ] && echo "ALL FIXTURE TESTS PASS" || { echo "$fails fixture test(s) failed"; exit 1; }
