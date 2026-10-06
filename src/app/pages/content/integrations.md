---
title: Integrations — VS Code Extension, CLI and MCP Server
description: Use String Utility Belt's 246 text tools outside the browser — a VS Code extension, the subelt command-line tool, an MCP server for AI agents and a Node.js library.
---

# Integrations

The same 246 utilities and pipeline engine that power this site are available in your editor, your terminal, your AI assistant and your own code. They all run on your own device: your text is never sent to us.

## VS Code extension

Run any utility on your selection (`Ctrl+Alt+U`, or `Cmd+Alt+U` on a Mac), repeat the last transform with one command, or replay a whole pipeline from a share link — every change is a single undoable edit.

- [Install from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=stringutilitybelt.string-utility-belt) for VS Code
- [Install from Open VSX](https://open-vsx.org/extension/stringutilitybelt/string-utility-belt) for Cursor, VSCodium, Windsurf and other VS Code–compatible editors

## MCP server for AI agents

Give Claude, Cursor and other MCP clients five tools: search the utilities, read a utility's documentation, run one, run a whole pipeline, and detect what format an input is in. The server runs locally and never sends your text anywhere.

- [Install from Smithery](https://smithery.ai/servers/string-utility-belt/string-utility-belt)
- [@string-utility-belt/mcp on npm](https://www.npmjs.com/package/@string-utility-belt/mcp), listed in the official MCP Registry as `com.stringutilitybelt/mcp`

To add it by hand, put this in your client's MCP configuration (Node.js 20 or later):

```json
{
  "mcpServers": {
    "string-utility-belt": {
      "command": "npx",
      "args": ["-y", "@string-utility-belt/mcp"]
    }
  }
}
```

## Command-line tool

`subelt` runs a utility or a whole pipeline from the shell, reading standard input and writing standard output, so it slots into scripts and pipes. It needs Node.js 20 or later.

```bash
echo hi | npx subelt base64_encode
```

- [subelt on npm](https://www.npmjs.com/package/subelt)

## Node.js library

`@string-utility-belt/core` is the framework-free engine itself, with every utility included, for your own scripts, servers and build tools.

```bash
npm install @string-utility-belt/core
```

- [@string-utility-belt/core on npm](https://www.npmjs.com/package/@string-utility-belt/core)

## Source code

String Utility Belt is open source under the MIT license. The web app, the engine and every integration live in one repository: [Murraylr/string-utility-belt on GitHub](https://github.com/Murraylr/string-utility-belt).
