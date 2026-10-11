# Manual review evidence: Docker egress allowlist

The advisor ran the `remote-sandbox` driver on 2026-10-11 with operator approval. The driver created a new exe.dev VM, ran `checks/docker-egress.sh`, and destroyed the VM. The trimmed log is [`exedev-docker-egress.log`](exedev-docker-egress.log). The log ends with `SUMMARY fails=0`, `remaining agro-matrix resources on exedev: 0`, and `RUN DONE`.

## Command

Prerequisites: an exe.dev account key on the driver host, and operator approval for one billable VM. Runs on the driver host. The check runs in the remote VM.

```bash
AGRO_REF=feat/1397-docker-egress-allowlist bash .agro/skills/remote-sandbox/scripts/run.sh exedev checks/docker-egress.sh
```

The check cloned the branch at `81315fb`, built the CLI, set `access.egress allowlist` in the clone `agro.json`, and ran `agro sandbox install docker --name agro-egress --checkout <clone> --yes`. The image came from the branch.

## Observed results

| Row | Result | Observed output |
|---|---|---|
| E01 installer | PASS | `release=0.20.0 node=v24.21.0` |
| E02 branch CLI | PASS | `ref=feat/1397-docker-egress-allowlist@81315fb` |
| E03 setting | PASS | `agro.json: set access.egress=allowlist (added)` |
| E04 install | PASS | exit 0 after 81 seconds |
| E05 allowlist file | PASS | `api.anthropic.com,api.github.com,github.com,platform.claude.com,registry.npmjs.org,release-assets.githubusercontent.com` |
| E06 health | PASS | `healthy after 91s` |
| E07 bootstrap | PASS | `agro-bootstrap=active` |
| E09 routes | PASS | no default route |
| E10 allowed host | PASS | `api.github.com http=200` |
| E11 denied host | PASS | curl exit 56; `agro egress log` printed `DENIED ... TCP_DENIED_ABORTED/403 ... CONNECT example.com:443` |
| E12 npm | PASS | `npm view` exit 0 |
| E13 Claude Code | PASS | `2.1.296 (Claude Code)` |
| E14 reload | PASS | after `access.egressAllow example.com` and `agro egress reload`, `example.com http=200` |
| E15 no restart | PASS | the container start time did not change |
| E17 bypass without the proxy | PASS | `curl: (6) Could not resolve host: example.com` |
| E18 bypass to a direct IP | PASS | `curl: (7) Failed to connect to 140.82.112.3 port 443` |
| E19 bypass after a root route change | PASS | `curl: (7) Failed to connect to 140.82.112.3 port 443` |
| E20 destroy | PASS | exit 0, no container left |

Development retired `agro-cron.service` in #1392, so the check has no cron row.
