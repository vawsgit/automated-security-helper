---
title: "Extension Guide: Task Provider"
---

# VS Code Task Provider Guide

> Source: https://code.visualstudio.com/api/extension-guides/task-provider

## Overview

Task Providers allow VS Code extensions to automatically detect and provide tasks to users, rather than requiring manual definition in `tasks.json` files.

## Task Definition

Define task properties in `package.json`:

```json
{
  "contributes": {
    "taskDefinitions": [
      {
        "type": "rake",
        "required": ["task"],
        "properties": {
          "task": {
            "type": "string",
            "description": "The Rake task to customize"
          },
          "file": {
            "type": "string",
            "description": "The Rake file that provides the task"
          }
        },
        "when": "shellExecutionSupported"
      }
    ]
  }
}
```

Available `when` contexts:
- `shellExecutionSupported`
- `processExecutionSupported`
- `customExecutionSupported`

## Task Provider Implementation

Register providers using `vscode.tasks.registerTaskProvider()`:

```typescript
vscode.tasks.registerTaskProvider('rake', {
  provideTasks(): vscode.Task[] {
    // Return all available tasks
    return getRakeTasks();
  },
  resolveTask(task: vscode.Task): vscode.Task | undefined {
    // Resolve a specific task (performance optimization)
    return task;
  }
});
```

Two methods:
- **`provideTasks()`**: Returns all available tasks
- **`resolveTask()`**: Resolves a specific task; useful for performance optimization when a single task is needed

## Execution Types

### ShellExecution

Runs commands through the OS-specific shell:

```typescript
new vscode.ShellExecution('rake test');
```

### ProcessExecution

Directly invokes processes with controlled arguments:

```typescript
new vscode.ProcessExecution('rake', ['test']);
```

### CustomExecution

For complex scenarios requiring state management, extensive output handling, or intricate build system integration. Requires implementing the `Pseudoterminal` interface:

```typescript
new vscode.CustomExecution(async () => {
  return new MyPseudoterminal();
});
```

## Creating Task Objects

```typescript
const task = new vscode.Task(
  { type: 'rake', task: 'test' },          // task definition
  vscode.TaskScope.Workspace,               // scope
  'test',                                    // name
  'rake',                                    // source
  new vscode.ShellExecution('rake test')    // execution
);
```
