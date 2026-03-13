---
title: "Extension Guide: Virtual Documents"
---

# VS Code Virtual Documents Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/virtual-documents

## Overview

The Virtual Documents guide demonstrates how to create read-only documents in VS Code from arbitrary sources using the text document content provider API.

## TextDocumentContentProvider

### Core Concept

The API works by claiming a URI scheme for which your provider then returns text contents. A single provider can serve multiple schemes, and multiple providers can register for one scheme.

### Registration

```typescript
vscode.workspace.registerTextDocumentContentProvider(myScheme, myProvider);
```

Returns a disposable that revokes the registration.

### Provider Implementation

```typescript
const myProvider = new (class implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    return cowsay.say({ text: uri.path });
  }
})();
```

The provider doesn't create URIs — its role is to provide contents given a URI.

### Usage Example

```typescript
vscode.commands.registerCommand('cowsay.say', async () => {
  let what = await vscode.window.showInputBox({ placeHolder: 'cow say?' });
  if (what) {
    let uri = vscode.Uri.parse('cowsay:' + what);
    let doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }
});
```

## Updating Virtual Documents

### EventEmitter Pattern

```typescript
const myProvider = new (class implements vscode.TextDocumentContentProvider {
  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    // provide content
  }
})();
```

Call `fire()` on the emitter with a URI to trigger re-provisioning.

## Adding Editor Commands

### Command Registration

```typescript
vscode.commands.registerCommand('cowsay.backwards', async () => {
  if (!vscode.window.activeTextEditor) return;
  let { document } = vscode.window.activeTextEditor;
  if (document.uri.scheme !== myScheme) return;

  let say = document.uri.path;
  let newSay = say.split('').reverse().join('');
  let newUri = document.uri.with({ path: newSay });
  await vscode.window.showTextDocument(newUri, { preview: false });
});
```

### Declarative Configuration

```json
{
  "contributes": {
    "menus": {
      "editor/title": [
        {
          "command": "cowsay.backwards",
          "group": "navigation",
          "when": "resourceScheme == cowsay"
        }
      ]
    }
  }
}
```

## Events and Visibility

Virtual documents are full citizens in VS Code — they appear in `onDidOpenTextDocument` and `onDidCloseTextDocument` events and are part of `vscode.workspace.textDocuments`. Extensions should verify document schemes before processing.

## File System API

For greater flexibility, the `FileSystemProvider` API enables implementing complete file systems with files, folders, binary data, and full CRUD operations.
