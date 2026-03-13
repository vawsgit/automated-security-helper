---
title: "UX Guidelines: Settings"
---

# VS Code Settings UX Guidelines

> Source: https://code.visualstudio.com/api/ux-guidelines/settings

## Overview

Settings are how a user can configure your extension. They include input boxes, booleans, dropdowns, lists, and key/value pairs.

## Do's

- Add default values to each setting
- Add clear descriptions to each setting
- Link to documentation for complicated settings
- Link to additional related settings
- Link to setting IDs when needing user configuration

## Don'ts

- Create custom settings pages/webviews
- Create lengthy descriptions

## Implementation

```json
{
  "contributes": {
    "configuration": {
      "title": "My Extension",
      "properties": {
        "myExtension.enableFeature": {
          "type": "boolean",
          "default": true,
          "description": "Enable the main feature of My Extension."
        },
        "myExtension.outputLevel": {
          "type": "string",
          "default": "normal",
          "enum": ["quiet", "normal", "verbose"],
          "enumDescriptions": [
            "Minimal output",
            "Standard output",
            "Detailed output with debug information"
          ],
          "description": "Controls the verbosity of extension output."
        },
        "myExtension.excludePaths": {
          "type": "array",
          "default": [],
          "items": {
            "type": "string"
          },
          "description": "List of paths to exclude from scanning. See [documentation](https://example.com/docs) for patterns."
        }
      }
    }
  }
}
```

### Setting Types

- **Boolean**: Toggle switches
- **String**: Free text input or enum dropdowns
- **Number**: Numeric input
- **Array**: List of values
- **Object**: Key/value pairs

### Linking to Settings

Reference settings in notifications or documentation using the setting ID format:

```typescript
vscode.window.showInformationMessage(
  'Configure output level in [settings](command:workbench.action.openSettings?%22myExtension.outputLevel%22).'
);
```

## Related Resources

- Configuration contribution point
