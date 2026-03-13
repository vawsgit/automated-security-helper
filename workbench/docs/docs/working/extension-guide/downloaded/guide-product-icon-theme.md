---
title: "Extension Guide: Product Icon Theme"
---

# VS Code Product Icon Theme Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/product-icon-theme

## Overview

Product icon themes allow developers to redefine built-in icons used throughout the VS Code editor interface. These icons appear in views, editors, hover tooltips, status bars, and breakpoints — but not file icons or extension-contributed icons.

**Technical Constraints**: Icons must use glyphs from icon fonts and are limited to single-color representations. The actual color derives from the active color theme.

## Implementation Steps

### 1. Extension Setup

Add a `productIconThemes` contribution point to `package.json`:

```json
{
  "contributes": {
    "productIconThemes": [
      {
        "id": "my-product-icons",
        "label": "My Product Icons",
        "path": "./product-icon-theme.json"
      }
    ]
  }
}
```

Properties:
- `id`: Unique identifier (used in settings)
- `label`: Display name for the theme picker
- `path`: Reference to the theme definition file

### 2. Theme Definition File

Create a JSON file containing:

**Font declarations**: Reference WOFF format fonts with weight and style properties.

**Icon definitions**: Map icon IDs to specific glyphs:

```json
{
  "fonts": [
    {
      "id": "my-font",
      "src": [{ "path": "./my-font.woff", "format": "woff" }],
      "weight": "normal",
      "style": "normal"
    }
  ],
  "iconDefinitions": {
    "chevron-down": {
      "fontCharacter": "\\E001",
      "fontId": "my-font"
    },
    "chevron-right": {
      "fontCharacter": "\\E002",
      "fontId": "my-font"
    }
  }
}
```

### 3. Development Workflow

- File naming convention: `*product-icon-theme.json` enables editor support
- Testing: Press F5 to launch an extension development host
- Live updates: Changes apply automatically on file save
- Theme switching: Use the "Preferences: Product Icon Theme" command

## Icon Inspection

To identify which icon ID corresponds to UI elements:
1. Open Developer Tools (Help > Toggle Developer Tools)
2. Use the inspect tool
3. Examine the element's class name (format: `codicon.codicon-[iconid]`)

## Resources

- Reference documentation includes a complete icon listing
- Sample repository: Product Color Theme sample extension available on GitHub
