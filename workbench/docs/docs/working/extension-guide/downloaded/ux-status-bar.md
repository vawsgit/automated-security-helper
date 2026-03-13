---
title: "UX Guidelines: Status Bar"
---

# VS Code Status Bar UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/status-bar

## Overview

The Status Bar occupies the bottom of the VS Code workbench, displaying workspace-related information and actions. Items are organized into two groups:
- **Primary (left)**: Global/workspace items
- **Secondary (right)**: Contextual/file-specific items

Extension developers should exercise restraint when adding items, as multiple extensions contribute to this shared space.

## Do's

- Employ concise text labels
- Utilize icons sparingly and intentionally
- Reserve icons for universally recognizable metaphors
- Position globally-relevant items on the left side
- Position contextual items on the right side

## Don'ts

- Apply custom color schemes
- Include multiple icons without clear justification
- Add multiple items unless genuinely necessary

## Status Bar Item Types

### Standard Items

Display information or actions relevant to the entire workspace:

```typescript
const item = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  100 // priority
);
item.text = '$(git-branch) main';
item.command = 'myExtension.switchBranch';
item.show();
```

### Progress Items

For background operations requiring subtle progress indication — use a loading icon with optional spin animation:

```typescript
const item = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);
item.text = '$(sync~spin) Syncing...';
item.show();
```

For progress demanding user attention, use a progress notification instead.

### Error and Warning Items

Configure with warning or error background colors for high-visibility scenarios:

```typescript
item.backgroundColor = new vscode.ThemeColor(
  'statusBarItem.errorBackground'
);
```

Reserve for exceptional cases and blocking errors due to the prominence such styling creates.
