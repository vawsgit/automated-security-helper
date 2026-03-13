---
title: "UX Guidelines: Editor Actions"
---

# VS Code Editor Actions UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/editor-actions

## Overview

Editor actions are interactive elements that display in the editor toolbar. They function as either quick-access icons or menu items beneath the overflow menu (`...`).

## Do's

- Display actions only when their context is relevant
- Select icons exclusively from the established icon library
- Assign secondary actions to the overflow menu

## Don'ts

- Include multiple icons
- Apply custom color schemes
- Incorporate emoji characters

## Implementation

```json
{
  "contributes": {
    "menus": {
      "editor/title": [
        {
          "command": "myExtension.openDiff",
          "when": "resourceScheme == file",
          "group": "navigation"
        }
      ]
    }
  }
}
```

Use `when` clauses to ensure actions only appear in relevant contexts.

## Related Resources

- Custom Editor extension guide
- Webview extension guide
- Custom Editor extension sample
- Webview extension sample
