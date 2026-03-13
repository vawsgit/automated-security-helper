---
title: "Extension Guide: Webview"
---

# VS Code Webview API Guide

> Source: https://code.visualstudio.com/api/extension-guides/webview

## Overview

The VS Code Webview API enables extensions to create custom, fully-controllable views within the editor. Think of a webview as an `iframe` within VS Code that your extension controls.

Webviews can be deployed as:
- Standalone panels via `createWebviewPanel`
- Custom editor interfaces
- Sidebar/panel views using `WebviewView`

### When to Use Webviews

Before implementation, consider:
- Whether the feature truly needs to live in VS Code
- If native APIs could accomplish the goal instead
- Whether resource costs justify the added complexity

**"Just because you can do something with webviews, doesn't mean you should."**

## Core API Methods

| Method | Purpose |
|--------|---------|
| `window.createWebviewPanel()` | Creates and displays a webview panel |
| `window.registerWebviewPanelSerializer()` | Enables webview persistence across sessions |
| `webview.postMessage()` | Sends data from extension to webview |
| `webview.onDidReceiveMessage()` | Receives messages from webview to extension |
| `webview.asWebviewUri()` | Converts file URIs to webview-accessible format |

## Basic Implementation

```typescript
const panel = vscode.window.createWebviewPanel(
  'viewType',           // Identifier
  'Display Title',      // User-visible title
  vscode.ViewColumn.One, // Editor column
  { enableScripts: true } // Options
);

panel.webview.html = getWebviewContent();
```

### HTML Content

Setting `webview.html` replaces entire webview content (resets the script's state). HTML must be a complete document:

```html
<!DOCTYPE html>
<html>
  <head><meta charset="UTF-8"></head>
  <body><!-- content --></body>
</html>
```

## Lifecycle Events

- `onDidDispose` — Fired when user closes or extension destroys the panel
- `onDidChangeViewState` — Fired when visibility or column changes
- `.visible` property — Check current visibility state
- `reveal()` method — Programmatically bring panel to foreground

## Loading Local Resources

Webviews cannot directly access local files for security reasons. Convert file paths using:

```typescript
const uri = vscode.Uri.joinPath(context.extensionUri, 'media', 'image.gif');
const webviewUri = panel.webview.asWebviewUri(uri);
```

Control access via `localResourceRoots` option:

```typescript
{
  localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
}
```

Setting to empty array `[]` blocks all local resources.

## Theming Support

Webviews receive CSS classes on the body element:
- `vscode-light` — Light themes
- `vscode-dark` — Dark themes
- `vscode-high-contrast` — High contrast themes

Access theme colors via CSS variables (prefix `--vscode-`):

```css
code { color: var(--vscode-editor-foreground); }
body.vscode-dark { background: var(--vscode-editor-background); }
```

The `data-vscode-theme-id` attribute contains the active theme ID for theme-specific styling.

## Supported Media

- **Audio formats:** Wav, Mp3, Ogg, Flac
- **Video formats:** H.264, VP8

Note: Audio codec support matters — an MP4 with H.264 video and AAC audio will play video but lack sound; use MP3 audio instead.

## Context Menus

Define custom context menus via contribution points:

```json
{
  "contributes": {
    "menus": {
      "webview/context": [
        {
          "command": "extension.command",
          "when": "webviewId == 'myWebview'"
        }
      ]
    }
  }
}
```

Set contexts in HTML using `data-vscode-context`:

```html
<div data-vscode-context='{"webviewSection": "main"}'>
  Content
</div>
```

## Scripts and Message Passing

Enable scripts with `enableScripts: true`. Scripts run in isolated context with no direct VS Code API access.

### Extension to Webview

```typescript
// Extension side
panel.webview.postMessage({ command: 'refactor', data: value });

// Webview side (HTML script)
window.addEventListener('message', event => {
  const message = event.data;
  switch(message.command) {
    case 'refactor': /* handle */ break;
  }
});
```

### Webview to Extension

```typescript
// Webview side
const vscode = acquireVsCodeApi();
vscode.postMessage({ command: 'alert', text: 'Message' });

// Extension side
panel.webview.onDidReceiveMessage(message => {
  switch(message.command) {
    case 'alert': vscode.window.showErrorMessage(message.text); break;
  }
});
```

**Critical:** `acquireVsCodeApi()` can only be called once per session.

## Web Workers

Workers require special handling in webviews:
- Must load via `data:` or `blob:` URIs only
- Cannot load directly from extension folders

```typescript
fetch('path/to/worker.js')
  .then(r => r.blob())
  .then(blob => new Worker(URL.createObjectURL(blob)));
```

## Security Best Practices

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src https:; script-src ${webview.cspSource};">
```

### Key Recommendations

- Enable only required capabilities (scripts, local resources)
- Set `localResourceRoots` restrictively
- Sanitize all user input and workspace data
- Use `https:` only for external resources
- Extract inline styles/scripts to external files
- Never leak the VS Code API object to global scope

## State Persistence

### Option 1: getState/setState (Recommended)

```typescript
const vscode = acquireVsCodeApi();
const previousState = vscode.getState();
let value = previousState ? previousState.value : 0;
vscode.setState({ value });
```

### Option 2: Serialization

Register a `WebviewPanelSerializer` for automatic restoration:

```typescript
vscode.window.registerWebviewPanelSerializer('viewType', new MySerializer());

class MySerializer implements vscode.WebviewPanelSerializer {
  async deserializeWebviewPanel(panel, state) {
    panel.webview.html = getWebviewContent();
  }
}
```

Add activation event: `"activationEvents": ["onWebviewPanel:viewType"]`

### Option 3: retainContextWhenHidden

Keep webview context alive when hidden (high memory cost):

```typescript
{ retainContextWhenHidden: true }
```

## Accessibility

CSS classes automatically applied based on user preferences:
- `vscode-using-screen-reader` — When screen reader active
- `vscode-reduce-motion` — When motion reduction requested

## Debugging

- **Developer: Toggle Developer Tools** — Inspect webviews with Chrome DevTools
- **Developer: Reload Webview** — Resets all active webviews
- Select "active frame" from DevTools console dropdown to evaluate in webview context
