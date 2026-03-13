---
title: "Extension Guide: Markdown Extension"
---

# VS Code Markdown Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/markdown-extension

## Overview

Three primary approaches for enhancing Markdown preview capabilities in VS Code.

## 1. Visual Styling with CSS

Contribute stylesheets through the `markdown.previewStyles` contribution point:

```json
{
  "contributes": {
    "markdown.previewStyles": [
      "./styles/my-styles.css"
    ]
  }
}
```

The load order ensures contributed styles appear after built-in styling but before user-defined styles.

## 2. Syntax Extension via markdown-it Plugins

Add custom Markdown syntax support:

**package.json:**
```json
{
  "contributes": {
    "markdown.markdownItPlugins": true
  }
}
```

**Extension activation:**
```typescript
export function activate(context: vscode.ExtensionContext) {
  return {
    extendMarkdownIt(md: any) {
      return md
        .use(myPlugin1)
        .use(myPlugin2);
    }
  };
}
```

Activation occurs lazily upon first preview display. Chain multiple plugins using sequential `.use()` calls.

## 3. Advanced Functionality Through Scripts

Contribute JavaScript files for complex features:

```json
{
  "contributes": {
    "markdown.previewScripts": [
      "./scripts/my-script.js"
    ]
  }
}
```

Scripts load asynchronously and refresh with each content update.

## Real-World Examples

- GitHub-styled preview extensions
- Mermaid diagram support
- Custom markdown-it plugins for domain-specific syntax
