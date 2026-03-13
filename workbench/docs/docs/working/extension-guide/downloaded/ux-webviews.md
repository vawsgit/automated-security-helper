---
title: "UX Guidelines: Webviews"
---

# VS Code Webviews UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/webviews

## Overview

Webviews provide fully customizable display options for functionality beyond standard VS Code API capabilities. They should only be deployed when absolutely necessary.

## Do's

- Implement webviews exclusively when other options prove insufficient
- Activate extensions contextually and appropriately
- Display webviews only in the active window
- Ensure all view elements support theming (use VS Code color tokens)
- Follow accessibility standards (color contrast, ARIA labels, keyboard navigation)
- Use command actions within toolbars and views

## Don'ts

- Show promotional content (upgrades, sponsorships)
- Create wizard interfaces
- Open across multiple windows
- Launch on extension updates (use Notifications instead)
- Include functionality unrelated to editor or workspace operations
- Duplicate existing features (Welcome, Settings, configuration)

## Webview Views

Webviews can be embedded within view containers (sidebars or panels) as webview views. Same guidance principles apply.

## Implementation Tips

- Use `@vscode/webview-ui-toolkit` for consistent VS Code styling
- Apply CSS variables for theme compatibility
- Test across all theme types (light, dark, high contrast)

## Related Resources

- Webview extension guide
- Webview extension samples
- Webview View extension sample
