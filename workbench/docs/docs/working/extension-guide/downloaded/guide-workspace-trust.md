---
title: "Extension Guide: Workspace Trust"
---

# VS Code Workspace Trust Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/workspace-trust

## Overview

Workspace Trust is a security feature that centralizes decisions about whether to trust workspace contents. Extensions can declare support for "Restricted Mode," which protects against automatic code execution from untrusted workspaces.

## Static Declarations

Declare trust support in `package.json` using `capabilities.untrustedWorkspaces`:

```json
// Fully functional in Restricted Mode
{
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": true
    }
  }
}

// Requires trust to function
{
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": false,
      "description": "This extension executes code from the workspace."
    }
  }
}

// Limited functionality without trust
{
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": "limited",
      "description": "Only basic features are available in Restricted Mode.",
      "restrictedConfigurations": [
        "myExtension.executablePath",
        "myExtension.runOnSave"
      ]
    }
  }
}
```

The `restrictedConfigurations` array allows gating specific workspace settings automatically.

## Evaluating Your Extension

Consider whether your extension:
- Executes code from workspace contents
- Uses workspace settings that control code execution
- Consumes workspace dependencies or configuration files
- Treats workspace contents as executable code

## Workspace Trust API

```typescript
// Check if workspace is trusted
const trusted = vscode.workspace.isTrusted;

// Listen for trust changes
vscode.workspace.onDidGrantWorkspaceTrust(() => {
  // Enable full functionality
});
```

Context key `isWorkspaceTrusted` available for `when` clauses in UI conditionals.

## Special Cases

Debug extensions and task providers generally don't require trust declarations since VS Code prevents their execution in Restricted Mode automatically.
