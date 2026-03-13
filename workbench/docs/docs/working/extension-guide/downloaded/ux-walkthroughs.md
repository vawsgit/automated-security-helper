---
title: "UX Guidelines: Walkthroughs"
---

# VS Code Walkthroughs UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/walkthroughs

## Overview

Walkthroughs provide a consistent experience for onboarding users to an extension via a multi-step checklist featuring rich content.

## Do's

- Incorporate helpful imagery to provide context for each walkthrough step
- Ensure images display correctly across all color themes; prefer SVGs utilizing VS Code's Theme Colors
- Use the Visual Studio Code Color Mapper Figma plugin for efficient SVG theming
- Provide actionable items for each step, using verb-based language

## Don'ts

- Create walkthroughs with an excessive number of steps
- Implement multiple walkthroughs unless absolutely necessary

## Implementation

```json
{
  "contributes": {
    "walkthroughs": [
      {
        "id": "myExtension.welcome",
        "title": "Get Started with My Extension",
        "description": "Learn the basics of My Extension",
        "steps": [
          {
            "id": "openView",
            "title": "Open the My Extension View",
            "description": "Click the icon in the Activity Bar to open the My Extension view.\n[Open View](command:myExtension.openView)",
            "media": {
              "svg": "media/walkthrough-step1.svg",
              "altText": "My Extension view in the sidebar"
            },
            "completionEvents": [
              "onView:myView"
            ]
          },
          {
            "id": "runScan",
            "title": "Run Your First Scan",
            "description": "Click the scan button to analyze your workspace.\n[Run Scan](command:myExtension.runScan)",
            "media": {
              "svg": "media/walkthrough-step2.svg",
              "altText": "Running a scan"
            },
            "completionEvents": [
              "onCommand:myExtension.runScan"
            ]
          }
        ]
      }
    ]
  }
}
```

### SVG Theming

Use CSS variables in SVGs for theme-aware graphics:

```svg
<svg>
  <style>
    .foreground { fill: var(--vscode-editor-foreground); }
    .background { fill: var(--vscode-editor-background); }
  </style>
  <rect class="background" width="100" height="100"/>
  <text class="foreground" x="10" y="50">Hello</text>
</svg>
```

## Related Resources

- Walkthroughs contribution point
- VS Code Color Mapper (Figma plugin)
- SVG with Theme Color CSS variable example on GitHub
