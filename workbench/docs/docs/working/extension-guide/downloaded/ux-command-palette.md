---
title: "UX Guidelines: Command Palette"
---

# VS Code Command Palette UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/command-palette

## Overview

The Command Palette serves as the central hub for discovering and executing all commands within VS Code. Proper command naming and organization are essential for helping users locate functionality efficiently.

## Do's

- Implement keyboard shortcuts where contextually appropriate
- Use descriptive, clear command names that convey purpose
- Organize related commands under consistent category prefixes (e.g., "GitHub Issues: Create")

## Don'ts

- Override or conflict with existing keyboard shortcuts
- Include emojis within command naming conventions

## Command Naming Pattern

```json
{
  "contributes": {
    "commands": [
      {
        "command": "myExtension.doSomething",
        "title": "Do Something",
        "category": "My Extension"
      }
    ]
  }
}
```

This produces `My Extension: Do Something` in the Command Palette.

## Related Resources

- Commands API reference (contribution points)
- Commands extension guide
- Hello World extension sample
