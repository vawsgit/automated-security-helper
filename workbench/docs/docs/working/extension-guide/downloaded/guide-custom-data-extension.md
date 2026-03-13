---
title: "Extension Guide: Custom Data Extension"
---

# VS Code Custom Data Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/custom-data-extension

## Overview

The Custom Data format enables extension developers to enhance VS Code's HTML and CSS language capabilities without requiring code implementation. This provides a declarative method for extending language support through JSON configuration files.

## Contribution Points

Two primary contribution points:

- `contributes.html.customData`
- `contributes.css.customData`

## Implementation

Declare custom data in `package.json`:

```json
{
  "contributes": {
    "html": {
      "customData": ["./html.html-data.json"]
    },
    "css": {
      "customData": ["./css.css-data.json"]
    }
  }
}
```

## Language Support Features

When custom data files are loaded, VS Code provides:

- Auto-completion for defined entities
- Hover information for language constructs
- Enhanced HTML/CSS editing capabilities

## Custom Data File Format

### HTML Custom Data

```json
{
  "version": 1.1,
  "tags": [
    {
      "name": "my-element",
      "description": "A custom HTML element",
      "attributes": [
        {
          "name": "my-attr",
          "description": "A custom attribute"
        }
      ]
    }
  ]
}
```

### CSS Custom Data

```json
{
  "version": 1.1,
  "properties": [
    {
      "name": "my-property",
      "description": "A custom CSS property"
    }
  ],
  "atDirectives": [
    {
      "name": "@my-directive",
      "description": "A custom at-directive"
    }
  ]
}
```

## Additional Resources

The "custom-data-sample" in the microsoft/vscode-extension-samples repository provides practical implementation examples.
