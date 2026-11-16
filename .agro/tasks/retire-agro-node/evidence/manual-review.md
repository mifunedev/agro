# Manual review: retire agro node

This file is the evidence for US-008. The transcript runs the built CLI entry point `.agro/cli/dist/agro.js` with host `node` v24.22.1. The console calls go to a local stub HTTP server. No call goes to a live console. The transcript creates no live console resource.

## Setup

- Branch: `feat/1654-retire-agro-node`.
- The transcript ran on commit `91181ce76f01f152a27356048df93ea217a64efc`.
- Build command: `agro run -- pnpm -C .agro/cli build`. The build wrote `.agro/cli/dist/agro.js`.
- `$S` is the untracked scratchpad folder `/tmp/claude-1000/-home-exedev--agro-workspaces-harness/a44e7554-36df-41df-ab5a-7ff0b4941444/scratchpad/us008`. The stub server script, the runner script, and the request log are in `$S`. They are not in the repository.
- `$HOME_T` is a new temp `HOME`. `$AGRO_T` is a new temp `AGRO_HOME`. `mktemp -d` made both folders. Before the run, the folder `$S/homes` did not exist.
- `$HOME_T` holds only a throwaway ed25519 key pair. `ssh-keygen` made the pair in `$HOME_T/.ssh` for this run. `$HOME_T` holds no credentials file.
- The stub server listens on `127.0.0.1:18741`. Before the start, `ss -ltn` showed no listener on that port.
- The stub accepts only the bearer token `stub-secret-us008`. The stub starts with one SSH key: the throwaway public key, with id `11111111-1111-4111-8111-111111111111`.
- Each console command sets `HOME`, `AGRO_HOME`, `AGRO_CONSOLE_TOKEN`, and `AGRO_CONSOLE_URL` inline. Each console command removes `XDG_CONFIG_HOME` with `env -u`. Thus the CLI looks for credentials only in `$HOME_T`. No env file exists.
- Each console command has `--provider console`.

```text
$ git rev-parse HEAD
91181ce76f01f152a27356048df93ea217a64efc
$ HOME_T=$(mktemp -d $S/homes/home.XXXXXX); AGRO_T=$(mktemp -d $S/homes/agro-home.XXXXXX)
HOME_T=$S/homes/home.RkOjwi
AGRO_T=$S/homes/agro-home.KArVMR
$ ls -A $HOME_T $AGRO_T
$S/homes/agro-home.KArVMR:

$S/homes/home.RkOjwi:
$ mkdir -m 700 $HOME_T/.ssh && HOME=$HOME_T ssh-keygen -t ed25519 -N '' -f $HOME_T/.ssh/id_ed25519 -q -C throwaway-us008
[exit 0]
$ ls -A $HOME_T $HOME_T/.ssh
$S/homes/home.RkOjwi:
.ssh

$S/homes/home.RkOjwi/.ssh:
id_ed25519
id_ed25519.pub
$ find $HOME_T $AGRO_T -mindepth 1 | sed "s#$TH_PARENT/##"
home.RkOjwi/.ssh
home.RkOjwi/.ssh/id_ed25519
home.RkOjwi/.ssh/id_ed25519.pub
$ ss -ltn '( sport = :18741 )' | tail -n +2 | wc -l
0
$ node $S/stub.mjs 18741 $S/requests.log $HOME_T/.ssh/id_ed25519.pub &
stub pid 912644
# stub listening on 127.0.0.1:18741
```

## Transcript

Each block shows the command line, the merged stdout and stderr, and the exit status.

### agro node list

The removed command goes to the unknown command path and exits 1.

```text
$ HOME=$S/homes/home.RkOjwi AGRO_HOME=$S/homes/agro-home.KArVMR node .agro/cli/dist/agro.js node list
agro: unknown command "node"

agro — AGRO CLI (v0.39.0)
[... general agro usage omitted ...]
  agro hands <args...>        Manage hands from a brain (list|create|exec|fetch|fork|pause|resume|destroy)
[...]
[exit 1]
```

### agro hands --help

The block keeps the usage block, the providers paragraph, and the console paragraphs that this task changed.

```text
$ HOME=$S/homes/home.RkOjwi AGRO_HOME=$S/homes/agro-home.KArVMR node .agro/cli/dist/agro.js hands --help
agro hands — Create and manage hands and console VMs from a brain or an operator host

Usage:
  agro hands list [--json]
  agro hands create [--name <name>] [--spec <spec>] [--profile agro|sandbox] [--docker] [--t3] [--code-server] [--disposable] [--ssh-key <uuid>]... [--json] [--project <owner>/<repo> | --clone <owner>/<repo>]
  agro hands fork <hand> [--spec <spec>] [--name <name>]
  agro hands pause <hand>
  agro hands resume <hand>
  agro hands destroy <hand> [--yes]
  agro hands exec <hand> [--project <owner>/<repo>] -- <command...>
  agro hands fetch <hand> --project <owner>/<repo>
  agro hands check [--ssh-key <uuid>]...

Providers:
  `hands.provider` in the host config ${AGRO_HOME:-~/.agro}/config.json
  selects the provider: `console` (the default) or `exedev`.
  Run `agro config set hands.provider exedev` to select exe.dev hands.
  `--provider console|exedev` selects the provider for one call and
  overrides `hands.provider`. Put it before or after the verb.

Console hands:
[... unchanged lines omitted ...]
`create` requests a sandbox hand, waits up to 15 minutes for it to reach
`running`, then prints its index, alias, and SSH host. When the free tier
does not offer the requested spec, `create` creates `n4` and says so.
`destroy` asks for confirmation unless --yes is given. `destroy` needs the
admin role in agro-console.

`--profile` sets the hand profile. The profile defaults to sandbox.
`--docker` turns on Docker. `--t3` turns on T3. `--code-server` turns on
code-server. Each app flag requires `--profile agro`. `--ssh-key <uuid>`
adds a console SSH key to the hand. Repeat it for more keys. Without
`--ssh-key` and without a brain token, `create` finds ~/.ssh/id_ed25519.pub
in the console SSH keys, or registers it as agro-cli@<host name>, and sends
its id. When the file does not exist, `create` exits 1 and creates no hand.
On a brain, `create` sends only the `--ssh-key` ids.

`--json` prints one JSON line with id, index, alias, name, status, spec,
sshHost, and ssh. When the console returns a hand id and the wait then
fails, `create --json` prints the line with the last status and exits 1.
`--json` excludes --project and --clone.

[... unchanged lines omitted ...]
`check` applies only to console hands. It sends only GET requests and
creates nothing. It finds each `--ssh-key` id in the console SSH keys.
Without `--ssh-key`, it finds ~/.ssh/id_ed25519.pub there. It reads the free
tier eligibility. It reads the org credit from /api/billing/balance for the
credit line. `check` prints one line for each check and exits 0 only when
no line starts with `fail `. An account outside the free tier gets a warn
line. The credit line is ok or warn and never changes the exit status.

The verbs read the console token from AGRO_CONSOLE_TOKEN, then from the
brain token /home/sandbox/.agro/brain-token, then from the credentials that
`agro auth login` writes. The verbs read the console URL from
AGRO_CONSOLE_URL, then from /home/sandbox/.agro/brain-console-url when the brain
token supplies the token, then from the credentials, then use
https://console.mifune.dev. Without a token, the verbs exit 2.

[... exe.dev hands and Projects sections omitted ...]
[exit 0]
```

### agro hands check --provider console

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.RkOjwi AGRO_HOME=$S/homes/agro-home.KArVMR AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands check --provider console
ok ssh-key 11111111-1111-4111-8111-111111111111 ~/.ssh/id_ed25519.pub
ok free-tier
ok credit: balance $5.00
[exit 0]
```

### agro hands create --provider console --profile agro --t3 --json

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.RkOjwi AGRO_HOME=$S/homes/agro-home.KArVMR AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands create --provider console --profile agro --t3 --json
agro hands create: hand 33333333-3333-4333-8333-333333333333 queued
agro hands create: hand 33333333-3333-4333-8333-333333333333 running
{"id":"33333333-3333-4333-8333-333333333333","index":7,"alias":"stub-hand","name":null,"status":"running","spec":"n8","sshHost":"stub-hand.example.test","ssh":"ssh sandbox@stub-hand.example.test"}
[exit 0]
```

### agro hands list --provider console --json

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.RkOjwi AGRO_HOME=$S/homes/agro-home.KArVMR AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands list --provider console --json
[{"id":"33333333-3333-4333-8333-333333333333","index":7,"alias":"stub-hand","name":null,"profile":"agro","status":"running","spec":"n8","sshHost":"stub-hand.example.test"}]
[exit 0]
```

### agro hands destroy 7 --provider console --yes

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.RkOjwi AGRO_HOME=$S/homes/agro-home.KArVMR AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands destroy 7 --provider console --yes
destroyed 7
[exit 0]
```

### agro hands list --provider console --json (after destroy)

This call shows that the stub holds no hand after `destroy`.

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.RkOjwi AGRO_HOME=$S/homes/agro-home.KArVMR AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands list --provider console --json
[]
[exit 0]
```

## Request log

The stub wrote one line for each request. The `auth=ok` field shows that the request carried the bearer token from `AGRO_CONSOLE_TOKEN`. The log does not record the token. The create body sends `profile` `agro`, `t3` `true`, and the `sshKeyIds` of the throwaway key. `check` sends only `GET` requests.

```text
# stub listening on 127.0.0.1:18741
GET /api/ssh-keys auth=ok
GET /api/free-tier auth=ok
GET /api/billing/balance auth=ok
GET /api/ssh-keys auth=ok
POST /api/nodes auth=ok body={"profile":"agro","sshKeyIds":["11111111-1111-4111-8111-111111111111"],"t3":true}
GET /api/nodes/33333333-3333-4333-8333-333333333333 auth=ok
GET /api/nodes auth=ok
DELETE /api/nodes/7 auth=ok
GET /api/nodes auth=ok
```

## Cleanup

The token check counts the token in each output, without the command line. Each count is 0. Thus the token never appears in the output.

The runner then stops the stub server, deletes `$HOME_T` and `$AGRO_T`, and proves that they are gone. Exit 143 is the stub exit after `SIGTERM`.

```text
$ grep -c stub-secret-us008 $S/out/0[1-7]-*.txt (output lines only, command lines excluded)
01-node-list.txt 0
02-hands-help.txt 0
03-check.txt 0
04-create.txt 0
05-list.txt 0
06-destroy.txt 0
07-list-after.txt 0
$ kill 912644
[exit of stub wait: 143]
$ kill -0 912644
$S/run.sh: line 47: kill: (912644) - No such process
[exit 1]
$ ss -ltn '( sport = :18741 )' | tail -n +2 | wc -l
0
$ rm -rf $HOME_T $AGRO_T
[exit 0]
$ test -e $HOME_T; echo $?
1
$ test -e $AGRO_T; echo $?
1
```
