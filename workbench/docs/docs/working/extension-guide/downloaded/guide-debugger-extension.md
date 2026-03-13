---
title: "Extension Guide: Debugger Extension"
---

# VS Code Debugger Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/debugger-extension

## Core Architecture

VS Code implements a language-agnostic debugging system built on the Debug Adapter Protocol (DAP). Three components:

1. **VS Code UI** — Generic debugger interface
2. **Debug Adapter** — Intermediary process that translates debugger communications to DAP
3. **Debugger Backend** — The actual debugging tool

The DAP is platform-independent and documented at microsoft.github.io/debug-adapter-protocol/.

## package.json Structure

A debugger extension's manifest includes:

```json
{
  "contributes": {
    "breakpoints": [
      { "language": "markdown" }
    ],
    "debuggers": [
      {
        "type": "mock",
        "label": "Mock Debug",
        "languages": ["markdown"],
        "program": "./out/debugAdapter.js",
        "runtime": "node",
        "configurationAttributes": {
          "launch": {
            "required": ["program"],
            "properties": {
              "program": {
                "type": "string",
                "description": "Path to program to debug"
              },
              "stopOnEntry": {
                "type": "boolean",
                "description": "Stop on entry",
                "default": true
              }
            }
          }
        },
        "initialConfigurations": [
          {
            "type": "mock",
            "request": "launch",
            "name": "Debug",
            "program": "${workspaceFolder}/readme.md"
          }
        ],
        "configurationSnippets": [
          {
            "label": "Mock Debug: Launch",
            "description": "A new configuration for launching a mock debug program",
            "body": {
              "type": "mock",
              "request": "launch",
              "name": "Debug ${2:program}",
              "program": "^\"\\${workspaceFolder}/${1:program}\""
            }
          }
        ]
      }
    ]
  }
}
```

Platform-specific executables can be specified for Windows, macOS, and Linux.

## DebugConfigurationProvider

Dynamic control over debug configurations:

```typescript
vscode.debug.registerDebugConfigurationProvider('mock', {
  // Generate initial configurations
  provideDebugConfigurations(folder): vscode.DebugConfiguration[] {
    return [/* configurations */];
  },

  // Modify before variable substitution
  resolveDebugConfiguration(folder, config): vscode.DebugConfiguration {
    return config;
  },

  // Modify after variable substitution
  resolveDebugConfigurationWithSubstitutedVariables(folder, config): vscode.DebugConfiguration {
    return config;
  }
});
```

Activation events: `onDebug`, `onDebugInitialConfigurations`, `onDebugResolve:type`

## Debug Adapter Execution Models

Three descriptor types:

1. **DebugAdapterExecutable** — External process via stdin/stdout
2. **DebugAdapterServer** — Network socket connection
3. **DebugAdapterInlineImplementation** — JavaScript/TypeScript object implementing the interface

## Mock Debug Example

The "Mock Debug" starter implementation demonstrates:
- Step, continue, breakpoints, exceptions, and variable access
- Full development workflow setup
- Multi-session debugging (extension + adapter simultaneously)
- Package configuration patterns

## Development Workflow

1. Clone the mock-debug repository
2. Build with TypeScript compilation
3. Debug extension in one VS Code session
4. Debug adapter in separate server mode
5. Use `debugServer` attribute to connect to running adapter

## Publishing

Extensions are published to the VS Code Marketplace following standard extension publishing procedures.
