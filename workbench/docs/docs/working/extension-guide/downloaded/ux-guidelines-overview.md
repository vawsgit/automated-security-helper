---
title: UX Guidelines Overview
---

# VS Code UX Guidelines Overview

The UX Guidelines documentation provides best practices for creating extensions that integrate seamlessly with VS Code's native interface. The guidelines cover three primary areas: the overall UI architecture, recommendations for extension-contributed UI, and relevant guides with samples.

## Core Architecture: Containers and Items

VS Code's interface divides into two main concepts:

### Containers (Major UI Sections)

These larger interface sections render one or more items:

- **Activity Bar**: A core navigation surface where extensions contribute View Containers that render Views in the Primary Sidebar
- **Primary Sidebar**: Displays one or more Views associated with selected Activity Bar items
- **Secondary Sidebar**: Functions as an alternative surface for rendering View Containers; users can drag views here for customization
- **Editor**: Contains one or more Editor Groups; supports Custom Editors, Webviews, and Editor Actions
- **Panel**: Exposes View Containers with Views like Terminal and Problems; supports split layouts
- **Status Bar**: Provides contextual workspace and file information through Status Bar Items

### Items (UI Components)

Extensions add items to containers:

- **Views**: Contributed as Tree Views, Welcome Views, or Webview Views; draggable across interface areas
- **View Toolbar**: Displays View-specific action buttons
- **Sidebar Toolbar**: Exposes View Container-scoped actions
- **Editor Toolbar**: Contains editor-specific actions
- **Panel Toolbar**: Shows options for the currently selected View
- **Status Bar Items**: Left-scoped items target the workspace; right-scoped items target the active file

## Common UI Elements

- **Command Palette**: Extensions contribute Commands for quick functionality execution
- **Quick Picks**: Capture user input for single selection, multiple selections, or freeform text
- **Notifications**: Communicate information, warnings, errors, and progress indicators
- **Webviews**: Display custom content beyond VS Code's native API capabilities
- **Context Menus**: Enable location-specific actions and configuration
- **Walkthroughs**: Provide multi-step checklists with rich content for extension onboarding
- **Settings**: Allow users to configure extension-relevant options

> Source: https://code.visualstudio.com/api/ux-guidelines/overview
