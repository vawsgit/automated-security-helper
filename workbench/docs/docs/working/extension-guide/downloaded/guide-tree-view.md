---
title: "Extension Guide: Tree View"
---

# VS Code Tree View API Guide

> Source: https://code.visualstudio.com/api/extension-guides/tree-view

## Overview

The Tree View API enables extensions to display hierarchical content in VS Code's sidebar, conforming to built-in view styling. The guide demonstrates building a "Node Dependencies" extension as a working example.

## Core Steps for Implementation

### 1. Register in package.json

Declare a view contribution using `contributes.views`, specifying where it appears:

```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "nodeDependencies",
          "name": "Node Dependencies"
        }
      ]
    }
  }
}
```

Possible locations: `explorer`, `debug`, `scm`, `test`, or custom containers.

### 2. Implement TreeDataProvider

Two essential methods are required:

```typescript
class NodeDependenciesProvider implements vscode.TreeDataProvider<Dependency> {
  getChildren(element?: Dependency): Dependency[] {
    // Returns child elements for a given item or root
  }

  getTreeItem(element: Dependency): vscode.TreeItem {
    // Converts data into UI representation
  }
}
```

The `collapsibleState` property controls whether items display as collapsed, expanded, or leaf nodes.

### 3. Register the Provider

**Basic:**
```typescript
vscode.window.registerTreeDataProvider('nodeDependencies', provider);
```

**With programmatic access:**
```typescript
const treeView = vscode.window.createTreeView('nodeDependencies', {
  treeDataProvider: provider
});
```

## Key Features

### Updating Content

Implement `onDidChangeTreeData` event with an `EventEmitter` to refresh displayed data:

```typescript
private _onDidChangeTreeData = new vscode.EventEmitter<Dependency | undefined>();
readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

refresh(): void {
  this._onDidChangeTreeData.fire(undefined);
}
```

### View Containers

Custom containers organize related views in the activity bar or panel:

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "myContainer",
          "title": "My Container",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "myContainer": [
        {
          "id": "myView",
          "name": "My View"
        }
      ]
    }
  }
}
```

### Actions (View Title, Context Menu, Inline)

Commands integrate into three menu locations controlled via `when` clauses and context values:

```json
{
  "contributes": {
    "menus": {
      "view/title": [
        {
          "command": "myExtension.refresh",
          "when": "view == nodeDependencies",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "myExtension.editEntry",
          "when": "view == nodeDependencies && viewItem == dependency"
        }
      ]
    }
  }
}
```

### Welcome Content

The `viewsWelcome` contribution displays helpful messaging in empty views:

```json
{
  "contributes": {
    "viewsWelcome": [
      {
        "view": "nodeDependencies",
        "contents": "No dependencies found.\n[Add Dependency](command:myExtension.addDependency)"
      }
    ]
  }
}
```

### Activation

VS Code automatically emits `onView:${viewId}` activation events when users open contributed views, eliminating the need for manual activation declarations in modern versions.
