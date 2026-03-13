---
title: "UX Guidelines: Context Menus"
---

# VS Code Context Menus UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/context-menus

## Overview

Menu items appear in views, actions, and right-click menus. It's important that the grouping of menus remain consistent.

## Do's

- Display actions when contextually appropriate
- Group similar actions together
- Organize large action groups into submenus

## Don'ts

- Show actions universally across every file without contextual relevance

## Implementation

```json
{
  "contributes": {
    "menus": {
      "editor/context": [
        {
          "command": "myExtension.copyPermalink",
          "when": "resourceScheme == file",
          "group": "9_cutcopypaste"
        }
      ],
      "explorer/context": [
        {
          "command": "myExtension.openInBrowser",
          "when": "resourceScheme == file",
          "group": "navigation"
        }
      ]
    }
  }
}
```

Use `when` clauses to ensure context menu items only appear when contextually relevant.

### Menu Groups

Standard groups for ordering:
- `navigation` — Top of the menu
- `1_modification` — Modification commands
- `9_cutcopypaste` — Cut/copy/paste commands

### Submenu Support

For large action groups:

```json
{
  "contributes": {
    "submenus": [
      {
        "id": "myExtension.submenu",
        "label": "My Extension"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "submenu": "myExtension.submenu",
          "group": "navigation"
        }
      ],
      "myExtension.submenu": [
        { "command": "myExtension.action1" },
        { "command": "myExtension.action2" }
      ]
    }
  }
}
```

## Related Resources

- Context Menu API reference (contribution points)
