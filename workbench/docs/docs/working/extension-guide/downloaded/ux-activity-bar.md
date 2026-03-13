---
title: "UX Guidelines: Activity Bar"
---

# VS Code Activity Bar UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/activity-bar

## Overview

The Activity Bar functions as a fundamental navigation component within VS Code. Extension developers can contribute View Containers to this interface, appearing as Activity Bar Items that users may relocate to other areas like the Panel.

## Do's

- Select an icon that aligns with the standard Activity Bar item icon aesthetic
- Provide a straightforward, descriptive name for the associated View Container

## Don'ts

- Replicate existing icons already in use
- Utilize an Activity Bar item solely to launch a Webview Panel

## Implementation

Two primary contribution points:

1. **View Container contribution point** — Establishes the container structure within the Activity Bar

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "myExtension",
          "title": "My Extension",
          "icon": "resources/icon.svg"
        }
      ]
    }
  }
}
```

2. **View contribution point** — Defines the views contained within that container

```json
{
  "contributes": {
    "views": {
      "myExtension": [
        {
          "id": "myView",
          "name": "My View"
        }
      ]
    }
  }
}
```
