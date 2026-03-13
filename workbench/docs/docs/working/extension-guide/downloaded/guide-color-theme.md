---
title: "Extension Guide: Color Theme"
---

# VS Code Color Theme Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/color-theme

## Main Theme Categories

### Workbench Colors

UI elements from Activity Bar to Status Bar, customizable via `workbench.colorCustomizations`:

```json
{
  "workbench.colorCustomizations": {
    "titleBar.activeBackground": "#ff0000"
  }
}
```

### Syntax Colors

Source code highlighting using TextMate grammars and themes:

```json
{
  "editor.tokenColorCustomizations": {
    "comments": "#FF0000"
  }
}
```

## Creating a Theme Extension

### Scaffolding

1. Install Yeoman generator: `npm install -g yo generator-code`
2. Run `yo code` to scaffold a theme project
3. Generate a theme file from current settings using the Developer command palette
4. Optionally import existing TextMate `.tmTheme` files

### Theme File Structure

Theme files define:
- `colors` — Workbench color overrides
- `tokenColors` — TextMate token color rules
- `semanticTokenColors` — Semantic token overrides

## Testing & Publishing

- Press **F5** to launch an Extension Development Host for live preview
- Use the `vsce` tool to publish to the VS Code Marketplace
- Include "theme" in descriptions and set category to "Themes" for discoverability

## Advanced Features

### Custom Color IDs

Extensions can contribute custom color IDs through contribution points, making colors available for `workbench.colorCustomizations` autocomplete.

### Semantic Highlighting

TypeScript/JavaScript enriches syntax coloring based on language service data. Semantic tokens provide more accurate theming than TextMate scopes alone.
