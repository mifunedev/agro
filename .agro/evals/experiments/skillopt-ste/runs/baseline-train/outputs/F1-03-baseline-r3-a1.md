# Descriptive `.agro/harness.yml` example

This page shows the smallest `.agro/harness.yml` file that a project can add as
a local manifest. This example is **descriptive, not normative**: AGRO does
not require this file. AGRO does not validate this file's shape. AGRO does not
treat this file as a registry-backed schema or conformance target.

Two files hold the real runtime configuration today. The tracked
[`agro.json`](../agro.json) at the repository root holds every non-secret
setting. The gitignored root `.env` holds only secrets. The tracked
[`.example.env`](../.example.env) documents the `.env` format.
[`docker-compose.sh`](../.agro/scripts/docker-compose.sh) reads both files. The
[Configuration](configuration.md) page holds the field reference. The example
below is only a pointer map over the `.agro/` control-plane surfaces that the
[`.agro/` directory layout](agro-directory-layout.md) page describes.

## Minimal example

```yaml
# .agro/harness.yml — example only; not required or read by AGRO.
name: agro
version: 1

primitives:
  skills: .agro/skills/
  hooks: .agro/hooks/

loops:
  schedules: crons/
  task_artifacts: .agro/tasks/

policies:
  operator_instructions: AGENTS.md
  git_workflow: .agro/skills/git/SKILL.md
  security_hooks: .agro/hooks/                       # secret-exposure guards
  destructive_command_guard: cc-safety-net@1.0.6   # global binary (Dockerfile) + provider config entries
```

## How to read the example

- `name` and `version` are plain labels for humans. These labels do not imply a
  manifest version registry.
- `primitives` points at the provider-portable primitive pack. Skills and hooks
  already live under `.agro/`. This example has no agent-definitions entry.
  Skills are the reusable-role primitive. `/delegate` chooses a provider-native
  sub-agent as a bounded execution detail, not as a repository artifact.
- `loops` points at today's scheduled cron prompts and the task artifact
  directory.
- `policies` points at existing policy surfaces: the root instructions file,
  the git workflow skill, and hook-enforced guardrails. This example does not
  invent a `.agro/policies/` directory. The guardrails form two layers. The
  first layer is the secret-exposure hooks under `.agro/hooks/`. The second
  layer is the destructive-command guard, `cc-safety-net@1.0.6`: a global
  binary from the image plus guard-wrapped entries in the provider configs, not
  an `.agro/` file.
  [security-considerations.md](security-considerations.md) describes both
  layers.

Every path in the example exists today except the example
`.agro/harness.yml` file itself. [ADR-0001](rfcs/adr-0001-standards-scope.md)
defers formal schemas, registries, lifecycle states, and `OH-Core` /
`OH-Dev` conformance profiles.
