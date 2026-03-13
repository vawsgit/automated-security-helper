---
title: "Extension Guide: Notebook"
---

# VS Code Notebook API Guide

> Source: https://code.visualstudio.com/api/extension-guides/notebook

## Overview

The Notebook API enables VS Code extensions to display files as notebooks, execute code cells, and render outputs in diverse formats. This mirrors interfaces like Jupyter Notebook or Google Colab, integrated directly into VS Code.

## Architecture Components

A notebook comprises sequential cells and their outputs. Cells are either **Markdown** or **code** cells. Three key components work together:

1. **NotebookSerializer**: Reads/writes notebook files from the filesystem
2. **NotebookController**: Executes code cells and produces outputs
3. **NotebookRenderer**: Displays application-specific or interactive output formats

---

## NotebookSerializer

### Purpose

Deserializes file bytes into `NotebookData` (containing Markdown and code cells) and reverses this process for saving.

### package.json Contribution

```json
{
  "contributes": {
    "notebooks": [
      {
        "type": "my-notebook",
        "displayName": "My Notebook",
        "selector": [
          {
            "filenamePattern": "*.notebook"
          }
        ]
      }
    ]
  }
}
```

### Implementation

```typescript
import { TextDecoder, TextEncoder } from 'util';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer('my-notebook', new SampleSerializer())
  );
}

interface RawNotebook {
  cells: RawNotebookCell[];
}

interface RawNotebookCell {
  source: string[];
  cell_type: 'code' | 'markdown';
}

class SampleSerializer implements vscode.NotebookSerializer {
  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    var contents = new TextDecoder().decode(content);
    let raw: RawNotebookCell[];
    try {
      raw = (<RawNotebook>JSON.parse(contents)).cells;
    } catch {
      raw = [];
    }

    const cells = raw.map(
      item =>
        new vscode.NotebookCellData(
          item.cell_type === 'code'
            ? vscode.NotebookCellKind.Code
            : vscode.NotebookCellKind.Markup,
          item.source.join('\n'),
          item.cell_type === 'code' ? 'python' : 'markdown'
        )
    );
    return new vscode.NotebookData(cells);
  }

  async serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken
  ): Promise<Uint8Array> {
    let contents: RawNotebookCell[] = [];
    for (const cell of data.cells) {
      contents.push({
        cell_type: cell.kind === vscode.NotebookCellKind.Code ? 'code' : 'markdown',
        source: cell.value.split(/\r?\n/g)
      });
    }
    return new TextEncoder().encode(JSON.stringify(contents));
  }
}
```

---

## NotebookController

### Purpose

Executes code cells and produces outputs in various formats.

### Implementation

```typescript
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(new Controller());
}

class Controller {
  readonly controllerId = 'my-notebook-controller-id';
  readonly notebookType = 'my-notebook';
  readonly label = 'My Notebook';
  readonly supportedLanguages = ['python'];

  private readonly _controller: vscode.NotebookController;
  private _executionOrder = 0;

  constructor() {
    this._controller = vscode.notebooks.createNotebookController(
      this.controllerId,
      this.notebookType,
      this.label
    );
    this._controller.supportedLanguages = this.supportedLanguages;
    this._controller.supportsExecutionOrder = true;
    this._controller.executeHandler = this._execute.bind(this);
  }

  private _execute(
    cells: vscode.NotebookCell[],
    _notebook: vscode.NotebookDocument,
    _controller: vscode.NotebookController
  ): void {
    for (let cell of cells) {
      this._doExecution(cell);
    }
  }

  private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
    const execution = this._controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this._executionOrder;
    execution.start(Date.now());

    execution.replaceOutput([
      new vscode.NotebookCellOutput([
        vscode.NotebookCellOutputItem.text('Dummy output text!')
      ])
    ]);
    execution.end(true, Date.now());
  }
}
```

### Publishing Keywords

When publishing a controller separately, add `notebookKernel<ViewTypeUpperCamelCased>` to `keywords`.

---

## Output Types

### Text Output

```typescript
vscode.NotebookCellOutputItem.text('This is the output...');
```

### Error Output

```typescript
try {
  /* Some code */
} catch (error) {
  vscode.NotebookCellOutputItem.error(error);
}
```

### Rich Output

Multiple data representations by mimetype:

```typescript
execution.replaceOutput([new vscode.NotebookCellOutput([
  vscode.NotebookCellOutputItem.text('<b>Hello</b> World', 'text/html'),
  vscode.NotebookCellOutputItem.json({ hello: 'world' }),
  vscode.NotebookCellOutputItem.json(
    { 'custom-data-for-custom-renderer': 'data' },
    'application/custom'
  ),
])]);
```

### Native Mimetype Support

VS Code core renders: `application/javascript`, `text/html`, `image/svg+xml`, `text/markdown`, `image/png`, `image/jpeg`, `text/plain`

Code editor mimetypes: `text/x-json`, `text/x-javascript`, `text/x-html`, `text/x-rust`, `text/x-LANGUAGE_ID`

Custom mimetypes require a `NotebookRenderer`.

---

## NotebookRenderer

### Simple Non-Interactive Renderer

**package.json:**

```json
{
  "contributes": {
    "notebookRenderer": [
      {
        "id": "github-issue-renderer",
        "displayName": "GitHub Issue Renderer",
        "entrypoint": "./out/renderer.js",
        "mimeTypes": ["ms-vscode.github-issue-notebook/github-issue"]
      }
    ]
  }
}
```

**Renderer entrypoint:**

```typescript
import type { ActivationFunction } from 'vscode-notebook-renderer';

export const activate: ActivationFunction = context => ({
  renderOutputItem(data, element) {
    element.innerText = JSON.stringify(data.json());
  }
});
```

### Resource Cleanup

Use `disposeOutputItem` for cleanup when output is cleared or cells deleted.

### Interactive Notebooks (Extension Host Communication)

Configure `requiresMessaging` in renderer:

```json
{
  "notebookRenderer": [{
    "id": "output-editor-renderer",
    "requiresMessaging": "optional"
  }]
}
```

Messaging requirements:
- `always`: Messaging required; renderer only in extension hosts
- `optional`: Better with messaging, but not required
- `never`: No messaging needed

**Extension host message handler:**

```typescript
const messageChannel = notebooks.createRendererMessaging('output-editor-renderer');
messageChannel.onDidReceiveMessage(e => {
  if (e.message.request === 'showEditor') {
    // Launch editor
  }
});
```

---

## Supporting Debugging

Controllers for programming languages can implement debugging by:
- Directly implementing the Debug Adapter Protocol (DAP)
- Delegating/transforming DAP to existing debuggers
- Using existing unmodified debug extensions
