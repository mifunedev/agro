# Manual review evidence

Branch: `fix/1673-secret-guard-variants` at `d0e5598c`, on the brain host.

Tooling: `export PATH=$HOME/.local/share/fnm/aliases/default/bin:$PATH`, then `corepack pnpm`.

This story runs no live resource. This story reads no environment secret. This story starts no container. The case names below are test inputs. The hook receives each input as JSON and does not run the input.

## 1. Hook decision tests

Command:

```
corepack pnpm vitest run .agro/scripts/__tests__/hooks.test.ts --reporter=verbose
```

Exit status: 0.

The list below holds every case in the three new describe blocks. The reporter prints each case with a `✓` prefix and a duration. The list removes the prefix and the duration and sorts the cases in each block. Each heredoc case name stops at the first newline, so two cases can show the same name. All 155 cases passed. No case failed.

The review repairs add cases. Commit `187e8bef` adds the 38 stdin cases whose names start with `hardened`. Commit `2d3da381` adds 11 encoded path cases for spaced hex, `0x` hex, environment dump and secret read payloads, and heredoc payloads.

The second review repairs add more cases. Commit `b2e6e738` tightens stdin interpreter parsing and adds the 25 stdin cases whose names start with `tightened`. These cases cover heredoc end lines, interpreter options that take a value, and prose that names `env` or `ENV`. Commit `7c02f9be` limits the remote environment read check to the exec command and adds 4 remote exec cases. Commit `6af2550b` limits the encoded payload scan and adds 6 encoded path cases. These cases cover combined decode flags such as `-di`, `-id`, and `--dec`, payloads in commit and note prose, and `base64 -w0` encoding.

Block counts:

| Describe block | Passed | Failed |
|---|---|---|
| stdin interpreter guard (deny-env-dump.sh) | 98 | 0 |
| remote exec secret guard (deny-env-dump.sh) | 22 | 0 |
| encoded path guard (deny-env-dump.sh) | 35 | 0 |

```
## stdin interpreter guard
stdin interpreter guard (deny-env-dump.sh) > allow: bash -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > allow: cat > notes.md <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > allow: echo 'throw process.env.DATABASE_URL' | grep DATABASE_URL
stdin interpreter guard (deny-env-dump.sh) > allow: echo 'throw process.env.DATABASE_URL' | node scripts/check.js
stdin interpreter guard (deny-env-dump.sh) > allow: echo hi | node
stdin interpreter guard (deny-env-dump.sh) > allow: gh pr create --title t --body-file - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > allow: git commit -F - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > allow: git commit -m "$(cat <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > allow: node - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > allow: node scripts/render.js <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > allow: printf '%s' "$x" | python3 -
stdin interpreter guard (deny-env-dump.sh) > allow: python3 - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: bash -s -- arg <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: bash -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: cat <<'EOF' | node
stdin interpreter guard (deny-env-dump.sh) > deny: cd /tmp && node - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: echo 'echo $DATABASE_URL' | bash
stdin interpreter guard (deny-env-dump.sh) > deny: echo 'print(os.getenv("GH_TOKEN"))' | python3
stdin interpreter guard (deny-env-dump.sh) > deny: echo 'puts ENV["GH_TOKEN"]' | /usr/bin/ruby
stdin interpreter guard (deny-env-dump.sh) > deny: echo 'throw process.env.DATABASE_URL' | node
stdin interpreter guard (deny-env-dump.sh) > deny: node - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: node - <<-"EOF"
stdin interpreter guard (deny-env-dump.sh) > deny: node - <<EOF
stdin interpreter guard (deny-env-dump.sh) > deny: node <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: node <<< 'throw process.env.DATABASE_URL'
stdin interpreter guard (deny-env-dump.sh) > deny: nodejs - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: perl - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: perl <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: printf '%s' 'import os; print(os.environ)' | python3 -
stdin interpreter guard (deny-env-dump.sh) > deny: python3 - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: python3 -u - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: ruby - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: sh <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > deny: zsh -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened launch deny: /usr/bin/env -i FOO=1 node <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened launch deny: /usr/bin/env node <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened launch deny: dash <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened launch deny: ksh -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened launch deny: sudo -E node - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened launch deny: sudo -u app -E python3 - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened pipe-redirect deny: cat <<'EOF' 2>&1 | node
stdin interpreter guard (deny-env-dump.sh) > hardened pipe-redirect deny: echo 'throw process.env.DATABASE_URL' 2>&1 | node
stdin interpreter guard (deny-env-dump.sh) > hardened pipeline allow: cat <<'EOF' | tr a a | node
stdin interpreter guard (deny-env-dump.sh) > hardened pipeline allow: echo hi | cat | node
stdin interpreter guard (deny-env-dump.sh) > hardened pipeline deny: cat <<'EOF' | tr a a | node
stdin interpreter guard (deny-env-dump.sh) > hardened pipeline deny: echo 'throw process.env.DATABASE_URL' | cat | node
stdin interpreter guard (deny-env-dump.sh) > hardened read-forms deny: node - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened read-forms deny: node <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened read-forms deny: python3 - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened read-forms deny: ruby - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened read-forms deny: ruby <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened redirect allow: node - 2>&1 <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened redirect deny: node - 2>&1 <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened redirect deny: node - >&2 <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened redirect deny: python3 - 2>&- <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote allow: docker exec -i db psql <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote allow: ssh host bash -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote deny: agro hands exec box -- python3 - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote deny: docker exec -i -u app -e X=1 db node - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote deny: docker exec -i db python3 - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote deny: docker exec -i db sh <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote deny: kubectl exec -i -n prod pod -- node <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote deny: podman exec -i db -- perl <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote deny: ssh -p 2222 -o BatchMode=yes host 'bash -s' <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened remote deny: ssh host bash -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened shell-dump allow: bash -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened shell-dump deny: bash -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened shell-dump deny: bash <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened shell-dump deny: bash <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened shell-dump deny: bash <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > hardened shell-dump deny: cat <<'EOF' | sh
stdin interpreter guard (deny-env-dump.sh) > hardened shell-dump deny: sh -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > names the operator remedy in the denial reason
stdin interpreter guard (deny-env-dump.sh) > tightened end-line allow: gh pr create --title t --body-file - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened end-line allow: node - <<-'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened end-line deny: bash -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened end-line deny: node - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened end-line deny: node - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened end-line deny: node - <<-'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened end-line deny: node <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened false-positive allow: bash -s <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened false-positive allow: bash <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened false-positive allow: python3 - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened false-positive deny: bash <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened false-positive deny: bash <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened false-positive deny: bash <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened false-positive deny: bash <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened false-positive deny: ruby <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value allow: node -r dotenv/config scripts/run.js <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value allow: python3 -m json.tool <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value deny: bash -o pipefail <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value deny: node --import tsx <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value deny: node --require dotenv/config - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value deny: node -r dotenv/config <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value deny: perl -I lib <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value deny: python3 -W ignore - <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value deny: python3 -X utf8 <<'EOF'
stdin interpreter guard (deny-env-dump.sh) > tightened option-value deny: ruby -I lib <<'EOF'
## remote exec secret guard
remote exec secret guard (deny-env-dump.sh) > allow: docker exec db psql -c 'select 1'
remote exec secret guard (deny-env-dump.sh) > allow: find . -name 'env' | xargs ls
remote exec secret guard (deny-env-dump.sh) > allow: grep -r 'env' src | xargs wc -l
remote exec secret guard (deny-env-dump.sh) > ask: git commit -m "deny docker exec db printenv POSTGRES_PASSWORD"
remote exec secret guard (deny-env-dump.sh) > ask: printenv GH_TOKEN; ssh host ls
remote exec secret guard (deny-env-dump.sh) > ask: printenv HOME
remote exec secret guard (deny-env-dump.sh) > deny: agro hands exec box -- printenv GH_TOKEN
remote exec secret guard (deny-env-dump.sh) > deny: bash -c 'printenv GH_TOKEN'
remote exec secret guard (deny-env-dump.sh) > deny: docker exec -it db printenv POSTGRES_PASSWORD
remote exec secret guard (deny-env-dump.sh) > deny: docker exec db env | grep PASSWORD
remote exec secret guard (deny-env-dump.sh) > deny: docker exec db printenv 'POSTGRES_PASSWORD'
remote exec secret guard (deny-env-dump.sh) > deny: docker exec db printenv POSTGRES_PASSWORD
remote exec secret guard (deny-env-dump.sh) > deny: docker exec db sh -c 'echo $POSTGRES_PASSWORD'
remote exec secret guard (deny-env-dump.sh) > deny: docker exec db sh -c 'env'
remote exec secret guard (deny-env-dump.sh) > deny: kubectl exec -n prod pod/db -- printenv GH_TOKEN
remote exec secret guard (deny-env-dump.sh) > deny: kubectl exec pod -- printenv
remote exec secret guard (deny-env-dump.sh) > deny: nerdctl exec db printenv GH_TOKEN
remote exec secret guard (deny-env-dump.sh) > deny: podman exec db printenv GH_TOKEN
remote exec secret guard (deny-env-dump.sh) > deny: ssh host 'cd /app; printenv GH_TOKEN'
remote exec secret guard (deny-env-dump.sh) > deny: ssh host 'printenv GH_TOKEN'
remote exec secret guard (deny-env-dump.sh) > deny: ssh host printenv GH_TOKEN
remote exec secret guard (deny-env-dump.sh) > names the operator remedy in the denial reason
## encoded path guard
encoded path guard (deny-env-dump.sh) > allow: base64 -d <<'EOF' > image.png
encoded path guard (deny-env-dump.sh) > allow: base64 -d image.b64 > image.png
encoded path guard (deny-env-dump.sh) > allow: base64 -w0 image.png > image.b64
encoded path guard (deny-env-dump.sh) > allow: cat > notes.md <<'EOF'
encoded path guard (deny-env-dump.sh) > allow: docker exec box sh -c 'base64 -d /tmp/image.b64 > /tmp/image.png'
encoded path guard (deny-env-dump.sh) > allow: echo '68 65 6c 6c 6f 20 77 6f 72 6c 64' | xxd -r -p
encoded path guard (deny-env-dump.sh) > allow: echo 68656c6c6f20776f726c64 | xxd -r -p
encoded path guard (deny-env-dump.sh) > allow: echo aGVsbG8= | base64 -d
encoded path guard (deny-env-dump.sh) > allow: echo bHMgLWxh | base64 -d | sh
encoded path guard (deny-env-dump.sh) > allow: echo bWFrZSB0ZXN0 | base64 -d | sh
encoded path guard (deny-env-dump.sh) > allow: git commit -F - <<'EOF'
encoded path guard (deny-env-dump.sh) > deny: agro hands exec box -- sh -c 'echo $P | base64 --decode | bash'
encoded path guard (deny-env-dump.sh) > deny: base64 -d <<'EOF' | sh
encoded path guard (deny-env-dump.sh) > deny: base64 -d <<< Y2F0IC5lbnY= | sh
encoded path guard (deny-env-dump.sh) > deny: bash -c 'eval "$(echo $P | base64 -d)"'
encoded path guard (deny-env-dump.sh) > deny: docker exec box sh -c 'echo $P | base64 -d | sh'
encoded path guard (deny-env-dump.sh) > deny: echo '0x63 0x61 0x74 0x20 0x7e 0x2f 0x2e 0x63 0x6f 0x6e 0x66 0x69 0x67 0x2f 0x67 0x68 0x2f 0x68 0x6f 0x73 0x74 0x73 0x2e 0x79 0x6d 0x6c' | xxd -r -p | sh
encoded path guard (deny-env-dump.sh) > deny: echo '63 61 74 20 2e 65 6e 76' | xxd -r -p | sh
encoded path guard (deny-env-dump.sh) > deny: echo 'Y2F0IH4vLmNvbmZpZy9naC9ob3N0cy55bWw=' | base64 --decode > run.sh
encoded path guard (deny-env-dump.sh) > deny: echo 636174202e656e76 | xxd -rp > run.sh
encoded path guard (deny-env-dump.sh) > deny: echo 636174207e2f2e636f6e6669672f67682f686f7374732e796d6c | xxd -r -p | sh
encoded path guard (deny-env-dump.sh) > deny: echo 6563686f2024504f5354475245535f50415353574f5244 | xxd -r -p | sh
encoded path guard (deny-env-dump.sh) > deny: echo Y2F0IC5lbnY= | base64 -id > run.sh
encoded path guard (deny-env-dump.sh) > deny: echo Y2F0IH4vLmNvbmZpZy9naC9ob3N0cy55bWw= | base64 --dec | sh
encoded path guard (deny-env-dump.sh) > deny: echo Y2F0IH4vLmNvbmZpZy9naC9ob3N0cy55bWw= | base64 -d > run.sh
encoded path guard (deny-env-dump.sh) > deny: echo Y2F0IH4vLmNvbmZpZy9naC9ob3N0cy55bWw= | base64 -d | sh
encoded path guard (deny-env-dump.sh) > deny: echo Y2F0IH4vLmNvbmZpZy9naC9ob3N0cy55bWw= | base64 -di | sh
encoded path guard (deny-env-dump.sh) > deny: echo ZW52 | base64 -d | sh
encoded path guard (deny-env-dump.sh) > deny: echo ZXhwb3J0IC1w | base64 --decode | bash
encoded path guard (deny-env-dump.sh) > deny: echo cHJpbnRlbnYgR0hfVE9LRU4= | base64 -d | sh
encoded path guard (deny-env-dump.sh) > deny: kubectl exec pod -- sh -c 'echo $P | base64 -d | sh'
encoded path guard (deny-env-dump.sh) > deny: printf %s "Y2F0IC5lbnY=" | base64 -D | bash
encoded path guard (deny-env-dump.sh) > deny: ssh host 'echo $P | xxd -r -p | sh'
encoded path guard (deny-env-dump.sh) > deny: xxd -r -p <<EOF > run.sh
encoded path guard (deny-env-dump.sh) > names the paste and prose remedies in the denial reason
```

Summary lines, verbatim:

```
 Test Files  1 passed (1)
      Tests  350 passed | 3 skipped (353)
   Start at  21:06:49
   Duration  19.38s (transform 187ms, setup 0ms, import 222ms, tests 18.22s, environment 0ms)
```

## 2. Full test suite

Command:

```
corepack pnpm test
```

Exit status: 1.

Failed tests and summary lines, verbatim:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > exports the default to children in an interactive Herdr pane
 FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > preserves an explicit value <0>
 FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > preserves an explicit value <1>
 FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > preserves an explicit value <>
 FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > leaves the variable unset without a nonempty pane marker: {}
 FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > leaves the variable unset without a nonempty pane marker: {"HERDR_PANE_ID":""}
 FAIL  .agro/scripts/__tests__/herdr-default.test.ts > Pi clipboard defaults in the canonical zshrc > leaves the variable unset in a noninteractive Herdr shell
 Test Files  1 failed | 124 passed (125)
      Tests  7 failed | 3688 passed | 9 skipped (3704)
   Duration  167.47s (transform 5.51s, setup 0ms, import 15.73s, tests 120.67s, environment 11ms)
```

Failure cause for the first case, verbatim:

```
AssertionError: These functional tests require zsh on the test runner: expected Error: spawnSync zsh ENOENT { …(5) } to be undefined
```

`command -v zsh` exits with status 1 on this node. The node has no `zsh`.

The 7 failures are all in `herdr-default.test.ts`. They are the same 7 failures that `baseline.md` records. They are the baseline on a node with no `zsh`. No other test file failed. The passed count went from 3533 in the baseline to 3688, because the branch adds 155 cases.

## 3. Provider link check

Command:

```
bash .agro/scripts/link-providers.sh --check
```

Exit status: 0.

Output, verbatim:

```
note: cc-safety-net not on PATH (enforced only where CC_SAFETY_NET_STRICT=1, i.e. inside the sandbox)
Providers OK: .agents/.claude skills -> .agro/skills (vendored pack present)
```

## 4. Scope

The story ran the three commands above, `command -v zsh`, and text filters on the captured output. The commands run tests and a link check on the host checkout. No command started a container, called a live resource, or read an environment secret.
