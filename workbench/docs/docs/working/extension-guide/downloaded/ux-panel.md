---
title: "UX Guidelines: Panel"
---

# VS Code Panel UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/panel

## Overview

The Panel serves as a secondary display area for View Containers, offering additional horizontal space for supporting functionality.

## Do's

- Render Views benefiting from expanded horizontal space
- Use for Views providing supplementary features
- Apply existing product icons when available
- Provide clear, useful tooltips

## Don'ts

- Place Views requiring constant visibility (users frequently minimize panels)
- Render custom Webview content that fails to resize properly across containers
- Add excessive icon buttons (use Context Menus instead)
- Duplicate default Panel icons

## Panel Toolbar Behavior

The toolbar displays View-specific actions:
- **Single View**: Actions appear in the main toolbar
- **Multiple Views**: Each renders their own toolbar with tailored actions

## Implementation

```json
{
  "contributes": {
    "viewsContainers": {
      "panel": [
        {
          "id": "myPanelContainer",
          "title": "My Panel",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "myPanelContainer": [
        {
          "id": "myPanelView",
          "name": "My Panel View"
        }
      ]
    }
  }
}
```

## Related Resources

- View Container contribution point
- View contribution point
- View Actions extension guide
