---
title: "UX Guidelines: Sidebars"
---

# VS Code Sidebars UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/sidebars

## Overview

The Primary and Secondary Sidebars contain one or more Views contributed by View Containers. Extensions can contribute Views to existing containers like Explorer or create entirely new View Containers.

## Do's

- Group related Views and content together
- Use clear, descriptive names for View Containers and Views

## Don'ts

- Use excessive View Containers (single container typically sufficient)
- Use excessive Views (3-5 maximum recommended for most screen sizes)
- Add content to Sidebar that could be a simple Command
- Repeat existing functionality

## Primary Sidebar

Extensions frequently contribute Views and View Containers to the Primary Sidebar due to high visibility. Exercise careful judgment when adding content, as excessive UI contributions create cluttered experiences.

## Secondary Sidebar

Functions as an auxiliary location for Views. While extensions cannot directly contribute Views to it by default, users can customize their layout by dragging Views from the Primary Sidebar or Panel.

## Sidebar Toolbars

**Default behavior (multiple Views):** Display a single `...` icon in the Sidebar Toolbar.

**Single View optimization:** The Sidebar consolidates UI to render all View-specific actions directly in the Toolbar, replacing the `...` button.

**Best practice:** Minimize actions to reduce clutter. Use existing product icons paired with descriptive Command names when possible.

## Related Resources

- View Container contribution point
- View contribution point
- View Actions extension guide
- Welcome View contribution point
- Tree View extension sample
- Webview View extension sample
- Welcome View extension sample
