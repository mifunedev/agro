# Manual review: US-004

Date: 2026-10-01. Operator approved one exe.dev VM from the default `exeuntu` image. The advisor ran the candidate `get-agro.sh` from task branch commit `effd85ee` through the exe.dev adapter in `.agro/tasks/microvm-validation/lib.sh`, then removed the VM.

```text
## create
$ ssh exe.dev new --json --name agro-us004-144434 --tag agro-matrix
{"vm_name":"agro-us004-144434","tags":["agro-matrix"],"ssh_command":"ssh agro-us004-144434.exe.xyz","ssh_dest":"agro-us004-144434.exe.xyz","ssh_host":"agro-us004-144434.exe.xyz","ssh_port":22,"https_url":"https://agro-us004-144434.exe.xyz","proxy_port":8000,"shelley_url":"https://agro-us004-144434.shelley.exe.xyz","vscode_url":"vscode://vscode-remote/ssh-remote+agro-us004-144434.exe.xyz/home/exedev?windowId=_blank","xterm_url":"https://agro-us004-144434.xterm.exe.xyz"}
[exit 0]
## node before install
$ ssh agro-us004-144434.exe.xyz command -v node || echo "no node on PATH"
no node on PATH
[exit 0]
## copy candidate get-agro.sh (effd85ee)
c9a355332cc3b7fad9d4a3f7c6aa22a3cfb74b051cd93227eedfca33c941be0d  /tmp/get-agro.sh
c9a355332cc3b7fad9d4a3f7c6aa22a3cfb74b051cd93227eedfca33c941be0d  /home/sandbox/harness/.worktrees/bug/1262-agro-cli-noninteractive-node/.agro/scripts/get-agro.sh
## install
$ ssh agro-us004-144434.exe.xyz bash /tmp/get-agro.sh --yes 2>&1 | grep -E "Pinned|WARN|Installed|agro [0-9]|ERROR"
WARN: Node.js not found (need >= 20 to run 'agro')
 ✓  Pinned the 'agro' shebang to /home/exedev/.local/share/agro/node -> /home/exedev/.nvm/versions/node/v22.23.3/bin/node
 ✓  Installed /home/exedev/.local/bin/agro
 ✓  agro 0.16.0
[exit 0]
## checks
$ ssh agro-us004-144434.exe.xyz ~/.local/bin/agro --version
0.16.0
[exit 0]
$ ssh agro-us004-144434.exe.xyz bash -lc "agro --version"
0.16.0
[exit 0]
$ ssh agro-us004-144434.exe.xyz env -i HOME=$HOME PATH=/usr/bin:/bin $HOME/.local/bin/agro --version
0.16.0
[exit 0]
$ ssh agro-us004-144434.exe.xyz head -1 ~/.local/bin/agro; readlink ~/.local/share/agro/node
#!/home/exedev/.local/share/agro/node
/home/exedev/.nvm/versions/node/v22.23.3/bin/node
[exit 0]
## second run keeps the pin
$ ssh agro-us004-144434.exe.xyz bash -ic "bash /tmp/get-agro.sh --yes" 2>&1 | grep -E "Pinned|Node.js v" ; head -1 ~/.local/bin/agro
 ✓  Node.js v22.23.3 — OK
 ✓  Pinned the 'agro' shebang to /home/exedev/.local/share/agro/node -> /home/exedev/.nvm/versions/node/v22.23.3/bin/node
#!/home/exedev/.local/share/agro/node
[exit 0]
== destroy agro-us004-144434
1 VM deleted successfully
remaining agro-matrix VMs on exedev: 0
RUN DONE
```
