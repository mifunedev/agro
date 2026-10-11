# Manual review evidence: hermes-generated-home

Run: `exedev` provider, VM `agro-mx-1011-112806`, check `.agro/skills/remote-sandbox/checks/hermes-home.sh`, `AGRO_REF=task/1400-hermes-generated-home` at `cd575617`.
Full log: `exedev-hermes-home-20261011-112806.log` in this directory.

## Driver command (sandbox, local driver; VM remote)

```bash
SKILL=.agro/skills/remote-sandbox
bash $SKILL/scripts/run.sh exedev --preflight
tmux new-session -d -s rs-hermes "MATRIX_OUT=<dir> AGRO_REF=task/1400-hermes-generated-home bash $SKILL/scripts/run.sh exedev checks/hermes-home.sh > <dir>/run.out 2>&1"
```

## Observed results

```text
RESULT H01-install-agro PASS released agro 0.20.0 node v24.21.0
RESULT H02-clone-ref PASS /home/exedev/.agro/workspaces/harness ref=task/1400-hermes-generated-home@cd575617
RESULT H03-cli-source PASS source=/home/exedev/.agro/workspaces/harness/.agro/cli/dist/agro.js version=0.20.0 built from cd575617 node=v24.21.0
RESULT H04-untracked-home PASS git ls-files .hermes is empty
RESULT H05-first-install PASS exit=0
RESULT H06-seed-config PASS ok _config_version=bigint:50
RESULT H07-operator-value-kept PASS exit=0 model.default=agro-rcheck-sentinel-model ok _config_version=bigint:50
RESULT H08-clean-status PASS git status --short .hermes is empty
RESULT H09-skills-link PASS agro -> ../../.agro/skills
SUMMARY fails=0
== destroy agro-mx-1011-112806
1 VM deleted successfully
remaining agro-matrix resources on exedev: 1
RUN DONE
```

`config.yaml` after the first install:

```yaml
model:
  default: gpt-6.1-sol-900k
  provider: openai-codex
  base_url: https://chatgpt.com/backend-api/codex
compression:
  codex_gpt55_autoraise: false
  auto_compact_percent: 85
onboarding:
  seen:
    profile_build_offered: true
_config_version: 50
terminal:
  cwd: /home/exedev/.agro/workspaces/harness
```

After `hermes config set model.default agro-rcheck-sentinel-model` and a second install, `model.default` stays `agro-rcheck-sentinel-model`; all other keys are unchanged.

## Cleanup

The driver deleted `agro-mx-1011-112806`. The remaining count of 1 is `agro-mx-1011-112912`, created at 2026-10-11T17:29:12Z by a concurrent `docker-egress` run of another session (log `exedev-docker-egress-20261011-112912.log`). `ssh exe.dev ls --json` after the run lists only that VM with the `agro-matrix` tag; `agro-mx-1011-112806` is absent.
