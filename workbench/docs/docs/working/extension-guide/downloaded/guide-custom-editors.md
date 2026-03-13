---
title: "Extension Guide: Custom Editors"
---

# VS Code Custom Editors Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/custom-editors

## Core Purpose

Custom editors enable extensions to create fully customizable read/write editors that replace VS Code's standard text editor for specific resource types. Common applications include asset previews, WYSIWYG editors, and alternative data visualizations.

## Two Primary Editor Types

### CustomTextEditorProvider

Uses VS Code's standard `TextDocument` model for text-based formats. Simpler to implement since VS Code handles file operations automatically.

### CustomEditorProvider

Provides your own document model for binary formats or complex scenarios. Requires more implementation effort but offers greater flexibility.

## Implementation

### Contribution Point Configuration

```json
{
  "contributes": {
    "customEditors": [
      {
        "viewType": "myExtension.catScratch",
        "displayName": "Cat Scratch",
        "selector": [
          { "filenamePattern": "*.cscratch" }
        ],
        "priority": "default"
      }
    ]
  }
}
```

Properties:
- `viewType`: Unique identifier tying the declaration to implementation
- `displayName`: User-facing name in UI
- `selector`: Glob patterns matching applicable files
- `priority`: Controls whether the editor activates by default

## Architecture

The architecture separates concerns:
- **Webviews** (HTML/CSS/JavaScript) handle the UI
- **Document models** manage the underlying resource state
- Communication happens through **message passing**

## Lifecycle Management

- **Activation**: VS Code fires `onCustomEditor:VIEW_TYPE` when needed; extensions must register providers during this event
- **Multiple Instances**: One document can support multiple editor views (e.g., split editors), all backed by the same underlying model
- **Cleanup**: Extensions must handle `onDidDispose` events and implement resource cleanup when editors close

## Undo/Redo Support

For editable custom editors, implementations support undo/redo through `CustomDocumentEditEvent` objects containing `undo()` and `redo()` callbacks.

## Saving

Extensions must serialize document state and write to disk using workspace filesystem APIs.
