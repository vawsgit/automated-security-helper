---
title: "UX Guidelines: Quick Picks"
---

# VS Code Quick Picks UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/quick-picks

## Overview

Quick Picks serve as an easy way to perform actions and receive input from the user. They work well for configuration selection, content filtering, and list item picking.

## Do's

- Incorporate icons that establish clear visual metaphors
- Select icons that enhance clarity and help distinguish between items
- Display current items in the description field (when relevant)
- Provide brief supplementary context through the detail field
- Employ the multi-step pattern for sequences of basic inputs
- Offer an option to add new items when selecting from lists
- Include titles for multi-step quick picks
- Add titles for quick picks without text input
- Add titles for quick picks requesting text input (use placeholder for hints/examples)
- Add titles for quick picks with global buttons (e.g., refresh icon)

## Don'ts

- Replicate existing functionality
- Include titles when the placeholder adequately describes the purpose
- Use inputs without placeholders

## Multiple Steps

Configure quick picks with sequential steps for related-but-separate selections. The interface displays step indicators (e.g., "1/3") within the title.

**Avoid** using quick picks for extended flows with numerous steps — they don't function effectively as wizards.

## Multiple Selections

Implement multi-select quick picks for closely-related selections requiring one-step selection.

## Title

Title bars appear above the main input and selection UI, providing additional context. Avoid duplicating labels already in the input placeholder.

## Using Separators

Quick Pick items can organize into sections using separators (dividers with labels). Use separators when your extension features obvious groupings.

## API References

```typescript
// Simple quick pick
const result = await vscode.window.showQuickPick(['option1', 'option2'], {
  placeHolder: 'Select an option',
  title: 'My Quick Pick'
});

// Rich quick pick items
const items: vscode.QuickPickItem[] = [
  { label: 'Item 1', description: 'Current', detail: 'Additional context' },
  { label: 'Item 2', description: 'Default' }
];

// Multi-step quick pick
const quickPick = vscode.window.createQuickPick();
quickPick.title = 'Step 1 of 3';
quickPick.step = 1;
quickPick.totalSteps = 3;
```

## Related Resources

- Quick Pick API reference
- Quick Pick Item API reference
- Quick Pick extension sample
