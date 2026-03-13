---
title: "Extension Guide: Source Control"
---

# VS Code Source Control API Guide

> Source: https://code.visualstudio.com/api/extension-guides/scm-provider

## Overview

The Source Control API enables extension developers to integrate SCM systems into VS Code. The API provides a slim, yet powerful surface that accommodates various SCM implementations while maintaining a consistent user interface.

## Core Components

### Source Control Model Structure

Three entities organized hierarchically:

```typescript
// Create the main source control instance
const scm = vscode.scm.createSourceControl('myScm', 'My SCM');

// Create resource groups
const stagedChanges = scm.createResourceGroup('staged', 'Staged Changes');
const workingTree = scm.createResourceGroup('working', 'Working Tree');

// Add resource states to groups
stagedChanges.resourceStates = [
  { resourceUri: vscode.Uri.file('/path/to/file.ts') }
];
```

- **`SourceControl`**: The main entity managing SCM functionality
- **`SourceControlResourceGroup`**: Organizes related resource changes (e.g., staged, working tree)
- **`SourceControlResourceState`**: Individual file changes with metadata

## Key Features

### Source Control View

- Resource states are customizable through `SourceControlResourceDecorations`
- Each state can include a command to handle user interactions
- The view auto-populates as the model changes

### Menu System

Six distinct menu locations:

| Menu ID | Location |
|---------|----------|
| `scm/title` | View header |
| `scm/resourceGroup/context` | Resource group context menu |
| `scm/resourceState/context` | Resource state context menu |
| `scm/resourceFolder/context` | Resource folder context menu |
| `scm/repository` | Repositories view |
| `scm/sourceControl` | Source control context menu |

Menu items use context keys like `scmProvider` and `scmResourceGroup` for conditional visibility.

### Input Box

Accepts user messages (like commit messages):

```typescript
sourceControl.inputBox.value; // Current input value
```

Users trigger acceptance with Ctrl+Enter (Cmd+Enter on macOS).

## Quick Diff Feature

Inline gutter decorations showing file differences:

```typescript
// Implement QuickDiffProvider
class MyQuickDiffProvider implements vscode.QuickDiffProvider {
  provideOriginalResource(uri: vscode.Uri): vscode.Uri {
    // Return URI to original file content
    return uri.with({ scheme: 'myScm-original' });
  }
}

// Register content provider for the scheme
vscode.workspace.registerTextDocumentContentProvider('myScm-original', provider);
```

## References

The Git extension source code serves as the primary reference implementation.
