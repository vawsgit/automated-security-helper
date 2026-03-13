---
title: Extension Guides Overview
---

# VS Code Extension Guides Overview

This documentation section provides detailed code guides and samples that explain how to use specific VS Code APIs. Each guide includes thoroughly commented source code, visual demonstrations, running instructions, and real-world extension examples.

## Available Guides & Samples

### Guides on VS Code Website

| Guide | Key APIs & Contributions |
|-------|-------------------------|
| **Command** | `commands` API; `contributes.commands` |
| **Color Theme** | `contributes.themes` |
| **File Icon Theme** | `contributes.iconThemes` |
| **Product Icon Theme** | `contributes.productIconThemes` |
| **Tree View** | `window.createTreeView`, `TreeDataProvider`, `contributes.views` |
| **Webview** | `window.createWebviewPanel`, `window.registerWebviewPanelSerializer` |
| **Custom Editors** | `window.registerCustomEditorProvider`, `contributes.customEditors` |
| **Virtual Documents** | `workspace.registerTextDocumentContentProvider` |
| **Virtual Workspaces** | `workspace.fs`, `capabilities.virtualWorkspaces` |
| **Workspace Trust** | `workspace.isTrusted`, `capabilities.untrustedWorkspaces` |
| **Task Provider** | `tasks.registerTaskProvider`, `Task`, `contributes.taskDefinitions` |
| **Source Control** | `scm.createSourceControl`, `SourceControl` APIs |
| **Debugger Extension** | `contributes.debuggers`, `debug` API |
| **Markdown Extension** | `markdown.previewStyles`, `markdown.markdownItPlugins` |
| **Test Extension** | `TestController`, `TestItem` |
| **Custom Data Extension** | `contributes.html.customData`, `contributes.css.customData` |

### GitHub Repository Samples

Additional samples from the VS Code Extensions repository demonstrate:

- **Webview, Status Bar, Tree View samples** with interactive UI components
- **Task Provider and Multi-Root samples** for workspace handling
- **Completion Provider, File System Provider samples** for language and file operations
- **Terminal, Vim, Source Control samples** for advanced editor interactions
- **Decorator, Commenting, Document Editing samples** for text manipulation

### Language Extension Samples

Specialized samples for language development:
- Snippet configuration
- Language configuration
- Language Server Protocol (LSP) implementation
- Web-based LSP extensions
- Multi-root server support

## Key Resources

- [UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) for UI best practices
- [VS Code API documentation](https://code.visualstudio.com/api/references/vscode-api) for comprehensive API details

> Source: https://code.visualstudio.com/api/extension-guides/overview
