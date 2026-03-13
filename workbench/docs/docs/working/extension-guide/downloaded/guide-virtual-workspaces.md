---
title: "Extension Guide: Virtual Workspaces"
---

# VS Code Virtual Workspaces Guide

> Source: https://code.visualstudio.com/api/extension-guides/virtual-workspaces

## Overview

Virtual Workspaces enable extensions to work with resources backed by file system providers rather than local disk storage. When using extensions like GitHub Repositories, resources may exist on servers or in the cloud, with editing operations occurring remotely.

## Key Concepts

**Virtual Workspace**: A configuration where workspace folders are located on a server or the cloud via file system providers, indicated by a remote indicator label in the lower left corner.

**Affected Extensions**: Only extensions with executable code (`main` entry point) require inspection. Purely declarative extensions (themes, grammars) work automatically.

## Testing Your Extension

Install the GitHub Repositories extension and use the "Open GitHub Repository..." command to test against virtual workspaces with resources represented by URIs like `vscode-vfs://github/microsoft/vscode/package.json`.

## Critical Implementation Points

### URI Handling

- Never assume `file` scheme for URIs
- Use `vscode.workspace.fs` API instead of Node's `fs` module
- Verify third-party components don't depend on direct file system access

### Detection Code

```javascript
const isVirtualWorkspace =
  workspace.workspaceFolders &&
  workspace.workspaceFolders.every(f => f.uri.scheme !== 'file');
```

## Capability Declaration

Signal virtual workspace support via `package.json`:

```json
// No support
{ "virtualWorkspaces": false }

// Full support (default)
{ "virtualWorkspaces": true }

// Limited support
{
  "virtualWorkspaces": {
    "supported": "limited",
    "description": "Only basic editing is supported in virtual workspaces"
  }
}
```

## Context-Based Disabling

Use `when` clauses to conditionally disable features:
- `virtualWorkspace` — True when all folders use non-file schemes
- `resourceScheme` — Current resource's URI scheme

## Language Extension Strategy

Three support tiers:
- **Basic**: Tokenization, bracket pairs, snippets
- **Single-file**: Symbols, completions, hovers, formatting
- **Cross-file**: Workspace symbols, multi-file validation

For rich language support, consider separating into two extensions:
1. Basic language extension with grammars (supports virtual workspaces)
2. Rich support extension with language features (may disable in virtual workspaces)
