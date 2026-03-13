---
title: Extension Capabilities Overview
---

# VS Code Extension Capabilities Overview

This documentation page outlines the various ways developers can extend Visual Studio Code functionality. The guide organizes extension capabilities into distinct categories and emphasizes important restrictions to maintain platform stability.

## Main Extension Categories

### Common Capabilities
Basic functionalities available to any extension, including:
- Command, configuration, and keybinding registration
- Data storage (workspace and global)
- User notifications
- Quick Pick interface for input collection
- System file picker integration
- Progress API for long-running operations

### Theming
Customization of VS Code's visual appearance through:
- Source code syntax colors
- UI element colors
- File and product icon themes

### Declarative Language Features
Text editing support implemented without code, such as:
- Bracket matching
- Auto-indentation
- Syntax highlighting
- Snippet bundles

### Programmatic Language Features
Advanced language support through the `vscode.languages.*` API:
- Hover information
- Go to Definition
- Diagnostics
- IntelliSense
- CodeLens
- Language Server integration

### Workbench Extensions
UI customization capabilities:
- Context menu actions in File Explorer
- TreeView implementations
- Activity Bar contributions
- Status Bar information
- Webview-based custom interfaces
- Source Control providers

### Debugging
Integration with VS Code's debugging system:
- Debug Adapter Protocol implementations
- Debug configuration management
- Breakpoint manipulation
- Debug session lifecycle tracking

### UX Guidelines
Best practices for seamless extension integration within VS Code's interface conventions.

## Critical Restrictions

The documentation emphasizes two key limitations:

1. **No DOM Access**: "Extensions have no access to the DOM of VS Code UI."
2. **No Custom Stylesheets**: Unsupported approach that conflicts with internal architecture changes

These restrictions exist to preserve platform stability and allow VS Code's underlying technologies to evolve without breaking extensions.

> Source: https://code.visualstudio.com/api/extension-capabilities/overview
