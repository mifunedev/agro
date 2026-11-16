# Manual review: retire agro node

This file is the evidence for US-008. The transcript runs the built CLI entry point `.agro/cli/dist/agro.js` with host `node` v24.22.1. The console calls go to a local stub HTTP server. No call goes to a live console. The transcript creates no live console resource.

## Setup

- Branch: `feat/1654-retire-agro-node`, after the rebase onto `development`.
- The transcript ran on commit `20f741534126b0bdb1ad17c131b2c4c8aa7f5d65`.
- Build command: `agro run -- pnpm -C .agro/cli build`. The build wrote `.agro/cli/dist/agro.js`.
- `$S` is the untracked scratchpad folder `/tmp/claude-1000/-home-exedev--agro-workspaces-harness/a44e7554-36df-41df-ab5a-7ff0b4941444/scratchpad/us008`. The stub server script, the runner script, and the request log are in `$S`. They are not in the repository.
- `$HOME_T` is a new temp `HOME`. `$AGRO_T` is a new temp `AGRO_HOME`. `mktemp -d` made both folders. Before the run, the folder `$S/homes` did not exist.
- `$HOME_T` holds only a throwaway ed25519 key pair. `ssh-keygen` made the pair in `$HOME_T/.ssh` for this run. `$HOME_T` holds no credentials file.
- The stub server listens on `127.0.0.1:18741`. Before the start, `ss -ltn` showed no listener on that port.
- The stub accepts only the bearer token `stub-secret-us008`.
- Each console command sets `HOME`, `AGRO_HOME`, `AGRO_CONSOLE_TOKEN`, and `AGRO_CONSOLE_URL` inline. Each console command removes `XDG_CONFIG_HOME` with `env -u`. Thus the CLI looks for credentials only in `$HOME_T`. No env file exists.
- Each console command has `--provider console`. The operator flow commands also have `--operator`. With `--operator`, the CLI reads the token and the URL from `AGRO_CONSOLE_TOKEN` and `AGRO_CONSOLE_URL`.
- One brain authority call runs `check` without `--operator`, with the same inline token and URL.
- The stub registers the throwaway key before the run, with id `11111111-1111-4111-8111-111111111111`. Thus the operator `check` finds the key, and `create` finds the key with `GET /api/ssh-keys` and does not send `POST /api/ssh-keys`. The stub still answers `POST /api/ssh-keys`.
- An operator path guard blocks each command that names the credentials file path. The evidence does not run `test -e` on that path. The `find` listing of `$HOME_T` and `env -u XDG_CONFIG_HOME` show that no credentials file is in reach.

```text
$ git rev-parse HEAD
20f741534126b0bdb1ad17c131b2c4c8aa7f5d65
$ HOME_T=$(mktemp -d $S/homes/home.XXXXXX); AGRO_T=$(mktemp -d $S/homes/agro-home.XXXXXX)
HOME_T=$S/homes/home.fJc4Ju
AGRO_T=$S/homes/agro-home.94n7xn
$ ls -A $HOME_T $AGRO_T
$S/homes/agro-home.94n7xn:

$S/homes/home.fJc4Ju:
$ mkdir -m 700 $HOME_T/.ssh && HOME=$HOME_T ssh-keygen -t ed25519 -N '' -f $HOME_T/.ssh/id_ed25519 -q -C throwaway-us008
[exit 0]
$ ls -A $HOME_T $HOME_T/.ssh
$S/homes/home.fJc4Ju:
.ssh

$S/homes/home.fJc4Ju/.ssh:
id_ed25519
id_ed25519.pub
$ find $HOME_T $AGRO_T -mindepth 1 | sed "s#$TH_PARENT/##"
home.fJc4Ju/.ssh
home.fJc4Ju/.ssh/id_ed25519
home.fJc4Ju/.ssh/id_ed25519.pub
$ ss -ltn '( sport = :18741 )' | tail -n +2 | wc -l
0
$ node $S/stub.mjs 18741 $S/requests.log $HOME_T/.ssh/id_ed25519.pub &
stub pid 1494005
# stub listening on 127.0.0.1:18741
```

## Transcript

Each block shows the command line, the merged stdout and stderr, and the exit status.

### agro node list

The removed command goes to the unknown command path and exits 1. The block keeps the top-level `agro hands` help line.

```text
$ HOME=$S/homes/home.fJc4Ju AGRO_HOME=$S/homes/agro-home.94n7xn node .agro/cli/dist/agro.js node list
agro: unknown command "node"

agro — AGRO CLI (v0.39.0)
[... general agro usage omitted ...]
  agro hands <args...>        Manage hands and console VMs (list|create|check|exec|fetch|fork|pause|resume|destroy)
[...]
[exit 1]
```

### agro hands --help

The block keeps the usage block, the Providers and Authority paragraphs, and the console paragraphs that this task changed.

```text
$ HOME=$S/homes/home.fJc4Ju AGRO_HOME=$S/homes/agro-home.94n7xn node .agro/cli/dist/agro.js hands --help
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

Authority:
  Console hands run with brain authority or operator authority.
  `--operator` selects operator authority. Put it before or after the verb.
  `--operator` applies only to console hands.

  With `--operator`, the verbs read the token and the URL like
  `agro auth`: AGRO_CONSOLE_TOKEN, then the credentials that
  `agro auth login` writes. The URL is AGRO_CONSOLE_URL with the env
  token, else the credentials URL, else https://console.mifune.dev. The verbs
  ignore the brain token. Without a token, the verbs exit 2.

  Without `--operator`, AGRO_CONSOLE_TOKEN gives brain authority. Else the
  brain token /home/sandbox/.agro/brain-token gives brain authority. With brain
  authority, the URL is AGRO_CONSOLE_URL, else
  /home/sandbox/.agro/brain-console-url. Else the credentials that
  `agro auth login` writes give operator authority. The URL is the
  credentials URL, else https://console.mifune.dev. Without a token, the verbs
  exit 2.

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
`--ssh-key` and with operator authority, `create` finds
~/.ssh/id_ed25519.pub in the console SSH keys, or registers it as
agro-cli@<host name>, and sends its id. When the file does not exist,
`create` exits 1 and creates no hand. With brain authority, `create`
sends only the `--ssh-key` ids.

`--json` prints one JSON line with id, index, alias, name, status, spec,
sshHost, and ssh. The ssh field is null unless the status is running.
When the console returns a hand id and the wait then fails,
`create --json` prints the line with the last status and exits 1.
`--json` excludes --project and --clone.

[... unchanged lines omitted ...]
`check` applies only to console hands. It sends only GET requests and
creates nothing. `check` prints one line for each check and exits 0 only
when no line starts with `fail `.

With brain authority, `check` reads /api/nodes for the console line. It
finds each `--ssh-key` id in the console SSH keys.

With operator authority, `check` finds each `--ssh-key` id in the console
SSH keys. Without `--ssh-key`, it finds ~/.ssh/id_ed25519.pub there. It
reads the free tier eligibility. It reads the org credit from
/api/billing/balance for the credit line. An account outside the free tier
gets a warn line. The credit line is ok or warn and never changes the exit
status.

[... exe.dev hands and Projects sections omitted ...]
[exit 0]
```

### agro hands check --provider console (brain authority)

Without `--operator`, `AGRO_CONSOLE_TOKEN` gives brain authority. `check` sends only `GET /api/nodes` and prints the `ok console:` line. The brain authority `check` does not read the local key. With brain authority, `create` sends `sshKeyIds` only for `--ssh-key`. Thus a brain authority `create` without `--ssh-key` sends no `sshKeyIds`. The transcript does not run a brain authority `create`.

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.fJc4Ju AGRO_HOME=$S/homes/agro-home.94n7xn AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands check --provider console
ok console: http://127.0.0.1:18741
[exit 0]
```

### agro hands check --provider console --operator

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.fJc4Ju AGRO_HOME=$S/homes/agro-home.94n7xn AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands check --provider console --operator
ok ssh-key 11111111-1111-4111-8111-111111111111 ~/.ssh/id_ed25519.pub
ok free-tier
ok credit: balance $5.00
[exit 0]
```

### agro hands create --provider console --operator --profile agro --t3 --json

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.fJc4Ju AGRO_HOME=$S/homes/agro-home.94n7xn AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands create --provider console --operator --profile agro --t3 --json
agro hands create: hand 33333333-3333-4333-8333-333333333333 queued
agro hands create: hand 33333333-3333-4333-8333-333333333333 running
{"id":"33333333-3333-4333-8333-333333333333","index":7,"alias":"stub-hand","name":null,"status":"running","spec":"n8","sshHost":"stub-hand.example.test","ssh":"ssh sandbox@stub-hand.example.test"}
[exit 0]
```

### agro hands list --provider console --operator --json

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.fJc4Ju AGRO_HOME=$S/homes/agro-home.94n7xn AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands list --provider console --operator --json
[{"id":"33333333-3333-4333-8333-333333333333","index":7,"alias":"stub-hand","name":null,"profile":"agro","status":"running","spec":"n8","sshHost":"stub-hand.example.test"}]
[exit 0]
```

### agro hands destroy 7 --provider console --operator --yes

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.fJc4Ju AGRO_HOME=$S/homes/agro-home.94n7xn AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands destroy 7 --provider console --operator --yes
destroyed 7
[exit 0]
```

### agro hands list --provider console --operator --json (after destroy)

This call shows that the stub holds no hand after `destroy`.

```text
$ env -u XDG_CONFIG_HOME HOME=$S/homes/home.fJc4Ju AGRO_HOME=$S/homes/agro-home.94n7xn AGRO_CONSOLE_TOKEN=stub-secret-us008 AGRO_CONSOLE_URL=http://127.0.0.1:18741 node .agro/cli/dist/agro.js hands list --provider console --operator --json
[]
[exit 0]
```

## Request log

The stub wrote one line for each request. The `auth=ok` field shows that the request carried the bearer token from `AGRO_CONSOLE_TOKEN`. The log does not record the token. The first line is the brain authority `check`. The next three lines are the operator `check`, which sends only `GET` requests. The create body sends `profile` `agro`, `t3` `true`, and the `sshKeyIds` of the throwaway key.

```text
# stub listening on 127.0.0.1:18741
GET /api/nodes auth=ok
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
$ grep -c stub-secret-us008 $S/out/0[1-8]-*.txt (output lines only, command lines excluded)
01-node-list.txt 0
02-hands-help.txt 0
03-check-brain.txt 0
04-check.txt 0
05-create.txt 0
06-list.txt 0
07-destroy.txt 0
08-list-after.txt 0
$ kill 1494005
[exit of stub wait: 143]
$ kill -0 1494005
$S/run.sh: line 48: kill: (1494005) - No such process
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
