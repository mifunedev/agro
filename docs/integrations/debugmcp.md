---
title: DebugMCP
---

# DebugMCP

[DebugMCP](https://github.com/microsoft/DebugMCP) is a VS Code extension
(`ozzafar.debugmcpextension`). The extension starts an MCP server at
`http://localhost:3001/mcp` (Streamable HTTP). The server gives an MCP-capable
agent debugger tools: breakpoints, stepping, variable inspection, and expression
evaluation. DebugMCP is optional. The terminal workflow does not need it.

## Confirmed setup runbook

The extension runs in the VS Code server inside the container. The image ships
no VS Code server, so DebugMCP works only while VS Code holds an attach to the
sandbox.

1. On the machine that runs VS Code, install the DebugMCP extension
   (`ozzafar.debugmcpextension`) from the VS Code Marketplace.
2. Attach VS Code to the running sandbox with Dev Containers → *Attach to Running
   Container*. For a remote host, connect with Remote-SSH first. See
   [Connecting to the Sandbox](../connecting.md). The attach installs the VS Code
   server in the container.
3. Confirm that the extension is active in the attached window. The MCP server
   then listens on `http://localhost:3001/mcp`.
4. Authenticate the agent that you debug from (`claude auth login` or
   `codex login --device-auth`). Start the agent inside the sandbox.
5. Ask the agent to start a debug session. The agent calls `start_debugging`,
   `add_breakpoint`, `get_variables_values`, `step_over`, `evaluate_expression`,
   and `stop_debugging`.

Each language needs its VS Code debug extension in the attached window. Python
needs `ms-python.python`. Node.js uses the built-in `js-debug`. Go needs
`golang.Go`. Rust needs `vadimcn.vscode-lldb`. AGRO has tested the Python flow
only.

Without an attached VS Code window, DebugMCP does not run. `agro tool install
code-server` installs code-server, which is a headless VS Code server. Nobody has
tested DebugMCP in code-server. code-server reads extensions from Open VSX, and
Open VSX can lack `ozzafar.debugmcpextension`.

## Agent registration

The repository registers the endpoint for Claude Code and Codex. You add no
configuration.

| Harness | File | Entry |
|---------|------|-------|
| Claude Code | `.mcp.json` | `mcpServers.debugmcp` with `"type": "http"` and the URL |
| Claude Code | `.claude/settings.json` | `"enabledMcpjsonServers": ["debugmcp"]` approves the server |
| Codex | `.codex/config.toml` | `[mcp_servers.debugmcp]` with `url = "http://localhost:3001/mcp"` |

To register the endpoint in another checkout, run one of these:

```bash
claude mcp add --transport http debugmcp http://localhost:3001/mcp
codex mcp add debugmcp --url http://localhost:3001/mcp
```

AGRO has not verified MCP client support for Pi or Hermes. AGRO ships no
registration for Pi or Hermes.

## Security

> **Warning.** `evaluate_expression` runs any expression in the debugged process.
> The server has no authentication. Keep the bind on loopback. Never set
> `debugmcp.bindHost` to a non-loopback address such as `0.0.0.0`. A
> non-loopback bind gives code execution to anyone who reaches port `3001`.

The Host and Origin checks of the server stop DNS rebinding from a browser page.
These checks do not isolate local processes. Any process in the container that
opens port `3001` gets every tool. The loopback URL in `.mcp.json` and
`.codex/config.toml` is not a credential.
