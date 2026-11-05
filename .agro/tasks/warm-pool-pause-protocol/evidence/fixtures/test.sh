#!/usr/bin/env bash
set -u
E=$(cd "$(dirname "$0")/.." && pwd)
fails=0
expect() {
  local fixture=$1 pattern=$2 out
  out=$(python3 -I "$E/verdict.py" --fixture "$E/fixtures/$fixture" 2>&1)
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
expect tokenscope '^e6 a small: n=10 .*failures=0 dropped=2 .* RECORDED$'
expect tokenscope '^dropped e6-a-small-new404.json: token scope$'
expect tokenscope '^dropped e6-a-small-legacy404.json: token scope$'
for e in 1 2 3 4 5 6 7; do expect pass "^E$e: "; done
[ "$(python3 -I "$E/verdict.py" --fixture "$E/fixtures/pass" | grep -c '^E[1-7]: ')" = 7 ] && echo "ok   pass: exactly 7 E lines" || { echo "FAIL pass: E line count"; fails=$((fails + 1)); }
[ "$fails" = 0 ] && echo "ALL FIXTURE TESTS PASS" || { echo "$fails fixture test(s) failed"; exit 1; }
