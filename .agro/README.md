# `.agro/` — control plane

AGRO keeps its portable machinery here. The sandbox definition stays in
`.devcontainer/`; human-facing reference material stays in root `docs/`.

| Path | Contents |
| --- | --- |
| `cli/` | The `agro` package. |
| `scripts/`, `install/` | Lifecycle scripts, runtime helpers, and image inputs. |
| `skills/` | The retained skill pack: `/agent-browser`, `/escalate`, `/git`, `/prd`, `/ralph`, `/release`, `/ste` and `/worktrees`. |
| `hooks/` | Security hooks mirrored onto each provider surface. |
| `logs/` | Local logs with a scoped contract. |
| `manifest.json` | The payload allowlist for `agro vendor`. |

Read each applicable `AGENTS.md` before changing that directory's contents.
See the [source directory guide](https://github.com/mifunedev/agro/blob/main/docs/agro-directory-layout.md)
for architecture, provider links, and distribution boundaries.
Root `docs/` does not ship through `agro vendor`.
