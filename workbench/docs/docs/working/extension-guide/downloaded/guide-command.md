---
title: "Extension Guide: Commands"
---

# VS Code Commands Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/command

## Core Concepts

Commands are the mechanism by which extensions expose functionality to users, bind to actions in VS Code's UI, and implement internal logic.

## Using Commands

### Programmatic Execution

The `vscode.commands.executeCommand` API allows extensions to trigger commands:

```typescript
vscode.commands.executeCommand('editor.action.addCommentLine');
```

Some commands accept arguments and return results:

```typescript
const definitions = await vscode.commands.executeCommand(
  'vscode.executeDefinitionProvider',
  documentUri,
  position
);
```

### Command URIs

Commands can be invoked via special URI links using the `command:` scheme. These work in hover text, completion details, and webviews. Arguments are passed as JSON-encoded arrays appended to the URI.

**Security requirement:** Markdown strings containing command URIs must have `isTrusted` set to true, requiring proper input sanitization.

## Creating Commands

### Registration

```typescript
vscode.commands.registerCommand('myExtension.sayHello', () => {
  vscode.window.showInformationMessage('Hello!');
});
```

### User-Facing Commands

Expose commands in the Command Palette via `package.json`:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "myExtension.sayHello",
        "title": "Say Hello"
      }
    ]
  }
}
```

This enables discovery and automatic extension activation.

### Conditional Display

Use `menus.commandPalette` with `when` clauses to restrict Command Palette visibility:

```json
{
  "contributes": {
    "menus": {
      "commandPalette": [
        {
          "command": "myExtension.sayHello",
          "when": "editorLangId == markdown"
        }
      ]
    }
  }
}
```

### Enablement Control

Commands support an `enablement` property using when-clauses to enable/disable functionality across menus and keybindings.

### Custom Context

Extensions can define custom context variables using `setContext`:

```typescript
vscode.commands.executeCommand('setContext', 'myExtension.enabled', true);
```

## Naming Conventions

Effective command titles should:
- Use title-case capitalization
- Begin with action verbs
- Include target nouns
- Omit "command" from the title
