# Archive variants

The advisor cut both variants on 2026-11-04 from the pooled `agro` n4 node `2539c179` (claimed as `h-cut-1`, then deleted) with `l2a/cut-variants.sh`. The output is in `l2a/cut-output.txt`. `archives.json` holds the bytes, sha256, entry count, zstd level, and local extract time of each variant.

| Variant | Bytes | Entries | Local extract |
|---|---|---|---|
| A0 | 366,067,832 | 17,040 | 11.0 s |
| A1 | 272,625,840 | 12,807 | 7.0 s |

## A0

A0 holds the same 16 include paths and the same 2 exclude paths as the earlier archive (`l2a/manifest.txt` of `warm-pool-pause-protocol`). The entry count differs by 152. T3 is now 0.1.7 instead of 0.1.6: `.t3` has 3,784 entries instead of 3,647.

## A1: removed path patterns

A1 removes these patterns from A0. Each size is the uncompressed byte count on the cut node.

| Pattern | Size | Reason |
|---|---|---|
| `.local/lib/code-server-*/lib/vscode/extensions/copilot` | 149,738,726 | Built-in Copilot chat extension. The usable probe and the editor do not need the extension. |
| `.local/lib/code-server-*/lib/vscode/node_modules/@github/copilot-linux-x64` | 126,070,735 | Copilot native binary. Only `out/vs/platform/agentHost` loads it. |
| `.local/lib/code-server-*/lib/vscode/extensions/mermaid-markdown-features` | 61,321,285 | Built-in Mermaid preview extension. |
| `.nvm/versions/node/*/include` | 60,986,343 | Node C headers. Only a native addon build reads the headers. |
| `*.map` | 8,511,722 | Source maps. No runtime loads them. |
| `CHANGELOG.md` | 1,746,794 | Documentation. |
| `.t3/userdata/logs` | 1,271,536 | T3 logs of the cut node. |

The usable probe of each A1 run in US-003 checks that `agro workspace list` lists `harness`, code-server returns HTTP 200, and T3 returns HTTP 200.

## Re-cut A1

The `/rsi` run cut A1 again on 2026-11-05 from the pooled `agro` n4 node `91e1daec`, with the same script and the same removed path patterns. The new A1 has 272,800,869 bytes, 12,807 entries, and sha256 `c82b9efe0f7ab2c30b13d53371377c3970d1b6a55f3f107a8226f46f5d62546c`. `archives.json` pins the new A1. The output is in `l2a/cut-output-rsi.txt`.
