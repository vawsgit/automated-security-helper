---
title: "UX Guidelines: Notifications"
---

# VS Code Notifications UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/notifications

## Overview

Notifications display brief information surfaced from the bottom right of the editor. Extensions should respect user attention by showing notifications only when truly necessary.

## Notification Types

- **Information** — General informational messages (`showInformationMessage`)
- **Warning** — Issues requiring user awareness (`showWarningMessage`)
- **Error** — Failure states that may need resolution (`showErrorMessage`)

## Decision Framework

Before displaying a notification, consider:
- For multi-step input: use a **quick pick**
- For single-step input: use a **modal dialog**
- For low-priority progress: use the **status bar**
- If user-triggered: find the right moment
- For multiple notifications: consolidate into one
- If not essential: consider showing nothing

## Do's

- Limit notifications to necessary scenarios only
- Include a "Do not show again" option for every notification
- Display one notification at a time
- Show a link to details (like logs) in progress scenarios
- Display information as operations progress
- Provide cancellation actions when applicable

## Don'ts

- Send repeated notifications
- Use notifications for promotional content
- Request feedback on first install
- Show actions without corresponding functionality
- Leave progress notifications running indefinitely
- Use modal dialogs for non-essential confirmations
- Display modals for non-user-initiated actions

## Progress Notifications

For indeterminate-duration operations:

```typescript
vscode.window.withProgress(
  {
    location: vscode.ProgressLocation.Notification,
    title: 'Setting up environment',
    cancellable: true
  },
  async (progress, token) => {
    token.onCancellationRequested(() => {
      // Handle cancellation
    });
    progress.report({ increment: 50, message: 'Halfway done...' });
    // Do work
  }
);
```

Best practices: link to detailed logs, show cancellation options. Prefer contextual progress within views or editors when possible.

## Modal Dialogs

Block external interactions until dismissed. Use only when immediate user action is required:

```typescript
const result = await vscode.window.showWarningMessage(
  'Are you sure?',
  { modal: true },
  'Always',
  'Yes',
  'Never'
);
```

Provide "Always" or "Never" options to reduce repeated confirmations.
