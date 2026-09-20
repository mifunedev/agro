# `.agro/` — control plane

AGRO keeps its portable machinery here. The sandbox definition stays in
`.devcontainer/`; human-facing reference material stays in root `docs/`.

| Path | Contents |
| --- | --- |
| `cli/` | The `agro` package and the legacy `oh` shim. |
| `scripts/`, `install/` | Lifecycle scripts, runtime helpers, and image inputs. |
| `skills/`, `hooks/`, `skills.lock` | Shared procedures, hooks, and pack metadata. |
| `evals/` | Regression probes, capability tasks, datasets, and scoreboards. |
| `knowledge/` | Tracked synthesis, external snapshots, and a generated index. |
| `tasks/` | Local task plans, structured state, and execution records. |
| `logs/` | Local logs with a scoped contract. |
| `manifest.json` | The payload allowlist for `oh update`. |

Read each applicable `AGENTS.md` before changing that directory's contents.
See the [source directory guide](https://github.com/mifunedev/agro/blob/main/docs/oh-directory-layout.md)
for architecture, provider links, and distribution boundaries.
Root `docs/` does not ship through `oh update`.
