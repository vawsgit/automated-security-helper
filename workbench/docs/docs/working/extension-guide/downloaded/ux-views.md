---
title: "UX Guidelines: Views"
---

# VS Code Views UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/views

## Overview

Views function as containers of content that can appear in the Sidebar or Panel. They support Tree Views, Welcome Views, or Webview Views and can display View Actions. Users can rearrange views or move them between View Containers.

## Do's

- Leverage existing icons when available
- Apply file icons to language-related files
- Use Tree Views for data presentation
- Include icons on every View (for Activity Bar or Secondary Sidebar compatibility)
- Minimize the quantity of Views
- Keep View names concise
- Restrict custom Webview View usage

## Don'ts

- Duplicate existing capabilities
- Treat tree items as single-action buttons (avoid firing Commands on click)
- Employ custom Webview Views unnecessarily
- Use an Activity Bar Item to open a Webview directly in the Editor

## View Locations

Views can be positioned in:
- Existing View Containers (File Explorer, Source Control, Debug)
- Custom View Containers via the Activity Bar
- Panel

Views can be dragged to the Secondary Sidebar for flexibility.

## Tree Views

Guidelines:
- Apply descriptive labels for context
- Use product icons to differentiate item types
- Avoid using Tree View Items as command buttons
- Limit nesting depth unless necessary
- Restrict to three or fewer actions per item

## Welcome Views

When views are empty, welcome content guides users on extension usage.

**Do's:**
- Apply only when necessary
- Prefer links over buttons
- Reserve buttons for primary actions
- Use explicit link text indicating destination
- Keep content concise
- Minimize welcome view count and button quantity

**Don'ts:**
- Add unnecessary buttons
- Use for promotional content
- Employ generic text like "read more"

## Views With Progress

Display progress indicators by referencing the view's ID through the Progress API:

```typescript
vscode.window.withProgress(
  { location: { viewId: 'myView' } },
  async (progress) => {
    // Perform work
  }
);
```

## View Actions

View Toolbars expose View Actions. Use built-in product icons for visual consistency. Custom SVG icons available when needed.

## Related Resources

- View Container API reference
- View API reference
- View Actions extension guide
- Tree View extension sample
- Welcome View extension sample
- Webview View extension sample
